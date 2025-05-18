document.addEventListener("DOMContentLoaded", () => {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;

  // Initialize Firebase if not already initialized
  if (!window.firebase) {
    // Load Firebase scripts dynamically if not already loaded
    const loadFirebase = () => {
      return new Promise((resolve) => {
        if (window.firebase) {
          resolve();
          return;
        }

        const appScript = document.createElement("script");
        appScript.src =
          "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js";
        document.head.appendChild(appScript);

        appScript.onload = () => {
          const authScript = document.createElement("script");
          authScript.src =
            "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js";
          document.head.appendChild(authScript);

          authScript.onload = () => {
            // Initialize Firebase
            const firebaseConfig = {
              apiKey: "AIzaSyARWluHL-BRw5jbSzWK_4BW-wxdD-kHRjc",
              authDomain: "alters-a4acf.firebaseapp.com",
              projectId: "alters-a4acf",
              storageBucket: "alters-a4acf.firebasestorage.app",
              messagingSenderId: "651773427152",
              appId: "1:651773427152:web:b21737767284588abf8dd5",
              measurementId: "G-41G219M9M0",
            };
            firebase.initializeApp(firebaseConfig);
            resolve();
          };
        };
      });
    };

    loadFirebase().then(renderNavbar);
  } else {
    renderNavbar();
  }

  function renderNavbar() {
    // Define the navigation links (excluding login which will be conditionally added)
    const navLinks = [
      { href: "/", label: "Home" },
      { href: "/pricing", label: "Pricing" },
      { href: "/about", label: "About" },
      { href: "/creator-page", label: "Become a Creator" },
      { href: "/creator-studio", label: "Creator Studio" },
      { href: "/marketplace", label: "Marketplace" },
    ];

    // Generate the navigation links HTML
    const navLinksHTML = navLinks
      .map(
        (link) => `
          <li>
            <a href="${link.href}" class="text-gray-400 hover:text-primary transition-colors">
              ${link.label}
            </a>
          </li>
        `
      )
      .join("");

    // Check if user is logged in
    const auth = firebase.auth();
    auth.onAuthStateChanged((user) => {
      // Create login/user link based on auth state
      let authLinkHTML = `
        <li>
          <a href="/login" class="text-gray-400 hover:text-primary transition-colors">
            Login
          </a>
        </li>
      `;

      if (user) {
        // User is signed in, show their name instead of login
        authLinkHTML = `
          <li>
            <a href="/login" class="text-primary hover:text-primary-dark transition-colors">
              ${user.displayName || "User"}
            </a>
          </li>
        `;
      }

      // Generate the complete navigation bar HTML
      const navHTML = `
        <nav class="bg-secondary bg-opacity-95 backdrop-blur-md border-b border-gray-800 sticky top-0 z-10">
          <div class="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
            <a href="/" class="text-3xl font-['Pacifico'] text-white">alters<span class="text-primary">.ai</span></a>
            <ul class="flex space-x-6">
              ${navLinksHTML}
              ${authLinkHTML}
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
    });
  }
});
