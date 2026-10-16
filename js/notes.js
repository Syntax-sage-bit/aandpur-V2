(() => {
  "use strict";

  const db = window.supabaseClient;
  const BUCKET = "chapter-notes";

  // Get chapter ID from the URL
  const chapterIdFromURL = new URLSearchParams(
    window.location.search
  ).get("chapter");

  const $ = (id) => document.getElementById(id);

  const els = {
    search: $("notesSearch"),
    classFilter: $("classFilter"),
    subjectFilter: $("subjectFilter"),
    chapterFilter: $("chapterFilter"),
    count: $("notesCount"),
    grid: $("notesGrid"),
    refresh: $("refreshNotes")
  };

  let allNotes = [];
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

  function setState(message, isError = false) {
    els.grid.replaceChildren();

    const state = document.createElement("div");
    state.className =
      "notes-state" + (isError ? " notes-error" : "");

    state.textContent = message;
    els.grid.append(state);
  }

  function setOptions(select, items, placeholder, labelFn) {
    select.replaceChildren(new Option(placeholder, ""));

    items.forEach((item) => {
      select.add(new Option(labelFn(item), item.id));
    });
  }

  function getLocation(note) {
    const chapter = note.chapters;
    const subject = chapter?.subjects;
    const cls = subject?.classes;

    return {
      chapterId: chapter?.id || "",
      chapterName: chapter?.name || "Chapter",
      subjectId: subject?.id || "",
      subjectName: subject?.name || "Subject",
      classId: cls?.id || "",
      className: cls?.name || "Class"
    };
  }

  async function checkLogin() {
    const { data, error } = await db.auth.getUser();

    if (error || !data?.user) {
      window.location.href = "login.html";
      return false;
    }

    return true;
  }

  // Load published notes, filtered by chapter when opened from a chapter page
  async function loadNotes() {
    if (busy) return;

    busy = true;

    els.refresh.disabled = true;
    els.count.textContent = "Loading notes...";
    setState("Fetching published notes...");

    try {
      let notesQuery = db
        .from("notes")
        .select(`
          id,
          chapter_id,
          title,
          description,
          content,
          file_url,
          created_at,
          sort_order,
          chapters!inner (
            id,
            name,
            is_published,
            subject_id,
            subjects!inner (
              id,
              name,
              is_published,
              class_id,
              classes!inner (
                id,
                name,
                is_published
              )
            )
          )
        `)
        .eq("status", "published");

      // IMPORTANT: Only show notes belonging to the selected chapter.
      if (chapterIdFromURL) {
        notesQuery = notesQuery.eq(
          "chapter_id",
          chapterIdFromURL
        );
      }

      const { data, error } = await notesQuery
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;

      allNotes = (data || []).filter((note) => {
        const chapter = note.chapters;
        const subject = chapter?.subjects;
        const cls = subject?.classes;

        return Boolean(
          chapter?.is_published &&
          subject?.is_published &&
          cls?.is_published
        );
      });

      populateFilters();
      renderNotes();

    } catch (error) {
      console.error("Could not load student notes:", error);

      els.count.textContent = "Notes could not be loaded";

      setState(
        error.message ||
          "Something went wrong while loading notes.",
        true
      );

    } finally {
      busy = false;
      els.refresh.disabled = false;
    }
  }

  function populateFilters() {
    const locations = allNotes.map(getLocation);

    const classes = [
      ...new Map(
        locations.map((item) => [
          item.classId,
          {
            id: item.classId,
            name: item.className
          }
        ])
      ).values()
    ].filter((item) => item.id);

    const selectedClass = els.classFilter.value;

    setOptions(
      els.classFilter,
      classes,
      "All classes",
      (item) => item.name
    );

    if (classes.some((item) => item.id === selectedClass)) {
      els.classFilter.value = selectedClass;
    }

    updateSubjects();
  }

  function updateSubjects() {
    const classId = els.classFilter.value;
    const locations = allNotes.map(getLocation);

    const subjects = [
      ...new Map(
        locations
          .filter(
            (item) =>
              !classId || item.classId === classId
          )
          .map((item) => [
            item.subjectId,
            {
              id: item.subjectId,
              name: item.subjectName
            }
          ])
      ).values()
    ].filter((item) => item.id);

    const selected = els.subjectFilter.value;

    setOptions(
      els.subjectFilter,
      subjects,
      "All subjects",
      (item) => item.name
    );

    if (subjects.some((item) => item.id === selected)) {
      els.subjectFilter.value = selected;
    }

    updateChapters();
  }

  function updateChapters() {
    const classId = els.classFilter.value;
    const subjectId = els.subjectFilter.value;

    const locations = allNotes.map(getLocation);

    const chapters = [
      ...new Map(
        locations
          .filter(
            (item) =>
              (!classId || item.classId === classId) &&
              (!subjectId || item.subjectId === subjectId)
          )
          .map((item) => [
            item.chapterId,
            {
              id: item.chapterId,
              name: item.chapterName
            }
          ])
      ).values()
    ].filter((item) => item.id);

    const selected = els.chapterFilter.value;

    setOptions(
      els.chapterFilter,
      chapters,
      "All chapters",
      (item) => item.name
    );

    if (chapters.some((item) => item.id === selected)) {
      els.chapterFilter.value = selected;
    }
  }

  function renderNotes() {
    const query = els.search.value.trim().toLowerCase();
    const classId = els.classFilter.value;
    const subjectId = els.subjectFilter.value;

    // When opened from a chapter page, lock the notes to that chapter.
    const selectedChapterId =
      chapterIdFromURL || els.chapterFilter.value;

    const filtered = allNotes.filter((note) => {
      const location = getLocation(note);

      const searchable = [
        note.title,
        note.description,
        note.content,
        location.className,
        location.subjectName,
        location.chapterName
      ]
        .join(" ")
        .toLowerCase();

      return (
        searchable.includes(query) &&
        (!classId || location.classId === classId) &&
        (!subjectId || location.subjectId === subjectId) &&
        (
          !selectedChapterId ||
          location.chapterId === selectedChapterId
        )
      );
    });

    els.count.textContent =
      `${filtered.length} ${
        filtered.length === 1 ? "note" : "notes"
      } found`;

    els.grid.replaceChildren();

    if (!filtered.length) {
      setState(
        allNotes.length
          ? "No notes match your search or selected filters."
          : "No published notes are available for this chapter yet."
      );
      return;
    }

    filtered.forEach((note) => {
      const location = getLocation(note);
      const card = document.createElement("article");

      card.className = "student-note";

      const hasPDF = Boolean(note.file_url);

      card.innerHTML = `
        <span class="note-pill">PDF Study Material</span>

        <h2>${escapeHTML(note.title || "Untitled note")}</h2>

        <p class="note-location">
          ${escapeHTML(location.className)} /
          ${escapeHTML(location.subjectName)} /
          ${escapeHTML(location.chapterName)}
        </p>

        <p class="note-description">
          ${escapeHTML(
            note.description || "Study material for this chapter."
          )}
        </p>

        ${
          note.content
            ? `
              <details>
                <summary>Read note details</summary>
                <p class="note-description">
                  ${escapeHTML(note.content)}
                </p>
              </details>
            `
            : ""
        }

        <div class="note-actions">
          ${
            hasPDF
              ? `
                <button
                  class="view-pdf"
                  type="button"
                  data-action="view"
                >
                  Open PDF
                </button>

                <button
                  class="download-pdf"
                  type="button"
                  data-action="download"
                >
                  Download PDF
                </button>
              `
              : ""
          }
        </div>
      `;

      if (hasPDF) {
        card
          .querySelector('[data-action="view"]')
          .addEventListener("click", (event) => {
            openPDF(note, event.currentTarget, false);
          });

        card
          .querySelector('[data-action="download"]')
          .addEventListener("click", (event) => {
            openPDF(note, event.currentTarget, true);
          });
      }

      els.grid.append(card);
    });
  }

  async function openPDF(note, button, download) {
    if (!note.file_url) return;

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = download
      ? "Preparing download..."
      : "Opening PDF...";

    // Open a tab immediately to reduce popup blocking.
    const newTab = download
      ? null
      : window.open("about:blank", "_blank");

    try {
      const options = download
        ? { download: true }
        : undefined;

      const { data, error } = await db.storage
        .from(BUCKET)
        .createSignedUrl(note.file_url, 120, options);

      if (error) throw error;

      if (download) {
        const link = document.createElement("a");

        link.href = data.signedUrl;
        link.download = "";
        link.rel = "noopener";

        document.body.append(link);
        link.click();
        link.remove();

      } else if (newTab) {
        newTab.location.href = data.signedUrl;

      } else {
        window.location.href = data.signedUrl;
      }

    } catch (error) {
      if (newTab && !newTab.closed) {
        newTab.close();
      }

      console.error("PDF access failed:", error);

      alert(
        error.message ||
          "Could not open this PDF. Please try again."
      );

    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function wireEvents() {
    els.search.addEventListener("input", renderNotes);

    els.classFilter.addEventListener("change", () => {
      updateSubjects();
      renderNotes();
    });

    els.subjectFilter.addEventListener("change", () => {
      updateChapters();
      renderNotes();
    });

    els.chapterFilter.addEventListener("change", renderNotes);

    els.refresh.addEventListener("click", loadNotes);
  }

  async function init() {
    if (!db) {
      setState(
        "Supabase client is not initialized. Please check js/supabase.js.",
        true
      );
      return;
    }

    // Check whether the page elements exist.
    const missingElement = Object.entries(els).find(
      ([, element]) => !element
    );

    if (missingElement) {
      console.error(
        `Notes page is missing the element: ${missingElement[0]}`
      );
      return;
    }

    const loggedIn = await checkLogin();

    if (!loggedIn) return;

    // If a chapter ID was passed, keep the chapter filter fixed to it.
    if (chapterIdFromURL) {
      els.chapterFilter.disabled = true;
    }

    wireEvents();
    await loadNotes();
  }

  document.addEventListener("DOMContentLoaded", init);
})();