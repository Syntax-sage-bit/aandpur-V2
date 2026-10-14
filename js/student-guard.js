(async function protectStudentDashboard() {
  const supabaseClient = window.supabaseClient;

  function redirectToLogin() {
    window.location.replace("../auth.html");
  }

  // Supabase client check
  if (!supabaseClient) {
    console.error("Supabase client is not initialized.");
    redirectToLogin();
    return;
  }

  document.body.style.visibility = "hidden";

  try {
    // Check whether the user is logged in
    const {
      data: { session },
      error: sessionError
    } = await supabaseClient.auth.getSession();

    if (sessionError || !session) {
      redirectToLogin();
      return;
    }

    // If the logged-in user is an admin, open the admin dashboard
    const { data: admin, error: adminError } = await supabaseClient
      .from("admin_users")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (adminError) {
      console.error("Account verification failed:", adminError.message);
      redirectToLogin();
      return;
    }

    if (admin) {
      window.location.replace("../admin/dashboard.html");
      return;
    }

    // Get the student's actual name
    const studentName =
      session.user.user_metadata?.display_name ||
      session.user.email?.split("@")[0] ||
      "Student";

    const studentEmail = session.user.email || "Student account";

    // Update the dashboard profile
    const nameElement = document.querySelector(".user-meta b");
    const emailElement = document.querySelector(".user-meta small");
    const avatarElement = document.querySelector(".student-avatar");
    const welcomeHeading = document.querySelector(".welcome-row h1");

    if (nameElement) {
      nameElement.textContent = studentName;
    }

    if (emailElement) {
      emailElement.textContent = studentEmail;
    }

    if (avatarElement) {
      const initials = studentName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word.charAt(0))
        .join("")
        .toUpperCase();

      avatarElement.textContent = initials || "ST";
    }

    if (welcomeHeading) {
      const firstTextNode = Array.from(welcomeHeading.childNodes)
        .find(node => node.nodeType === Node.TEXT_NODE);

      if (firstTextNode) {
        firstTextNode.textContent = `Welcome back, ${studentName} `;
      }
    }

    document.body.style.visibility = "visible";

  } catch (error) {
    console.error("Student dashboard security error:", error);
    redirectToLogin();
  }
})();