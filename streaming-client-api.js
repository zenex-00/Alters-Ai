class VideoAgent {
  constructor() {
    this.peerConnection = null;
    this.streamId = null;
    this.sessionId = null;
    this.statsIntervalId = null;
    this.API_CONFIG = null;
    this.DID_API_URL = "https://api.d-id.com";
    this.lastBytesReceived = 0;
    this.videoIsPlaying = false;
    this.customAvatarUrl = null;
    this.messageProcessing = new Set();
    this.isPlayingPromise = false;

    this.idleVideo = document.getElementById("idle-video");
    this.talkVideo = document.getElementById("talk-video");
    this.avatarImage = document.getElementById("avatar-image");

    // Set default avatar URL
    const defaultAvatarUrl =
      "https://raw.githubusercontent.com/jjmlovesgit/D-id_Streaming_Chatgpt/main/oracle_pic.jpg";

    // Load custom avatar URL and voice settings from localStorage or use default
    const settings = JSON.parse(localStorage.getItem("avatarSettings") || "{}");
    this.customAvatarUrl = settings.avatarUrl || defaultAvatarUrl;
    console.log("Loaded customAvatarUrl:", this.customAvatarUrl);

    // Initialize voice settings from multiple sources
    this.initializeVoiceSettings();
    console.log("VideoAgent initialized with voice ID:", window.customVoiceId);

    // Set initial display state
    if (this.avatarImage) {
      this.avatarImage.src = this.customAvatarUrl;
      this.avatarImage.style.display = "block";
    }
    if (this.idleVideo) {
      this.idleVideo.style.display = "none";
    }
    if (this.talkVideo) {
      this.talkVideo.style.display = "none";
    }

    this.init();
  }

  async init() {
    try {
      // Fetch API configuration from server
      const response = await fetch("/api-config");
      if (!response.ok) {
        throw new Error("Failed to fetch API configuration");
      }
      this.API_CONFIG = await response.json();

      if (!this.API_CONFIG?.key)
        throw new Error("Missing video streaming configuration");
      if (!this.API_CONFIG?.openai_key)
        throw new Error("Missing AI chat configuration");
      if (!this.API_CONFIG?.elevenlabs_key)
        throw new Error("Missing voice synthesis configuration");
      if (this.API_CONFIG.url) this.DID_API_URL = this.API_CONFIG.url;

      this.talkVideo.setAttribute("playsinline", "");
      this.setupEventListeners();

      // Automatically start the server with retry
      await this.handleConnectWithRetry();

      console.log("Initialized successfully");
    } catch (error) {
      console.error("streaming-client-api.js: init error:", error);
      this.showToast(
        "Unable to initialize the application. Please refresh and try again.",
        "error"
      );
    }
  }

  initializeVoiceSettings() {
    let voiceId = null;
    let voiceName = null;

    // 1. Check avatarSettings first (highest priority - fresh from customize page)
    const avatarSettings = localStorage.getItem("avatarSettings");
    if (avatarSettings) {
      try {
        const settings = JSON.parse(avatarSettings);
        if (settings.voiceId) {
          voiceId = settings.voiceId;
          voiceName = settings.voiceName || settings.voice_name;
          console.log(
            "Voice initialized from avatarSettings:",
            voiceId,
            voiceName
          );
        }
      } catch (e) {
        console.warn("Failed to parse avatarSettings:", e);
      }
    }

    // 2. Check window.selectedAlter (set by chat.html)
    if (!voiceId && window.selectedAlter?.voiceId) {
      voiceId = window.selectedAlter.voiceId;
      voiceName =
        window.selectedAlter.voiceName || window.selectedAlter.voice_name;
      console.log("Voice initialized from selectedAlter:", voiceId, voiceName);
    }

    // 3. Check current alter in session
    if (!voiceId) {
      const currentAlter = sessionStorage.getItem("currentAlter");
      if (currentAlter) {
        try {
          const alter = JSON.parse(currentAlter);
          if (alter.voiceId) {
            voiceId = alter.voiceId;
            voiceName = alter.voiceName || alter.voice_name;
            console.log(
              "Voice initialized from currentAlter:",
              voiceId,
              voiceName
            );
          }
        } catch (e) {
          console.warn("Failed to parse currentAlter:", e);
        }
      }
    }

    // 4. Check active voice config as fallback
    if (!voiceId) {
      const activeVoiceConfig = sessionStorage.getItem("activeVoiceConfig");
      if (activeVoiceConfig) {
        try {
          const config = JSON.parse(activeVoiceConfig);
          if (config.voiceId) {
            voiceId = config.voiceId;
            voiceName = config.voiceName || config.voice_name;
            console.log(
              "Voice initialized from activeVoiceConfig:",
              voiceId,
              voiceName
            );
          }
        } catch (e) {
          console.warn("Failed to parse activeVoiceConfig:", e);
        }
      }
    }

    // 5. Check localStorage for saved voice (like in your working files)
    if (!voiceId) {
      const savedVoice = localStorage.getItem("selectedVoice");
      if (savedVoice) {
        try {
          const voice = JSON.parse(savedVoice);
          if (voice.voiceId) {
            voiceId = voice.voiceId;
            voiceName = voice.voiceName || voice.voice_name;
            console.log(
              "Voice initialized from saved voice:",
              voiceId,
              voiceName
            );
          }
        } catch (e) {
          console.warn("Failed to parse saved voice:", e);
        }
      }
    }

    // Set and persist voice configuration
    if (voiceId) {
      window.customVoiceId = voiceId;
      window.customVoiceName = voiceName;
      console.log("Final voice configuration set:", voiceId, voiceName);

      // Store in sessionStorage for persistence
      sessionStorage.setItem(
        "activeVoiceConfig",
        JSON.stringify({
          voiceId: voiceId,
          voiceName: voiceName,
        })
      );

      // Also store in localStorage for persistence across sessions
      localStorage.setItem(
        "selectedVoice",
        JSON.stringify({
          voiceId: voiceId,
          voiceName: voiceName,
        })
      );
    } else {
      console.log("No custom voice found, using default");
      window.customVoiceId = "21m00Tcm4TlvDq8ikWAM"; // Default female voice
      window.customVoiceName = "Rachel";
    }
  }

  setupEventListeners() {
    // No button event listeners needed
  }

  addMessage(text, isUser = false) {
    console.log(
      `streaming-client-api.js: addMessage: Adding ${
        isUser ? "user" : "AI"
      } message: ${text}`
    );
    const chatHistory = document.getElementById("chat-history");
    const messageDiv = document.createElement("div");
    messageDiv.className = isUser
      ? "message user-message"
      : "message assistant-message";

    const messageContent = document.createElement("div");
    messageContent.className = "message-content";
    messageContent.textContent = text;

    const timestamp = document.createElement("div");
    timestamp.className = "timestamp";
    const now = new Date();
    timestamp.textContent = `${now.getHours()}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(timestamp);

    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  async setCustomAvatar(url) {
    try {
      // Verify image accessibility
      const urlCheck = await fetch(url, { method: "HEAD" });
      if (!urlCheck.ok) {
        throw new Error(`Image URL inaccessible: ${url}`);
      }

      // Fetch image
      const imgResponse = await fetch(url);
      if (!imgResponse.ok) {
        throw new Error("Failed to fetch image");
      }
      const imgBlob = await imgResponse.blob();

      // Validate format
      const validFormats = ["image/jpeg", "image/png", "image/jpg"];
      if (!validFormats.includes(imgBlob.type)) {
        throw new Error("Invalid image format");
      }

      // Validate size
      const maxSizeMB = 25 * 1024 * 1024;
      if (imgBlob.size > maxSizeMB) {
        throw new Error("Image exceeds size requirements");
      }

      // Log dimensions for debugging (non-blocking)
      const img = new Image();
      const imgLoadPromise = new Promise((resolve, reject) => {
        img.onload = () => {
          console.log(
            `streaming-client-api.js: Image dimensions: ${img.width}x${img.height}`
          );
          resolve();
        };
        img.onerror = () => {
          console.warn(
            "streaming-client-api.js: Failed to load image for dimension logging"
          );
          resolve(); // Proceed anyway
        };
        img.src = URL.createObjectURL(imgBlob);
      });

      await imgLoadPromise;
      URL.revokeObjectURL(img.src);

      // Update customAvatarUrl and localStorage
      this.customAvatarUrl = url;
      const settings = JSON.parse(
        localStorage.getItem("avatarSettings") || "{}"
      );
      settings.avatarUrl = url;
      localStorage.setItem("avatarSettings", JSON.stringify(settings));
      console.log("Updated customAvatarUrl:", this.customAvatarUrl);

      // Set avatar in UI
      this.avatarImage.src = url;
      this.avatarImage.style.display = "block";
      this.idleVideo.style.display = "none";
      this.talkVideo.style.display = "none";

      // Recreate stream with new avatar
      await this.handleConnectWithRetry();

      this.showToast("Avatar updated successfully!", "success");
    } catch (error) {
      console.error(
        "streaming-client-api.js: Error setting custom avatar:",
        error.message
      );
      this.avatarImage.src = "";
      this.avatarImage.style.display = "none";
      this.idleVideo.style.display = "block";

      if (error.message.includes("Invalid image format")) {
        this.showToast("Please use a JPEG or PNG image format", "warning");
      } else if (error.message.includes("Failed to load image")) {
        this.showToast(
          "Unable to load the image. Please try a different one",
          "error"
        );
      } else if (error.message.includes("Image URL inaccessible")) {
        this.showToast("Image upload failed. Please try again", "error");
      } else if (error.message.includes("size requirements")) {
        this.showToast(
          "Image is too large. Please use an image under 25MB",
          "warning"
        );
      } else {
        this.showToast("Unable to set avatar. Please try again", "error");
      }
      throw error;
    }
  }

  async handleConnectWithRetry(maxRetries = 3, retryDelay = 2000) {
    const enterButton = document.getElementById("enter-button");
    enterButton.classList.add("loading");

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (this.peerConnection?.connectionState === "connected") return;

        this.cleanup();

        const response = await this.createStream();
        if (!response.ok) {
          throw new Error("Failed to create stream");
        }
        const { id, offer, ice_servers, session_id } = await response.json();
        this.streamId = id;
        this.sessionId = session_id;

        const answer = await this.createPeerConnection(offer, ice_servers);
        await this.sendSDPAnswer(answer);

        enterButton.classList.remove("loading");
        this.updateUI(true);
        document.getElementById("user-input-field").focus();
        this.showToast("Connected successfully!", "success");
        return;
      } catch (error) {
        console.error(
          `streaming-client-api.js: Connection error (attempt ${attempt}):`,
          error
        );
        if (attempt === maxRetries) {
          if (error.message.includes("rejected")) {
            this.showToast(
              "Avatar image not supported. Please try a different image",
              "warning"
            );
          } else {
            this.showToast(
              "Unable to connect. Please check your internet and try again",
              "error"
            );
          }
          enterButton.classList.remove("loading");
          this.cleanup();
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  async handleTalk(userMessage = null) {
    const messageId = `${userMessage}-${Date.now()}`;
    if (this.messageProcessing.has(messageId)) {
      console.log(
        `streaming-client-api.js: Duplicate message detected: "${userMessage}", skipping.`
      );
      return;
    }
    this.messageProcessing.add(messageId);

    let aiResponse = "";
    const startTime = performance.now();
    try {
      if (!userMessage) {
        userMessage = document.getElementById("user-input-field").value.trim();
      }

      if (!userMessage) {
        console.log(
          "streaming-client-api.js: handleTalk: No user message provided"
        );
        this.showToast("Please enter a message to send", "info");
        return;
      }

      console.log(
        "streaming-client-api.js: handleTalk: Processing user message:",
        userMessage
      );
      this.addMessage(userMessage, true);

      const inputContainer = document.getElementById("input-container");
      if (!inputContainer) {
        console.error(
          "streaming-client-api.js: handleTalk: input-container element not found"
        );
        throw new Error("Input container element not found");
      }
      inputContainer.classList.add("loading");

      // Get AI response
      const { fetchOpenAIResponse } = await import("./openai.js");
      aiResponse = await fetchOpenAIResponse(
        this.API_CONFIG.openai_key,
        userMessage
      );

      // Generate audio
      const audioUrl = await this.generateElevenLabsAudio(aiResponse);
      if (!audioUrl.startsWith("https://")) {
        throw new Error("Invalid audio URL: Must be an HTTPS URL");
      }

      // Get the current alter's image URL - completely avoid readdy.ai URLs
      const selectedAlter = window.selectedAlter;
      const avatarImageElement = document.getElementById("avatar-image");
      let avatarUrl;

      // Check if DOM has a Supabase URL
      if (
        avatarImageElement &&
        avatarImageElement.src &&
        avatarImageElement.src !== window.location.href &&
        !avatarImageElement.src.includes("placeholder.svg") &&
        avatarImageElement.src.includes("supabase")
      ) {
        avatarUrl = avatarImageElement.src;
      } else if (selectedAlter) {
        // Filter out readdy.ai URLs completely
        const candidateUrls = [
          selectedAlter.avatar_url,
          selectedAlter.image,
          this.customAvatarUrl,
        ].filter((url) => url && !url.includes("readdy.ai"));

        // Prioritize Supabase URLs
        avatarUrl =
          candidateUrls.find((url) => url.includes("supabase")) ||
          candidateUrls[0];
      }

      // Final fallback - never use readdy.ai
      if (!avatarUrl || avatarUrl.includes("readdy.ai")) {
        avatarUrl =
          this.customAvatarUrl && !this.customAvatarUrl.includes("readdy.ai")
            ? this.customAvatarUrl
            : "https://raw.githubusercontent.com/jjmlovesgit/D-id_Streaming_Chatgpt/main/oracle_pic.jpg";
      }

      // Log the audio URL and avatar URL for debugging
      console.log("Audio URL:", audioUrl);
      console.log("Avatar URL:", avatarUrl);

      // Verify audio URL accessibility
      const urlCheck = await fetch(audioUrl, { method: "HEAD" });
      if (!urlCheck.ok) {
        console.error("Audio URL inaccessible:", audioUrl);
        throw new Error("Audio URL is not publicly accessible");
      }

      // Send to video streaming service with retry logic
      let talkResponse;
      let errorData;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          talkResponse = await fetch(
            `${this.DID_API_URL}/talks/streams/${this.streamId}`,
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${btoa(this.API_CONFIG.key + ":")}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                script: {
                  type: "audio",
                  audio_url: audioUrl,
                },
                config: { fluent: true, stitch: true, client_fps: 30 },
                driver_url: "bank://lively/",
                session_id: this.sessionId,
                source_url: avatarUrl,
              }),
            }
          );

          if (talkResponse.ok) break;

          errorData = await talkResponse.json().catch(() => ({}));
          console.warn(
            `Video streaming attempt ${attempt} failed:`,
            JSON.stringify(errorData, null, 2)
          );
          if (talkResponse.status === 400 && attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
          throw new Error(errorData.message || "Video streaming error");
        } catch (error) {
          if (attempt === 3) throw error;
        }
      }

      if (!talkResponse.ok) {
        console.error(
          "Video streaming error details:",
          JSON.stringify(errorData, null, 2)
        );
        if (talkResponse.status === 400) {
          throw new Error("Unable to process request. Please try again");
        } else if (talkResponse.status === 402) {
          throw new Error("Service temporarily unavailable");
        } else if (talkResponse.status === 404) {
          throw new Error("Connection lost. Please refresh and try again");
        } else {
          throw new Error("Video streaming error");
        }
      }

      // Wait for video stream
      for (let i = 0; i < 10; i++) {
        if (this.videoIsPlaying) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      inputContainer.classList.remove("loading");
      this.addMessage(aiResponse, false);
      document.getElementById("user-input-field").value = "";
    } catch (error) {
      console.error("streaming-client-api.js: handleTalk: Error:", error);
      this.showToast(
        "Unable to process your message. Please try again",
        "error"
      );
      throw error;
    } finally {
      this.messageProcessing.delete(messageId);
      const inputContainer = document.getElementById("input-container");
      if (inputContainer) {
        inputContainer.classList.remove("loading");
      }
      console.log(
        `streaming-client-api.js: handleTalk: Total time: ${
          performance.now() - startTime
        }ms`
      );
    }
  }

  async getVoiceConfig() {
    // Determine which page we're on to use appropriate voice logic
    const currentPath = window.location.pathname;
    const isAlterChat = currentPath.includes("chat-alter");

    if (isAlterChat) {
      // For chat-alter.html: Use voice from alter data (published_alters or hardcoded premade)
      console.log("Getting voice config for chat-alter page");

      // Priority 1: Get voice from selected alter data
      if (
        window.selectedAlter &&
        (window.selectedAlter.voiceId || window.selectedAlter.voice_id)
      ) {
        const voiceId =
          window.selectedAlter.voiceId || window.selectedAlter.voice_id;
        console.log("Using voice from selectedAlter:", voiceId);
        return voiceId;
      }

      // Priority 2: Check session storage for alter data
      const currentAlter = sessionStorage.getItem("alterCurrentAlter");
      if (currentAlter) {
        try {
          const alter = JSON.parse(currentAlter);
          if (alter.voiceId || alter.voice_id) {
            const voiceId = alter.voiceId || alter.voice_id;
            console.log("Using voice from alterCurrentAlter:", voiceId);
            return voiceId;
          }
        } catch (e) {
          console.warn("Failed to parse alterCurrentAlter:", e);
        }
      }

      // Priority 3: Check regular currentAlter in session
      const sessionAlter = sessionStorage.getItem("currentAlter");
      if (sessionAlter) {
        try {
          const alter = JSON.parse(sessionAlter);
          if (alter.voiceId || alter.voice_id) {
            const voiceId = alter.voiceId || alter.voice_id;
            console.log("Using voice from currentAlter:", voiceId);
            return voiceId;
          }
        } catch (e) {
          console.warn("Failed to parse currentAlter:", e);
        }
      }

      // Default voice for alters if no voice specified
      console.log("Using default voice for alter");
      return "21m00Tcm4TlvDq8ikWAM"; // Default female voice
    } else {
      // For chat.html: Use voice from alter_voices table (custom alters)
      console.log("Getting voice config for chat page (custom alters)");

      // Priority 1: Check Supabase for saved voice first
      try {
        const config = (await import("./config.js")).default;
        const { createClient: createSupabaseClient } = await import(
          "https://cdn.skypack.dev/@supabase/supabase-js@2"
        );
        const supabase = createSupabaseClient(
          config.supabaseUrl,
          config.supabaseKey
        );

        // Try different ways to get session ID
        let alterSessionId = sessionStorage.getItem("alterSessionId");

        if (!alterSessionId) {
          // Check avatar settings for session ID
          const avatarSettings = localStorage.getItem("avatarSettings");
          if (avatarSettings) {
            try {
              const settings = JSON.parse(avatarSettings);
              alterSessionId = settings.sessionId;
            } catch (e) {
              console.warn("Failed to parse avatarSettings for sessionId:", e);
            }
          }
        }

        if (!alterSessionId) {
          // Get the most recent entry for this user (fallback)
          const { data, error } = await supabase
            .from("alter_voices")
            .select("voice_id, session_id")
            .order("created_at", { ascending: false })
            .limit(1);

          if (!error && data && data.length > 0) {
            console.log(
              "Using most recent voice from Supabase:",
              data[0].voice_id
            );
            window.customVoiceId = data[0].voice_id; // Cache for future use
            sessionStorage.setItem("alterSessionId", data[0].session_id); // Store session ID
            return data[0].voice_id;
          }
        } else {
          // Use specific session ID
          const { data, error } = await supabase
            .from("alter_voices")
            .select("voice_id")
            .eq("session_id", alterSessionId)
            .single();

          if (!error && data?.voice_id) {
            console.log(
              "Using voice from Supabase by session ID:",
              data.voice_id
            );
            window.customVoiceId = data.voice_id; // Cache for future use
            return data.voice_id;
          }
        }
      } catch (supabaseError) {
        console.warn("Failed to fetch voice from Supabase:", supabaseError);
      }

      // Priority 2: Global custom voice ID (set by chat interface)
      if (window.customVoiceId) {
        console.log("Using global custom voice ID:", window.customVoiceId);
        return window.customVoiceId;
      }

      // Priority 3: Active voice config from session
      const activeVoiceConfig = sessionStorage.getItem("activeVoiceConfig");
      if (activeVoiceConfig) {
        try {
          const config = JSON.parse(activeVoiceConfig);
          if (config.voiceId) {
            console.log("Using voice from activeVoiceConfig:", config.voiceId);
            return config.voiceId;
          }
        } catch (e) {
          console.warn("Failed to parse activeVoiceConfig:", e);
        }
      }

      // Priority 4: Avatar settings from localStorage
      const avatarSettings = localStorage.getItem("avatarSettings");
      if (avatarSettings) {
        try {
          const settings = JSON.parse(avatarSettings);
          if (settings.voiceId) {
            console.log("Using voice from avatarSettings:", settings.voiceId);
            return settings.voiceId;
          }
        } catch (e) {
          console.warn("Failed to parse avatarSettings:", e);
        }
      }

      // Priority 5: Saved voice from localStorage
      const savedVoice = localStorage.getItem("selectedVoice");
      if (savedVoice) {
        try {
          const voice = JSON.parse(savedVoice);
          if (voice.voiceId) {
            console.log("Using voice from saved voice:", voice.voiceId);
            return voice.voiceId;
          }
        } catch (e) {
          console.warn("Failed to parse saved voice:", e);
        }
      }

      // Default voice if nothing else is available
      console.log("Using default voice for custom alter");
      return "21m00Tcm4TlvDq8ikWAM"; // Default female voice
    }
  }

  async generateElevenLabsAudio(text) {
    const maxRetries = 2; // Reduced from 3 for faster failure
    let attempt = 1;

    while (attempt <= maxRetries) {
      try {
        let voiceId = await this.getVoiceConfig();
        console.log(
          "streaming-client-api.js: generateElevenLabsAudio: Using voice ID:",
          voiceId
        );

        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
          {
            method: "POST",
            headers: {
              "xi-api-key": this.API_CONFIG.elevenlabs_key,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: text,
              model_id: "eleven_monolingual_v1",
              voice_settings: {
                stability: 0.3,
                similarity_boost: 0.3,
                style: 0.5,
                use_speaker_boost: true,
              },
            }),
            signal: new AbortController().signal,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(
            "Voice synthesis error:",
            JSON.stringify(errorData, null, 2)
          );
          throw new Error("Voice synthesis failed");
        }

        const audioBlob = await response.blob();
        console.log(
          "Audio blob size:",
          audioBlob.size,
          "type:",
          audioBlob.type
        );

        const audio = new Audio(URL.createObjectURL(audioBlob));
        await new Promise((resolve) => {
          audio.onloadedmetadata = resolve;
          audio.onerror = () => resolve();
        });
        const duration = audio.duration || 0;
        console.log("Audio duration:", duration, "seconds");
        if (duration < 1 || duration > 90) {
          throw new Error("Audio duration must be between 1 and 90 seconds");
        }

        const formData = new FormData();
        const audioFile = new File([audioBlob], `audio-${Date.now()}.mp3`, {
          type: "audio/mpeg",
        });
        formData.append("audio", audioFile);

        console.log("Uploading audio to storage");
        const uploadResponse = await fetch("/upload-audio", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error("Audio upload failed:", errorText);
          throw new Error("Audio upload failed");
        }

        const { url } = await uploadResponse.json();
        console.log("Audio uploaded successfully:", url);

        if (!url.startsWith("https://")) {
          throw new Error("Invalid audio URL: Must be an HTTPS URL");
        }

        return url;
      } catch (error) {
        console.error("Error generating audio:", error);
        this.showToast(
          "Unable to generate voice response. Please try again",
          "error"
        );
        throw error;
      } finally {
        attempt++;
      }
    }

    throw new Error("Failed to generate audio after multiple retries");
  }

  async handleDestroy() {
    try {
      if (this.streamId) {
        await this.deleteStream();
      }
    } catch (error) {
      console.error("streaming-client-api.js: Destroy error:", error);
      this.showToast(
        "Unable to disconnect properly. Please refresh the page",
        "warning"
      );
    } finally {
      this.cleanup();
      this.updateUI(false);
    }
  }

  async createStream() {
    // Wait a moment for alter image manager to finish updating
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get the current alter's image URL with proper fallback chain - COMPLETELY AVOID readdy.ai
    const selectedAlter = window.selectedAlter;
    let avatarUrl;

    // First, check if the avatar image element has a Supabase URL (updated by alter manager)
    const avatarImageElement = document.getElementById("avatar-image");
    if (
      avatarImageElement &&
      avatarImageElement.src &&
      avatarImageElement.src !== window.location.href &&
      !avatarImageElement.src.includes("placeholder.svg") &&
      avatarImageElement.src.includes("supabase")
    ) {
      avatarUrl = avatarImageElement.src;
      console.log("Using Supabase avatar image from DOM:", avatarUrl);
    }
    // If no Supabase URL in DOM, get from alter data but NEVER use readdy.ai
    else if (selectedAlter) {
      // For all alter types, prioritize Supabase URLs and avoid readdy.ai completely
      const candidateUrls = [
        selectedAlter.avatar_url,
        selectedAlter.image,
        this.customAvatarUrl,
      ].filter((url) => url && !url.includes("readdy.ai"));

      // Find the first Supabase URL
      avatarUrl = candidateUrls.find((url) => url.includes("supabase"));

      // If no Supabase URL, use any non-readdy.ai URL
      if (!avatarUrl) {
        avatarUrl = candidateUrls[0];
      }

      console.log("Using filtered image URL (no readdy.ai):", avatarUrl);
    } else {
      // If no selected alter, use custom avatar or default (never readdy.ai)
      avatarUrl =
        this.customAvatarUrl && !this.customAvatarUrl.includes("readdy.ai")
          ? this.customAvatarUrl
          : "https://raw.githubusercontent.com/jjmlovesgit/D-id_Streaming_Chatgpt/main/oracle_pic.jpg";
    }

    // Final safety check - if we still have a readdy.ai URL, use default instead
    if (!avatarUrl || avatarUrl.includes("readdy.ai")) {
      console.warn("Avoiding readdy.ai URL, using default avatar");
      avatarUrl =
        "https://raw.githubusercontent.com/jjmlovesgit/D-id_Streaming_Chatgpt/main/oracle_pic.jpg";
    }

    console.log(
      "streaming-client-api.js: Creating stream with avatar URL:",
      avatarUrl
    );

    // Set the avatar image in the UI
    if (this.avatarImage) {
      this.avatarImage.src = avatarUrl;
      this.avatarImage.style.display = "block";
      this.idleVideo.style.display = "none";
      this.talkVideo.style.display = "none";
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(`${this.DID_API_URL}/talks/streams`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(this.API_CONFIG.key + ":")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_url: avatarUrl,
        driver_url: "bank://lively/",
        config: {
          stitch: true,
          client_fps: 30,
          streaming_mode: "web",
          reduced_latency: true,
          video_quality: "medium",
          optimize_network_bandwidth: true,
          auto_match: true,
          stream_warmup: true,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: "Failed to parse error response" };
      }
      console.error(
        "streaming-client-api.js: Stream creation error:",
        JSON.stringify(errorData, null, 2)
      );
      if (response.status === 400 || response.status === 422) {
        throw new Error("Avatar image not supported");
      }
      throw new Error("Failed to create video stream");
    }

    return response;
  }

  async createPeerConnection(offer, iceServers) {
    const RTCPeerConnection = (
      window.RTCPeerConnection ||
      window.webkitRTCPeerConnection ||
      window.mozRTCPeerConnection
    ).bind(window);

    this.peerConnection = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: "relay",
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
      iceCandidatePoolSize: 1,
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        fetch(`${this.DID_API_URL}/talks/streams/${this.streamId}/ice`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(this.API_CONFIG.key + ":")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            session_id: this.sessionId,
          }),
          signal: controller.signal,
        })
          .catch((error) => {
            console.error(
              "streaming-client-api.js: ICE candidate error:",
              error
            );
            this.showToast("Connection issue detected. Please try again");
          })
          .finally(() => clearTimeout(timeoutId));
      }
    };

    this.peerConnection.ontrack = (event) => {
      if (event.track.kind === "video") {
        this.statsIntervalId = setInterval(async () => {
          const stats = await this.peerConnection.getStats(event.track);
          stats.forEach((report) => {
            if (report.type === "inbound-rtp" && report.kind === "video") {
              const isPlaying = report.bytesReceived > this.lastBytesReceived;
              if (isPlaying !== this.videoIsPlaying) {
                this.videoIsPlaying = isPlaying;
                this.updateStatus(
                  "streaming",
                  isPlaying ? "streaming" : "idle"
                );

                if (isPlaying) {
                  console.log(
                    "streaming-client-api.js: Video stream started playing"
                  );
                  this.talkVideo.style.display = "block";
                  this.avatarImage.style.display = "none";
                  this.idleVideo.style.display = "none";
                  this.talkVideo.srcObject = event.streams[0];
                  this.isPlayingPromise = true;
                  this.talkVideo
                    .play()
                    .then(() => {
                      this.isPlayingPromise = false;
                    })
                    .catch((error) => {
                      console.error(
                        "streaming-client-api.js: Video play error:",
                        error
                      );
                      this.isPlayingPromise = false;
                      this.showToast("Video playback issue. Please try again");
                    });
                } else {
                  console.log("streaming-client-api.js: Video stream stopped");
                  // Only transition back to avatar if we're not in the middle of playing
                  if (!this.isPlayingPromise) {
                    this.talkVideo.pause();
                    this.talkVideo.srcObject = null;
                    this.talkVideo.style.display = "none";

                    // Get the current alter's image URL
                    const selectedAlter = window.selectedAlter;
                    const avatarUrl =
                      selectedAlter?.image ||
                      selectedAlter?.avatar_url ||
                      this.customAvatarUrl;

                    if (avatarUrl) {
                      this.avatarImage.src = avatarUrl;
                      this.avatarImage.style.display = "block";
                      this.idleVideo.style.display = "none";
                    } else {
                      this.avatarImage.style.display = "none";
                      this.idleVideo.style.display = "block";
                    }
                  }
                }
              }
              this.lastBytesReceived = report.bytesReceived;
            }
          });
        }, 500);
      }
    };

    this.peerConnection.addEventListener("connectionstatechange", () => {
      if (this.peerConnection.connectionState === "connected") {
        console.log("Connected to video stream successfully");
      }
    });

    await this.peerConnection.setRemoteDescription(offer);
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async sendSDPAnswer(answer) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(
      `${this.DID_API_URL}/talks/streams/${this.streamId}/sdp`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(this.API_CONFIG.key + ":")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answer: answer,
          session_id: this.sessionId,
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    return response;
  }

  async deleteStream() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(
      `${this.DID_API_URL}/talks/streams/${this.streamId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Basic ${btoa(this.API_CONFIG.key + ":")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session_id: this.sessionId }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    return response;
  }

  cleanup() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (!this.isPlayingPromise) {
      this.talkVideo.pause();
      this.talkVideo.srcObject = null;
      this.talkVideo.style.display = "none";

      // Get the current alter's image URL with proper fallback chain
      const selectedAlter = window.selectedAlter;
      let avatarUrl;

      if (selectedAlter) {
        // For premade or customized alters
        if (
          selectedAlter.type === "premade" ||
          selectedAlter.type === "customized"
        ) {
          avatarUrl = selectedAlter.image || selectedAlter.avatar_url;
        }
        // For new custom alters
        else if (selectedAlter.type === "custom") {
          avatarUrl = this.customAvatarUrl;
        }
        // Fallback for any other case
        else {
          avatarUrl =
            selectedAlter.image ||
            selectedAlter.avatar_url ||
            this.customAvatarUrl;
        }
      } else {
        // If no selected alter, use custom avatar or default
        avatarUrl =
          this.customAvatarUrl ||
          "https://raw.githubusercontent.com/jjmlovesgit/D-id_Streaming_Chatgpt/main/oracle_pic.jpg";
      }

      if (avatarUrl) {
        this.avatarImage.src = avatarUrl;
        this.avatarImage.style.display = "block";
        this.idleVideo.style.display = "none";
      } else {
        this.avatarImage.style.display = "none";
        this.idleVideo.style.display = "block";
      }

      const video = document.getElementById("talk-video");
      if (video.srcObject) {
        video.srcObject.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
    }

    if (this.statsIntervalId) {
      clearInterval(this.statsIntervalId);
      this.statsIntervalId = null;
    }
    ["peer", "ice", "iceGathering", "signaling", "streaming"].forEach(
      (type) => {
        this.updateStatus(
          type,
          type === "signaling" ? "stable" : "disconnected"
        );
      }
    );
  }

  updateUI(connected) {
    const enterButton = document.getElementById("enter-button");
    if (connected) {
      enterButton.classList.add("connected");
    } else {
      enterButton.classList.remove("connected", "loading");
    }
  }

  updateStatus(type, state) {
    const label = document.getElementById(`${type}-status-label`);
    if (!label) return;
    label.innerText = state;
    label.className = `${type}-${state}`;
  }

  // Method to refresh stream with updated alter image
  async refreshAlterStream(alterData) {
    if (alterData) {
      // Update the global selectedAlter with fresh data
      window.selectedAlter = alterData;

      // Force refresh the avatar image
      const avatarUrl = alterData.avatar_url || alterData.image;
      if (avatarUrl && this.avatarImage) {
        this.avatarImage.src = avatarUrl;
        console.log("Refreshed avatar image:", avatarUrl);
      }

      // Recreate the stream to use the updated image
      try {
        await this.handleDestroy();
        await this.handleConnectWithRetry();
        console.log("Stream refreshed with updated alter image");
      } catch (error) {
        console.error("Failed to refresh stream:", error);
        this.showToast(
          "Failed to update avatar. Please refresh the page.",
          "error"
        );
      }
    }
  }

  showToast(message, type = "error") {
    // Create toast container if it doesn't exist
    let container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    // Add icon based on type
    const icons = {
      success: "fa-check-circle",
      error: "fa-exclamation-circle",
      warning: "fa-exclamation-triangle",
      info: "fa-info-circle",
    };

    // Create unique ID for this toast
    const toastId = `toast-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    toast.id = toastId;

    toast.innerHTML = `
      <div class="toast-icon-wrapper">
        <i class="fas ${icons[type] || icons.error} toast-icon"></i>
      </div>
      <div class="toast-content">
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <i class="fas fa-times"></i>
      </button>
      <div class="toast-progress"></div>
    `;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
      toast.classList.add("show");
    }, 100);

    // Start progress bar animation
    const progressBar = toast.querySelector(".toast-progress");
    setTimeout(() => {
      progressBar.style.transform = "scaleX(0)";
    }, 200);

    // Auto remove after 4 seconds
    setTimeout(() => {
      if (document.getElementById(toastId)) {
        toast.classList.remove("show");
        setTimeout(() => {
          if (toast.parentElement) {
            toast.remove();
          }
        }, 400);
      }
    }, 4000);

    console[type === "error" ? "error" : "log"](message);
  }

  async buildChatPrompt(message) {
    let systemPrompt = "You are a helpful AI assistant.";
    let alterName = "AI Assistant";
    let alterDescription = "";
    let personality = "";
    let knowledge = "";
    let documentContent = "";

    // Check for alter properties from database or localStorage
    if (window.alterProperties) {
      console.log("Using alter properties for chat:", window.alterProperties);

      // Use the alter's system prompt if available
      if (window.alterProperties.prompt) {
        systemPrompt = window.alterProperties.prompt;
      }

      personality = window.alterProperties.personality || "";
      knowledge = window.alterProperties.knowledge || "";
      documentContent = window.alterProperties.documentContent || "";
    } else if (window.selectedAlter) {
      console.log(
        "Fallback to selectedAlter properties for chat:",
        window.selectedAlter
      );

      // Get alter details
      alterName = window.selectedAlter.name || "AI Assistant";
      alterDescription = window.selectedAlter.description || "";

      // Fallback to selectedAlter properties
      if (window.selectedAlter.prompt || window.selectedAlter.system_prompt) {
        systemPrompt =
          window.selectedAlter.prompt || window.selectedAlter.system_prompt;
      }

      personality =
        window.selectedAlter.personality ||
        window.selectedAlter.personality_description ||
        "";
      knowledge = window.selectedAlter.knowledge || "";
      documentContent = window.selectedAlter.documentContent || "";
    } else {
      console.warn(
        "No alter properties or selectedAlter found for chat system"
      );
    }

    // Get alter name from the selected alter
    if (window.selectedAlter && window.selectedAlter.name) {
      alterName = window.selectedAlter.name;
    }

    // Build comprehensive character prompt with strong identity enforcement
    let characterPrompt = "";

    // Start with role definition based on knowledge area and name
    if (
      knowledge === "medical" ||
      systemPrompt.toLowerCase().includes("doctor") ||
      alterName.toLowerCase().includes("doctor") ||
      alterName.toLowerCase().includes("dr")
    ) {
      characterPrompt = `You are ${alterName}, a professional medical doctor and healthcare consultant.`;
    } else if (knowledge === "legal") {
      characterPrompt = `You are ${alterName}, a qualified legal professional and attorney.`;
    } else if (knowledge === "finance") {
      characterPrompt = `You are ${alterName}, a financial advisor and investment consultant.`;
    } else if (knowledge === "technology") {
      characterPrompt = `You are ${alterName}, a technology expert and programming specialist.`;
    } else if (knowledge === "education") {
      characterPrompt = `You are ${alterName}, an experienced educator and academic professional.`;
    } else if (knowledge === "creative") {
      characterPrompt = `You are ${alterName}, a creative professional specializing in writing and content creation.`;
    } else {
      // Use the system prompt or create identity from name
      if (systemPrompt && !systemPrompt.includes("helpful AI assistant")) {
        characterPrompt = systemPrompt;
      } else {
        characterPrompt = `You are ${alterName}, a knowledgeable professional in your field.`;
      }
    }

    // Add description if available
    if (alterDescription) {
      characterPrompt += ` ${alterDescription}`;
    }

    // Add personality with strong behavioral instructions
    if (personality) {
      characterPrompt += `\n\nYour personality and approach: ${personality}`;
      characterPrompt += `\nYou MUST always embody this personality in every response. Never break character.`;
    }

    // Add professional expertise context
    if (knowledge) {
      characterPrompt += `\n\nYour area of expertise and specialization: ${knowledge}`;
      if (knowledge === "medical") {
        characterPrompt += `\nAs a doctor, when someone asks about your name and job, introduce yourself as Dr. ${alterName} and explain your medical expertise and role as a healthcare professional.`;
      } else if (knowledge === "legal") {
        characterPrompt += `\nAs a legal professional, when asked about your identity, introduce yourself as ${alterName} and describe your legal expertise and role as an attorney.`;
      } else {
        characterPrompt += `\nWhen asked about your identity and role, clearly explain your profession and expertise in ${knowledge}.`;
      }
    }

    // Add document content if available
    if (documentContent) {
      characterPrompt += `\n\nAdditional specialized knowledge: ${documentContent}`;
    }

    // Add strong behavioral and identity instructions
    characterPrompt += `\n\n=== CRITICAL IDENTITY INSTRUCTIONS ===
1. You are ${alterName} - NEVER refer to yourself as "AI assistant" or any generic term
2. When asked "what is your name" or "who are you", respond with: "I am ${alterName}" followed by your professional role and expertise
3. Always stay completely in character according to your defined role and personality
4. Your responses must reflect your professional background and expertise
5. NEVER break character or mention that you are an AI
6. Embody your personality traits in every interaction
7. Use your specialized knowledge to provide professional, expert-level responses
8. Maintain consistency with your established identity throughout the entire conversation`;

    // Add knowledge-specific identity reinforcement
    if (knowledge === "medical") {
      characterPrompt += `\n9. Always identify as a medical doctor when discussing your profession
10. Provide medical insights and healthcare guidance as a qualified physician`;
    } else if (knowledge === "legal") {
      characterPrompt += `\n9. Always identify as a legal professional when discussing your profession
10. Provide legal insights and guidance as a qualified attorney`;
    }

    console.log("Built enhanced character prompt:", characterPrompt);

    return `${characterPrompt}\n\nUser: ${message}`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("streaming-client-api.js: Initializing VideoAgent");
  window.videoAgent = new VideoAgent();
  console.log(
    "streaming-client-api.js: VideoAgent assigned to window.videoAgent"
  );
});
