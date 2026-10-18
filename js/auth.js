
document.addEventListener("DOMContentLoaded", () => {
  const supabaseClient = window.supabaseClient;

  const form = document.getElementById("authForm");
  const loginTab = document.getElementById("loginTab");
  const signupTab = document.getElementById("signupTab");
  const title = document.getElementById("authTitle");
  const subtitle = document.getElementById("authSubtitle");
  const nameField = document.getElementById("nameField");
  const displayName = document.getElementById("displayName");
  const role = document.getElementById("role");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const submitButton = document.getElementById("submitButton");
  const message = document.getElementById("authMessage");

  let isSignup = false;
  let isRedirecting = false;

  // Display a message on the page.
  function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "#dc2626" : "#15803d";
  }

  // Switch between Login and Student Signup.
  function setMode(signup) {
    isSignup = signup;

    loginTab.classList.toggle("active", !signup);
    signupTab.classList.toggle("active", signup);

    nameField.hidden = !signup;
    displayName.required = signup;

    // Signup is available only for students.
    role.disabled = signup;

    if (signup) {
      role.value = "student";
    }

    title.textContent = signup
      ? "Create your account"
      : "Welcome back";

    subtitle.textContent = signup
      ? "Join Aandpur and start learning."
      : "Sign in to continue to Aandpur.";

    submitButton.textContent = signup
      ? "Create Student Account"
      : "Login";

    password.autocomplete = signup
      ? "new-password"
      : "current-password";

    showMessage("");
  }

  loginTab.addEventListener("click", () => setMode(false));
  signupTab.addEventListener("click", () => setMode(true));

  // Check that Supabase has been initialized.
  if (!supabaseClient) {
    showMessage(
      "Supabase is not initialized. Check js/supabase.js and script order.",
      true
    );

    submitButton.disabled = true;
    return;
  }

  // Check whether the account is an authorised admin.
  async function isAuthorisedAdmin(userId) {
    const { data, error } = await supabaseClient
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Admin verification error:", error);

      throw new Error(
        "Could not verify admin access. Check admin_users table permissions."
      );
    }

    return Boolean(data);
  }

  // Create or update the student's profile after signup.
  async function saveStudentProfile(user, fullName) {
    const { error } = await supabaseClient
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          display_name: fullName,
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("Profile save error:", error);

      throw new Error(
        "Your account was created, but your profile could not be saved. " +
        "Please contact the administrator."
      );
    }
  }

  // Restore an existing session when auth.html opens.
  async function restoreExistingSession() {
    try {
      const {
        data: { session },
        error: sessionError
      } = await supabaseClient.auth.getSession();

      if (sessionError) {
        console.error("Session check failed:", sessionError);
        return;
      }

      if (!session) {
        return;
      }

      // Avoid accidental duplicate redirects.
      if (isRedirecting) return;

      isRedirecting = true;
      submitButton.disabled = true;
      loginTab.disabled = true;
      signupTab.disabled = true;

      showMessage("Existing session found. Opening your dashboard...");

      let authorisedAdmin;

      try {
        authorisedAdmin = await isAuthorisedAdmin(session.user.id);
      } catch (error) {
        console.error("Could not verify saved session:", error);

        isRedirecting = false;
        submitButton.disabled = false;
        loginTab.disabled = false;
        signupTab.disabled = false;

        showMessage(
          "Could not verify your account. Please try logging in again.",
          true
        );

        return;
      }

      if (isRedirecting) {
        window.location.replace(
          authorisedAdmin
            ? "admin/dashboard.html"
            : "student/dashboard.html"
        );
      }
    } catch (error) {
      console.error("Session restoration error:", error);
    }
  }

  // Check saved session before the user logs in again.
  // The session is not signed out just because the login page opens.
  restoreExistingSession();

  // Login or signup form submission.
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isRedirecting) return;

    const userEmail = email.value.trim();
    const userPassword = password.value;
    const selectedRole = role.value;
    const fullName = displayName.value.trim();

    if (isSignup && !fullName) {
      showMessage("Please enter your full name.", true);
      return;
    }

    submitButton.disabled = true;

    showMessage(
      isSignup ? "Creating your account..." : "Signing in..."
    );

    try {
      if (isSignup) {
        // Public signup always creates a student account.
        const { data, error } = await supabaseClient.auth.signUp({
          email: userEmail,
          password: userPassword,
          options: {
            data: {
              display_name: fullName
            }
          }
        });

        if (error) throw error;

        if (data.user && data.session) {
          await saveStudentProfile(data.user, fullName);

          isRedirecting = true;

          showMessage(
            "Account created successfully! Opening your dashboard..."
          );

          window.location.replace("student/dashboard.html");
          return;
        }

        showMessage(
          "Signup successful! Check your email to confirm your account, then log in."
        );

        setMode(false);
        return;
      }

      // Sign in to an existing account.
      const { data, error } =
        await supabaseClient.auth.signInWithPassword({
          email: userEmail,
          password: userPassword
        });

      if (error) throw error;

      const user = data.user;

      if (!user) {
        throw new Error("Login failed. Please try again.");
      }

      const authorisedAdmin = await isAuthorisedAdmin(user.id);

      if (selectedRole === "admin") {
        if (!authorisedAdmin) {
          await supabaseClient.auth.signOut();

          throw new Error(
            "This account is not authorised for Admin access."
          );
        }

        isRedirecting = true;
        window.location.replace("admin/dashboard.html");
        return;
      }

      if (authorisedAdmin) {
        // Keep admin accounts restricted to the Admin dashboard.
        await supabaseClient.auth.signOut();

        throw new Error(
          "This is an authorised Admin account. Please select Admin login."
        );
      }

      isRedirecting = true;
      window.location.replace("student/dashboard.html");
    } catch (error) {
      console.error("Authentication error:", error);

      isRedirecting = false;

      showMessage(
        error.message || "Something went wrong. Please try again.",
        true
      );
    } finally {
      if (!isRedirecting) {
        submitButton.disabled = false;
      }
    }
  });

  setMode(false);
});
