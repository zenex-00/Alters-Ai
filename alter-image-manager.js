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
      const cached = localStorage.getItem('alterImageCache');
      if (cached) {
        const parsed = JSON.parse(cached);
        this.imageCache = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('Error loading image cache:', error);
    }
  }

  saveImageCache() {
    try {
      const cacheObject = Object.fromEntries(this.imageCache);
      localStorage.setItem('alterImageCache', JSON.stringify(cacheObject));
    } catch (error) {
      console.error('Error saving image cache:', error);
    }
  }

  getAlterImageKey(alterId, type) {
    return `${type}_${alterId}`;
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
      this.setImage(cachedImage);
      return;
    }

    // Try to get image from localStorage
    const persistentImage = localStorage.getItem(imageKey);
    if (persistentImage && (await this.verifyImage(persistentImage))) {
      console.log("Using localStorage image:", persistentImage);
      this.setImage(persistentImage);
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
        this.setImage(source);
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
    this.setImage("/placeholder.svg");
  }

  getImageSources() {
    if (!this.alterData) return ["/placeholder.svg"];

    const sources = [];

    // Add all possible image sources
    if (this.alterData.image) sources.push(this.alterData.image);
    if (this.alterData.avatar_url) sources.push(this.alterData.avatar_url);
    if (this.alterData.avatarUrl) sources.push(this.alterData.avatarUrl);
    if (this.alterData.profile_image) sources.push(this.alterData.profile_image);
    if (this.alterData.profileImage) sources.push(this.alterData.profileImage);

    // For premade alters, use the image directly
    if (this.alterData.type === "premade") {
      // Add cache busting to the image URL
      const timestamp = Date.now();
      const imageUrl = this.alterData.image;
      if (imageUrl) {
        sources.push(`${imageUrl}${imageUrl.includes('?') ? '&' : '?'}_=${timestamp}`);
      }
    }

    // Always include placeholder as last resort
    sources.push("/placeholder.svg");

    // Remove duplicates and null/undefined values
    const uniqueSources = [...new Set(sources.filter(src => src && src !== "undefined" && src !== "null"))];

    console.log("Generated image sources for alter:", this.alterData.id, uniqueSources);
    return uniqueSources;
  }

  async verifyImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  async uploadAlterImageToServer(imageUrl, alterId) {
    try {
      // First, fetch the image from the original URL
      const imageResponse = await fetch(imageUrl, {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Accept': 'image/*'
        }
      });

      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch original image: ${imageResponse.status}`);
      }

      const imageBlob = await imageResponse.blob();

      // Create FormData to upload to our server
      const formData = new FormData();
      const fileName = `alter-${alterId}-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const imageFile = new File([imageBlob], fileName, { type: "image/jpeg" });
      formData.append("avatar", imageFile);

      // Upload to our server
      const uploadResponse = await fetch("/upload", {
        method: "POST",
        body: formData,
        credentials: 'include'
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload image to server: ${uploadResponse.status}`);
      }

      const uploadData = await uploadResponse.json();
      console.log("Successfully uploaded alter image:", uploadData.url);
      return uploadData.url;
    } catch (error) {
      console.error('Error uploading alter image:', error);
      return null;
    }
  }

  setImage(url) {
    if (!url) return;
    
    // Update all image elements with the alter class
    const images = document.querySelectorAll('.alter-image');
    images.forEach(img => {
      img.src = url;
      img.crossOrigin = 'anonymous';
      img.onerror = () => {
        console.warn(`Failed to load image: ${url}, using placeholder`);
        img.src = '/placeholder.svg';
      };
    });

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

  setAlterData(alter) {
    if (!alter.type) {
      alter.type = "custom";
    }

    this.alterData = { ...alter };
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
    if (!alter) {
      console.warn("No alter data provided");
      this.setImage("/placeholder.svg");
      return;
    }

    console.log("Handling alter image for:", alter);

    // For premade alters
    if (alter.type === "premade") {
      // Use the image URL directly with cache busting
      const timestamp = Date.now();
      const imageUrl = alter.image;
      if (imageUrl) {
        const cachedUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}_=${timestamp}`;
        this.setImage(cachedUrl);
        this.setAlterData(alter);
        return;
      }
    }

    // For published alters
    if (alter.type === "published" && alter.image) {
      const imageKey = this.getAlterImageKey(alter.id, alter.type);
      const cachedImage = this.imageCache.get(imageKey) || localStorage.getItem(imageKey);

      if (cachedImage && (await this.verifyImage(cachedImage))) {
        console.log("Using cached image:", cachedImage);
        this.setImage(cachedImage);
      } else {
        // Upload the image to our server to get a fresh public URL
        const publicUrl = await this.uploadAlterImageToServer(alter.image, alter.id);
        if (publicUrl) {
          this.setImage(publicUrl);
          localStorage.setItem(imageKey, publicUrl);
          this.imageCache.set(imageKey, publicUrl);
          this.saveImageCache();
          console.log("Uploaded and cached published alter image:", publicUrl);
        } else {
          console.warn("Failed to upload published alter image, using placeholder");
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
