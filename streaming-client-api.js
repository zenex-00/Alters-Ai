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
    this.currentConversationId = null;
    this.isConnecting = false;

    this.idleVideo = document.getElementById("idle-video");
    this.talkVideo = document.getElementById("talk-video");
    this.avatarImage = document.getElementById("avatar-image");

    // Handle missing video elements gracefully
    if (this.idleVideo) {
      this.idleVideo.addEventListener("error", () => {
        console.warn(
          "streaming-client-api.js: Idle video failed to load, hiding element"
        );
        this.idleVideo.style.display = "none";
      });
    }

    // Set default avatar URL
    const defaultAvatarUrl =
      "https://lstowcxyswqxxddttwnz.supabase.co/storage/v1/object/public/images/avatars/general/1749156984503-934277780.jpg";

    // Load custom avatar URL from localStorage or use default
    const settings = JSON.parse(localStorage.getItem("avatarSettings") || "{}");
    this.customAvatarUrl = settings.avatarUrl || defaultAvatarUrl;
    console.log("Loaded customAvatarUrl:", this.customAvatarUrl);

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

  async initializeConversation() {
    try {
      const selectedAlter = window.selectedAlter;
      if (!selectedAlter) {
        console.log("No alter selected, skipping conversation initialization");
        return;
      }

      const alterId = selectedAlter.id || selectedAlter.alter_id || "default";
      const alterType = selectedAlter.type || "custom";

      // Get or create conversation
      const convResponse = await fetch("/api/chat/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alterId, alterType }),
      });

      if (!convResponse.ok) {
        console.error("Failed to create conversation");
        return;
      }

      const convData = await convResponse.json();
      this.currentConversationId = convData.conversationId;

      // Load conversation history
      await this.loadConversationHistory();
    } catch (error) {
      console.error("Error initializing conversation:", error);
    }
  }

  async loadConversationHistory() {
    try {
      if (!this.currentConversationId) {
        return;
      }

      const historyResponse = await fetch(
        `/api/chat/history/${this.currentConversationId}`
      );
      if (!historyResponse.ok) {
        console.error("Failed to load conversation history");
        return;
      }

      const historyData = await historyResponse.json();
      const messages = historyData.messages || [];

      // Clear existing chat history
      const chatHistory = document.getElementById("chat-history");
      if (chatHistory) {
        chatHistory.innerHTML = "";
      }

      // Add messages to chat history
      messages.forEach((message) => {
        this.addMessage(message.content, message.role === "user");
      });

      console.log(
        `Loaded ${messages.length} messages from conversation history`
      );
    } catch (error) {
      console.error("Error loading conversation history:", error);
    }
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

      // Initialize conversation and load history
      await this.initializeConversation();

      console.log("Initialized successfully");
    } catch (error) {
      console.error("streaming-client-api.js: init error:", error);
      this.showToast(
        "Unable to initialize the application. Please refresh and try again.",
        "error"
      );
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
    this.isConnecting = true;
    enterButton.classList.add("loading");

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (
          this.peerConnection?.connectionState === "connected" &&
          this.streamId &&
          this.sessionId
        ) {
          enterButton.classList.remove("loading");
          return;
        }

        this.cleanup();

        const response = await this.createStream();
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Stream creation failed:", errorData);
          throw new Error(`Failed to create stream: ${response.status}`);
        }

        const responseData = await response.json();
        const { id, offer, ice_servers, session_id } = responseData;

        if (!id || !session_id || !offer) {
          throw new Error("Invalid response data from stream creation");
        }

        this.streamId = id;
        this.sessionId = session_id;

        console.log(
          `streaming-client-api.js: Stream created successfully - ID: ${this.streamId}, Session: ${this.sessionId}`
        );

        const answer = await this.createPeerConnection(offer, ice_servers);
        await this.sendSDPAnswer(answer);

        // Wait a moment to ensure connection is stable
        await new Promise((resolve) => setTimeout(resolve, 1000));

        this.isConnecting = false;
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

        // Reset IDs on failure
        this.streamId = null;
        this.sessionId = null;

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
          this.isConnecting = false;
          enterButton.classList.remove("loading");
          this.cleanup();
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  async handleTalk(userMessage = null) {
    // Validate stream is ready before processing
    if (!this.streamId || !this.sessionId) {
      console.log(
        "streaming-client-api.js: Stream not ready, attempting to reconnect..."
      );
      try {
        await this.handleConnectWithRetry();
        if (!this.streamId || !this.sessionId) {
          throw new Error("Failed to establish stream connection");
        }
      } catch (error) {
        console.error(
          "streaming-client-api.js: Failed to establish connection:",
          error
        );
        this.showToast(
          "Connection failed. Please refresh the page and try again.",
          "error"
        );
        return;
      }
    }

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

      // Get or create conversation
      const selectedAlter = window.selectedAlter;
      if (!selectedAlter) {
        throw new Error("No alter selected");
      }

      const alterId = selectedAlter.id || selectedAlter.alter_id || "default";
      const alterType = selectedAlter.type || "custom";

      // Get conversation ID
      let conversationId = this.currentConversationId;
      if (!conversationId) {
        const convResponse = await fetch("/api/chat/conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alterId, alterType }),
        });

        if (!convResponse.ok) {
          throw new Error("Failed to create conversation");
        }

        const convData = await convResponse.json();
        conversationId = convData.conversationId;
        this.currentConversationId = conversationId;
      }

      // Send message to API with history and enhanced context
      const messageResponse = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: userMessage,
          alterContext: {
            ...selectedAlter,
            useHistory: true,
            maintainMemory: true,
          },
        }),
      });

      if (!messageResponse.ok) {
        throw new Error("Failed to process message");
      }

      const messageData = await messageResponse.json();
      aiResponse = messageData.response;

      // Generate audio
      const audioUrl = await this.generateElevenLabsAudio(aiResponse);
      if (!audioUrl.startsWith("https://")) {
        throw new Error("Invalid audio URL: Must be an HTTPS URL");
      }

      // Get the current alter's image URL with proper fallback
      const defaultAvatarUrl =
        "https://lstowcxyswqxxddttwnz.supabase.co/storage/v1/object/public/images/avatars/general/1749156984503-934277780.jpg";
      let avatarUrl =
        selectedAlter?.image ||
        selectedAlter?.avatar_url ||
        selectedAlter?.avatarUrl ||
        selectedAlter?.profile_image ||
        selectedAlter?.profileImage ||
        this.customAvatarUrl ||
        defaultAvatarUrl;

      // Ensure we have a valid URL
      if (!avatarUrl || avatarUrl === "undefined" || avatarUrl === "null") {
        avatarUrl = defaultAvatarUrl;
      }

      // Upload the avatar image to our server to get a fresh public URL
      try {
        if (avatarUrl !== defaultAvatarUrl && !avatarUrl.includes("/upload/")) {
          const freshUrl = await this.uploadAvatarToServer(avatarUrl);
          if (freshUrl) {
            avatarUrl = freshUrl;
            console.log(
              "Using fresh uploaded avatar URL for streaming:",
              avatarUrl
            );
          } else {
            console.warn(
              "Failed to upload avatar for streaming, using default"
            );
            avatarUrl = defaultAvatarUrl;
          }
        }
      } catch (error) {
        console.warn(
          "Avatar upload failed for streaming, using default:",
          error
        );
        avatarUrl = defaultAvatarUrl;
      }

      // Log the audio URL and avatar URL for debugging
      console.log("Audio URL:", audioUrl);
      console.log("Avatar URL:", avatarUrl);

      // Verify audio URL accessibility
      const urlCheck2 = await fetch(audioUrl, { method: "HEAD" });
      if (!urlCheck2.ok) {
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

  async uploadAvatarToServer(imageUrl) {
    try {
      console.log("Uploading avatar to server:", imageUrl);

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
      const fileName = `avatar-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
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
      console.log("Successfully uploaded avatar:", uploadData.url);

      // Store the URL in localStorage for persistence
      localStorage.setItem('customAvatarUrl', uploadData.url);
      
      return uploadData.url;
    } catch (error) {
      console.error("Error uploading avatar to server:", error);
      return null;
    }
  }

  async generateElevenLabsAudio(text) {
    try {
      // First try to get voice ID from the current alter
      let voiceId = null;

      // Check window.selectedAlter first
      if (
        window.selectedAlter &&
        (window.selectedAlter.voiceId || window.selectedAlter.voice_id)
      ) {
        voiceId = window.selectedAlter.voiceId || window.selectedAlter.voice_id;
        console.log("Voice ID from selectedAlter:", voiceId);
      }
      // Check sessionStorage for current alter
      else {
        const sessionAlter = JSON.parse(
          sessionStorage.getItem("alterCurrentAlter") || "{}"
        );
        if (sessionAlter.voiceId || sessionAlter.voice_id) {
          voiceId = sessionAlter.voiceId || sessionAlter.voice_id;
          console.log(
            "Voice ID from sessionStorage alterCurrentAlter:",
            voiceId
          );
        }
        // Check localStorage avatarSettings as fallback
        else {
          const settings = JSON.parse(
            localStorage.getItem("avatarSettings") || "{}"
          );
          if (settings.voiceId || settings.voice_id) {
            voiceId = settings.voiceId || settings.voice_id;
            console.log("Voice ID from localStorage avatarSettings:", voiceId);
          }
        }
      }

      console.log("Retrieved voice ID:", voiceId || "undefined");

      // Use default voice if no voice ID found
      voiceId = voiceId || "21m00Tcm4TlvDq8ikWAM";

      console.log(
        "Final voice ID for audio generation:",
        voiceId,
        "text:",
        text
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
      console.log("Audio blob size:", audioBlob.size, "type:", audioBlob.type);

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
    }
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
    try {
      let avatarUrl = this.customAvatarUrl;

      // If we have a custom avatar, try to upload it
      if (avatarUrl) {
        try {
          const uploadedUrl = await this.uploadAvatarToServer(avatarUrl);
          if (uploadedUrl) {
            avatarUrl = uploadedUrl;
          } else {
            console.warn("Failed to upload avatar, using default");
            avatarUrl = null;
          }
        } catch (error) {
          console.error("Error handling custom avatar:", error);
          avatarUrl = null;
        }
      }

      console.log("Creating stream with avatar URL:", avatarUrl);

      // Create the stream with or without custom avatar
      const response = await fetch("/create-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          avatarUrl: avatarUrl,
          voiceId: this.voiceId,
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to create stream: ${response.status}`);
      }

      const data = await response.json();
      this.streamId = data.streamId;
      this.sessionId = data.sessionId;

      console.log("Stream created successfully - ID:", this.streamId, "Session:", document.cookie);
      return data;
    } catch (error) {
      console.error("Error creating stream:", error);
      throw error;
    }
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
          try {
            if (
              !this.peerConnection ||
              this.peerConnection.connectionState !== "connected"
            ) {
              return;
            }
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
                        this.showToast(
                          "Video playback issue. Please try again"
                        );
                      });
                  } else {
                    console.log(
                      "streaming-client-api.js: Video stream stopped"
                    );
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
          } catch (error) {
            // Silently handle stats errors to avoid console spam
            if (error.name !== "InvalidAccessError") {
              console.warn(
                "streaming-client-api.js: Stats collection error:",
                error
              );
            }
          }
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

    // Reset connection state
    this.streamId = null;
    this.sessionId = null;
    this.videoIsPlaying = false;
    this.lastBytesReceived = 0;
    this.isConnecting = false;

    if (!this.isPlayingPromise) {
      this.talkVideo.pause();
      this.talkVideo.srcObject = null;
      this.talkVideo.style.display = "none";

      // Get the current alter's image URL with proper fallback
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
          "https://lstowcxyswqxxddttwnz.supabase.co/storage/v1/object/public/images/avatars/general/1749156984503-934277780.jpg";
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
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("streaming-client-api.js: Initializing VideoAgent");
  window.videoAgent = new VideoAgent();
  console.log(
    "streaming-client-api.js: VideoAgent assigned to window.videoAgent"
  );
});
