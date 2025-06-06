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

    // Store the URL before setting it
    const imageUrl = url;

    // Set the image
    element.src = imageUrl;
    element.style.display = "block";

    // Store the current image URL in sessionStorage for persistence
    sessionStorage.setItem("currentAlterImage", imageUrl);

    // For published alters, store the image URL persistently for this specific alter
    if (this.alterData && this.alterData.id) {
      if (imageUrl.includes("supabase") || imageUrl !== "/placeholder.svg") {
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

    // For published alters, ensure we preserve the image URL for this specific alter
    if (cleanAlterData.type === "published" && cleanAlterData.id) {
      const persistentImage = localStorage.getItem(
        this.getAlterImageKey(cleanId, "published")
      );
      if (persistentImage) {
        cleanAlterData.avatar_url = persistentImage;
        cleanAlterData.image = persistentImage;
      } else {
        // If no persistent image, use Supabase URL
        const supabaseUrl = cleanAlterData.avatar_url || cleanAlterData.image;
        if (supabaseUrl && supabaseUrl.includes("supabase")) {
          cleanAlterData.avatar_url = supabaseUrl;
          cleanAlterData.image = supabaseUrl;
          // Store as persistent for this specific alter
          localStorage.setItem(
            this.getAlterImageKey(cleanId, "published"),
            supabaseUrl
          );
        }
      }
    }

    // For premade alters
    if (cleanAlterData.type === "premade" && cleanAlterData.id) {
      const persistentImage = localStorage.getItem(
        this.getAlterImageKey(cleanId, "premade")
      );
      if (persistentImage) {
        cleanAlterData.avatar_url = persistentImage;
        cleanAlterData.image = persistentImage;
      }
    }

    // For custom alters
    if (cleanAlterData.type === "custom" && cleanAlterData.id) {
      const persistentImage = localStorage.getItem(
        this.getAlterImageKey(cleanId, "custom")
      );
      if (persistentImage) {
        cleanAlterData.avatar_url = persistentImage;
        cleanAlterData.image = persistentImage;
      }
    }

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

  // Method to handle both premade and published alters
  async handleAlterImage(alter) {
    // Ensure we have a type
    if (!alter.type) {
      alter.type = "custom"; // Default to custom if not specified
    }

    // For published alters, ensure we preserve the image URL for this specific alter
    if (alter.type === "published" && alter.id) {
      // Check for alter-specific persistent image first
      const persistentImage = localStorage.getItem(
        this.getAlterImageKey(alter.id, "published")
      );
      if (persistentImage) {
        alter.avatar_url = persistentImage;
        alter.image = persistentImage;
      } else {
        // If no persistent image, use Supabase URL
        const supabaseUrl = alter.avatar_url || alter.image;
        if (supabaseUrl && supabaseUrl.includes("supabase")) {
          alter.avatar_url = supabaseUrl;
          alter.image = supabaseUrl;
          // Store as persistent for this specific alter
          localStorage.setItem(
            this.getAlterImageKey(alter.id, "published"),
            supabaseUrl
          );
        }
      }
    }

    // For premade alters
    if (alter.type === "premade" && alter.id) {
      const persistentImage = localStorage.getItem(
        this.getAlterImageKey(alter.id, "premade")
      );
      if (persistentImage) {
        alter.avatar_url = persistentImage;
        alter.image = persistentImage;
      }
    }

    // For custom alters
    if (alter.type === "custom" && alter.id) {
      const persistentImage = localStorage.getItem(
        this.getAlterImageKey(alter.id, "custom")
      );
      if (persistentImage) {
        alter.avatar_url = persistentImage;
        alter.image = persistentImage;
      }
    }

    // Set the alter data
    this.setAlterData(alter);
  }
}

// Create and export a singleton instance
const alterImageManager = new AlterImageManager();
export default alterImageManager;
