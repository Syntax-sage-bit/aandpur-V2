
(async function protectAdminDashboard() {
  const supabaseClient = window.supabaseClient;

  // Keep the dashboard hidden until access is verified.
  document.body.style.visibility = "hidden";

  function redirectToLogin() {
    window.location.replace("../auth.html");
  }

  if (!supabaseClient) {
    console.error("Supabase client is not initialized.");
    redirectToLogin();
    return;
  }

  try {
    // 1. Check whether a user is logged in.
    const {
      data: { session },
      error: sessionError
    } = await supabaseClient.auth.getSession();

    if (sessionError || !session) {
      redirectToLogin();
      return;
    }

    // 2. Verify the user's admin membership in the database.
    const { data: admin, error: adminError } = await supabaseClient
      .from("admin_users")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (adminError) {
      console.error("Admin verification failed:", adminError.message);
      redirectToLogin();
      return;
    }

    if (!admin) {
      // This account is not authorised to use the admin dashboard.
      await supabaseClient.auth.signOut();
      redirectToLogin();
      return;
    }

    // 3. Show the dashboard only after verification succeeds.
    const userName =
      session.user.user_metadata?.display_name ||
      session.user.email?.split("@")[0] ||
      "Admin";

    const nameElement = document.querySelector(".user-meta b");
    const emailElement = document.querySelector(".user-meta small");

    if (nameElement) {
      nameElement.textContent = userName;
    }

    if (emailElement) {
      emailElement.textContent = session.user.email || "Administrator";
    }

    document.body.style.visibility = "visible";
  } catch (error) {
    console.error("Admin dashboard security error:", error);
    redirectToLogin();
  }
})();
