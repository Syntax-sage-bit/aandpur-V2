(async function setupLogout() {
  const supabaseClient = window.supabaseClient;

  if (!supabaseClient) {
    console.error("Supabase client not initialized.");
    return;
  }

  // Add logout button to the topbar
  const topActions = document.querySelector(".top-actions");

  if (!topActions || document.getElementById("logoutButton")) {
    return;
  }

  const logoutButton = document.createElement("button");
  logoutButton.id = "logoutButton";
  logoutButton.className = "text-button";
  logoutButton.type = "button";
  logoutButton.textContent = "Logout";

  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Logging out...";

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      console.error("Logout failed:", error.message);
      logoutButton.disabled = false;
      logoutButton.textContent = "Logout";
      alert("Logout nahi ho paya. Please dobara try karo.");
      return;
    }

    window.location.replace("../auth.html");
  });

  topActions.appendChild(logoutButton);
})();