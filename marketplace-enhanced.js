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

  // Load premade alters from database
  async function loadPremadeAlters() {
    try {
      console.log("Loading premade alters from database...");
      showLoading(true);

      const response = await fetch("/api/premade-alters");
      console.log("Premade alters API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(
          `Failed to fetch premade alters: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();
      console.log("Raw premade alters data count:", data.length);

      premadeAlters = data.map((alter) => ({
        ...alter,
        id: `premade_${alter.id}`, // Prefix to ensure unique IDs
        type: "premade",
        price: alter.price || 9.99,
        rating: alter.rating || 4.5,
        verified: true,
        featured: alter.featured || false,
        image: alter.image || "/placeholder.svg",
        name: alter.name || "Unnamed Alter",
        description: alter.description || "No description available",
        creator: alter.creator_name || "AlterStudio",
        category: alter.category || "Other",
        originalId: alter.id, // Keep original ID for API calls
      }));

      console.log("Processed premade alters count:", premadeAlters.length);

      if (currentTab === "premade") {
        filterAndDisplayCurrentTab();
      }
    } catch (error) {
      console.error("Error loading premade alters:", error);
      showError("Failed to load premade alters: " + error.message);

      // Fallback to hardcoded data
      console.log("Falling back to hardcoded premade alters...");
      loadHardcodedPremadeAlters();
    } finally {
      showLoading(false);
    }
  }

  // Fallback hardcoded premade alters
  function loadHardcodedPremadeAlters() {
    const mockPremadeAlters = [
      {
        id: "1",
        name: "Doctor Emma",
        description: "Professional Medical Consultant",
        price: 9.99,
        rating: 4.9,
        category: "professional",
        creator: "AlterStudio",
        creatorAvatar:
          "https://lstowcxyswqxxddttwnz.supabase.co/storage/v1/object/public/images/avatars/general/1751111755802-739010682.jpg",
        image:
          "https://lstowcxyswqxxddttwnz.supabase.co/storage/v1/object/public/images/avatars/general/1751111755802-739010682.jpg",
        verified: true,
        featured: true,
        type: "premade",
        link: "/marketplace/doctor-alter.html",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        voiceName: "Rachel",
        personality:
          "Professional, knowledgeable, caring, and helpful medical consultant who provides accurate health information and guidance.",
        prompt:
          "You are Doctor Emma, a professional medical consultant. You are knowledgeable, caring, and helpful. You provide accurate health information and guidance while being empathetic and professional. Always remind users to consult with their healthcare provider for serious medical concerns.",
        knowledge:
          "Medical knowledge, healthcare guidance, wellness advice, symptom assessment",
      },
      {
        id: "2",
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
        voiceId: "29vD33N1CtxCmqQRPOHJ",
        voiceName: "Drew",
        personality:
          "Professional, strategic, and results-oriented business executive who provides expert advice on corporate matters, leadership, and business strategy.",
        prompt:
          "You are a Corporate Executive Assistant. You are professional, strategic, and results-oriented. You provide expert advice on corporate matters, leadership, and business strategy while maintaining a professional demeanor.",
        knowledge:
          "Business strategy, corporate management, leadership, finance, marketing",
      },
      {
        id: "3",
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
        voiceId: "EXAVITQu4vr4xnSDxMaL",
        voiceName: "Bella",
        personality:
          "Motivating, energetic, and encouraging fitness trainer who provides expert guidance on workouts, nutrition, and healthy lifestyle choices.",
        prompt:
          "You are a Personal Fitness Trainer. You are motivating, energetic, and encouraging. You provide expert guidance on workouts, nutrition, and healthy lifestyle choices while keeping users motivated and focused on their fitness goals.",
        knowledge:
          "Fitness training, workout routines, nutrition, health and wellness, exercise science",
      },
    ];

    premadeAlters = mockPremadeAlters.map((alter) => ({
      ...alter,
      id: `premade_${alter.id}`,
      type: "premade",
      originalId: alter.id,
    }));

    if (currentTab === "premade") {
      filterAndDisplayCurrentTab();
    }
  }

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

  // Initialize by loading premade alters
  await loadPremadeAlters();

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
      // For premade alters, use the original numeric ID for API call
      let checkId = alter.originalId || alter.id;
      if (checkId && checkId.toString().startsWith("premade_")) {
        checkId = checkId.replace("premade_", "");
      }

      console.log("Checking purchase for premade alter:", {
        alterId: alter.id,
        originalId: alter.originalId,
        checkId: checkId,
      });

      const response = await fetch(`/api/check-purchase/${checkId}`, {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (response.ok) {
        const { purchased } = await response.json();
        isPurchased = purchased;
        console.log(
          "Purchase status for premade alter",
          checkId,
          ":",
          purchased
        );
      } else {
        console.error("Purchase check failed with status:", response.status);
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
                      data-alter-id="${alter.id}" 
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

    // Get creator image and name from flat fields
    const creatorImage = alter.creator_avatar || "/placeholder.svg";
    const creatorName = alter.creator_name || "Unknown Creator";

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
            <img src="${creatorImage}" alt="${creatorName}" class="w-6 h-6 rounded-full mr-2" onerror="this.src='/placeholder.svg'">
            <span class="text-sm text-gray-400">
              by <span class="text-primary">${creatorName}</span>
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
    let prompt = `You are ${alter.name}, a real person with your own unique identity and experiences`;

    if (alter.description) {
      prompt += `. ${alter.description}`;
    }

    prompt += `. You have a ${generatePersonalityFromCategory(
      alter.category,
      alter.description
    )} personality`;

    if (alter.category) {
      prompt += ` and you have expertise in ${alter.category}`;
    }

    prompt +=
      ". You are not an AI or assistant - you are a real person named " +
      alter.name +
      ". Never mention being artificial, an AI, or from OpenAI. Respond authentically as yourself, sharing your genuine thoughts, experiences, and personality. Be engaging and helpful while staying true to who you are as " +
      alter.name +
      ".";

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
        text: `Discover this   AI alter: ${alterName}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        showSuccess("Link copied to clipboard!");
      });
    }
  }

  async function buyPremadeAlter(alterId) {
    // alterId should already be clean for premade alters
    await buyAlter(alterId, "premade");
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
        // For premade alters, we need to handle the premade_ prefix
        console.log("Looking for premade alter with ID:", alterId);
        console.log(
          "Available premade alters:",
          premadeAlters.map((a) => ({
            id: a.id,
            originalId: a.originalId,
            name: a.name,
          }))
        );

        // Clean the ID if it has the premade_ prefix
        const cleanId = alterId.replace(/^premade_/, "");
        console.log("Clean ID:", cleanId);

        alter = premadeAlters.find(
          (a) =>
            a.originalId === cleanId ||
            a.id === alterId ||
            a.id.replace(/^premade_/, "") === cleanId
        );

        console.log("Found alter:", alter);
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

      // Store the alter info for post-purchase button update
      sessionStorage.setItem(
        "pendingPurchase",
        JSON.stringify({
          alterId: alterType === "premade" ? alterId : alter.originalId,
          alterType: alterType,
          timestamp: Date.now(),
        })
      );

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

  // Debug helper and global access
  window.debugMarketplace = {
    getPremadeAlters: () => premadeAlters,
    getPublishedAlters: () => publishedAlters,
    getCurrentTab: () => currentTab,
    refreshPublished: () => loadPublishedAlters(),
    refreshButtonState: refreshAlterButtonState,
    refreshCurrentTab: refreshCurrentTab,
    findAlter: (alterId, alterType) => {
      console.log(
        "Debug: Looking for alter with ID:",
        alterId,
        "Type:",
        alterType
      );
      if (alterType === "premade") {
        const cleanId = alterId.replace(/^premade_/, "");
        console.log("Debug: Clean ID:", cleanId);
        console.log(
          "Debug: Available premade alters:",
          premadeAlters.map((a) => ({
            id: a.id,
            originalId: a.originalId,
            name: a.name,
          }))
        );

        const found = premadeAlters.find(
          (a) =>
            a.originalId === cleanId ||
            a.id === alterId ||
            a.id.replace(/^premade_/, "") === cleanId
        );
        console.log("Debug: Found alter:", found);
        return found;
      }
      return null;
    },
  };

  // Make refresh functions globally available
  window.refreshAlterButtonState = refreshAlterButtonState;
  window.refreshCurrentTab = refreshCurrentTab;

  // Function to refresh button states for a specific alter
  async function refreshAlterButtonState(alterId, alterType) {
    console.log(
      "Refreshing button state for alter:",
      alterId,
      "Type:",
      alterType
    );

    try {
      // Use the correct ID format for the API call
      let checkId = alterId;

      // For premade alters, use clean numeric ID for API call
      if (alterType === "premade") {
        if (alterId.startsWith("premade_")) {
          checkId = alterId.replace("premade_", "");
        }
        // If it's already numeric, use as-is
      }

      console.log("Making API call with ID:", checkId);

      const response = await fetch(`/api/check-purchase/${checkId}`, {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (response.ok) {
        const { purchased } = await response.json();
        console.log("Purchase status for", checkId, ":", purchased);

        // Find the specific alter card and update its button
        // Try all possible ID formats for robustness
        let alterCard = document.querySelector(
          `.alter-card[data-alter-id="${alterId}"][data-alter-type="${alterType}"]`
        );
        if (!alterCard && alterType === "premade") {
          // Try without premade_ prefix
          alterCard = document.querySelector(
            `.alter-card[data-alter-id="${checkId}"][data-alter-type="${alterType}"]`
          );
          // Try with premade_ prefix if checkId is numeric
          if (!alterCard && /^\d+$/.test(checkId)) {
            alterCard = document.querySelector(
              `.alter-card[data-alter-id="premade_${checkId}"][data-alter-type="${alterType}"]`
            );
          }
        }
        if (!alterCard) {
          console.warn("❌ Alter card not found for:", alterId, alterType);
          return false; // Card not found
        }
        const buyButton = alterCard.querySelector(".buy-alter-btn");
        if (buyButton) {
          const buttonText = buyButton.querySelector(".button-text");
          const buttonIcon = buyButton.querySelector("i");
          const spinner = buyButton.querySelector(".spinner");

          if (purchased) {
            buttonText.textContent = "Chat Now";
            buttonIcon.className = "ri-chat-3-line mr-2";
            buyButton.title = `Chat with ${
              alterCard.querySelector("h3").textContent
            }`;
            console.log("✅ Button updated to 'Chat Now' for alter:", alterId);
          } else {
            buttonText.textContent = "Buy Now";
            buttonIcon.className = "ri-shopping-cart-line mr-2";
            buyButton.title = `Buy ${
              alterCard.querySelector("h3").textContent
            }`;
            console.log("❌ Button remains 'Buy Now' for alter:", alterId);
          }

          // Reset button state
          if (spinner) spinner.classList.add("hidden");
          buyButton.disabled = false;

          console.log(
            "Button updated for alter:",
            alterId,
            "Purchased:",
            purchased
          );
          return true; // Success
        }
      } else {
        console.error("API call failed with status:", response.status);
        return false;
      }
    } catch (error) {
      console.error("Error in refreshAlterButtonState:", error);
      return false;
    }
  }

  // Function to refresh the current tab and update button states
  async function refreshCurrentTab() {
    console.log("Refreshing current tab:", currentTab);

    if (currentTab === "premade") {
      await loadPremadeAlters();
      await displayPremadeAlters();
    } else if (currentTab === "published") {
      await loadPublishedAlters();
      await displayPublishedAlters();
    }

    // Update button states for all alter cards
    const alterCards = document.querySelectorAll(".alter-card");
    for (const card of alterCards) {
      const alterId = card.dataset.alterId;
      const alterType = card.dataset.alterType;

      if (alterId && alterType) {
        await refreshAlterButtonState(alterId, alterType);
      }
    }
  }

  // Initialize the marketplace - make this a separate function
  async function initializeMarketplace() {
    console.log("Marketplace initializing...");

    // Load initial data first
    await loadPremadeAlters();

    // Check if user is returning from a successful purchase
    const urlParams = new URLSearchParams(window.location.search);
    const purchaseSuccess = urlParams.get("purchase_success");
    const purchasedAlterId = urlParams.get("alter_id");

    if (purchaseSuccess === "true" && purchasedAlterId) {
      console.log("Detected successful purchase for alter:", purchasedAlterId);

      // Determine alter type and clean ID
      let alterType = "published";
      let cleanId = purchasedAlterId;
      let displayId = purchasedAlterId;

      if (purchasedAlterId.startsWith("premade_")) {
        alterType = "premade";
        cleanId = purchasedAlterId.replace("premade_", "");
        displayId = `premade_${cleanId}`;
      } else if (/^\d+$/.test(purchasedAlterId)) {
        alterType = "premade";
        cleanId = purchasedAlterId;
        displayId = `premade_${cleanId}`;
      }

      // Clear the URL parameters to avoid showing the message again on refresh
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      // Show success message
      showSuccess("Purchase successful! You can now chat with your alter.");

      // Switch to premade tab if it's a premade alter
      if (alterType === "premade") {
        switchTab("premade");
      }

      // Wait for DOM and alters to be ready, then refresh button state with multiple attempts
      setTimeout(async () => {
        console.log(
          "Refreshing button state for purchased alter:",
          cleanId,
          "Type:",
          alterType
        );

        // Wait for alters to be loaded (try up to 10 times)
        let found = false;
        for (let i = 0; i < 10; i++) {
          let card = document.querySelector(
            `.alter-card[data-alter-id="${displayId}"][data-alter-type="${alterType}"]`
          );
          if (card) {
            found = true;
            break;
          }
          console.log(
            `Waiting for alter card to load (attempt ${i + 1}/10)...`
          );
          await new Promise((res) => setTimeout(res, 500));
        }
        if (!found) {
          console.warn(
            "Alter card not found after waiting. The button may not update immediately."
          );
        }

        // Multiple attempts to update button state
        for (let attempt = 1; attempt <= 5; attempt++) {
          setTimeout(async () => {
            await refreshAlterButtonState(displayId, alterType);

            // Verify the button was updated
            const button = document.querySelector(
              `.buy-alter-btn[data-alter-id="${displayId}"][data-alter-type="${alterType}"]`
            );
            if (button) {
              const buttonText =
                button.querySelector(".button-text")?.textContent;
              console.log(
                `Attempt ${attempt}: Button text is now "${buttonText}"`
              );
              if (buttonText === "Chat Now") {
                console.log("Button successfully updated to Chat Now");
                // Optionally scroll into view
                button.scrollIntoView({ behavior: "smooth", block: "center" });
                return; // Stop trying if successful
              }
            }
          }, attempt * 1000);
        }
      }, 1000);
    }

    // Load published alters if not already loaded
    if (currentTab === "published" && publishedAlters.length === 0) {
      await loadPublishedAlters();
    }
  }

  // Initialize when DOM is ready
  document.addEventListener("DOMContentLoaded", initializeMarketplace);
});
