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
    const lastServerState = localStorage.getItem('serverState');
    const currentServerState = Date.now().toString();

    // If this is a fresh server start
    if (!lastServerState) {
      // Clear any temporary image data
      localStorage.removeItem('tempAlterImage');
      localStorage.removeItem('currentAlterImage');
    }

    // Update server state
    localStorage.setItem('serverState', currentServerState);
  }

  getAlterImageKey(alterId) {
    return `alterImage_${alterId}`;
  }

  async loadCachedAlterData() {
    try {
      const cachedData = localStorage.getItem('alterData');
      if (cachedData) {
        this.alterData = JSON.parse(cachedData);
        
        // Check if we have a persistent image URL for this specific alter
        if (this.alterData.id) {
          const persistentImage = localStorage.getItem(this.getAlterImageKey(this.alterData.id));
          if (persistentImage) {
            this.alterData.avatar_url = persistentImage;
            this.alterData.image = persistentImage;
          }
        }
        
        await this.loadAlterImage();
      }
    } catch (error) {
      console.error('Error loading cached alter data:', error);
    }
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

    // For published alters, check for alter-specific persistent image first
    if (this.alterData.type === 'published' && this.alterData.id) {
      const persistentImage = localStorage.getItem(this.getAlterImageKey(this.alterData.id));
      if (persistentImage) {
        console.log('Using persistent image for published alter:', persistentImage);
        this.setImage(avatarImage, persistentImage);
        return;
      }

      // If no persistent image, try the Supabase URL
      const supabaseUrl = this.alterData.avatar_url || this.alterData.image;
      if (supabaseUrl && supabaseUrl.includes('supabase')) {
        console.log('Using Supabase URL for published alter:', supabaseUrl);
        this.setImage(avatarImage, supabaseUrl);
        // Store this as persistent for this specific alter
        localStorage.setItem(this.getAlterImageKey(this.alterData.id), supabaseUrl);
        return;
      }
    }

    // For premade alters or if no persistent/Supabase URL is available
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
    this.setImage(avatarImage, '/placeholder.svg');
  }

  getImageSources() {
    if (!this.alterData) return ['/placeholder.svg'];

    // For published alters, check alter-specific persistent storage first
    if (this.alterData.type === 'published' && this.alterData.id) {
      const persistentImage = localStorage.getItem(this.getAlterImageKey(this.alterData.id));
      if (persistentImage) {
        return [persistentImage, '/placeholder.svg'];
      }

      const supabaseUrl = this.alterData.avatar_url || this.alterData.image;
      if (supabaseUrl && supabaseUrl.includes('supabase')) {
        return [supabaseUrl, '/placeholder.svg'];
      }
    }

    // For premade alters or if no persistent/Supabase URL is available
    return [
      this.alterData.image,
      this.alterData.avatar_url,
      this.alterData.avatarUrl,
      this.alterData.profile_image,
      this.alterData.profileImage,
      '/placeholder.svg'
    ].filter(Boolean);
  }

  async verifyImage(url) {
    if (!url) return false;

    // Skip verification for Supabase URLs and persistent images
    if (url.includes('supabase') || 
        (this.alterData && this.alterData.id && 
         url === localStorage.getItem(this.getAlterImageKey(this.alterData.id)))) {
      return true;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        img.src = '';
        reject(new Error('Image load timeout'));
      }, 5000);

      img.onload = () => {
        clearTimeout(timeout);
        resolve(true);
      };

      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Image failed to load'));
      };

      img.src = url;
    });
  }

  setImage(element, url) {
    if (!url) {
      console.warn('No image URL provided');
      url = '/placeholder.svg';
    }

    // Store the URL before setting it
    const imageUrl = url;
    
    // Set the image
    element.src = imageUrl;
    element.style.display = 'block';
    
    // Store the current image URL in sessionStorage for persistence
    sessionStorage.setItem('currentAlterImage', imageUrl);
    
    // For published alters, store the image URL persistently for this specific alter
    if (this.alterData && this.alterData.type === 'published' && this.alterData.id) {
      if (imageUrl.includes('supabase') || imageUrl !== '/placeholder.svg') {
        localStorage.setItem(this.getAlterImageKey(this.alterData.id), imageUrl);
      }
    }
    
    // Log the image being set
    console.log('Setting image:', imageUrl);
  }

  setAlterData(alterData) {
    // For published alters, ensure we preserve the image URL for this specific alter
    if (alterData.type === 'published' && alterData.id) {
      // Check for alter-specific persistent image first
      const persistentImage = localStorage.getItem(this.getAlterImageKey(alterData.id));
      if (persistentImage) {
        alterData.avatar_url = persistentImage;
        alterData.image = persistentImage;
      } else {
        // If no persistent image, use Supabase URL
        const supabaseUrl = alterData.avatar_url || alterData.image;
        if (supabaseUrl && supabaseUrl.includes('supabase')) {
          alterData.avatar_url = supabaseUrl;
          alterData.image = supabaseUrl;
          // Store as persistent for this specific alter
          localStorage.setItem(this.getAlterImageKey(alterData.id), supabaseUrl);
        }
      }
    }

    this.alterData = alterData;
    localStorage.setItem('alterData', JSON.stringify(alterData));
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
    // For published alters, ensure we preserve the image URL for this specific alter
    if (alter.type === 'published' && alter.id) {
      // Check for alter-specific persistent image first
      const persistentImage = localStorage.getItem(this.getAlterImageKey(alter.id));
      if (persistentImage) {
        alter.avatar_url = persistentImage;
        alter.image = persistentImage;
      } else {
        // If no persistent image, use Supabase URL
        const supabaseUrl = alter.avatar_url || alter.image;
        if (supabaseUrl && supabaseUrl.includes('supabase')) {
          alter.avatar_url = supabaseUrl;
          alter.image = supabaseUrl;
          // Store as persistent for this specific alter
          localStorage.setItem(this.getAlterImageKey(alter.id), supabaseUrl);
        }
      }
    }

    // Set the alter data
    this.setAlterData(alter);
  }
}

// Create and export a singleton instance
const alterImageManager = new AlterImageManager();
export default alterImageManager; 