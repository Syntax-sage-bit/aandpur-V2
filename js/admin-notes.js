
(() => {
  "use strict";

  const db = window.supabaseClient;
  const BUCKET = "chapter-notes";
  const MAX_FILE_SIZE = 20 * 1024 * 1024;

  const $ = (id) => document.getElementById(id);

  const els = {
    form: $("noteForm"),
    editor: $("noteEditor"),
    editorHeading: $("editorHeading"),
    noteId: $("noteId"),
    classSelect: $("classSelect"),
    subjectSelect: $("subjectSelect"),
    chapterSelect: $("chapterSelect"),
    title: $("noteTitle"),
    description: $("noteDescription"),
    content: $("noteContent"),
    sortOrder: $("sortOrder"),
    file: $("pdfFile"),
    fileHint: $("currentFileHint"),
    status: $("noteStatus"),
    formMessage: $("formMessage"),
    save: $("saveDraftBtn"),
    notesList: $("notesList"),
    notesMessage: $("notesMessage"),
    search: $("searchNotes"),
    statusFilter: $("statusFilter"),
    total: $("totalNotes"),
    published: $("publishedNotes"),
    drafts: $("draftNotes")
  };

  let currentUser = null;
  let allClasses = [];
  let allSubjects = [];
  let allChapters = [];
  let allNotes = [];
  let currentFilePath = null;
  let busy = false;

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function setFormMessage(message, isError = false) {
    els.formMessage.textContent = message;
    els.formMessage.style.color = isError ? "#b42318" : "";
  }

  function setBusy(value) {
    busy = value;
    els.save.disabled = value;
    els.save.textContent = value ? "Saving…" : "Save note";
  }

  function setOptions(select, rows, placeholder, labelFn) {
    select.replaceChildren(new Option(placeholder, ""));
    rows.forEach((row) => {
      select.add(new Option(labelFn(row), row.id));
    });
  }

  function getById(rows, id) {
    return rows.find((row) => row.id === id);
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
      document.querySelector(".notes-page").innerHTML =
        "<h1>Access denied</h1><p>This page is only available to administrators.</p>";
      throw new Error("Your account is not registered as an administrator.");
    }
  }

  async function loadHierarchy() {
    const [classResult, subjectResult, chapterResult] = await Promise.all([
      db.from("classes").select("id,name,is_published").order("name"),
      db.from("subjects").select("id,class_id,name,is_published").order("name"),
      db.from("chapters").select("id,subject_id,name,is_published").order("name")
    ]);

    if (classResult.error) throw classResult.error;
    if (subjectResult.error) throw subjectResult.error;
    if (chapterResult.error) throw chapterResult.error;

    allClasses = classResult.data || [];
    allSubjects = subjectResult.data || [];
    allChapters = chapterResult.data || [];

    setOptions(els.classSelect, allClasses, "Select class", (row) => row.name);
    setOptions(els.subjectSelect, [], "Select subject", (row) => row.name);
    setOptions(els.chapterSelect, [], "Select chapter", (row) => row.name);

    els.subjectSelect.disabled = true;
    els.chapterSelect.disabled = true;
  }

  function updateSubjects(selectedSubjectId = "") {
    const classId = els.classSelect.value;
    const subjects = allSubjects.filter((subject) => subject.class_id === classId);

    setOptions(els.subjectSelect, subjects, "Select subject", (row) => row.name);
    els.subjectSelect.disabled = !classId;
    els.subjectSelect.value = subjects.some((s) => s.id === selectedSubjectId)
      ? selectedSubjectId : "";

    updateChapters();
  }

  function updateChapters(selectedChapterId = "") {
    const subjectId = els.subjectSelect.value;
    const chapters = allChapters.filter((chapter) => chapter.subject_id === subjectId);

    setOptions(els.chapterSelect, chapters, "Select chapter", (row) => row.name);
    els.chapterSelect.disabled = !subjectId;
    els.chapterSelect.value = chapters.some((c) => c.id === selectedChapterId)
      ? selectedChapterId : "";
  }

  function hierarchyIsPublished(chapterId) {
    const chapter = getById(allChapters, chapterId);
    const subject = chapter && getById(allSubjects, chapter.subject_id);
    const cls = subject && getById(allClasses, subject.class_id);

    return Boolean(
      chapter?.is_published === true &&
      subject?.is_published === true &&
      cls?.is_published === true
    );
  }

  async function loadNotes() {
    els.notesMessage.textContent = "Loading notes…";
    els.notesList.replaceChildren();

    const { data, error } = await db
      .from("notes")
      .select("id,chapter_id,title,description,content,file_url,status,sort_order,created_by,created_at,updated_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;

    allNotes = data || [];
    updateStats();
    renderNotes();
  }

  function updateStats() {
    els.total.textContent = allNotes.length;
    els.published.textContent =
      allNotes.filter((note) => note.status === "published").length;
    els.drafts.textContent =
      allNotes.filter((note) => note.status === "draft").length;
  }

  function noteLocation(note) {
    const chapter = getById(allChapters, note.chapter_id);
    const subject = chapter && getById(allSubjects, chapter.subject_id);
    const cls = subject && getById(allClasses, subject.class_id);

    return {
      chapter: chapter?.name || "Unknown chapter",
      subject: subject?.name || "Unknown subject",
      className: cls?.name || "Unknown class"
    };
  }

  function renderNotes() {
    const query = els.search.value.trim().toLowerCase();
    const status = els.statusFilter.value;

    const filtered = allNotes.filter((note) => {
      const location = noteLocation(note);
      const searchable = [
        note.title,
        note.description,
        location.chapter,
        location.subject,
        location.className
      ].join(" ").toLowerCase();

      return searchable.includes(query) &&
        (status === "all" || note.status === status);
    });

    els.notesList.replaceChildren();

    if (!filtered.length) {
      els.notesMessage.textContent = "";
      const empty = document.createElement("div");
      empty.className = "note-empty";
      empty.textContent = allNotes.length
        ? "No notes match your search."
        : "No notes yet. Use “Add new note” to create your first one.";
      els.notesList.append(empty);
      return;
    }

    els.notesMessage.textContent = `${filtered.length} note(s)`;

    filtered.forEach((note) => {
      const location = noteLocation(note);
      const row = document.createElement("article");
      row.className = "note-row";

      const main = document.createElement("div");
      main.className = "note-main";

      const title = document.createElement("h3");
      title.textContent = note.title;

      const description = document.createElement("p");
      description.textContent = note.description || "No description provided.";

      const hierarchy = document.createElement("p");
      hierarchy.textContent =
        `${location.className} / ${location.subject} / ${location.chapter}`;

      const meta = document.createElement("div");
      meta.className = "note-meta";

      const badge = document.createElement("span");
      badge.className = `note-tag ${note.status === "published" ? "published" : "draft"}`;
      badge.textContent = note.status === "published" ? "Published" : "Draft";

      const pdfBadge = document.createElement("span");
      pdfBadge.className = "note-tag";
      pdfBadge.textContent = note.file_url ? "PDF attached" : "No PDF";

      meta.append(badge, pdfBadge);
      main.append(title, description, hierarchy, meta);

      const actions = document.createElement("div");
      actions.className = "note-actions";

      if (note.file_url) {
        const view = document.createElement("button");
        view.type = "button";
        view.className = "view-note";
        view.textContent = "View PDF";
        view.addEventListener("click", () => openPDF(note));
        actions.append(view);
      }

      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => editNote(note.id));

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.textContent = note.status === "published" ? "Unpublish" : "Publish";
      toggle.addEventListener("click", () => togglePublication(note.id));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete-note";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => deleteNote(note.id));

      actions.append(edit, toggle, remove);
      row.append(main, actions);
      els.notesList.append(row);
    });
  }

  async function openPDF(note) {
    if (!note.file_url) {
      alert("No PDF is attached to this note.");
      return;
    }

    const { data, error } = await db.storage
      .from(BUCKET)
      .createSignedUrl(note.file_url, 60);

    if (error) {
      alert("Could not open PDF: " + error.message);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function resetForm() {
    els.form.reset();
    els.noteId.value = "";
    currentFilePath = null;
    els.sortOrder.value = "0";
    els.status.value = "draft";
    els.fileHint.textContent = "Choose a PDF to attach. A file is required for a new note.";
    els.editorHeading.textContent = "Create a note";
    els.save.textContent = "Save note";
    setFormMessage("");

    els.classSelect.value = "";
    updateSubjects();
    els.subjectSelect.value = "";
    updateChapters();
    els.chapterSelect.value = "";

    els.editor.hidden = false;
    els.editor.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function editNote(id) {
    const note = allNotes.find((item) => item.id === id);
    if (!note) return;

    const chapter = getById(allChapters, note.chapter_id);
    const subject = chapter && getById(allSubjects, chapter.subject_id);
    if (!chapter || !subject) {
      alert("This note's chapter or subject could not be found.");
      return;
    }

    els.noteId.value = note.id;
    els.classSelect.value = subject.class_id;
    updateSubjects(subject.id);
    updateChapters(chapter.id);

    els.title.value = note.title || "";
    els.description.value = note.description || "";
    els.content.value = note.content || "";
    els.sortOrder.value = note.sort_order ?? 0;
    els.status.value = note.status || "draft";
    currentFilePath = note.file_url || null;
    els.file.value = "";
    els.fileHint.textContent = currentFilePath
      ? "A PDF is already attached. Choose another PDF only if you want to replace it."
      : "No PDF attached. Choose a PDF if required.";

    els.editorHeading.textContent = "Edit note";
    els.save.textContent = "Update note";
    setFormMessage("");
    els.editor.hidden = false;
    els.editor.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function uploadPDF(file, chapterId) {
    if (!file) return null;

    const isPDF = file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPDF) throw new Error("Please select a PDF file.");
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("PDF size must be 20 MB or less.");
    }
    if (!file.size) throw new Error("The selected PDF is empty.");

    const uniqueName = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const path = `${chapterId}/${uniqueName}.pdf`;

    const { error } = await db.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: "application/pdf",
        upsert: false
      });

    if (error) throw error;
    return path;
  }

  async function saveNote(event) {
    event.preventDefault();
    if (busy) return;

    try {
      setBusy(true);
      setFormMessage("Saving…");

      const chapterId = els.chapterSelect.value;
      const title = els.title.value.trim();
      const selectedFile = els.file.files[0] || null;
      const existingId = els.noteId.value;
      const status = els.status.value;

      if (!chapterId) throw new Error("Please select a chapter.");
      if (!title) throw new Error("Please enter a note title.");
      if (!existingId && !selectedFile) {
        throw new Error("Please select a PDF for the new note.");
      }

      if (!["draft", "published"].includes(status)) {
        throw new Error("Invalid publication status.");
      }

      if (status === "published" && !hierarchyIsPublished(chapterId)) {
        throw new Error(
          "Publish blocked: publish the selected class, subject and chapter first."
        );
      }

      const oldNote = existingId
        ? allNotes.find((note) => note.id === existingId)
        : null;

      let filePath = oldNote?.file_url || null;
      let newlyUploadedPath = null;

      if (selectedFile) {
        newlyUploadedPath = await uploadPDF(selectedFile, chapterId);
        filePath = newlyUploadedPath;
      }

      const payload = {
        chapter_id: chapterId,
        title,
        description: els.description.value.trim() || null,
        content: els.content.value.trim() || null,
        file_url: filePath,
        status,
        sort_order: Math.max(0, Number.parseInt(els.sortOrder.value, 10) || 0),
        updated_at: new Date().toISOString()
      };

      let result;

      if (oldNote) {
        result = await db.from("notes")
          .update(payload)
          .eq("id", oldNote.id)
          .select("id")
          .single();
      } else {
        result = await db.from("notes")
          .insert({
            ...payload,
            created_by: currentUser.id
          })
          .select("id")
          .single();
      }

      if (result.error) {
        if (newlyUploadedPath) {
          await db.storage.from(BUCKET).remove([newlyUploadedPath]);
        }
        throw result.error;
      }

      // Remove the old PDF only after the database points to the new PDF.
      if (selectedFile && oldNote?.file_url) {
        const { error: removeError } = await db.storage
          .from(BUCKET)
          .remove([oldNote.file_url]);

        if (removeError) {
          console.warn("Old PDF could not be removed:", removeError.message);
        }
      }

      setFormMessage("Saved successfully.");
      resetForm();
      await loadNotes();
    } catch (error) {
      console.error("Saving note failed:", error);
      setFormMessage(error.message || "Could not save note.", true);
    } finally {
      setBusy(false);
    }
  }

  async function togglePublication(id) {
    const note = allNotes.find((item) => item.id === id);
    if (!note) return;

    const nextStatus = note.status === "published" ? "draft" : "published";

    if (nextStatus === "published" && !hierarchyIsPublished(note.chapter_id)) {
      alert("Publish the class, subject and chapter before publishing this note.");
      return;
    }

    const message = nextStatus === "published"
      ? "Publish this note for students?"
      : "Unpublish this note? Students will no longer be able to access it.";

    if (!confirm(message)) return;

    const { error } = await db.from("notes")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      alert("Could not update status: " + error.message);
      return;
    }

    await loadNotes();
  }

  async function deleteNote(id) {
    const note = allNotes.find((item) => item.id === id);
    if (!note) return;

    if (!confirm(`Delete "${note.title}"? This action cannot be undone.`)) return;

    // Delete the database record first, so a Storage error doesn't leave
    // a visible note pointing to a missing PDF.
    const { error } = await db.from("notes").delete().eq("id", id);

    if (error) {
      alert("Could not delete note: " + error.message);
      return;
    }

    if (note.file_url) {
      const { error: fileError } = await db.storage
        .from(BUCKET)
        .remove([note.file_url]);

      if (fileError) {
        alert("The note was deleted, but its PDF could not be removed: " + fileError.message);
      }
    }

    await loadNotes();
  }

  function wireEvents() {
    els.classSelect.addEventListener("change", () => updateSubjects());
    els.subjectSelect.addEventListener("change", () => updateChapters());
    els.form.addEventListener("submit", saveNote);

    $("newNoteBtn").addEventListener("click", resetForm);
    $("cancelEditBtn").addEventListener("click", () => {
      els.editor.hidden = true;
      resetForm();
      els.editor.hidden = true;
    });

    $("refreshNotesBtn").addEventListener("click", async () => {
      try {
        await loadHierarchy();
        await loadNotes();
      } catch (error) {
        console.error(error);
        els.notesMessage.textContent = error.message || "Could not refresh notes.";
      }
    });

    els.search.addEventListener("input", renderNotes);
    els.statusFilter.addEventListener("change", renderNotes);
  }

  async function init() {
    if (!db) {
      els.notesMessage.textContent = "Supabase client was not initialized. Check js/supabase.js.";
      return;
    }

    try {
      await checkAdmin();
      wireEvents();
      await loadHierarchy();
      await loadNotes();
      els.editor.hidden = true;
    } catch (error) {
      console.error("Admin notes initialization failed:", error);
      els.notesMessage.textContent = error.message || "Could not load the notes manager.";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
