
document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  const db = window.supabaseClient;

  const $ = (id) => document.getElementById(id);

  const els = {
    title: $("chapterTitle"),
    className: $("className"),
    subjectName: $("subjectName"),
    breadcrumbClass: $("breadcrumbClass"),
    breadcrumbSubject: $("breadcrumbSubject"),
    breadcrumbChapter: $("breadcrumbChapter"),
    message: $("pageMessage"),
    resourceGrid: $("resourceGrid"),
    back: $("backToChapters"),
    notes: $("notesLink"),
    pyqs: $("pyqsLink"),
    practice: $("practiceLink"),
    quiz: $("quizLink")
  };

  const params = new URLSearchParams(window.location.search);
  const chapterId = params.get("chapter");

  function showMessage(title, description, isError = false) {
    els.message.hidden = false;
    els.resourceGrid.hidden = true;

    els.message.className = "message" + (isError ? " error" : "");

    const heading = document.createElement("strong");
    heading.textContent = title;

    const paragraph = document.createElement("p");
    paragraph.textContent = description;

    els.message.replaceChildren(heading, paragraph);

    const backLink = document.createElement("a");
    backLink.href = "subjects.html";
    backLink.textContent = "← Back to Subjects";
    els.message.append(backLink);
  }

  function showResources() {
    els.message.hidden = true;
    els.resourceGrid.hidden = false;
  }

  function setResourceLinks(chapter) {
    const id = encodeURIComponent(chapter.id);

    // Each resource page receives the selected chapter ID.
    els.notes.href = `notes.html?chapter=${id}`;
    els.pyqs.href = `pyqs.html?chapter=${id}`;
    els.practice.href = `practice.html?chapter=${id}`;
    els.quiz.href = `quizzes.html?chapter=${id}`;
  }

  if (!db) {
    showMessage(
      "Connection error",
      "Supabase client nahi mila. Please js/supabase.js check karo.",
      true
    );
    return;
  }

  if (!chapterId) {
    els.title.textContent = "Chapter Not Selected";

    showMessage(
      "No chapter selected",
      "Please go back to your subject and select a chapter first."
    );
    return;
  }

  try {
    // Confirm that the student is logged in.
    const { data: authData, error: authError } = await db.auth.getUser();

    if (authError) throw authError;

    if (!authData?.user) {
      showMessage(
        "Login required",
        "Please log in to access your chapter resources."
      );

      window.location.href = "login.html";
      return;
    }

    // Load the selected chapter and its published hierarchy.
    const { data: chapter, error: chapterError } = await db
      .from("chapters")
      .select(`
        id,
        name,
        subject_id,
        is_published,
        subjects!inner (
          id,
          name,
          class_id,
          is_published,
          classes!inner (
            id,
            name,
            is_published
          )
        )
      `)
      .eq("id", chapterId)
      .eq("is_published", true)
      .eq("subjects.is_published", true)
      .eq("subjects.classes.is_published", true)
      .maybeSingle();

    if (chapterError) throw chapterError;

    if (!chapter) {
      els.title.textContent = "Chapter Unavailable";

      showMessage(
        "Chapter not found",
        "This chapter may be unpublished, unavailable, or the link may be invalid."
      );
      return;
    }

    const subject = chapter.subjects;
    const cls = subject?.classes;

    if (!subject || !cls) {
      showMessage(
        "Chapter details unavailable",
        "The subject or class linked to this chapter could not be found.",
        true
      );
      return;
    }

    // Display chapter and hierarchy information.
    els.title.textContent = chapter.name;
    els.className.textContent = cls.name;
    els.subjectName.textContent = subject.name;

    els.breadcrumbClass.textContent = cls.name;
    els.breadcrumbSubject.textContent = subject.name;
    els.breadcrumbChapter.textContent = chapter.name;

    // Return to the correct subject's chapter list.
    els.back.href = `chapters.html?subject=${encodeURIComponent(subject.id)}`;

    // Pass the selected chapter to each resource page.
    setResourceLinks(chapter);

    showResources();

  } catch (error) {
    console.error("Chapter page error:", error);

    els.title.textContent = "Unable to Load Chapter";

    showMessage(
      "Something went wrong",
      error.message || "Could not load this chapter. Please try again.",
      true
    );
  }
});
