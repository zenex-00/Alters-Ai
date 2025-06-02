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

      // Generate the complete navigation bar HTML with mobile sidebar
      const navHTML = `
        <nav class="bg-secondary bg-opacity-95 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
          <div class="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
            <a href="/" class="text-3xl font-['Pacifico'] text-white">alters<span class="text-primary">.ai</span></a>

            <!-- Desktop Navigation -->
            <ul class="hidden lg:flex space-x-6">
              ${navLinksHTML}
              ${authLinkHTML}
            </ul>

            <!-- Mobile Hamburger Button -->
            <button id="mobile-menu-button" class="lg:hidden text-white hover:text-primary transition-colors p-2">
              <svg id="hamburger-icon" class="w-6 h-6 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
              <svg id="close-icon" class="w-6 h-6 transition-transform duration-300 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </nav>

        <!-- Mobile Sidebar Overlay -->
        <div id="mobile-sidebar-overlay" class="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden opacity-0 pointer-events-none transition-opacity duration-300"></div>

        <!-- Mobile Sidebar -->
        <div id="mobile-sidebar" class="fixed top-0 right-0 h-full w-80 bg-secondary bg-opacity-98 backdrop-blur-md border-l border-gray-800 z-50 lg:hidden transform translate-x-full transition-transform duration-300 ease-in-out">
          <div class="flex flex-col h-full">
            <!-- Sidebar Header -->
            <div class="flex items-center justify-between p-6 border-b border-gray-800">
              <a href="/" class="text-2xl font-['Pacifico'] text-white">alters<span class="text-primary">.ai</span></a>
              <button id="close-sidebar-button" class="text-white hover:text-primary transition-colors p-2">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <!-- Sidebar Navigation Links -->
            <div class="flex-1 overflow-y-auto py-6">
              <ul class="space-y-2 px-6">
                ${navLinks
                  .map(
                    (link) => `
                  <li>
                    <a href="${link.href}" class="mobile-nav-link block px-4 py-3 text-gray-300 hover:text-white hover:bg-primary hover:bg-opacity-20 rounded-lg transition-all duration-200 border-l-4 border-transparent hover:border-primary">
                      ${link.label}
                    </a>
                  </li>
                `
                  )
                  .join("")}
                <li class="pt-4 border-t border-gray-800 mt-4">
                  ${
                    user
                      ? `
                    <a href="/login" class="mobile-nav-link block px-4 py-3 text-primary hover:text-white hover:bg-primary hover:bg-opacity-20 rounded-lg transition-all duration-200 border-l-4 border-primary font-medium">
                      ${user.displayName || "User"}
                    </a>
                  `
                      : `
                    <a href="/login" class="mobile-nav-link block px-4 py-3 text-gray-300 hover:text-white hover:bg-primary hover:bg-opacity-20 rounded-lg transition-all duration-200 border-l-4 border-transparent hover:border-primary">
                      Login
                    </a>
                  `
                  }
                </li>
              </ul>
            </div>

            <!-- Sidebar Footer -->
            <div class="p-6 border-t border-gray-800">
              <div class="text-xs text-gray-500 text-center">
                © 2025 alters.ai
              </div>
            </div>
          </div>
        </div>
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

      // Mobile sidebar functionality
      const mobileMenuButton = document.getElementById("mobile-menu-button");
      const mobileSidebar = document.getElementById("mobile-sidebar");
      const mobileSidebarOverlay = document.getElementById(
        "mobile-sidebar-overlay"
      );
      const closeSidebarButton = document.getElementById(
        "close-sidebar-button"
      );
      const hamburgerIcon = document.getElementById("hamburger-icon");
      const closeIcon = document.getElementById("close-icon");
      const mobileNavLinks = document.querySelectorAll(".mobile-nav-link");

      let sidebarOpen = false;

      function openSidebar() {
        sidebarOpen = true;
        mobileSidebar.classList.remove("translate-x-full");
        mobileSidebarOverlay.classList.remove(
          "opacity-0",
          "pointer-events-none"
        );
        hamburgerIcon.classList.add("hidden");
        closeIcon.classList.remove("hidden");
        document.body.style.overflow = "hidden";

        // Animate links with stagger effect
        mobileNavLinks.forEach((link, index) => {
          link.style.opacity = "0";
          link.style.transform = "translateX(20px)";
          setTimeout(() => {
            link.style.transition = "opacity 0.3s ease, transform 0.3s ease";
            link.style.opacity = "1";
            link.style.transform = "translateX(0)";
          }, index * 50);
        });
      }

      function closeSidebar() {
        sidebarOpen = false;
        mobileSidebar.classList.add("translate-x-full");
        mobileSidebarOverlay.classList.add("opacity-0", "pointer-events-none");
        hamburgerIcon.classList.remove("hidden");
        closeIcon.classList.add("hidden");
        document.body.style.overflow = "";

        // Reset link animations
        mobileNavLinks.forEach((link) => {
          link.style.transition = "";
          link.style.opacity = "";
          link.style.transform = "";
        });
      }

      // Event listeners
      mobileMenuButton.addEventListener("click", () => {
        if (sidebarOpen) {
          closeSidebar();
        } else {
          openSidebar();
        }
      });

      closeSidebarButton.addEventListener("click", closeSidebar);
      mobileSidebarOverlay.addEventListener("click", closeSidebar);

      // Close sidebar when clicking on navigation links
      mobileNavLinks.forEach((link) => {
        link.addEventListener("click", () => {
          setTimeout(closeSidebar, 150); // Small delay for better UX
        });
      });

      // Handle escape key
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && sidebarOpen) {
          closeSidebar();
        }
      });

      // Handle window resize
      window.addEventListener("resize", () => {
        if (window.innerWidth >= 1024 && sidebarOpen) {
          closeSidebar();
        }
      });
    });
  }
});
