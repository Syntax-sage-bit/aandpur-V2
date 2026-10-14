
document.addEventListener("DOMContentLoaded", () => {
  const client = window.supabaseClient;

  const elements = {
    studentName: document.getElementById("studentName"),
    welcomeName: document.getElementById("welcomeName"),
    studentAvatar: document.getElementById("studentAvatar"),
    studentClassLabel: document.getElementById("studentClassLabel"),
    welcomeDate: document.getElementById("welcomeDate"),
    currentClassName: document.getElementById("currentClassName"),
    classCount: document.getElementById("classCount"),
    subjectCount: document.getElementById("subjectCount"),
    subjectGrid: document.getElementById("subjectGrid"),
    refreshButton: document.getElementById("refreshDashboard")
  };

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  function showMessage(message) {
    if (elements.subjectGrid) {
      elements.subjectGrid.innerHTML = `
        <article class="panel-card">
          <p>${escapeHTML(message)}</p>
        </article>`;
    }
  }

  function subjectIcon(name) {
    const value = name.toLowerCase();

    if (value.includes("physics")) return "Φ";
    if (value.includes("chemistry")) return "⚗";
    if (value.includes("math")) return "∑";
    if (value.includes("biology")) return "♧";

    return "◈";
  }

  function subjectTheme(name) {
    const value = name.toLowerCase();

    if (value.includes("physics")) return "physics";
    if (value.includes("chemistry")) return "chemistry";
    if (value.includes("math")) return "mathematics";

    return "physics";
  }

  function renderSubjects(subjects, classes) {
    if (!subjects.length) {
      showMessage("Abhi koi published subject available nahi hai.");
      return;
    }

    const classMap = new Map(
      classes.map((item) => [item.id, item.name])
    );

    elements.subjectGrid.innerHTML = subjects.map((subject, index) => {
      const name = escapeHTML(subject.name);
      const className = escapeHTML(
        classMap.get(subject.class_id) || "Class not assigned"
      );

      const theme = subjectTheme(subject.name);
      const icon = escapeHTML(subjectIcon(subject.name));
      const code = `SUB / ${String(index + 1).padStart(2, "0")}`;

      return `
        <article class="subject-card ${theme}">
          <div class="subject-card-top">
            <span class="subject-icon">${icon}</span>
            <span class="subject-code">${code}</span>
          </div>

          <h3>${name}</h3>
          <p>Explore lessons and study materials.</p>

          <div class="subject-foot">
            <span>${className}</span>
            <button type="button"
              class="explore-subject"
              data-subject-id="${escapeHTML(subject.id)}"
              data-subject-name="${name}">
              Explore <b>→</b>
            </button>
          </div>
        </article>`;
    }).join("");
  }

  async function loadDashboard() {
    if (!client) {
      showMessage("Supabase client nahi mila. js/supabase.js check karo.");
      return;
    }

    elements.classCount.textContent = "…";
    elements.subjectCount.textContent = "…";
    showMessage("Loading published subjects...");

    try {
      // Logged-in student ki details
      const { data: userResult, error: userError } =
        await client.auth.getUser();

      if (userError) throw userError;

      const user = userResult?.user;

      if (user) {
        const metadata = user.user_metadata || {};
        const fullName =
          metadata.full_name ||
          metadata.name ||
          metadata.display_name ||
          user.email?.split("@")[0] ||
          "Student";

        elements.studentName.textContent = fullName;
        elements.welcomeName.textContent = fullName;
        elements.studentAvatar.textContent = fullName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0].toUpperCase())
          .join("");

        elements.studentClassLabel.textContent = "Student";
      }

      // Date ko automatically update karo
      elements.welcomeDate.textContent =
        new Date().toLocaleDateString("en-IN", {
          weekday: "long",
          month: "long",
          day: "numeric"
        }).toUpperCase();

      // Sirf published classes
      const { data: classes, error: classesError } = await client
        .from("classes")
        .select("id, name, is_published")
        .eq("is_published", true)
        .order("name");

      if (classesError) throw classesError;

      // Sirf published subjects
      const { data: subjects, error: subjectsError } = await client
        .from("subjects")
        .select("id, class_id, name, is_published")
        .eq("is_published", true)
        .order("name");

      if (subjectsError) throw subjectsError;

      const availableClasses = classes || [];
      const availableSubjects = subjects || [];

      elements.classCount.textContent =
        String(availableClasses.length).padStart(2, "0");

      elements.subjectCount.textContent =
        String(availableSubjects.length).padStart(2, "0");

      elements.currentClassName.textContent =
        availableClasses.length === 1
          ? availableClasses[0].name
          : `${availableClasses.length} available`;

      renderSubjects(availableSubjects, availableClasses);

    } catch (error) {
      console.error("Student dashboard error:", error);

      elements.classCount.textContent = "—";
      elements.subjectCount.textContent = "—";
      elements.currentClassName.textContent = "Unavailable";

      showMessage(
        "Data load nahi ho saka. Login, Supabase connection aur table permissions check karo."
      );
    }
  }

  elements.refreshButton?.addEventListener("click", loadDashboard);

  // Subject pages abhi connect nahi hain.
  elements.subjectGrid?.addEventListener("click", (event) => {
    const button = event.target.closest(".explore-subject");
    if (!button) return;

    const subjectId = button.dataset.subjectId;
    const subjectName = button.dataset.subjectName;

    console.log("Selected subject:", { subjectId, subjectName });

    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent =
        `${subjectName} selected. Subject chapters page abhi connect karna hai.`;
      toast.classList.add("show");

      setTimeout(() => toast.classList.remove("show"), 3000);
    }
  });

  loadDashboard();
});
