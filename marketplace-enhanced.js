import alterImageManager from "./alter-image-manager.js";

// Initialize Stripe
const stripe = Stripe(
  "pk_test_51RGlGVI7ArCWlaxqdMKur3Eb3SCI17n6eWHknRzqdSGKjPCYZilKB9wXCIBKdhGWMzDOxMw01b17eSiDl1L5kiap009eiIlIPt"
);

// Enhanced marketplace functionality with proper tab integration
document.addEventListener("DOMContentLoaded", async () => {
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

  // State - Separate for each alter type
  let currentTab = "premade";
  let premadeAlters = [];
  let publishedAlters = [];
  let filteredPremadeAlters = [];
  let filteredPublishedAlters = [];

  // Error handling for critical elements
  if (!premadeTab || !publishedTab || !premadeContent || !publishedContent) {
    console.error("Critical tab elements not found");
    return;
  }

  // Initialize premade alters data
  const mockPremadeAlters = [
    {
      id: "premade_1",
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
      id: "premade_2",
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
      id: "premade_3",
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

  // Add styles for buy button loading state
  const style = document.createElement("style");
  style.textContent = `
    .buy-alter-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
    .buy-alter-btn .spinner {
      transition: opacity 0.2s ease-in-out;
    }
    .buy-alter-btn .spinner.hidden {
      opacity: 0;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Tab switching functionality
  premadeTab.addEventListener("click", () => {
    switchTab("premade");
  });

  publishedTab.addEventListener("click", async () => {
    showLoading(true);
    try {
      switchTab("published");
      await loadPublishedAlters();
      console.log("Published alters loaded after tab switch");
    } catch (error) {
      console.error("Error loading published alters on tab switch:", error);
      showError(
        "Failed to load published alters. Please try refreshing the page."
      );
    } finally {
      showLoading(false);
    }
  });

  // Category filter from navigation
  categoryLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const category = link.getAttribute("data-category");
      categoryFilter.value = category;
      filterAndDisplayCurrentTab();
    });
  });

  // Filter event listeners
  categoryFilter.addEventListener("change", filterAndDisplayCurrentTab);
  searchInput.addEventListener("input", filterAndDisplayCurrentTab);
  sortFilter.addEventListener("change", filterAndDisplayCurrentTab);

  function switchTab(tab) {
    currentTab = tab;

    // Update tab buttons
    premadeTab.classList.toggle("active", tab === "premade");
    publishedTab.classList.toggle("active", tab === "published");

    // Update content visibility
    premadeContent.style.display = tab === "premade" ? "grid" : "none";
    publishedContent.style.display = tab === "published" ? "grid" : "none";

    // Filter and display current tab's alters
    filterAndDisplayCurrentTab();
  }

  async function loadPublishedAlters() {
    try {
      console.log("Starting to load published alters...");
      showLoading(true);

      const response = await fetch("/api/published-alters");
      console.log("Published alters API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(
          `Failed to fetch published alters: ${response.status} ${errorText}`
        );
      }

      const alters = await response.json();
      console.log("Raw published alters data count:", alters.length);

      publishedAlters = alters.map((alter) => ({
        ...alter,
        id: `published_${alter.id}`, // Prefix to ensure unique IDs
        type: "published",
        price: alter.price || 9.99,
        rating: alter.rating || 4.5,
        verified: true,
        featured: false,
        image: alter.avatar_url || alter.image || "/placeholder.svg",
        name: alter.name || "Unnamed Alter",
        description: alter.description || "No description available",
        creator: alter.creator_name || "Unknown Creator",
        category: alter.category || "Other",
        originalId: alter.id, // Keep original ID for API calls
      }));

      console.log("Processed published alters count:", publishedAlters.length);

      if (currentTab === "published") {
        filterAndDisplayCurrentTab();
      }
    } catch (error) {
      console.error("Error loading published alters:", error);
      showError("Failed to load published alters: " + error.message);
    } finally {
      showLoading(false);
    }
  }

  function filterAndDisplayCurrentTab() {
    if (currentTab === "premade") {
      filterAndDisplayPremadeAlters();
    } else {
      filterAndDisplayPublishedAlters();
    }
  }

  function filterAndDisplayPremadeAlters() {
    const searchTerm = searchInput.value.toLowerCase();
    const category = categoryFilter.value;
    const sortBy = sortFilter.value;

    // Filter premade alters
    filteredPremadeAlters = premadeAlters.filter((alter) => {
      const matchesSearch =
        alter.name.toLowerCase().includes(searchTerm) ||
        alter.description.toLowerCase().includes(searchTerm);
      const matchesCategory = category === "all" || alter.category === category;
      return matchesSearch && matchesCategory;
    });

    // Sort premade alters
    sortAlters(filteredPremadeAlters, sortBy);

    displayPremadeAlters();
    updateResultsCount(filteredPremadeAlters.length, "premade");
  }

  function filterAndDisplayPublishedAlters() {
    const searchTerm = searchInput.value.toLowerCase();
    const category = categoryFilter.value;
    const sortBy = sortFilter.value;

    // Filter published alters
    filteredPublishedAlters = publishedAlters.filter((alter) => {
      const matchesSearch =
        alter.name.toLowerCase().includes(searchTerm) ||
        alter.description.toLowerCase().includes(searchTerm);
      const matchesCategory = category === "all" || alter.category === category;
      return matchesSearch && matchesCategory;
    });

    // Sort published alters
    sortAlters(filteredPublishedAlters, sortBy);

    displayPublishedAlters();
    updateResultsCount(filteredPublishedAlters.length, "published");
  }

  function sortAlters(altersArray, sortBy) {
    altersArray.sort((a, b) => {
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
  }

  async function displayPremadeAlters() {
    const container = premadeContent;

    if (filteredPremadeAlters.length === 0) {
      container.innerHTML = "";
      showNoResults(true);
      return;
    }

    showNoResults(false);

    const alterCards = await Promise.all(
      filteredPremadeAlters.map((alter) => createPremadeAlterCard(alter))
    );
    container.innerHTML = alterCards.join("");

    addPremadeCardEventListeners(container);
  }

  async function displayPublishedAlters() {
    const container = publishedContent;

    if (filteredPublishedAlters.length === 0) {
      container.innerHTML = "";
      showNoResults(true);
      return;
    }

    showNoResults(false);

    const alterCards = await Promise.all(
      filteredPublishedAlters.map((alter) => createPublishedAlterCard(alter))
    );
    container.innerHTML = alterCards.join("");

    addPublishedCardEventListeners(container);
  }

  async function createPremadeAlterCard(alter) {
    const isOwner = false; // Premade alters are not owned by users

    // Enhanced alter for chat with generated personality/prompt
    const enhancedAlter = {
      ...alter,
      personality: generatePersonalityFromCategory(
        alter.category,
        alter.description
      ),
      prompt: generatePromptFromAlter(alter),
    };

    // Check if alter is purchased
    let isPurchased = false;
    try {
      // For premade alters, use clean ID without prefix
      const checkId = alter.id.replace(/^premade_/, "");
      const response = await fetch(`/api/check-purchase/${checkId}`);
      if (response.ok) {
        const { purchased } = await response.json();
        isPurchased = purchased;
      }
    } catch (error) {
      console.error("Error checking purchase status:", error);
    }

    const buttonText = isPurchased ? "Chat Now" : "Buy Now";
    const buttonIcon = isPurchased ? "ri-chat-3-line" : "ri-shopping-cart-line";
    const buttonTitle = isPurchased
      ? `Chat with ${alter.name}`
      : `Buy ${alter.name}`;

    return `
      <div class="alter-card fade-in" data-alter-id="${
        alter.id
      }" data-alter-type="premade">
        <div class="relative">
          <img src="${alter.image || "/placeholder.svg"}" 
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
            <img src="${alter.creatorAvatar || "/placeholder.svg"}" 
                 alt="${alter.creator}" 
                 class="w-6 h-6 rounded-full mr-2">
            <span class="text-sm text-gray-400">
              by <span class="text-primary">${alter.creator || "Unknown"}</span>
            </span>
            ${
              alter.verified
                ? '<div class="ml-2 w-4 h-4 bg-primary bg-opacity-20 rounded-full flex items-center justify-center"><i class="ri-check-line text-primary text-xs"></i></div>'
                : ""
            }
          </div>

          <div class="flex items-center justify-between">
            <div class="text-xl font-bold">$${alter.price}</div>
            <div class="flex gap-2">
              <button class="bg-primary px-4 py-2 rounded-lg buy-alter-btn flex items-center justify-center min-w-[120px]" 
                      data-alter-id="${alter.id.replace(/^premade_/, "")}" 
                      data-alter-type="premade"
                      data-alter="${encodeURIComponent(
                        JSON.stringify(enhancedAlter)
                      )}"
                      title="${buttonTitle}">
                <i class="${buttonIcon} mr-2"></i>
                <span class="button-text">${buttonText}</span>
                <div class="hidden spinner ml-2">
                  <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function createPublishedAlterCard(alter) {
    const isOwner = alter.is_owner || false;

    // Enhanced alter for chat
    const enhancedAlter = {
      ...alter,
      personality:
        alter.personality ||
        generatePersonalityFromCategory(alter.category, alter.description),
      prompt: alter.prompt || generatePromptFromAlter(alter),
    };

    // Check if alter is purchased using original ID
    let isPurchased = false;
    try {
      const response = await fetch(`/api/check-purchase/${alter.originalId}`);
      if (response.ok) {
        const { purchased } = await response.json();
        isPurchased = purchased;
      }
    } catch (error) {
      console.error("Error checking purchase status:", error);
    }

    const buttonText = isPurchased ? "Chat Now" : "Buy Now";
    const buttonIcon = isPurchased ? "ri-chat-3-line" : "ri-shopping-cart-line";
    const buttonTitle = isPurchased
      ? `Chat with ${alter.name}`
      : `Buy ${alter.name}`;

    return `
      <div class="alter-card fade-in" data-alter-id="${
        alter.id
      }" data-alter-type="published">
        <div class="relative">
          <img src="${alter.image || "/placeholder.svg"}" 
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
            isOwner
              ? `<button class="delete-button" data-alter-id="${alter.originalId}" title="Delete alter"><i class="ri-delete-bin-line"></i></button>`
              : ""
          }
        </div>

        <div class="p-4">
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-bold text-lg truncate">${alter.name}</h3>
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
                 alt="${alter.creator}" 
                 class="w-6 h-6 rounded-full mr-2">
            <span class="text-sm text-gray-400">
              by <span class="text-primary">${alter.creator || "Unknown"}</span>
            </span>
            ${
              alter.verified
                ? '<div class="ml-2 w-4 h-4 bg-primary bg-opacity-20 rounded-full flex items-center justify-center"><i class="ri-check-line text-primary text-xs"></i></div>'
                : ""
            }
          </div>

          <div class="flex items-center justify-between">
            <div class="text-xl font-bold">$${alter.price}</div>
            <div class="flex gap-2">
              <button class="bg-primary px-4 py-2 rounded-lg buy-alter-btn flex items-center justify-center min-w-[120px]" 
                      data-alter-id="${alter.originalId}" 
                      data-alter-type="published"
                      data-alter="${encodeURIComponent(
                        JSON.stringify(enhancedAlter)
                      )}"
                      title="${buttonTitle}">
                <i class="${buttonIcon} mr-2"></i>
                <span class="button-text">${buttonText}</span>
                <div class="hidden spinner ml-2">
                  <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
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

  function addPremadeCardEventListeners(container) {
    // Buy/Chat buttons for premade alters
    container
      .querySelectorAll(".buy-alter-btn[data-alter-type='premade']")
      .forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          e.preventDefault();

          const alterId = btn.getAttribute("data-alter-id");
          const buttonText = btn.querySelector(".button-text").textContent;
          const alterData = JSON.parse(
            decodeURIComponent(btn.getAttribute("data-alter"))
          );

          if (buttonText === "Chat Now") {
            chatWithPremadeAlter(alterData);
          } else {
            await buyPremadeAlter(alterId);
          }
        });
      });

    // Common event listeners
    addCommonCardEventListeners(container);
  }

  function addPublishedCardEventListeners(container) {
    // Delete buttons for published alters
    container.querySelectorAll(".delete-button").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const alterId = btn.getAttribute("data-alter-id");
        deletePublishedAlter(alterId);
      });
    });

    // Buy/Chat buttons for published alters
    container
      .querySelectorAll(".buy-alter-btn[data-alter-type='published']")
      .forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          e.preventDefault();

          const alterId = btn.getAttribute("data-alter-id");
          const buttonText = btn.querySelector(".button-text").textContent;
          const alterData = JSON.parse(
            decodeURIComponent(btn.getAttribute("data-alter"))
          );

          if (buttonText === "Chat Now") {
            chatWithPublishedAlter(alterData);
          } else {
            await buyPublishedAlter(alterId);
          }
        });
      });

    // Common event listeners
    addCommonCardEventListeners(container);
  }

  function addCommonCardEventListeners(container) {
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

  async function deletePublishedAlter(alterId) {
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
      publishedAlters = publishedAlters.filter(
        (alter) => alter.originalId !== alterId
      );

      // Refresh display
      filterAndDisplayCurrentTab();

      showSuccess("Alter deleted successfully");
    } catch (error) {
      console.error("Error deleting alter:", error);
      showError("Failed to delete alter");
    }
  }

  function chatWithPremadeAlter(alter) {
    // Prepare alter data for chat with premade-specific handling
    const cleanId = alter.id.replace(/^premade_/, "");
    const alterForChat = {
      ...alter,
      id: cleanId, // Use clean ID for chat
      type: "premade",
      image: alter.image,
    };

    // Use alter image manager for premade alters
    alterImageManager.handleAlterImage(alterForChat);

    // Save alter data for the chat page
    localStorage.setItem("selectedAlter", JSON.stringify(alterForChat));

    // Redirect to chat
    window.location.href = "/chat-alter";
  }

  function chatWithPublishedAlter(alter) {
    // Prepare alter data for chat with published-specific handling
    const alterForChat = {
      ...alter,
      id: alter.originalId, // Use original ID for published alters
      type: "published",
      image: alter.image,
      avatar_url: alter.avatar_url,
    };

    // Use alter image manager for published alters
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
      navigator.clipboard.writeText(window.location.href).then(() => {
        showSuccess("Link copied to clipboard!");
      });
    }
  }

  async function buyPremadeAlter(alterId) {
    // Extract clean ID for premade alters (remove 'premade_' prefix)
    const cleanId = alterId.replace(/^premade_/, "");
    await buyAlter(cleanId, "premade");
  }

  async function buyPublishedAlter(alterId) {
    await buyAlter(alterId, "published");
  }

  async function buyAlter(alterId, alterType) {
    let buyButton;
    try {
      // Find and update the buy button state
      buyButton = document.querySelector(
        `.buy-alter-btn[data-alter-id="${alterId}"][data-alter-type="${alterType}"]`
      );
      if (buyButton) {
        const buttonText = buyButton.querySelector(".button-text");
        const spinner = buyButton.querySelector(".spinner");
        buttonText.textContent = "Processing...";
        spinner.classList.remove("hidden");
        buyButton.disabled = true;
      }

      showLoading(true);
      console.log("Starting buyAlter for ID:", alterId, "Type:", alterType);

      if (!alterId) {
        throw new Error(`Missing alter ID`);
      }

      // Find the alter in the appropriate array
      let alter;
      if (alterType === "premade") {
        alter = premadeAlters.find((a) => a.id === alterId);
      } else {
        alter = publishedAlters.find((a) => a.originalId === alterId);
      }

      if (!alter) {
        throw new Error(`Alter not found with ID: ${alterId}`);
      }

      // Create checkout session
      const response = await fetch("/create-alter-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alterId: alterType === "premade" ? alterId : alter.originalId,
          alterName: alter.name,
          price: alter.price,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const { id: sessionId } = await response.json();

      // Redirect to Stripe Checkout
      const result = await stripe.redirectToCheckout({
        sessionId: sessionId,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      console.error("Error in buyAlter:", error);
      showError(error.message || "Failed to process purchase");

      // Reset button state on error
      if (buyButton) {
        const buttonText = buyButton.querySelector(".button-text");
        const spinner = buyButton.querySelector(".spinner");
        buttonText.textContent = "Buy Now";
        spinner.classList.add("hidden");
        buyButton.disabled = false;
      }
    } finally {
      showLoading(false);
    }
  }

  function updateResultsCount(count, tabName) {
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
    const toast = document.createElement("div");
    toast.className =
      "fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg z-50";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function showError(message) {
    const toast = document.createElement("div");
    toast.className =
      "fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg z-50";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  // Initialize arrays and load initial data
  premadeAlters = mockPremadeAlters;
  publishedAlters = [];

  // Initialize with loading state
  showLoading(true);
  console.log("Starting marketplace initialization...");

  try {
    // Start with premade alters immediately
    filterAndDisplayCurrentTab();

    // Load published alters in parallel
    await loadPublishedAlters();

    console.log("Initial data load complete");
  } catch (error) {
    console.error("Error during initialization:", error);
    showError("Some content failed to load. Please refresh the page.");
  } finally {
    showLoading(false);
    console.log("Marketplace Enhanced: Initialization complete");
  }

  // Debug helper
  window.debugMarketplace = {
    getPremadeAlters: () => premadeAlters,
    getPublishedAlters: () => publishedAlters,
    getCurrentTab: () => currentTab,
    refreshPublished: () => loadPublishedAlters(),
  };
});
