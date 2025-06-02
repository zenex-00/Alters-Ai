class AlterImageManager {
  constructor() {
    this.alterData = null;
    this.imageCache = new Map();
    this.init();
  }

  init() {
    // Load any cached alter data on initialization
    this.loadCachedAlterData();

    // Set up periodic cache cleanup
    setInterval(() => this.cleanupCache(), 3600000); // Cleanup every hour

    // Check for server restart
    this.checkServerRestart();
  }

  checkServerRestart() {
    // Get the last known server state
    const lastServerState = localStorage.getItem("serverState");
    const currentServerState = Date.now().toString();

    // If this is a fresh server start
    if (!lastServerState) {
      // Clear any temporary image data
      localStorage.removeItem("tempAlterImage");
      localStorage.removeItem("currentAlterImage");
    }

    // Update server state
    localStorage.setItem("serverState", currentServerState);
  }

  getAlterImageKey(alterId, type) {
    // Ensure clean key generation for different alter types
    const cleanId = String(alterId).replace(/^(premade_|published_)/, "");
    return `alterImage_${type}_${cleanId}`;
  }

  async loadCachedAlterData() {
    try {
      const cachedData = localStorage.getItem("alterData");
      if (cachedData) {
        this.alterData = JSON.parse(cachedData);

        // Check if we have a persistent image URL for this specific alter
        if (this.alterData.id) {
          const persistentImage = localStorage.getItem(
            this.getAlterImageKey(this.alterData.id, this.alterData.type)
          );
          if (persistentImage) {
            this.alterData.avatar_url = persistentImage;
            this.alterData.image = persistentImage;
          }
        }

        await this.loadAlterImage();
      }
    } catch (error) {
      console.error("Error loading cached alter data:", error);
    }
  }

  async loadAlterImage() {
    const avatarImage = document.getElementById("avatar-image");
    if (!avatarImage) {
      console.error("Avatar image element not found");
      return;
    }

    if (!this.alterData) {
      console.warn("No alter data available");
      return;
    }

    // For published alters, check for alter-specific persistent image first
    if (this.alterData.type === "published" && this.alterData.id) {
      const persistentImage = localStorage.getItem(
        this.getAlterImageKey(this.alterData.id, "published")
      );
      if (persistentImage) {
        console.log(
          "Using persistent image for published alter:",
          persistentImage
        );
        this.setImage(avatarImage, persistentImage);
        return;
      }

      // If no persistent image, try the Supabase URL
      const supabaseUrl = this.alterData.avatar_url || this.alterData.image;
      if (supabaseUrl && supabaseUrl.includes("supabase")) {
        console.log("Using Supabase URL for published alter:", supabaseUrl);
        this.setImage(avatarImage, supabaseUrl);
        // Store this as persistent for this specific alter
        localStorage.setItem(
          this.getAlterImageKey(this.alterData.id, "published"),
          supabaseUrl
        );
        return;
      }
    }

    // For premade alters
    if (this.alterData.type === "premade") {
      const persistentImage = localStorage.getItem(
        this.getAlterImageKey(this.alterData.id, "premade")
      );
      if (persistentImage) {
        console.log(
          "Using persistent image for premade alter:",
          persistentImage
        );
        this.setImage(avatarImage, persistentImage);
        return;
      }
    }

    // For custom alters (from chat.html)
    if (this.alterData.type === "custom") {
      const persistentImage = localStorage.getItem(
        this.getAlterImageKey(this.alterData.id, "custom")
      );
      if (persistentImage) {
        console.log(
          "Using persistent image for custom alter:",
          persistentImage
        );
        this.setImage(avatarImage, persistentImage);
        return;
      }
    }

    // If no persistent image found, try loading from sources
    const imageSources = this.getImageSources();

    // Try to load from cache first
    for (const source of imageSources) {
      if (this.imageCache.has(source)) {
        const cachedImage = this.imageCache.get(source);
        if (await this.verifyImage(cachedImage)) {
          this.setImage(avatarImage, cachedImage);
          return;
        }
      }
    }

    // If not in cache, try loading from sources
    for (const source of imageSources) {
      try {
        if (await this.verifyImage(source)) {
          this.setImage(avatarImage, source);
          this.imageCache.set(source, source);
          return;
        }
      } catch (error) {
        console.warn(`Failed to load image from ${source}:`, error);
      }
    }

    // If all sources fail, use placeholder
    this.setImage(avatarImage, "/placeholder.svg");
  }

  getImageSources() {
    if (!this.alterData) return ["/placeholder.svg"];

    // For published alters
    if (this.alterData.type === "published") {
      const persistentImage = localStorage.getItem(
        this.getAlterImageKey(this.alterData.id, "published")
      );
      if (persistentImage) {
        return [persistentImage, "/placeholder.svg"];
      }

      const supabaseUrl = this.alterData.avatar_url || this.alterData.image;
      if (supabaseUrl && supabaseUrl.includes("supabase")) {
        return [supabaseUrl, "/placeholder.svg"];
      }
    }

    // For premade alters
    if (this.alterData.type === "premade") {
      const persistentImage = localStorage.getItem(
        this.getAlterImageKey(this.alterData.id, "premade")
      );
      if (persistentImage) {
        return [persistentImage, "/placeholder.svg"];
      }
    }

    // For custom alters
    if (this.alterData.type === "custom") {
      const persistentImage = localStorage.getItem(
        this.getAlterImageKey(this.alterData.id, "custom")
      );
      if (persistentImage) {
        return [persistentImage, "/placeholder.svg"];
      }
    }

    // Default image sources
    return [
      this.alterData.image,
      this.alterData.avatar_url,
      this.alterData.avatarUrl,
      this.alterData.profile_image,
      this.alterData.profileImage,
      "/placeholder.svg",
    ].filter(Boolean);
  }

  async verifyImage(url) {
    if (!url) return false;

    // Skip verification for Supabase URLs and persistent images
    if (
      url.includes("supabase") ||
      (this.alterData &&
        this.alterData.id &&
        url ===
          localStorage.getItem(
            this.getAlterImageKey(this.alterData.id, this.alterData.type)
          ))
    ) {
      return true;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        img.src = "";
        reject(new Error("Image load timeout"));
      }, 5000);

      img.onload = () => {
        clearTimeout(timeout);
        resolve(true);
      };

      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Image failed to load"));
      };

      img.src = url;
    });
  }

  setImage(element, url) {
    if (!url) {
      console.warn("No image URL provided");
      url = "/placeholder.svg";
    }

    // Don't use readdy.ai URLs if we can avoid it
    if (url.includes("readdy.ai") && this.alterData && this.alterData.id) {
      const imageKey = this.getAlterImageKey(
        this.alterData.id,
        this.alterData.type
      );
      const persistentImage = localStorage.getItem(imageKey);

      // If we have a better alternative, use it
      if (persistentImage && !persistentImage.includes("readdy.ai")) {
        console.log(
          "Avoiding readdy.ai URL, using persistent alternative:",
          persistentImage
        );
        url = persistentImage;
      } else {
        console.warn("Using readdy.ai URL as last resort:", url);
      }
    }

    // Store the URL before setting it
    const imageUrl = url;

    // Set the image
    element.src = imageUrl;
    element.style.display = "block";

    // Store the current image URL in sessionStorage for persistence
    sessionStorage.setItem("currentAlterImage", imageUrl);

    // For published alters, store the image URL persistently for this specific alter
    if (this.alterData && this.alterData.id) {
      // Only store high-quality URLs (Supabase, not readdy.ai or placeholder)
      if (
        imageUrl.includes("supabase") ||
        (imageUrl !== "/placeholder.svg" && !imageUrl.includes("readdy.ai"))
      ) {
        localStorage.setItem(
          this.getAlterImageKey(this.alterData.id, this.alterData.type),
          imageUrl
        );
      }
    }

    // Log the image being set
    console.log("Setting image:", imageUrl);
  }

  setAlterData(alterData) {
    // Ensure we have a type
    if (!alterData.type) {
      alterData.type = "custom"; // Default to custom if not specified
    }

    // Create a clean copy to avoid reference issues
    const cleanAlterData = { ...alterData };

    // Get clean ID for key generation
    const cleanId = String(cleanAlterData.id).replace(
      /^(premade_|published_)/,
      ""
    );

    // Clear any existing cached image for this alter to force fresh load
    const imageKey = this.getAlterImageKey(cleanId, cleanAlterData.type);

    // For published alters, check if we have a fresh image URL
    if (cleanAlterData.type === "published" && cleanAlterData.id) {
      const supabaseUrl = cleanAlterData.avatar_url || cleanAlterData.image;
      if (supabaseUrl && supabaseUrl.includes("supabase")) {
        // Always use the fresh Supabase URL and update persistent storage
        cleanAlterData.avatar_url = supabaseUrl;
        cleanAlterData.image = supabaseUrl;
        localStorage.setItem(imageKey, supabaseUrl);
        console.log(
          "Updated persistent image for published alter:",
          supabaseUrl
        );
      } else {
        // Fallback to persistent image only if no fresh URL
        const persistentImage = localStorage.getItem(imageKey);
        if (persistentImage) {
          cleanAlterData.avatar_url = persistentImage;
          cleanAlterData.image = persistentImage;
        }
      }
    }

    // For premade alters, prevent readdy.ai from overriding Supabase
    if (cleanAlterData.type === "premade" && cleanAlterData.id) {
      const incomingImage = cleanAlterData.avatar_url || cleanAlterData.image;
      const persistentImage = localStorage.getItem(imageKey);

      // If we have a Supabase URL in storage, keep it
      if (persistentImage && persistentImage.includes("supabase")) {
        cleanAlterData.avatar_url = persistentImage;
        cleanAlterData.image = persistentImage;
        console.log(
          "Keeping Supabase image for premade alter:",
          persistentImage
        );
      }
      // Only update with incoming if it's not readdy.ai and better than what we have
      else if (incomingImage && !incomingImage.includes("readdy.ai")) {
        localStorage.setItem(imageKey, incomingImage);
        console.log(
          "Updated persistent image for premade alter:",
          incomingImage
        );
      }
      // If incoming is readdy.ai, don't store it, use existing if available
      else if (incomingImage && incomingImage.includes("readdy.ai")) {
        if (persistentImage && !persistentImage.includes("readdy.ai")) {
          cleanAlterData.avatar_url = persistentImage;
          cleanAlterData.image = persistentImage;
          console.log(
            "Avoiding readdy.ai, using existing image:",
            persistentImage
          );
        } else {
          console.log("No better alternative to readdy.ai URL available");
          // Don't store readdy.ai URLs
        }
      }
      // Fallback to persistent image
      else if (persistentImage) {
        cleanAlterData.avatar_url = persistentImage;
        cleanAlterData.image = persistentImage;
      }
    }

    // For custom alters
    if (cleanAlterData.type === "custom" && cleanAlterData.id) {
      const incomingImage = cleanAlterData.avatar_url || cleanAlterData.image;
      if (incomingImage) {
        localStorage.setItem(imageKey, incomingImage);
        console.log(
          "Updated persistent image for custom alter:",
          incomingImage
        );
      } else {
        const persistentImage = localStorage.getItem(imageKey);
        if (persistentImage) {
          cleanAlterData.avatar_url = persistentImage;
          cleanAlterData.image = persistentImage;
        }
      }
    }

    // Clear image cache for this alter to force fresh verification
    const imageSources = this.getImageSources();
    imageSources.forEach((source) => {
      if (this.imageCache.has(source)) {
        this.imageCache.delete(source);
      }
    });

    this.alterData = cleanAlterData;
    localStorage.setItem("alterData", JSON.stringify(cleanAlterData));
    this.loadAlterImage();
  }

  cleanupCache() {
    // Remove entries older than 24 hours
    const now = Date.now();
    for (const [key, value] of this.imageCache.entries()) {
      if (now - value.timestamp > 86400000) {
        this.imageCache.delete(key);
      }
    }
  }

  // Method to clear specific alter's cached data
  clearAlterCache(alterId, type) {
    const cleanId = String(alterId).replace(/^(premade_|published_)/, "");
    const imageKey = this.getAlterImageKey(cleanId, type);

    // Remove from localStorage
    localStorage.removeItem(imageKey);

    // Clear from image cache
    this.imageCache.clear();

    console.log(`Cleared cache for alter ${cleanId} of type ${type}`);
  }

  // Method to force refresh an alter's image
  refreshAlterImage(alterData) {
    if (alterData && alterData.id && alterData.type) {
      // Clear the cache first
      this.clearAlterCache(alterData.id, alterData.type);

      // Set the alter data which will reload the image
      this.setAlterData(alterData);
    }
  }

  // Method to handle both premade and published alters
  async handleAlterImage(alter) {
    // Ensure we have a type
    if (!alter.type) {
      alter.type = "custom"; // Default to custom if not specified
    }

    const cleanId = String(alter.id).replace(/^(premade_|published_)/, "");
    const imageKey = this.getAlterImageKey(cleanId, alter.type);

    // For published alters, prioritize fresh Supabase URLs
    if (alter.type === "published" && alter.id) {
      const supabaseUrl = alter.avatar_url || alter.image;
      if (supabaseUrl && supabaseUrl.includes("supabase")) {
        // Always use fresh Supabase URL - this ensures updated images are used
        alter.avatar_url = supabaseUrl;
        alter.image = supabaseUrl;
        localStorage.setItem(imageKey, supabaseUrl);
        console.log(
          "Using fresh Supabase URL for published alter:",
          supabaseUrl
        );
      } else {
        // Fallback to persistent image only if no Supabase URL
        const persistentImage = localStorage.getItem(imageKey);
        if (persistentImage) {
          alter.avatar_url = persistentImage;
          alter.image = persistentImage;
        }
      }
    }

    // For premade alters, prioritize Supabase URLs over readdy.ai
    if (alter.type === "premade" && alter.id) {
      const incomingImage = alter.avatar_url || alter.image;
      const persistentImage = localStorage.getItem(imageKey);

      // If we have a Supabase URL in persistent storage, use it
      if (persistentImage && persistentImage.includes("supabase")) {
        alter.avatar_url = persistentImage;
        alter.image = persistentImage;
        console.log(
          "Using persistent Supabase image for premade alter:",
          persistentImage
        );
      }
      // Only use incoming image if it's not a readdy.ai URL and we don't have Supabase
      else if (incomingImage && !incomingImage.includes("readdy.ai")) {
        localStorage.setItem(imageKey, incomingImage);
        console.log("Using fresh image for premade alter:", incomingImage);
      }
      // If incoming is readdy.ai but we have any persistent image, use persistent
      else if (
        incomingImage &&
        incomingImage.includes("readdy.ai") &&
        persistentImage
      ) {
        alter.avatar_url = persistentImage;
        alter.image = persistentImage;
        console.log(
          "Avoiding readdy.ai URL, using persistent image:",
          persistentImage
        );
      }
      // Last resort: use incoming even if readdy.ai (but don't store it)
      else if (incomingImage) {
        console.log(
          "Using readdy.ai as last resort for premade alter:",
          incomingImage
        );
        // Don't store readdy.ai URLs in localStorage
      }
    }

    // For custom alters
    if (alter.type === "custom" && alter.id) {
      const incomingImage = alter.avatar_url || alter.image;
      if (incomingImage) {
        localStorage.setItem(imageKey, incomingImage);
        console.log("Using fresh image for custom alter:", incomingImage);
      } else {
        const persistentImage = localStorage.getItem(imageKey);
        if (persistentImage) {
          alter.avatar_url = persistentImage;
          alter.image = persistentImage;
        }
      }
    }

    // Clear any cached versions to force fresh verification
    this.imageCache.clear();

    // Set the alter data
    this.setAlterData(alter);
  }
}

// Create and export a singleton instance
const alterImageManager = new AlterImageManager();
export default alterImageManager;
