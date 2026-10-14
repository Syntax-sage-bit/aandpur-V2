
document.addEventListener("DOMContentLoaded", async () => {
  const client = window.supabaseClient;
  const grid = document.getElementById("subjectGrid");
  const searchInput = document.getElementById("subjectSearch");
  const countElement = document.getElementById("subjectCount");
  const classElement = document.getElementById("className");

  if (!client) {
    grid.innerHTML =
      '<div class="message error">Supabase client nahi mila. js/supabase.js check karo.</div>';
    return;
  }

  let allSubjects = [];

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const getIcon = (name) => {
    const value = name.toLowerCase();

    if (value.includes("physics")) return "⚛️";
    if (value.includes("chemistry")) return "🧪";
    if (value.includes("math")) return "📐";
    if (value.includes("biology")) return "🧬";
    if (value.includes("computer")) return "💻";
    if (value.includes("english")) return "📖";

    return "📚";
  };

  function renderSubjects(query = "") {
    const filtered = allSubjects.filter((subject) =>
      subject.name.toLowerCase().includes(query.trim().toLowerCase())
    );

    countElement.textContent = allSubjects.length;

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="message">
          ${allSubjects.length
            ? "No subjects match your search."
            : "Abhi koi published subject available nahi hai."}
        </div>`;
      return;
    }

    grid.innerHTML = filtered.map((subject) => `
      <article class="subject-card">
        <div class="subject-icon">${getIcon(subject.name)}</div>
        <h3>${escapeHTML(subject.name)}</h3>
        <p>Explore chapters, study notes, PYQs and practice questions.</p>
        <div class="subject-meta">📘 Subject learning resources</div>
        <a
          class="open-btn"
          href="chapters.html?subject=${encodeURIComponent(subject.id)}"
        >Explore Subject →</a>
      </article>
    `).join("");
  }

  searchInput.addEventListener("input", () => {
    renderSubjects(searchInput.value);
  });

  try {
    const { data: { user }, error: userError } =
      await client.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      grid.innerHTML = `
        <div class="message">
          Please log in to view your subjects.
          <br><a href="login.html">Go to Login</a>
        </div>`;
      return;
    }

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.warn("Profile could not be loaded:", profileError.message);
    }

    const pageParams = new URLSearchParams(window.location.search);

    const selectedClassId = pageParams.get("class");

    const classId =
    selectedClassId || profile?.class_id || profile?.class;

    if (classId) {
      const { data: classData, error: classError } = await client
        .from("classes")
        .select("id, name")
        .eq("id", classId)
        .maybeSingle();

      if (!classError && classData) {
        classElement.textContent = classData.name;
      } else {
        classElement.textContent = "Your Class";
      }

      let subjectQuery = client
        .from("subjects")
        .select("id, class_id, name, is_published")
        .eq("is_published", true)
        .eq("class_id", classId)
        .order("name");

      const { data, error } = await subjectQuery;

      if (error) throw error;

      allSubjects = data || [];
    } else {
      // Agar profile mein class assign nahi hai, to saare
      // published subjects dikhao.
      classElement.textContent = "All Classes";

      const { data, error } = await client
        .from("subjects")
        .select("id, class_id, name, is_published")
        .eq("is_published", true)
        .order("name");

      if (error) throw error;

      allSubjects = data || [];
    }

    renderSubjects();
  } catch (error) {
    console.error("Subjects loading error:", error);

    grid.innerHTML = `
      <div class="message error">
        Subjects load nahi ho paaye.
        <br>${escapeHTML(error.message || "Unknown error")}
        <br>Supabase table, columns aur RLS policies check karo.
      </div>`;
  }
});
