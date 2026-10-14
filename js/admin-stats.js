(async function loadAdminStats() {
  const supabase = window.supabaseClient;

  if (!supabase) {
    console.error("Supabase client is not initialized.");
    return;
  }

  const stats = [
    { table: "classes", label: "Total classes" },
    { table: "subjects", label: "Total subjects" },
    { table: "chapters", label: "Total chapters" },
    { table: "notes", label: "Learning resources" }
  ];

  async function getCount(table) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error(`Could not load ${table} count:`, error.message);
      return null;
    }

    return count ?? 0;
  }

  const cards = document.querySelectorAll(
    ".admin-stats .stat-card"
  );

  for (const stat of stats) {
    const card = Array.from(cards).find(
      item =>
        item.querySelector(".stat-label")?.textContent.trim() ===
        stat.label
    );

    if (!card) continue;

    const number = card.querySelector("strong");
    if (number) number.textContent = "…";
  }

  const results = await Promise.all(
    stats.map(async stat => ({
      ...stat,
      count: await getCount(stat.table)
    }))
  );

  for (const result of results) {
    const card = Array.from(cards).find(
      item =>
        item.querySelector(".stat-label")?.textContent.trim() ===
        result.label
    );

    if (!card) continue;

    const number = card.querySelector("strong");

    if (number) {
      number.textContent =
        result.count === null ? "—" : result.count;
    }

    const note = card.querySelector(".trend, .stat-note");

    if (note && result.count !== null) {
      note.textContent = "LIVE DATA";
    }

    const bottom = card.querySelector(".stat-bottom");

    if (bottom && result.count !== null) {
      const descriptions = {
        classes: "Available classes",
        subjects: "Available subjects",
        chapters: "Available chapters",
        notes: "Notes in database"
      };

      const arrow = bottom.querySelector("span");

      bottom.textContent = descriptions[result.table];

      if (arrow) bottom.appendChild(arrow);
    }
  }
})();