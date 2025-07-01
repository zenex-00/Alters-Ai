// Premade Alters Module
class PremadeAltersManager {
  constructor() {
    this.alters = [];
    this.filteredAlters = [];
  }

  async loadAlters() {
    try {
      console.log("Loading premade alters from database...");

      // Fetch premade alters from the API
      const response = await fetch("/api/premade-alters");

      if (!response.ok) {
        throw new Error(`Failed to fetch premade alters: ${response.status}`);
      }

      const data = await response.json();

      this.alters = data.map((alter) => {
        return {
          ...alter,
          id: `premade_${alter.id}`,
          type: "premade",
          price: alter.price || 9.99,
          rating: alter.rating || 4.5,
          verified: true,
          featured: alter.featured || false,
          image: alter.image_url || alter.image, // Use image_url from database
          image_url: alter.image_url || alter.image, // Ensure both fields are available
          name: alter.name || "Unnamed Alter",
          description: alter.description || "No description available",
          creator: alter.creator_name || "AlterStudio",
          category: alter.category || "Other",
          originalId: alter.id,
        };
      });

      console.log(`Loaded ${this.alters.length} premade alters from database`);
      return this.alters;
    } catch (error) {
      console.error("Error loading premade alters:", error);

      // Fallback to hardcoded data if API fails
      console.log("Falling back to hardcoded premade alters...");
      return this.loadHardcodedAlters();
    }
  }

  loadHardcodedAlters() {
    // Fallback hardcoded data in case API fails
    const hardcodedAlters = {
      1: {
        id: "1",
        name: "Tech Specialist",
        description: "AI Technology Expert",
        category: "technology",
        image:
          "https://readdy.ai/api/search-image?query=professional%2520looking%2520digital%2520avatar%2520of%2520tech%2520specialist%2520woman%2520on%2520dark%2520background%2520high%2520quality%2520realistic%25203D%2520render%2520with%2520perfect%2520lighting%2520and%2520textures&width=400&height=400&seq=14&orientation=squarish",
        voiceId: "EXAVITQu4vr4xnSDxMaL",
        voiceName: "Bella",
        personality:
          "Professional, knowledgeable, and friendly tech expert who helps users understand and solve technology-related problems.",
        prompt:
          "You are a Tech Specialist. You are professional, knowledgeable, and friendly. You help users understand and solve technology-related problems while maintaining a helpful and approachable demeanor.",
        knowledge:
          "Technology, software, hardware, digital tools, troubleshooting",
        type: "premade",
      },
      2: {
        id: "2",
        name: "Business Coach",
        description: "Professional Business Advisor",
        category: "business",
        image:
          "https://readdy.ai/api/search-image?query=professional%2520looking%2520digital%2520avatar%2520of%2520business%2520coach%2520man%2520on%2520dark%2520background%2520high%2520quality%2520realistic%25203D%2520render%2520with%2520perfect%2520lighting%2520and%2520textures&width=400&height=400&seq=14&orientation=squarish",
        voiceId: "EXAVITQu4vr4xnSDxMaL",
        voiceName: "Bella",
        personality:
          "Strategic, insightful, and motivating business coach who helps users develop their professional skills and business acumen.",
        prompt:
          "You are a Business Coach. You are strategic, insightful, and motivating. You help users develop their professional skills and business acumen while providing practical advice and guidance.",
        knowledge:
          "Business strategy, leadership, entrepreneurship, professional development",
        type: "premade",
      },
      3: {
        id: "3",
        name: "Gym Guide",
        description: "Personal Fitness Trainer",
        category: "fitness",
        image:
          "https://readdy.ai/api/search-image?query=professional%2520looking%2520digital%2520avatar%2520of%2520tech%2520specialist%2520woman%2520on%2520dark%2520background%2520high%2520quality%2520realistic%25203D%2520render%2520with%2520perfect%2520lighting%2520and%2520textures&width=400&height=400&seq=14&orientation=squarish",
        voiceId: "EXAVITQu4vr4xnSDxMaL",
        voiceName: "Bella",
        personality:
          "Motivating, energetic, and encouraging fitness trainer who provides expert guidance on workouts, nutrition, and healthy lifestyle choices.",
        prompt:
          "You are a Personal Fitness Trainer. You are motivating, energetic, and encouraging. You provide expert guidance on workouts, nutrition, and healthy lifestyle choices while keeping users motivated and focused on their fitness goals.",
        knowledge:
          "Fitness training, workout routines, nutrition, health and wellness, exercise science",
        type: "premade",
      },
    };

    const data = Object.values(hardcodedAlters);

    this.alters = data.map((alter) => {
      return {
        ...alter,
        id: `premade_${alter.id}`,
        type: "premade",
        price: alter.price || 9.99,
        rating: alter.rating || 4.5,
        verified: true,
        featured: alter.featured || false,
        image: alter.image, // Use image as-is from hardcoded data
        name: alter.name || "Unnamed Alter",
        description: alter.description || "No description available",
        creator: alter.creator_name || "AlterStudio",
        category: alter.category || "Other",
        originalId: alter.id,
      };
    });

    return this.alters;
  }

  filterAlters(searchTerm, category, sortBy) {
    // Filter alters
    this.filteredAlters = this.alters.filter((alter) => {
      const matchesSearch =
        alter.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alter.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = category === "all" || alter.category === category;
      return matchesSearch && matchesCategory;
    });

    // Sort alters
    this.sortAlters(sortBy);

    return this.filteredAlters;
  }

  sortAlters(sortBy) {
    switch (sortBy) {
      case "price-asc":
        this.filteredAlters.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        this.filteredAlters.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        this.filteredAlters.sort((a, b) => b.rating - a.rating);
        break;
      case "name":
        this.filteredAlters.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        // Default sort by featured first, then rating
        this.filteredAlters.sort((a, b) => {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return b.rating - a.rating;
        });
    }
  }

  getAlterById(id) {
    const cleanId = id.replace(/^premade_/, "");
    return this.alters.find(
      (alter) => alter.id === `premade_${cleanId}` || alter.id === cleanId
    );
  }

  async preloadImages() {
    const imagePromises = this.alters.map((alter) => {
      if (!alter.image) return Promise.resolve();

      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
          console.log(`Successfully loaded image: ${alter.image}`);
          resolve();
        };

        img.onerror = (error) => {
          console.error(`Failed to load image: ${alter.image}`, error);
          // Set fallback image
          alter.image = `${window.location.origin}/placeholder.svg`;
          resolve();
        };

        img.src = alter.image;
      });
    });

    await Promise.all(imagePromises);
  }
}

// Export as singleton
const premadeAltersManager = new PremadeAltersManager();
export default premadeAltersManager;
