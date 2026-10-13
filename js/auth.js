
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

  // Update the message shown on the page.
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

    // Signup is only available for students.
    role.disabled = signup;
    if (signup) role.value = "student";

    title.textContent = signup ? "Create your account" : "Welcome back";
    subtitle.textContent = signup
      ? "Join Aandpur and start learning."
      : "Sign in to continue to Aandpur.";

    submitButton.textContent = signup ? "Create Student Account" : "Login";
    password.autocomplete = signup ? "new-password" : "current-password";

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

  // Create the student's profile after successful signup.
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

  // Check whether this account has been authorised as an admin.
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

  // Login or signup form submission.
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const userEmail = email.value.trim();
    const userPassword = password.value;
    const selectedRole = role.value;
    const fullName = displayName.value.trim();

    if (isSignup && !fullName) {
      showMessage("Please enter your full name.", true);
      return;
    }

    submitButton.disabled = true;
    showMessage(isSignup ? "Creating your account..." : "Signing in...");

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
          showMessage("Account created successfully! Opening your dashboard...");

          window.location.href = "student/dashboard.html";
          return;
        }

        showMessage(
          "Signup successful! Check your email to confirm your account, then log in."
        );
        setMode(false);
        return;
      }

      // Sign in existing account.
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

      // Never trust the dropdown alone to grant admin access.
      const authorisedAdmin = await isAuthorisedAdmin(user.id);

      if (selectedRole === "admin") {
        if (!authorisedAdmin) {
          await supabaseClient.auth.signOut();
          throw new Error(
            "This account is not authorised for Admin access."
          );
        }

        window.location.href = "admin/dashboard.html";
        return;
      }

      if (authorisedAdmin) {
        // Admin accounts should use the Admin login option.
        await supabaseClient.auth.signOut();
        throw new Error(
          "This is an authorised Admin account. Please select Admin login."
        );
      }

      window.location.href = "student/dashboard.html";
    } catch (error) {
      console.error("Authentication error:", error);
      showMessage(error.message || "Something went wrong. Please try again.", true);
    } finally {
      submitButton.disabled = false;
    }
  });

  setMode(false);
});
