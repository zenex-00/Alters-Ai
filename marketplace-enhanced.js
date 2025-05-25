import alterImageManager from "./alter-image-manager.js";

// Enhanced marketplace functionality with proper tab integration
document.addEventListener("DOMContentLoaded", () => {
  console.log("Marketplace Enhanced: Script loaded");

  // DOM Elements
  const premadeTab = document.getElementById("premade-tab");
  const publishedTab = document.getElementById("published-tab");
  const premadeContent = document.getElementById("premade-content");
  const publishedContent = document.getElementById("published-content");
  const categoryFilter = document.getElementById("category-filter");
  const searchInput = document.getElementById("search-input");
  const sortFilter = document.getElementById("sort-filter");
  const resultsCount = document.getElementById("results-count");
  const loadingSpinner = document.getElementById("loading-spinner");
  const noResults = document.getElementById("no-results");
  const categoryLinks = document.querySelectorAll(".category-filter");

  // State
  let currentTab = "premade";
  let premadeAlters = [];
  let publishedAlters = [];
  let filteredAlters = [];

  // Error handling for critical elements
  if (!premadeTab || !publishedTab || !premadeContent || !publishedContent) {
    console.error("Critical tab elements not found");
    return;
  }

  // Initialize premade alters data
  const mockPremadeAlters = [
    {
      id: 1,
      name: "Doctor Emma",
      description: "Professional Medical Consultant",
      price: 9.99,
      rating: 4.9,
      category: "professional",
      creator: "AlterStudio",
      creatorAvatar:
        "https://readdy.ai/api/search-image?query=professional%2520headshot%2520of%2520young%2520woman%2520with%2520neutral%2520expression%2520on%2520dark%2520background%2520high%2520quality%2520portrait&width=100&height=100&seq=11&orientation=squarish",
      image:
        "https://readdy.ai/api/search-image?query=professional%2520looking%2520digital%2520avatar%2520of%2520business%2520woman%2520with%2520suit%2520on%2520dark%2520background%2520high%2520quality%2520realistic%25203D%2520render%2520with%2520perfect%2520lighting%2520and%2520textures&width=400&height=400&seq=10&orientation=squarish",
      verified: true,
      featured: true,
      type: "premade",
      link: "/marketplace/doctor-alter.html",
    },
    {
      id: 2,
      name: "Business Man",
      description: "Corporate Executive Assistant",
      price: 9.99,
      rating: 4.8,
      category: "professional",
      creator: "DigitalTwins",
      creatorAvatar:
        "https://readdy.ai/api/search-image?query=professional%2520headshot%2520of%2520young%2520man%2520with%2520neutral%2520expression%2520on%2520dark%2520background%2520high%2520quality%2520portrait&width=100&height=100&seq=13&orientation=squarish",
      image:
        "https://readdy.ai/api/search-image?query=professional%2520looking%2520digital%2520avatar%2520of%2520business%2520man%2520with%2520suit%2520on%2520dark%2520background%2520high%2520quality%2520realistic%25203D%2520render%2520with%2520perfect%2520lighting%2520and%2520textures&width=400&height=400&seq=12&orientation=squarish",
      verified: true,
      featured: true,
      type: "premade",
      link: "/marketplace/business-alter.html",
    },
    {
      id: 3,
      name: "Gym Guide",
      description: "Personal Fitness Trainer",
      price: 9.99,
      rating: 4.7,
      category: "fitness",
      creator: "TechAlters",
      creatorAvatar:
        "https://readdy.ai/api/search-image?query=professional%2520headshot%2520of%2520young%2520asian%2520woman%2520with%2520neutral%2520expression%2520on%2520dark%2520background%2520high%2520quality%2520portrait&width=100&height=100&seq=15&orientation=squarish",
      image:
        "https://readdy.ai/api/search-image?query=professional%2520looking%2520digital%2520avatar%2520of%2520tech%2520specialist%2520woman%2520on%2520dark%2520background%2520high%2520quality%2520realistic%25203D%2520render%2520with%2520perfect%2520lighting%2520and%2520textures&width=400&height=400&seq=14&orientation=squarish",
      verified: true,
      featured: false,
      type: "premade",
      link: "/marketplace/gym-guide-alter.html",
    },
  ];

  // Tab switching functionality
  premadeTab.addEventListener("click", () => {
    switchTab("premade");
  });

  publishedTab.addEventListener("click", () => {
    switchTab("published");
    if (publishedAlters.length === 0) {
      loadPublishedAlters();
    }
  });

  // Category filter from navigation
  categoryLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const category = link.getAttribute("data-category");
      categoryFilter.value = category;
      filterAndDisplayAlters();
    });
  });

  // Filter event listeners
  categoryFilter.addEventListener("change", filterAndDisplayAlters);
  searchInput.addEventListener("input", filterAndDisplayAlters);
  sortFilter.addEventListener("change", filterAndDisplayAlters);

  function switchTab(tab) {
    currentTab = tab;

    // Update tab buttons
    premadeTab.classList.toggle("active", tab === "premade");
    publishedTab.classList.toggle("active", tab === "published");

    // Update content visibility
    premadeContent.style.display = tab === "premade" ? "grid" : "none";
    publishedContent.style.display = tab === "published" ? "grid" : "none";

    // Filter and display current tab's alters
    filterAndDisplayAlters();
  }

  async function loadPublishedAlters() {
    try {
      showLoading(true);
      const response = await fetch("/api/published-alters");
      if (!response.ok) {
        throw new Error("Failed to fetch published alters");
      }
      const alters = await response.json();
      publishedAlters = alters.map((alter) => ({
        ...alter,
        type: "published",
        price: alter.price || 9.99,
        rating: alter.rating || 4.5,
        verified: true,
        featured: false,
      }));
      console.log("Published alters loaded:", publishedAlters);
      filterAndDisplayAlters();
    } catch (error) {
      console.error("Error loading published alters:", error);
      showError("Failed to load published alters");
    } finally {
      showLoading(false);
    }
  }

  function filterAndDisplayAlters() {
    const currentAlters =
      currentTab === "premade" ? premadeAlters : publishedAlters;
    const searchTerm = searchInput.value.toLowerCase();
    const category = categoryFilter.value;
    const sortBy = sortFilter.value;

    // Filter alters
    filteredAlters = currentAlters.filter((alter) => {
      const matchesSearch =
        alter.name.toLowerCase().includes(searchTerm) ||
        alter.description.toLowerCase().includes(searchTerm);
      const matchesCategory = category === "all" || alter.category === category;
      return matchesSearch && matchesCategory;
    });

    // Sort alters
    filteredAlters.sort((a, b) => {
      switch (sortBy) {
        case "featured":
          return Number(b.featured) - Number(a.featured) || b.rating - a.rating;
        case "rating":
          return b.rating - a.rating;
        case "price-low":
          return a.price - b.price;
        case "price-high":
          return b.price - a.price;
        case "name":
          return a.name.localeCompare(b.name);
        case "newest":
          return (
            new Date(b.created_at || Date.now()) -
            new Date(a.created_at || Date.now())
          );
        default:
          return 0;
      }
    });

    displayAlters();
    updateResultsCount();
  }

  function displayAlters() {
    const container =
      currentTab === "premade" ? premadeContent : publishedContent;

    if (filteredAlters.length === 0) {
      container.innerHTML = "";
      showNoResults(true);
      return;
    }

    showNoResults(false);
    container.innerHTML = filteredAlters.map(createAlterCard).join("");

    // Add event listeners to new cards
    addCardEventListeners(container);
  }

  function createAlterCard(alter) {
    const isOwner = alter.is_owner || false;

    // Ensure alter has all necessary fields for chat
    const enhancedAlter = {
      ...alter,
      personality:
        alter.personality ||
        generatePersonalityFromCategory(alter.category, alter.description),
      prompt: alter.prompt || generatePromptFromAlter(alter),
    };

    return `
      <div class="alter-card fade-in" data-alter-id="${alter.id}">
        <div class="relative">
          <img src="${alter.image || alter.avatar_url || "/placeholder.svg"}" 
               alt="${alter.name}" 
               class="w-full h-64 object-cover">
          
          <div class="overlay-buttons absolute top-3 right-3 flex space-x-2">
            <button class="btn-icon bg-black bg-opacity-50 text-white hover:bg-black hover:bg-opacity-70 favorite-btn">
              <i class="ri-heart-line"></i>
            </button>
            <button class="btn-icon bg-black bg-opacity-50 text-white hover:bg-black hover:bg-opacity-70 share-btn">
              <i class="ri-share-line"></i>
            </button>
          </div>
          
          <div class="absolute bottom-3 left-3">
            <span class="badge badge-primary capitalize">${
              alter.category
            }</span>
          </div>
          
          ${
            alter.featured
              ? '<div class="absolute top-3 left-3"><span class="badge badge-featured">Featured</span></div>'
              : ""
          }
          
          ${
            isOwner
              ? `<button class="delete-button" data-alter-id="${alter.id}" title="Delete alter"><i class="ri-delete-bin-line"></i></button>`
              : ""
          }
        </div>
        
        <div class="p-4">
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-bold text-lg truncate">
              ${
                alter.link
                  ? `<a href="${alter.link}" class="hover:text-primary transition-colors">${alter.name}</a>`
                  : alter.name
              }
            </h3>
            <div class="flex items-center text-yellow-400 text-sm">
              <i class="ri-star-fill"></i>
              <span class="ml-1">${alter.rating}</span>
            </div>
          </div>
          
          <p class="text-gray-400 text-sm mb-4 truncate">${
            alter.description
          }</p>
          
          <div class="flex items-center mb-4">
            <img src="${
              alter.creatorAvatar || alter.creator_avatar || "/placeholder.svg"
            }" 
                 alt="${alter.creator || alter.creator_name}" 
                 class="w-6 h-6 rounded-full mr-2">
            <span class="text-sm text-gray-400">
              by <span class="text-primary">${
                alter.creator || alter.creator_name || "Unknown"
              }</span>
            </span>
            ${
              alter.verified
                ? '<div class="ml-2 w-4 h-4 bg-primary bg-opacity-20 rounded-full flex items-center justify-center"><i class="ri-check-line text-primary text-xs"></i></div>'
                : ""
            }
          </div>
          
          <div class="flex items-center justify-between">
            <div class="text-xl font-bold">$${alter.price}</div>
            <div class="flex gap-2">              <button class="btn-primary px-4 py-2 rounded-lg chat-alter-btn" data-alter="${encodeURIComponent(
              JSON.stringify(enhancedAlter)
            )}" title="Chat with ${alter.name}">
                <i class="ri-chat-3-line mr-2"></i>Chat Now
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Helper functions for generating personality and prompts
  function generatePersonalityFromCategory(category, description) {
    const categoryPersonalities = {
      professional: "Professional, knowledgeable, and helpful",
      business: "Professional, strategic, and results-oriented",
      health: "Caring, knowledgeable, and supportive",
      fitness: "Motivating, energetic, and encouraging",
      education: "Patient, knowledgeable, and encouraging",
      entertainment: "Fun, engaging, and creative",
      gaming: "Enthusiastic, competitive, and knowledgeable about games",
      service: "Helpful, courteous, and solution-focused",
    };

    let personality =
      categoryPersonalities[category] || "Helpful, friendly, and knowledgeable";

    if (description) {
      personality += `. ${description}`;
    }

    return personality;
  }

  function generatePromptFromAlter(alter) {
    let prompt = `You are ${alter.name}`;

    if (alter.description) {
      prompt += `, ${alter.description}`;
    }

    prompt += `. You are ${generatePersonalityFromCategory(
      alter.category,
      alter.description
    )}`;

    if (alter.category) {
      prompt += ` You specialize in ${alter.category} topics.`;
    }

    prompt +=
      " Respond in character, be engaging, and provide helpful information. Keep your responses conversational and maintain your unique personality.";

    return prompt;
  }

  function addCardEventListeners(container) {
    // Delete buttons
    container.querySelectorAll(".delete-button").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const alterId = btn.getAttribute("data-alter-id");
        deleteAlter(alterId);
      });
    });

    // Try alter buttons
    container.querySelectorAll(".try-alter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const alter = JSON.parse(btn.getAttribute("data-alter"));
        tryAlter(alter);
      });
    }); // Chat buttons
    container.querySelectorAll(".chat-alter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const alterJson = decodeURIComponent(btn.getAttribute("data-alter"));
        const alter = JSON.parse(alterJson);
        chatWithAlter(alter);
      });
    });

    // Favorite buttons
    container.querySelectorAll(".favorite-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(btn);
      });
    });

    // Share buttons
    container.querySelectorAll(".share-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        shareAlter(btn);
      });
    });
  }

  async function deleteAlter(alterId) {
    if (!confirm("Are you sure you want to delete this alter?")) {
      return;
    }

    try {
      const response = await fetch(`/api/published-alters/${alterId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete alter");
      }

      // Remove from local array
      publishedAlters = publishedAlters.filter((alter) => alter.id !== alterId);

      // Refresh display
      filterAndDisplayAlters();

      showSuccess("Alter deleted successfully");
    } catch (error) {
      console.error("Error deleting alter:", error);
      showError("Failed to delete alter");
    }
  }

  function tryAlter(alter) {
    // For "try" we can either go to chat directly or to customize
    // Let's make "try" go directly to chat for immediate interaction
    chatWithAlter(alter);
  }

  function chatWithAlter(alter) {
    // Prepare comprehensive alter data for the chat page
    const alterForChat = {
      id: alter.id,
      name: alter.name,
      description: alter.description,
      // Ensure all possible image properties are included
      image: alter.image,
      avatar_url: alter.avatar_url,
      avatarUrl: alter.avatarUrl,
      profile_image: alter.profile_image,
      profileImage: alter.profileImage,
      // Always use the specific personality and prompt from the alter
      personality: alter.personality || alter.personality_description,
      prompt: alter.prompt || alter.system_prompt,
      knowledge: alter.knowledge || alter.category || "general",
      voice_id: alter.voice_id || alter.voiceId || "",
      category: alter.category,
      creator: alter.creator || alter.creator_name,
      rating: alter.rating,
      price: alter.price,
      type: alter.type,
      // Additional fields for published alters
      documentContent: alter.documentContent || "",
      documentUrl: alter.documentUrl || "",
      documentName: alter.documentName || "",
    };

    // Clear any existing avatar settings to prevent interference
    localStorage.removeItem("avatarSettings");

    // Pre-load the image using the image manager
    alterImageManager.handleAlterImage(alterForChat);

    // Save alter data for the chat page
    localStorage.setItem("selectedAlter", JSON.stringify(alterForChat));

    // Redirect to chat
    window.location.href = "/chat-alter";
  }

  function toggleFavorite(btn) {
    const icon = btn.querySelector("i");
    if (icon.classList.contains("ri-heart-line")) {
      icon.classList.remove("ri-heart-line");
      icon.classList.add("ri-heart-fill");
      btn.classList.add("text-red-500");
    } else {
      icon.classList.remove("ri-heart-fill");
      icon.classList.add("ri-heart-line");
      btn.classList.remove("text-red-500");
    }
  }

  function shareAlter(btn) {
    const alterCard = btn.closest(".alter-card");
    const alterName = alterCard.querySelector("h3").textContent;

    if (navigator.share) {
      navigator.share({
        title: `Check out ${alterName} on Alters.ai`,
        text: `Discover this amazing AI alter: ${alterName}`,
        url: window.location.href,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href).then(() => {
        showSuccess("Link copied to clipboard!");
      });
    }
  }

  function updateResultsCount() {
    const count = filteredAlters.length;
    const tabName = currentTab === "premade" ? "premade" : "published";
    resultsCount.textContent = `Showing ${count} ${tabName} alter${
      count !== 1 ? "s" : ""
    }`;
  }

  function showLoading(show) {
    loadingSpinner.style.display = show ? "block" : "none";
  }

  function showNoResults(show) {
    noResults.style.display = show ? "block" : "none";
  }

  function showSuccess(message) {
    // Simple toast notification
    const toast = document.createElement("div");
    toast.className =
      "fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg z-50";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function showError(message) {
    // Simple toast notification
    const toast = document.createElement("div");
    toast.className =
      "fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg z-50";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  // Initialize
  premadeAlters = mockPremadeAlters;
  showLoading(false);
  filterAndDisplayAlters();

  console.log("Marketplace Enhanced: Initialization complete");
});
