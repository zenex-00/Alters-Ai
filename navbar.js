document.addEventListener("DOMContentLoaded", () => {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;

  // Define the navigation links
  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/pricing", label: "Pricing" },
    { href: "/about", label: "About" },
    { href: "/creator-page", label: "Become a Creator" },
    { href: "/creator-studio", label: "Creator Studio" },
    { href: "/marketplace", label: "Marketplace" },
  ];

  // Generate the navigation bar HTML
  const navHTML = `
    <nav class="bg-secondary bg-opacity-95 backdrop-blur-md border-b border-gray-800 sticky top-0 z-10">
      <div class="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <a href="/" class="text-3xl font-['Pacifico'] text-white">alters<span class="text-primary">.ai</span></a>
        <ul class="flex space-x-6">
          ${navLinks
            .map(
              (link) => `
                <li>
                  <a href="${link.href}" class="text-gray-400 hover:text-primary transition-colors">
                    ${link.label}
                  </a>
                </li>
              `
            )
            .join("")}
          <li id="auth-link">
            <a href="/login" class="text-gray-400 hover:text-primary transition-colors">
              Login
            </a>
          </li>
        </ul>
      </div>
    </nav>
  `;

  // Inject the navigation bar into the #navbar element
  navbar.innerHTML = navHTML;

  // Highlight the active link
  const currentPath = window.location.pathname;
  const links = navbar.querySelectorAll("a");
  links.forEach((link) => {
    if (link.getAttribute("href") === currentPath) {
      link.classList.add("text-primary");
      link.classList.remove("text-gray-400");
    }
  });

  // Check if Firebase is available
  if (typeof firebase !== "undefined" && firebase.auth) {
    // Update auth link based on authentication state
    const authLink = document.getElementById("auth-link");

    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        // User is signed in
        authLink.innerHTML = `
          <a href="#" id="logout-btn" class="text-gray-400 hover:text-primary transition-colors">
            Logout
          </a>
        `;

        // Add event listener to logout button
        document.getElementById("logout-btn").addEventListener("click", (e) => {
          e.preventDefault();

          // Sign out from Firebase
          firebase
            .auth()
            .signOut()
            .then(() => {
              // Clear session on backend
              fetch("/auth/signout", { method: "POST" })
                .then(() => {
                  // Redirect to home page or refresh
                  window.location.href = "/";
                })
                .catch((error) => {
                  console.error("Sign-out error:", error);
                });
            })
            .catch((error) => {
              console.error("Firebase sign-out error:", error);
            });
        });
      } else {
        // User is signed out
        authLink.innerHTML = `
          <a href="/login" class="text-gray-400 hover:text-primary transition-colors">
            Login
          </a>
        `;
      }
    });
  } else {
    console.warn(
      "Firebase is not initialized. Authentication features will not work."
    );
  }
});
