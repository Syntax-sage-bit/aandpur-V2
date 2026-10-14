
(async function () {
  const supabase = window.supabaseClient;

  if (!supabase) {
    console.error("Supabase client is not initialized.");
    return;
  }

  const chapterButton = document.querySelector(
    '[data-demo="chapters"]'
  );

  if (!chapterButton) {
    console.error('Chapters button [data-demo="chapters"] not found.');
    return;
  }

  // Dashboard ke existing demo handler ko override karo.
  chapterButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    openChapterManager();
  }, true);

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function openChapterManager() {
    document.getElementById("chapterManagerModal")?.remove();

    const modal = document.createElement("div");
    modal.id = "chapterManagerModal";

    modal.style.cssText = `
      position:fixed;inset:0;z-index:9999;
      background:rgba(15,23,42,.65);overflow:auto;
      padding:24px;display:flex;align-items:flex-start;
      justify-content:center;
    `;

    modal.innerHTML = `
      <section style="
        background:white;width:100%;max-width:850px;
        margin:20px auto;padding:24px;border-radius:16px;
        color:#172033;box-shadow:0 20px 60px #0003;
      ">
        <div style="display:flex;justify-content:space-between;
          align-items:center;gap:12px;flex-wrap:wrap">
          <div>
            <h2 style="margin:0 0 6px">Chapter Management</h2>
            <p style="margin:0;color:#64748b">
              Add, edit and publish chapters
            </p>
          </div>
          <button id="closeChapterManager" type="button"
            style="padding:10px 14px;cursor:pointer">
            Close ✕
          </button>
        </div>

        <hr style="margin:20px 0;border:0;border-top:1px solid #e2e8f0">

        <form id="chapterForm">
          <input type="hidden" id="editingChapterId">

          <label for="chapterClass">Class</label>
          <select id="chapterClass" required style="width:100%;padding:12px;margin:7px 0 14px">
            <option value="">Loading classes...</option>
          </select>

          <label for="chapterSubject">Subject</label>
          <select id="chapterSubject" required disabled
            style="width:100%;padding:12px;margin:7px 0 14px">
            <option value="">Select subject</option>
          </select>

          <label for="chapterName">Chapter name</label>
          <input id="chapterName" required maxlength="200"
            placeholder="e.g. Electric Charges and Fields"
            style="box-sizing:border-box;width:100%;padding:12px;margin:7px 0 14px">

          <label style="display:flex;gap:8px;align-items:center;margin-bottom:16px">
            <input id="chapterPublished" type="checkbox" checked>
            Publish chapter for students
          </label>

          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button id="saveChapter" type="submit"
              style="background:#1d4ed8;color:white;border:0;border-radius:8px;padding:12px 18px;cursor:pointer">
              Add Chapter
            </button>
            <button id="cancelChapterEdit" type="button" hidden
              style="padding:12px 18px;cursor:pointer">
              Cancel Edit
            </button>
          </div>
        </form>

        <p id="chapterMessage" role="status"
          style="margin:16px 0;color:#334155;white-space:pre-wrap"></p>

        <hr style="margin:20px 0;border:0;border-top:1px solid #e2e8f0">

        <h3>Existing Chapters</h3>
        <div id="chapterList">Loading chapters...</div>
      </section>
    `;

    document.body.appendChild(modal);

    const $ = (id) => modal.querySelector("#" + id);
    const classSelect = $("chapterClass");
    const subjectSelect = $("chapterSubject");
    const form = $("chapterForm");
    const message = $("chapterMessage");
    const list = $("chapterList");
    const saveButton = $("saveChapter");

    function setMessage(text, isError = false) {
      message.textContent = text;
      message.style.color = isError ? "#b91c1c" : "#166534";
    }

    function addOption(select, value, label) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }

    async function loadClasses(selectedId = "") {
      classSelect.replaceChildren();
      addOption(classSelect, "", "Select class");

      const { data, error } = await supabase
        .from("classes")
        .select("id,name")
        .order("name");

      if (error) throw error;

      (data || []).forEach((item) =>
        addOption(classSelect, item.id, item.name)
      );

      classSelect.value = selectedId;
    }

    async function loadSubjects(classId, selectedId = "") {
      subjectSelect.replaceChildren();
      addOption(subjectSelect, "", "Select subject");
      subjectSelect.disabled = true;

      if (!classId) return;

      const { data, error } = await supabase
        .from("subjects")
        .select("id,name")
        .eq("class_id", classId)
        .order("name");

      if (error) throw error;

      (data || []).forEach((item) =>
        addOption(subjectSelect, item.id, item.name)
      );

      subjectSelect.disabled = false;
      subjectSelect.value = selectedId;
    }

    async function loadChapters() {
      list.textContent = "Loading chapters...";

      const { data, error } = await supabase
        .from("chapters")
        .select("id,name,subject_id,is_published")
        .order("name");

      if (error) throw error;

      if (!data?.length) {
        list.textContent = "No chapters added yet.";
        return;
      }

      const { data: subjects, error: subjectError } = await supabase
        .from("subjects")
        .select("id,name,class_id");

      if (subjectError) throw subjectError;

      const subjectMap = new Map(
        (subjects || []).map((item) => [item.id, item])
      );

      const { data: classes, error: classError } = await supabase
        .from("classes")
        .select("id,name");

      if (classError) throw classError;

      const classMap = new Map(
        (classes || []).map((item) => [item.id, item.name])
      );

      list.innerHTML = "";

      data.forEach((chapter) => {
        const subject = subjectMap.get(chapter.subject_id);
        const row = document.createElement("article");

        row.style.cssText = `
          border:1px solid #e2e8f0;border-radius:10px;
          padding:14px;margin:12px 0;
          display:flex;justify-content:space-between;
          align-items:center;gap:12px;flex-wrap:wrap;
        `;

        row.innerHTML = `
          <div>
            <strong>${escapeHTML(chapter.name)}</strong>
            <p style="margin:6px 0;color:#64748b;font-size:13px">
              ${escapeHTML(classMap.get(subject?.class_id) || "Unknown class")}
              → ${escapeHTML(subject?.name || "Unknown subject")}
            </p>
            <span style="font-size:12px;font-weight:600;color:${
              chapter.is_published ? "#15803d" : "#b45309"
            }">
              ${chapter.is_published ? "Published" : "Draft"}
            </span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" data-edit="${escapeHTML(chapter.id)}"
              style="padding:9px 12px;cursor:pointer">Edit</button>
            <button type="button" data-delete="${escapeHTML(chapter.id)}"
              style="padding:9px 12px;color:#b91c1c;cursor:pointer">Delete</button>
          </div>
        `;

        row.querySelector("[data-edit]").addEventListener("click", async () => {
          if (!subject) {
            setMessage("Subject not found for this chapter.", true);
            return;
          }

          try {
            await loadClasses(subject.class_id);
            await loadSubjects(subject.class_id, subject.id);

            $("editingChapterId").value = chapter.id;
            $("chapterName").value = chapter.name;
            $("chapterPublished").checked = chapter.is_published;
            saveButton.textContent = "Save Changes";
            $("cancelChapterEdit").hidden = false;
            setMessage("Editing chapter: " + chapter.name);

            form.scrollIntoView({ behavior: "smooth", block: "start" });
          } catch (error) {
            setMessage(error.message, true);
          }
        });

        row.querySelector("[data-delete]").addEventListener("click", async () => {
          if (!confirm(`Delete chapter "${chapter.name}"? Related notes or other records may prevent deletion.`)) return;

          try {
            const { error } = await supabase
              .from("chapters")
              .delete()
              .eq("id", chapter.id);

            if (error) throw error;

            setMessage("Chapter deleted successfully.");
            await loadChapters();
          } catch (error) {
            console.error(error);
            setMessage("Could not delete chapter: " + error.message, true);
          }
        });

        list.appendChild(row);
      });
    }

    function resetForm() {
      form.reset();
      $("editingChapterId").value = "";
      $("chapterPublished").checked = true;
      saveButton.textContent = "Add Chapter";
      $("cancelChapterEdit").hidden = true;
      subjectSelect.replaceChildren();
      addOption(subjectSelect, "", "Select subject");
      subjectSelect.disabled = true;
    }

    classSelect.addEventListener("change", async () => {
      try {
        await loadSubjects(classSelect.value);
      } catch (error) {
        setMessage("Could not load subjects: " + error.message, true);
      }
    });

    $("cancelChapterEdit").addEventListener("click", resetForm);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const id = $("editingChapterId").value;
      const subjectId = subjectSelect.value;
      const name = $("chapterName").value.trim();
      const isPublished = $("chapterPublished").checked;

      if (!classSelect.value || !subjectId || !name) {
        setMessage("Please select a class, subject and chapter name.", true);
        return;
      }

      saveButton.disabled = true;
      setMessage(id ? "Saving changes..." : "Adding chapter...");

      try {
        const payload = {
          subject_id: subjectId,
          name,
          is_published: isPublished
        };

        const result = id
          ? await supabase.from("chapters").update(payload).eq("id", id)
          : await supabase.from("chapters").insert(payload);

        if (result.error) throw result.error;

        setMessage(id ? "Chapter updated successfully." : "Chapter added successfully.");
        resetForm();
        await loadChapters();

        // Update dashboard statistics if that script exposes a reload event.
        window.dispatchEvent(new CustomEvent("aandpur:chapters-updated"));
      } catch (error) {
        console.error("Chapter save error:", error);
        setMessage("Could not save chapter: " + error.message, true);
      } finally {
        saveButton.disabled = false;
      }
    });

    $("closeChapterManager").addEventListener("click", () => modal.remove());

    modal.addEventListener("click", (event) => {
      if (event.target === modal) modal.remove();
    });

    try {
      await loadClasses();
      await loadChapters();
    } catch (error) {
      console.error("Chapter manager error:", error);
      setMessage("Could not load data: " + error.message, true);
      list.textContent = "Unable to load chapters.";
    }
  }
})();
