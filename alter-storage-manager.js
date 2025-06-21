// Utility for managing alter data storage across the application
class AlterStorageManager {
  static normalizeImageUrl(imageUrl) {
    if (!imageUrl) return `${window.location.origin}/placeholder.svg`;
    
    // Ensure absolute URL
    if (imageUrl.startsWith('/')) {
      imageUrl = `${window.location.origin}${imageUrl}`;
    }
    
    // Add cache busting
    const timestamp = Date.now();
    return `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}_=${timestamp}`;
  }

  static setSelectedAlter(alter, useSessionStorage = true) {
    // Normalize image URL before storage
    const alterData = {
      ...alter,
      image: this.normalizeImageUrl(alter.image),
      timestamp: Date.now(),
    };

    const storage = useSessionStorage ? sessionStorage : localStorage;
    storage.setItem("selectedAlter", JSON.stringify(alterData));

    // Also store in localStorage as backup
    if (useSessionStorage) {
      localStorage.setItem("selectedAlter", JSON.stringify(alterData));
    }

    console.log("Stored alter data:", alterData);
  }

  static getSelectedAlter() {
    // Try sessionStorage first
    let alterData = sessionStorage.getItem("selectedAlter");
    if (alterData) {
      try {
        const parsed = JSON.parse(alterData);
        // Check if data is not too old (24 hours)
        if (Date.now() - parsed.timestamp < 86400000) {
          // Ensure image URL is still valid
          parsed.image = this.normalizeImageUrl(parsed.image);
          return parsed;
        }
      } catch (e) {
        console.error("Error parsing sessionStorage alter data:", e);
      }
    }

    // Try localStorage as fallback
    alterData = localStorage.getItem("selectedAlter");
    if (alterData) {
      try {
        const parsed = JSON.parse(alterData);
        // Check if data is not too old (7 days)
        if (Date.now() - parsed.timestamp < 604800000) {
          // Ensure image URL is still valid
          parsed.image = this.normalizeImageUrl(parsed.image);
          return parsed;
        }
      } catch (e) {
        console.error("Error parsing localStorage alter data:", e);
      }
    }

    return null;
  }

  static clearSelectedAlter() {
    sessionStorage.removeItem("selectedAlter");
    localStorage.removeItem("selectedAlter");
  }

  static navigateToChat(alter) {
    this.setSelectedAlter(alter, true);
    window.location.href = "/chat.html";
  }
}

export default AlterStorageManager;
