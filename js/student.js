
document.addEventListener("DOMContentLoaded", async () => {
  const subjectGrid = document.querySelector(".subject-grid");
  const stats = document.querySelectorAll(".stat-card strong");
  const classNameElement = document.querySelector(".current-class b");

  if (!subjectGrid) {
    console.error("Student dashboard elements not found.");
    return;
  }

  subjectGrid.innerHTML = "<p>Loading subjects...</p>";

  try {
    // Fetch published classes from Supabase
    const { data: classes, error: classesError } = await supabaseClient
      .from("classes")
      .select("id, name")
      .eq("is_published", true)
      .order("sort_order");

    if (classesError) throw classesError;

    // Fetch published subjects from Supabase
    const { data: subjects, error: subjectsError } = await supabaseClient
      .from("subjects")
      .select("id, name, description, class_id")
      .eq("is_published", true)
      .order("sort_order");

    if (subjectsError) throw subjectsError;

    // Update class information
    if (classes.length > 0 && classNameElement) {
      classNameElement.textContent = classes[0].name;
    }

    // Update dashboard counts
    if (stats.length > 0) {
      stats[0].textContent = String(classes.length).padStart(2, "0");
    }

    if (stats.length > 1) {
      stats[1].textContent = String(subjects.length).padStart(2, "0");
    }

    // Render subject cards
    subjectGrid.innerHTML = "";

    if (subjects.length === 0) {
      subjectGrid.innerHTML = `
        <article class="panel-card">
          <h3>No subjects published yet</h3>
          <p>Published subjects will appear here when they are added by the admin.</p>
        </article>
      `;
      return;
    }

    const styles = ["physics", "chemistry", "mathematics"];

    subjects.forEach((subject, index) => {
      const classInfo = classes.find(
        (item) => item.id === subject.class_id
      );

      const card = document.createElement("article");
      card.className = `subject-card ${styles[index % styles.length]}`;

      const top = document.createElement("div");
      top.className = "subject-card-top";

      const icon = document.createElement("span");
      icon.className = "subject-icon";
      icon.textContent = "◈";

      const code = document.createElement("span");
      code.className = "subject-code";
      code.textContent = `SUB / ${String(index + 1).padStart(2, "0")}`;

      top.append(icon, code);

      const heading = document.createElement("h3");
      heading.textContent = subject.name;

      const description = document.createElement("p");
      description.textContent =
        subject.description || "Explore lessons and learning resources.";

      const footer = document.createElement("div");
      footer.className = "subject-foot";

      const classLabel = document.createElement("span");
      classLabel.textContent = classInfo?.name || "Class not assigned";

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Explore →";
      button.addEventListener("click", () => {
        alert(`Selected subject: ${subject.name}`);
      });

      footer.append(classLabel, button);
      card.append(top, heading, description, footer);
      subjectGrid.appendChild(card);
    });

    console.log("Student dashboard loaded from Supabase.");
    console.log("Published classes:", classes.length);
    console.log("Published subjects:", subjects.length);
  } catch (error) {
    console.error("Could not load student dashboard:", error.message);

    subjectGrid.innerHTML = `
      <article class="panel-card">
        <h3>Unable to load learning content</h3>
        <p>Please check your connection and try refreshing the page.</p>
      </article>
    `;
  }
});
