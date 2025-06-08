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
      const cachedImages = localStorage.getItem('alterImageCache');
      if (cachedImages) {
        const parsedCache = JSON.parse(cachedImages);
        this.imageCache = new Map(Object.entries(parsedCache));
      }
    } catch (error) {
      console.error('Error loading image cache:', error);
      this.imageCache = new Map();
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
    const cleanId = String(alterId).replace(/^(premade_|published_)/, '');
    return `alterImage_${type}_${cleanId}`;
  }

  async loadAlterImage() {
    const avatarImage = document.getElementById('avatar-image');
    if (!avatarImage) {
      console.error('Avatar image element not found');
      return;
    }

    if (!this.alterData) {
      console.warn('No alter data available');
      return;
    }

    const imageKey = this.getAlterImageKey(this.alterData.id, this.alterData.type);
    
    // Try to get image from cache first
    const cachedImage = this.imageCache.get(imageKey);
    if (cachedImage && await this.verifyImage(cachedImage)) {
      this.setImage(avatarImage, cachedImage);
      return;
    }

    // Try to get image from localStorage
    const persistentImage = localStorage.getItem(imageKey);
    if (persistentImage && await this.verifyImage(persistentImage)) {
      this.setImage(avatarImage, persistentImage);
      this.imageCache.set(imageKey, persistentImage);
      this.saveImageCache();
      return;
    }

    // For published alters, try Supabase URL
    if (this.alterData.type === 'published') {
      const supabaseUrl = this.alterData.avatar_url || this.alterData.image;
      if (supabaseUrl && supabaseUrl.includes('supabase') && await this.verifyImage(supabaseUrl)) {
        this.setImage(avatarImage, supabaseUrl);
        localStorage.setItem(imageKey, supabaseUrl);
        this.imageCache.set(imageKey, supabaseUrl);
        this.saveImageCache();
        return;
      }
    }

    // Try loading from alter data sources
    const imageSources = this.getImageSources();
    for (const source of imageSources) {
      if (await this.verifyImage(source)) {
        this.setImage(avatarImage, source);
        localStorage.setItem(imageKey, source);
        this.imageCache.set(imageKey, source);
        this.saveImageCache();
        return;
      }
    }

    // If all sources fail, use placeholder
    this.setImage(avatarImage, '/placeholder.svg');
  }

  getImageSources() {
    if (!this.alterData) return ['/placeholder.svg'];

    const sources = [
      this.alterData.image,
      this.alterData.avatar_url,
      this.alterData.avatarUrl,
      this.alterData.profile_image,
      this.alterData.profileImage,
      '/placeholder.svg'
    ].filter(Boolean);

    return sources;
  }

  async verifyImage(url) {
    if (!url) return false;

    // Skip verification for placeholder
    if (url === '/placeholder.svg') return true;

    return new Promise((resolve) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        img.src = '';
        resolve(false);
      }, 5000);

      img.onload = () => {
        clearTimeout(timeout);
        resolve(true);
      };

      img.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };

      img.src = url;
    });
  }

  setImage(element, url) {
    if (!url) {
      console.warn('No image URL provided');
      url = '/placeholder.svg';
    }

    // Set the image
    element.src = url;
    element.style.display = 'block';

    // Store in both localStorage and cache
    if (this.alterData && this.alterData.id && url !== '/placeholder.svg') {
      const imageKey = this.getAlterImageKey(this.alterData.id, this.alterData.type);
      localStorage.setItem(imageKey, url);
      this.imageCache.set(imageKey, url);
      this.saveImageCache();
    }

    console.log('Setting image:', url);
  }

  setAlterData(alterData) {
    if (!alterData.type) {
      alterData.type = 'custom';
    }

    this.alterData = { ...alterData };
    localStorage.setItem('alterData', JSON.stringify(this.alterData));
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
      alter.type = 'custom';
    }

    // For published alters
    if (alter.type === 'published' && alter.id) {
      const imageKey = this.getAlterImageKey(alter.id, 'published');
      const cachedImage = this.imageCache.get(imageKey);
      
      if (cachedImage && await this.verifyImage(cachedImage)) {
        alter.avatar_url = cachedImage;
        alter.image = cachedImage;
      } else {
        const supabaseUrl = alter.avatar_url || alter.image;
        if (supabaseUrl && supabaseUrl.includes('supabase') && await this.verifyImage(supabaseUrl)) {
          alter.avatar_url = supabaseUrl;
          alter.image = supabaseUrl;
          localStorage.setItem(imageKey, supabaseUrl);
          this.imageCache.set(imageKey, supabaseUrl);
          this.saveImageCache();
        }
      }
    }

    // For premade alters
    if (alter.type === 'premade' && alter.id) {
      const imageKey = this.getAlterImageKey(alter.id, 'premade');
      const cachedImage = this.imageCache.get(imageKey);
      
      if (cachedImage && await this.verifyImage(cachedImage)) {
        alter.avatar_url = cachedImage;
        alter.image = cachedImage;
      } else if (alter.image && await this.verifyImage(alter.image)) {
        localStorage.setItem(imageKey, alter.image);
        this.imageCache.set(imageKey, alter.image);
        this.saveImageCache();
      }
    }

    this.setAlterData(alter);
  }
}

// Create and export a singleton instance
const alterImageManager = new AlterImageManager();
export default alterImageManager;
