class AlterImageManager {
  constructor() {
    this.alterData = null;
    this.imageCache = new Map();
    this.init();
  }

  init() {
    // Initialize image cache from localStorage
    this.loadImageCache();

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

  loadImageCache() {
    try {
      const cachedImages = localStorage.getItem("alterImageCache");
      if (cachedImages) {
        const parsedCache = JSON.parse(cachedImages);
        this.imageCache = new Map(Object.entries(parsedCache));
      }
    } catch (error) {
      console.error("Error loading image cache:", error);
      this.imageCache = new Map();
    }
  }

  saveImageCache() {
    try {
      const cacheObject = Object.fromEntries(this.imageCache);
      localStorage.setItem("alterImageCache", JSON.stringify(cacheObject));
    } catch (error) {
      console.error("Error saving image cache:", error);
    }
  }

  getAlterImageKey(alterId, type) {
    const cleanId = String(alterId).replace(/^(premade_|published_)/, "");
    return `alterImage_${type}_${cleanId}`;
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

    console.log("Loading alter image for:", this.alterData);

    const imageKey = this.getAlterImageKey(
      this.alterData.id,
      this.alterData.type
    );

    // Try to get image from cache first
    const cachedImage = this.imageCache.get(imageKey);
    if (cachedImage && (await this.verifyImage(cachedImage))) {
      console.log("Using cached image:", cachedImage);
      this.setImage(avatarImage, cachedImage);
      return;
    }

    // Try to get image from localStorage
    const persistentImage = localStorage.getItem(imageKey);
    if (persistentImage && (await this.verifyImage(persistentImage))) {
      console.log("Using localStorage image:", persistentImage);
      this.setImage(avatarImage, persistentImage);
      this.imageCache.set(imageKey, persistentImage);
      this.saveImageCache();
      return;
    }

    // Try loading from alter data sources with enhanced verification
    const imageSources = this.getImageSources();
    console.log("Trying image sources:", imageSources);

    for (const source of imageSources) {
      if (source && (await this.verifyImage(source))) {
        console.log("Successfully loaded image from:", source);
        this.setImage(avatarImage, source);
        localStorage.setItem(imageKey, source);
        this.imageCache.set(imageKey, source);
        this.saveImageCache();
        return;
      } else {
        console.warn("Failed to load image from:", source);
      }
    }

    // If all sources fail, use placeholder
    console.log("All image sources failed, using placeholder");
    this.setImage(avatarImage, "/placeholder.svg");
  }

  getImageSources() {
    if (!this.alterData) return ["/placeholder.svg"];

    const sources = [];

    // Add all possible image sources
    if (this.alterData.image) sources.push(this.alterData.image);
    if (this.alterData.avatar_url) sources.push(this.alterData.avatar_url);
    if (this.alterData.avatarUrl) sources.push(this.alterData.avatarUrl);
    if (this.alterData.profile_image)
      sources.push(this.alterData.profile_image);
    if (this.alterData.profileImage) sources.push(this.alterData.profileImage);

    // For premade alters, try constructing common image paths
    if (this.alterData.type === "premade" && this.alterData.id) {
      const premadeImages = [
        `/images/premade/${this.alterData.id}.png`,
        `/images/premade/${this.alterData.id}.jpg`,
        `/images/alters/${this.alterData.id}.png`,
        `/images/alters/${this.alterData.id}.jpg`,
        `/assets/premade/${this.alterData.id}.png`,
        `/assets/premade/${this.alterData.id}.jpg`,
      ];
      sources.push(...premadeImages);
    }

    // Always include placeholder as last resort
    sources.push("/placeholder.svg");

    // Remove duplicates and null/undefined values
    const uniqueSources = [
      ...new Set(
        sources.filter((src) => src && src !== "undefined" && src !== "null")
      ),
    ];

    console.log(
      "Generated image sources for alter:",
      this.alterData.id,
      uniqueSources
    );
    return uniqueSources;
  }

  async verifyImage(url) {
    if (!url || url === "undefined" || url === "null") {
      console.log("Invalid URL for verification:", url);
      return false;
    }

    // Skip verification for placeholder and local files
    if (
      url === "/placeholder.svg" ||
      url.startsWith("/") ||
      url.startsWith("data:")
    )
      return true;

    return new Promise((resolve) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        console.log("Image verification timeout for:", url);
        img.src = "";
        resolve(false);
      }, 8000); // Increased timeout

      img.onload = () => {
        console.log("Image verification successful for:", url);
        clearTimeout(timeout);
        resolve(true);
      };

      img.onerror = (error) => {
        console.log("Image verification failed for:", url, error);
        clearTimeout(timeout);
        resolve(false);
      };

      // Add crossOrigin for external images
      if (url.startsWith("http") && !url.includes(window.location.hostname)) {
        img.crossOrigin = "anonymous";
      }

      img.src = url;
    });
  }

  async uploadAlterImageToServer(imageUrl, alterId) {
    try {
      console.log("Uploading alter image to server:", imageUrl);

      // First, fetch the image from the original URL
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error("Failed to fetch original image");
      }

      const imageBlob = await imageResponse.blob();

      // Create FormData to upload to our server
      const formData = new FormData();
      const fileName = `alter-${alterId}-${Date.now()}.jpg`;
      const imageFile = new File([imageBlob], fileName, { type: "image/jpeg" });
      formData.append("avatar", imageFile);

      // Upload to our server
      const uploadResponse = await fetch("/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image to server");
      }

      const uploadData = await uploadResponse.json();
      console.log("Successfully uploaded alter image:", uploadData.url);

      return uploadData.url;
    } catch (error) {
      console.error("Error uploading alter image to server:", error);
      return null;
    }
  }

  setImage(element, url) {
    if (!url) {
      console.warn("No image URL provided");
      url = "/placeholder.svg";
    }

    // Set the image
    element.src = url;
    element.style.display = "block";

    // Store in both localStorage and cache
    if (this.alterData && this.alterData.id && url !== "/placeholder.svg") {
      const imageKey = this.getAlterImageKey(
        this.alterData.id,
        this.alterData.type
      );
      localStorage.setItem(imageKey, url);
      this.imageCache.set(imageKey, url);
      this.saveImageCache();
    }

    console.log("Setting image:", url);
  }

  setAlterData(alterData) {
    if (!alterData.type) {
      alterData.type = "custom";
    }

    this.alterData = { ...alterData };
    localStorage.setItem("alterData", JSON.stringify(this.alterData));
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

  async handleAlterImage(alter) {
    if (!alter.type) {
      alter.type = "custom";
    }

    console.log("Handling alter image for:", alter);

    // For published alters
    if (alter.type === "published" && alter.id) {
      const imageKey = this.getAlterImageKey(alter.id, "published");
      const cachedImage =
        this.imageCache.get(imageKey) || localStorage.getItem(imageKey);

      if (cachedImage && (await this.verifyImage(cachedImage))) {
        alter.avatar_url = cachedImage;
        alter.image = cachedImage;
        console.log("Using cached published alter image:", cachedImage);
      } else {
        const supabaseUrl = alter.avatar_url || alter.image;
        if (supabaseUrl && (await this.verifyImage(supabaseUrl))) {
          alter.avatar_url = supabaseUrl;
          alter.image = supabaseUrl;
          localStorage.setItem(imageKey, supabaseUrl);
          this.imageCache.set(imageKey, supabaseUrl);
          this.saveImageCache();
          console.log(
            "Verified and cached published alter image:",
            supabaseUrl
          );
        }
      }
    }

    // For premade alters
    if (
      (alter.type === "premade" || alter.type === "customized") &&
      alter.image
    ) {
      const imageKey = this.getAlterImageKey(alter.id, alter.type);
      const cachedImage =
        this.imageCache.get(imageKey) || localStorage.getItem(imageKey);

      if (cachedImage && (await this.verifyImage(cachedImage))) {
        console.log("Using cached image:", cachedImage);
        this.setImage(cachedImage);
      } else {
        // Upload the image to our server to get a fresh public URL
        const publicUrl = await this.uploadAlterImageToServer(
          alter.image,
          alter.id
        );
        if (publicUrl) {
          this.setImage(publicUrl);
          localStorage.setItem(imageKey, publicUrl);
          this.imageCache.set(imageKey, publicUrl);
          this.saveImageCache();
          console.log("Uploaded and cached premade alter image:", publicUrl);
        } else {
          console.warn(
            "Failed to upload premade alter image, using placeholder"
          );
          this.setImage("/placeholder.svg");
        }
      }
    }

    this.setAlterData(alter);
  }

  // Add method to get alter data from any storage source
  static getAlterFromStorage() {
    // Try sessionStorage first (for navigation from marketplace)
    let selectedAlter = sessionStorage.getItem("selectedAlter");
    if (selectedAlter) {
      sessionStorage.removeItem("selectedAlter");
      return JSON.parse(selectedAlter);
    }

    // Try localStorage (for backward compatibility)
    selectedAlter = localStorage.getItem("selectedAlter");
    if (selectedAlter) {
      localStorage.removeItem("selectedAlter");
      return JSON.parse(selectedAlter);
    }

    // Try custom avatar settings
    const avatarSettings = localStorage.getItem("avatarSettings");
    if (avatarSettings) {
      const settings = JSON.parse(avatarSettings);
      return {
        name: settings.name,
        personality: settings.personality,
        prompt: settings.prompt,
        knowledge: settings.knowledge,
        voiceId: settings.voiceId,
        voiceName: settings.voiceName,
        documentName: settings.documentName,
        documentUrl: settings.documentUrl,
        documentContent: settings.documentContent,
        type: "custom",
      };
    }

    return null;
  }
}

// Create and export a singleton instance
const alterImageManager = new AlterImageManager();
export default alterImageManager;
