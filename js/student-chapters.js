
document.addEventListener("DOMContentLoaded", async () => {
  const client = window.supabaseClient;

  const subjectTitle = document.getElementById("subjectTitle");
  const chapterCount = document.getElementById("chapterCount");
  const className = document.getElementById("className");
  const chapterGrid = document.getElementById("chapterGrid");
  const chapterSearch = document.getElementById("chapterSearch");

  let allChapters = [];

  const params = new URLSearchParams(window.location.search);
  const subjectId = params.get("subject");

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function showMessage(title, description, isError = false) {
    chapterGrid.innerHTML = `
      <div class="message ${isError ? "error" : ""}">
        <strong>${escapeHTML(title)}</strong>
        ${escapeHTML(description)}
        <br>
        <a href="subjects.html">← Back to Subjects</a>
      </div>
    `;
  }

  function renderChapters(searchText = "") {
    const search = searchText.trim().toLowerCase();

    const filtered = allChapters.filter((chapter) =>
      chapter.name.toLowerCase().includes(search)
    );

    chapterCount.textContent = allChapters.length;

    if (filtered.length === 0) {
      chapterGrid.innerHTML = `
        <div class="message">
          <strong>${allChapters.length
            ? "No chapters found"
            : "No chapters available yet"}</strong>
          ${allChapters.length
            ? "Try searching with a different chapter name."
            : "Chapters will appear here when the admin publishes them."}
        </div>
      `;
      return;
    }

    chapterGrid.innerHTML = filtered.map((chapter) => `
      <article class="chapter-card">
        <div class="chapter-icon" aria-hidden="true">📖</div>

        <div class="chapter-label">Study Chapter</div>

        <h3>${escapeHTML(chapter.name)}</h3>

        <p>
          Open this chapter to find its notes, PYQs,
          practice questions and quizzes.
        </p>

        <a
          class="open-btn"
          href="chapter.html?chapter=${encodeURIComponent(chapter.id)}"
        >
          Open Chapter →
        </a>
      </article>
    `).join("");
  }

  chapterSearch.addEventListener("input", () => {
    renderChapters(chapterSearch.value);
  });

  if (!client) {
    showMessage(
      "Connection error",
      "Supabase client nahi mila. js/supabase.js check karo.",
      true
    );
    return;
  }

  if (!subjectId) {
    showMessage(
      "Subject not selected",
      "Please open this page by selecting a subject first."
    );
    subjectTitle.textContent = "Subject Not Selected";
    return;
  }

  try {
    // Check that the student is authenticated.
    const { data: authData, error: authError } =
      await client.auth.getUser();

    if (authError) throw authError;

    if (!authData.user) {
      showMessage(
        "Login required",
        "Please log in to view your subject chapters."
      );
      subjectTitle.textContent = "Login Required";
      return;
    }

    // Load the selected published subject.
    const { data: subject, error: subjectError } = await client
      .from("subjects")
      .select("id, name, class_id, is_published")
      .eq("id", subjectId)
      .eq("is_published", true)
      .maybeSingle();

    if (subjectError) throw subjectError;

    if (!subject) {
      subjectTitle.textContent = "Subject Unavailable";
      showMessage(
        "Subject not found",
        "This subject may not be published or may no longer be available."
      );
      return;
    }

    subjectTitle.textContent = subject.name;
    className.textContent = "—";

    // Load the class name for this subject.
    if (subject.class_id) {
      const { data: classData, error: classError } = await client
        .from("classes")
        .select("id, name")
        .eq("id", subject.class_id)
        .maybeSingle();

      if (classError) {
        console.warn("Class name could not be loaded:", classError.message);
      } else if (classData) {
        className.textContent = classData.name;
      }
    }

    // Load only published chapters belonging to this subject.
    const { data: chapters, error: chaptersError } = await client
      .from("chapters")
      .select("id, name, subject_id, is_published")
      .eq("subject_id", subject.id)
      .eq("is_published", true)
      .order("name");

    if (chaptersError) throw chaptersError;

    allChapters = (chapters || []).map((chapter) => ({
      ...chapter,
      name: String(chapter.name || "")
    }));

    renderChapters();
  } catch (error) {
    console.error("Chapter loading error:", error);

    subjectTitle.textContent = "Unable to Load Chapters";

    showMessage(
      "Something went wrong",
      error.message || "Please check your Supabase configuration and policies.",
      true
    );
  }
});
