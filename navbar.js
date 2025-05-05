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
    { href: "/login", label: "Login" },
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
