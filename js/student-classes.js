
document.addEventListener("DOMContentLoaded", async () => {
  const client = window.supabaseClient;
  const grid = document.getElementById("classGrid");
  const search = document.getElementById("classSearch");

  let allClasses = [];

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
    grid.innerHTML = `
      <div class="message ${isError ? "error" : ""}">
        <strong>${escapeHTML(title)}</strong>
        ${escapeHTML(description)}
      </div>
    `;
  }

  function getClassIcon(name) {
    const match = String(name).match(/\d+/);
    const number = match ? Number(match[0]) : null;

    if (number === 11 || number === 12) return "🎓";
    if (number === 9 || number === 10) return "📘";

    return "📚";
  }

  function renderClasses(searchText = "") {
    const term = searchText.trim().toLowerCase();

    const filtered = allClasses.filter((item) =>
      String(item.name).toLowerCase().includes(term)
    );

    if (filtered.length === 0) {
      showMessage(
        "No classes found",
        allClasses.length
          ? "Try searching with a different class name."
          : "No published classes are available yet."
      );
      return;
    }

    grid.innerHTML = filtered.map((item) => `
      <article class="class-card">
        <div class="class-icon" aria-hidden="true">
          ${getClassIcon(item.name)}
        </div>

        <h3>${escapeHTML(item.name)}</h3>

        <p>
          Explore subjects, chapters, notes and practice
          material available for this class.
        </p>

        <a
          class="select-btn"
          href="subjects.html?class=${encodeURIComponent(item.id)}"
        >
          Select Class →
        </a>
      </article>
    `).join("");
  }

  search.addEventListener("input", () => {
    renderClasses(search.value);
  });

  if (!client) {
    showMessage(
      "Connection error",
      "Supabase client nahi mila. js/supabase.js check karo.",
      true
    );
    return;
  }

  try {
    const { data: authData, error: authError } =
      await client.auth.getUser();

    if (authError) throw authError;

    if (!authData.user) {
      showMessage(
        "Login required",
        "Please log in to select your class."
      );
      return;
    }

    const { data, error } = await client
      .from("classes")
      .select("id, name, is_published")
      .eq("is_published", true)
      .order("name");

    if (error) throw error;

    allClasses = (data || []).filter((item) => item.name);

    renderClasses();
  } catch (error) {
    console.error("Class loading error:", error);

    showMessage(
      "Unable to load classes",
      error.message || "Please check your Supabase settings and permissions.",
      true
    );
  }
});
