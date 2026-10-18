(() => {
  "use strict";

  const db = window.supabaseClient;
  const $ = (id) => document.getElementById(id);

  const els = {
    editor: $("questionEditor"),
    form: $("questionForm"),
    heading: $("editorHeading"),
    recordId: $("recordId"),
    classSelect: $("classSelect"),
    subjectSelect: $("subjectSelect"),
    chapterSelect: $("chapterSelect"),
    questionText: $("questionText"),
    optionA: $("optionA"),
    optionB: $("optionB"),
    optionC: $("optionC"),
    optionD: $("optionD"),
    correctAnswer: $("correctAnswer"),
    difficulty: $("difficulty"),
    marks: $("marks"),
    explanation: $("explanation"),
    sourceType: $("sourceType"),
    isPublished: $("isPublished"),
    examName: $("examName"),
    examYear: $("examYear"),
    pyqSolution: $("pyqSolution"),
    quizSelect: $("quizSelect"),
    save: $("saveQuestionBtn"),
    formMessage: $("formMessage"),
    list: $("questionsList"),
    listMessage: $("questionsMessage"),
    search: $("searchQuestions"),
    classFilter: $("classFilter"),
    statusFilter: $("statusFilter"),
    listHeading: $("listHeading")
  };

  let currentUser = null;
  let allClasses = [];
  let allSubjects = [];
  let allChapters = [];
  let allQuizzes = [];
  let practiceRows = [];
  let quizRows = [];
  let pyqRows = [];
  let activeTab = "practice";
  let busy = false;

  const tableByTab = {
    practice: "practice_questions",
    quiz: "questions",
    pyq: "pyqs"
  };

  function setMessage(message, isError = false) {
    els.formMessage.textContent = message;
    els.formMessage.style.color = isError ? "#b42318" : "";
  }

  function setBusy(value) {
    busy = value;
    els.save.disabled = value;
    els.save.textContent = value
      ? "Saving…"
      : (els.recordId.value ? "Update question" : "Save question");
  }

  function setOptions(select, rows, placeholder, labelFn) {
    select.replaceChildren(new Option(placeholder, ""));
    rows.forEach((row) => {
      select.add(new Option(labelFn(row), row.id));
    });
  }

  function byId(rows, id) {
    return rows.find((row) => row.id === id);
  }

  function currentRows() {
    if (activeTab === "practice") return practiceRows;
    if (activeTab === "quiz") return quizRows;
    return pyqRows;
  }

  function chapterInfo(chapterId) {
    const chapter = byId(allChapters, chapterId);
    const subject = chapter && byId(allSubjects, chapter.subject_id);
    const cls = subject && byId(allClasses, subject.class_id);

    return {
      chapter: chapter?.name || "Unknown chapter",
      subject: subject?.name || "Unknown subject",
      className: cls?.name || "Unknown class",
      classId: cls?.id || ""
    };
  }

  function publishedHierarchy(chapterId) {
    const chapter = byId(allChapters, chapterId);
    const subject = chapter && byId(allSubjects, chapter.subject_id);
    const cls = subject && byId(allClasses, subject.class_id);

    return Boolean(
      chapter?.is_published === true &&
      subject?.is_published === true &&
      cls?.is_published === true
    );
  }

  async function checkAdmin() {
    const { data, error } = await db.auth.getUser();

    if (error || !data.user) {
      window.location.href = "login.html";
      throw new Error("Please log in as an administrator.");
    }

    currentUser = data.user;

    const { data: admin, error: adminError } = await db
      .from("admin_users")
      .select("user_id")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (adminError || !admin) {
      document.querySelector(".questions-page").innerHTML =
        "<h1>Access denied</h1><p>This page is only available to administrators.</p>";

      throw new Error("Your account is not registered as an administrator.");
    }
  }

  async function loadHierarchy() {
    const [classResult, subjectResult, chapterResult, quizResult] =
      await Promise.all([
        db.from("classes")
          .select("id,name,is_published")
          .order("name"),

        db.from("subjects")
          .select("id,class_id,name,is_published")
          .order("name"),

        db.from("chapters")
          .select("id,subject_id,name,is_published")
          .order("name"),

        db.from("quizzes")
          .select("id,title,chapter_id")
          .order("title")
      ]);

    for (const result of [
      classResult,
      subjectResult,
      chapterResult,
      quizResult
    ]) {
      if (result.error) throw result.error;
    }

    allClasses = classResult.data || [];
    allSubjects = subjectResult.data || [];
    allChapters = chapterResult.data || [];
    allQuizzes = quizResult.data || [];

    setOptions(
      els.classSelect,
      allClasses,
      "Select class",
      (row) => row.name
    );

    setOptions(els.subjectSelect, [], "Select subject", (row) => row.name);
    setOptions(els.chapterSelect, [], "Select chapter", (row) => row.name);

    els.subjectSelect.disabled = true;
    els.chapterSelect.disabled = true;

    els.classFilter.replaceChildren(new Option("All classes", "all"));

    allClasses.forEach((row) => {
      els.classFilter.add(new Option(row.name, row.id));
    });

    setOptions(
      els.quizSelect,
      allQuizzes,
      "Do not link to a quiz",
      (row) => row.title
    );
  }

  function updateSubjects(selectedSubjectId = "") {
    const rows = allSubjects.filter(
      (subject) => subject.class_id === els.classSelect.value
    );

    setOptions(els.subjectSelect, rows, "Select subject", (row) => row.name);
    els.subjectSelect.disabled = !els.classSelect.value;

    els.subjectSelect.value = rows.some(
      (row) => row.id === selectedSubjectId
    ) ? selectedSubjectId : "";

    updateChapters();
  }

  function updateChapters(selectedChapterId = "") {
    const rows = allChapters.filter(
      (chapter) => chapter.subject_id === els.subjectSelect.value
    );

    setOptions(els.chapterSelect, rows, "Select chapter", (row) => row.name);
    els.chapterSelect.disabled = !els.subjectSelect.value;

    els.chapterSelect.value = rows.some(
      (row) => row.id === selectedChapterId
    ) ? selectedChapterId : "";
  }

  function tabName(tab) {
    if (tab === "practice") return "Practice Questions";
    if (tab === "quiz") return "Quiz MCQs";
    return "PYQs";
  }

  function configureTab() {
    const isMCQ = activeTab !== "pyq";

    $("mcqFields").hidden = !isMCQ;
    $("marksField").hidden = activeTab !== "quiz";
    $("explanationField").hidden = activeTab === "pyq";
    $("sourceField").hidden = activeTab !== "practice";
    $("publishedField").hidden = activeTab !== "quiz";
    $("examField").hidden = activeTab !== "pyq";
    $("yearField").hidden = activeTab !== "pyq";
    $("solutionField").hidden = activeTab !== "pyq";
    $("quizSelectField").hidden = activeTab !== "quiz";

    els.heading.textContent = els.recordId.value
      ? "Edit " + tabName(activeTab).toLowerCase()
      : "Create " + tabName(activeTab).toLowerCase();

    els.listHeading.textContent = tabName(activeTab);

    els.questionText.required = true;

    [
      els.optionA,
      els.optionB,
      els.optionC,
      els.optionD,
      els.correctAnswer
    ].forEach((element) => {
      element.required = isMCQ;
    });

    els.examName.required = activeTab === "pyq";
    els.save.textContent = els.recordId.value
      ? "Update question"
      : "Save question";
  }

  function resetForm(hide = false) {
    els.form.reset();
    els.recordId.value = "";
    els.marks.value = "1";
    els.difficulty.value = "medium";
    els.isPublished.value = "true";

    els.classSelect.value = "";
    updateSubjects();

    els.subjectSelect.value = "";
    updateChapters();

    setMessage("");
    configureTab();

    if (hide) {
      els.editor.hidden = true;
    }
  }

  function setCount() {
    $("practiceCount").textContent = practiceRows.length;
    $("quizCount").textContent = quizRows.length;
    $("pyqCount").textContent = pyqRows.length;
  }

  async function loadRows() {
    els.listMessage.textContent = "Loading questions…";
    els.list.replaceChildren();

    const [practiceResult, quizResult, pyqResult] = await Promise.all([
      db.from("practice_questions")
        .select(
          "id,chapter_id,question,options,correct_answer,explanation,difficulty,created_at"
        )
        .order("created_at", { ascending: false }),

      db.from("questions")
        .select(
          "id,chapter_id,question_text,question_type,options,correct_answer,explanation,difficulty,marks,source,source_type,exam_year,is_published,created_at"
        )
        .order("created_at", { ascending: false }),

      db.from("pyqs")
        .select("id,chapter_id,question,year,exam,solution,created_at")
        .order("created_at", { ascending: false })
    ]);

    for (const result of [
      practiceResult,
      quizResult,
      pyqResult
    ]) {
      if (result.error) throw result.error;
    }

    practiceRows = practiceResult.data || [];
    quizRows = quizResult.data || [];
    pyqRows = pyqResult.data || [];

    setCount();
    renderRows();
  }

  function normalOptions(row) {
    if (Array.isArray(row.options)) return row.options;

    if (row.options && typeof row.options === "object") {
      return Object.values(row.options);
    }

    return [];
  }

  function rowQuestion(row) {
    return activeTab === "quiz"
      ? row.question_text
      : row.question;
  }

  function rowStatus(row) {
    if (activeTab === "quiz") {
      return row.is_published === false ? "draft" : "published";
    }

    return "published";
  }

  function renderRows() {
    const query = els.search.value.trim().toLowerCase();
    const classId = els.classFilter.value;
    const status = els.statusFilter.value;

    const filtered = currentRows().filter((row) => {
      const location = chapterInfo(row.chapter_id);

      const searchable = [
        rowQuestion(row),
        row.exam,
        row.year,
        row.explanation,
        row.solution,
        location.chapter,
        location.subject,
        location.className
      ].filter(Boolean).join(" ").toLowerCase();

      return searchable.includes(query) &&
        (classId === "all" || location.classId === classId) &&
        (status === "all" || rowStatus(row) === status);
    });

    els.list.replaceChildren();

    if (!filtered.length) {
      els.listMessage.textContent = "";

      const empty = document.createElement("div");
      empty.className = "question-empty";
      empty.textContent = currentRows().length
        ? "No questions match these filters."
        : `No ${tabName(activeTab).toLowerCase()} yet. Use “Add question” to create one.`;

      els.list.append(empty);
      return;
    }

    els.listMessage.textContent = `${filtered.length} question(s)`;

    filtered.forEach((row) => {
      const location = chapterInfo(row.chapter_id);

      const card = document.createElement("article");
      card.className = "question-row";

      const main = document.createElement("div");
      main.className = "question-main";

      const title = document.createElement("h3");
      title.textContent = rowQuestion(row) || "(No question text)";

      const hierarchy = document.createElement("p");
      hierarchy.textContent =
        `${location.className} / ${location.subject} / ${location.chapter}`;

      main.append(title, hierarchy);

      if (activeTab === "pyq") {
        const exam = document.createElement("p");
        exam.textContent =
          `${row.exam || "Exam not specified"}${row.year ? " · " + row.year : ""}`;

        const solution = document.createElement("p");
        solution.textContent = row.solution
          ? `Solution: ${row.solution}`
          : "No solution added.";

        main.append(exam, solution);
      } else {
        const options = normalOptions(row);

        if (options.length) {
          const optionText = document.createElement("p");

          optionText.textContent = "Options: " + options.map((option, index) => {
            const value = typeof option === "string"
              ? option
              : (option?.text || JSON.stringify(option));

            return `${String.fromCharCode(65 + index)}. ${value}`;
          }).join(" | ");

          main.append(optionText);
        }

        const answer = document.createElement("p");
        answer.textContent =
          `Answer: ${row.correct_answer || "Not set"}` +
          `${row.difficulty ? " · " + row.difficulty : ""}`;

        main.append(answer);

        if (row.explanation) {
          const explanation = document.createElement("p");
          explanation.textContent = `Explanation: ${row.explanation}`;
          main.append(explanation);
        }
      }

      const meta = document.createElement("div");
      meta.className = "question-meta";

      const type = document.createElement("span");
      type.className = "question-tag";
      type.textContent = tabName(activeTab);
      meta.append(type);

      const statusTag = document.createElement("span");
      statusTag.className =
        `question-tag ${rowStatus(row) === "draft" ? "draft" : "published"}`;
      statusTag.textContent =
        rowStatus(row) === "draft" ? "Draft" : "Available";

      meta.append(statusTag);
      main.append(meta);

      const actions = document.createElement("div");
      actions.className = "question-actions";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => editRow(row.id));
      actions.append(edit);

      if (activeTab === "quiz") {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.textContent =
          row.is_published === false ? "Publish" : "Unpublish";
        toggle.addEventListener("click", () => toggleQuestion(row));
        actions.append(toggle);
      }

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete-question";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => deleteRow(row));
      actions.append(remove);

      card.append(main, actions);
      els.list.append(card);
    });
  }

  function parseOptionsFromRow(row) {
    const options = normalOptions(row);

    const values = options.map((option) =>
      typeof option === "string" ? option : (option?.text || "")
    );

    return [
      values[0] || "",
      values[1] || "",
      values[2] || "",
      values[3] || ""
    ];
  }

  function editRow(id) {
    const row = currentRows().find((item) => item.id === id);
    if (!row) return;

    els.recordId.value = row.id;

    const chapter = byId(allChapters, row.chapter_id);
    const subject = chapter && byId(allSubjects, chapter.subject_id);

    if (!chapter || !subject) {
      alert("This question's chapter or subject could not be found.");
      return;
    }

    els.classSelect.value = subject.class_id;
    updateSubjects(subject.id);
    updateChapters(chapter.id);

    els.questionText.value =
      activeTab === "quiz"
        ? row.question_text || ""
        : row.question || "";

    if (activeTab !== "pyq") {
      const options = parseOptionsFromRow(row);

      [
        els.optionA,
        els.optionB,
        els.optionC,
        els.optionD
      ].forEach((element, index) => {
        element.value = options[index];
      });

      const rawAnswer = String(row.correct_answer || "").trim();
      const letterMatch = rawAnswer.match(/^([A-D])$/i);

      let answerLetter = letterMatch
        ? letterMatch[1].toUpperCase()
        : "";

      if (!answerLetter) {
        const index = options.findIndex(
          (option) => option && option === rawAnswer
        );

        if (index >= 0) {
          answerLetter = String.fromCharCode(65 + index);
        }
      }

      els.correctAnswer.value = answerLetter;
      els.difficulty.value = row.difficulty || "medium";
      els.explanation.value = row.explanation || "";

      if (activeTab === "practice") {
        els.sourceType.value = row.source_type || row.source || "custom";
      } else {
        els.marks.value = row.marks || 1;
        els.isPublished.value =
          row.is_published === false ? "false" : "true";
      }
    } else {
      els.examName.value = row.exam || "";
      els.examYear.value = row.year || "";
      els.pyqSolution.value = row.solution || "";
    }

    els.quizSelect.value = "";
    els.editor.hidden = false;

    configureTab();
    setMessage("");
    els.save.textContent = "Update question";

    els.editor.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function getQuestionOptions() {
    const values = [
      els.optionA.value,
      els.optionB.value,
      els.optionC.value,
      els.optionD.value
    ].map((value) => value.trim());

    if (values.some((value) => !value)) {
      throw new Error("Please fill all four options.");
    }

    if (!els.correctAnswer.value) {
      throw new Error("Please choose the correct answer.");
    }

    return {
      values,
      answer: els.correctAnswer.value
    };
  }

  async function saveRow(event) {
    event.preventDefault();
    if (busy) return;

    try {
      setBusy(true);
      setMessage("Saving…");

      const chapterId = els.chapterSelect.value;
      const question = els.questionText.value.trim();
      const existingId = els.recordId.value;

      if (!chapterId) {
        throw new Error("Please select a chapter.");
      }

      if (!question) {
        throw new Error("Please enter the question.");
      }

      let result;

      if (activeTab === "pyq") {
        if (!els.examName.value.trim()) {
          throw new Error("Please enter the exam name.");
        }

        const payload = {
          chapter_id: chapterId,
          question,
          exam: els.examName.value.trim(),
          year: els.examYear.value
            ? Number(els.examYear.value)
            : null,
          solution: els.pyqSolution.value.trim() || null
        };

        result = existingId
          ? await db.from("pyqs")
              .update(payload)
              .eq("id", existingId)
              .select("id")
              .single()
          : await db.from("pyqs")
              .insert(payload)
              .select("id")
              .single();
      } else {
        const { values, answer } = getQuestionOptions();
        const correct = values[answer.charCodeAt(0) - 65];
        const options = values;

        if (activeTab === "practice") {
          const payload = {
            chapter_id: chapterId,
            question,
            options,
            correct_answer: correct,
            explanation: els.explanation.value.trim() || null,
            difficulty: els.difficulty.value
          };

          result = existingId
            ? await db.from("practice_questions")
                .update(payload)
                .eq("id", existingId)
                .select("id")
                .single()
            : await db.from("practice_questions")
                .insert(payload)
                .select("id")
                .single();
        } else {
          if (
            els.isPublished.value === "true" &&
            !publishedHierarchy(chapterId)
          ) {
            throw new Error(
              "Publish the selected class, subject and chapter before publishing this question."
            );
          }

          const payload = {
            chapter_id: chapterId,
            question_text: question,
            question_type: "mcq",
            options,
            correct_answer: correct,
            explanation: els.explanation.value.trim() || null,
            difficulty: els.difficulty.value,
            marks: Math.max(
              1,
              Number.parseInt(els.marks.value, 10) || 1
            ),
            source: "custom",
            source_type: els.sourceType.value,
            is_published: els.isPublished.value === "true"
          };

          result = existingId
            ? await db.from("questions")
                .update(payload)
                .eq("id", existingId)
                .select("id")
                .single()
            : await db.from("questions")
                .insert(payload)
                .select("id")
                .single();

          if (!result.error && els.quizSelect.value) {
            const questionId = result.data.id;

            const { error: linkError } = await db
              .from("quiz_questions")
              .upsert({
                quiz_id: els.quizSelect.value,
                question_id: questionId,
                question_order: 1
              }, {
                onConflict: "quiz_id,question_id"
              });

            if (linkError) {
              throw new Error(
                "Question saved, but it could not be linked to the quiz: " +
                linkError.message
              );
            }
          }
        }
      }

      if (result.error) throw result.error;

      setMessage("Saved successfully.");
      resetForm(true);
      await loadRows();
    } catch (error) {
      console.error("Saving question failed:", error);
      setMessage(error.message || "Could not save question.", true);
    } finally {
      setBusy(false);
    }
  }

  async function toggleQuestion(row) {
    const next = row.is_published === false;

    if (next && !publishedHierarchy(row.chapter_id)) {
      alert("Publish the class, subject and chapter before publishing this question.");
      return;
    }

    if (!confirm(
      next
        ? "Publish this question for students?"
        : "Unpublish this question?"
    )) {
      return;
    }

    const { error } = await db
      .from("questions")
      .update({ is_published: next })
      .eq("id", row.id);

    if (error) {
      alert("Could not update question: " + error.message);
      return;
    }

    await loadRows();
  }

  async function deleteRow(row) {
    if (!confirm("Delete this question? This action cannot be undone.")) {
      return;
    }

    const table = tableByTab[activeTab];

    if (activeTab === "quiz") {
      const { error: linkError } = await db
        .from("quiz_questions")
        .delete()
        .eq("question_id", row.id);

      if (linkError) {
        alert("Could not remove quiz links: " + linkError.message);
        return;
      }
    }

    const { error } = await db
      .from(table)
      .delete()
      .eq("id", row.id);

    if (error) {
      alert("Could not delete question: " + error.message);
      return;
    }

    await loadRows();
  }

  function switchTab(tab) {
    activeTab = tab;

    document.querySelectorAll(".question-tab").forEach((button) => {
      const selected = button.dataset.tab === tab;

      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
    });

    els.statusFilter.hidden = tab !== "quiz";
    els.statusFilter.value = "all";
    els.search.value = "";

    resetForm(true);
    els.editor.hidden = true;

    configureTab();
    renderRows();
  }

  function wireEvents() {
    els.classSelect.addEventListener("change", () => updateSubjects());
    els.subjectSelect.addEventListener("change", () => updateChapters());
    els.form.addEventListener("submit", saveRow);

    $("newQuestionBtn").addEventListener("click", () => {
      resetForm(false);
      els.editor.hidden = false;

      els.editor.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });

    $("cancelEditBtn").addEventListener("click", () => {
      resetForm(true);
    });

    $("refreshQuestionsBtn").addEventListener("click", async () => {
      try {
        await loadHierarchy();
        await loadRows();
      } catch (error) {
        console.error(error);
        els.listMessage.textContent =
          error.message || "Could not refresh questions.";
      }
    });

    els.search.addEventListener("input", renderRows);
    els.classFilter.addEventListener("change", renderRows);
    els.statusFilter.addEventListener("change", renderRows);

    document.querySelectorAll(".question-tab").forEach((button) => {
      button.addEventListener("click", () => {
        switchTab(button.dataset.tab);
      });
    });
  }

  async function init() {
    if (!db) {
      els.listMessage.textContent =
        "Supabase client was not initialized. Check js/supabase.js.";
      return;
    }

    try {
      await checkAdmin();
      wireEvents();
      await loadHierarchy();
      await loadRows();

      els.editor.hidden = true;
      configureTab();
    } catch (error) {
      console.error("Question manager initialization failed:", error);
      els.listMessage.textContent =
        error.message || "Could not load question manager.";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();