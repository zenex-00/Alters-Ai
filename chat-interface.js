import alterImageManager from "./alter-image-manager.js";

document.addEventListener("DOMContentLoaded", async () => {
  console.log("chat-interface.js: DOMContentLoaded fired");

  const userInputField = document.getElementById("user-input-field");
  const voiceButton = document.getElementById("voice-button");
  const enterButton = document.getElementById("enter-button");
  const chatHistory = document.getElementById("chat-history");

  let recognition = null;
  let isRecording = false;
  let isSending = false;

  // Function to handle image loading with fallbacks
  async function loadAlterImage(alter) {
    const avatarImage = document.getElementById("avatar-image");
    if (!avatarImage) {
      console.error("Avatar image element not found");
      return;
    }

    // List of possible image sources in order of preference
    const imageSources = [
      alter.image,
      alter.avatar_url,
      alter.avatarUrl,
      alter.profile_image,
      alter.profileImage,
      "/placeholder.svg", // Final fallback
    ].filter(Boolean); // Remove any undefined/null values

    // Try each image source until one works
    for (const imageUrl of imageSources) {
      try {
        // Create a promise that resolves when the image loads or rejects after timeout
        const imageLoadPromise = new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(imageUrl);
          img.onerror = () =>
            reject(new Error(`Failed to load image: ${imageUrl}`));
          img.src = imageUrl;
        });

        // Wait for image to load with timeout
        const loadedUrl = await Promise.race([
          imageLoadPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Image load timeout")), 5000)
          ),
        ]);

        // If we get here, the image loaded successfully
        avatarImage.src = loadedUrl;
        avatarImage.style.display = "block";
        console.log("Successfully loaded alter image:", loadedUrl);
        return true;
      } catch (error) {
        console.warn(`Failed to load image from ${imageUrl}:`, error);
        continue; // Try next image source
      }
    }

    // If we get here, all image sources failed
    console.error("All image sources failed to load");
    avatarImage.src = "/placeholder.svg";
    avatarImage.style.display = "block";
    return false;
  }

  // Check for selected alter from marketplace and avatar settings from customization
  const selectedAlter = localStorage.getItem("selectedAlter");
  const avatarSettings = localStorage.getItem("avatarSettings");

  if (avatarSettings) {
    try {
      const settings = JSON.parse(avatarSettings);
      console.log("Loading custom avatar settings:", settings);

      // Load additional data from Supabase if session ID exists
      if (settings.sessionId) {
        // Store session ID for voice lookup
        sessionStorage.setItem("alterSessionId", settings.sessionId);

        try {
          const configModule = await import("./config.js");
          const config = configModule.default;
          const supabaseModule = await import(
            "https://cdn.skypack.dev/@supabase/supabase-js@2"
          );
          const supabase = supabaseModule.createClient(
            config.supabaseUrl,
            config.supabaseKey
          );

          const { data, error } = await supabase
            .from("alter_voices")
            .select("*")
            .eq("session_id", settings.sessionId)
            .single();

          if (!error && data) {
            // Update settings with Supabase data including all properties
            settings.voiceId = data.voice_id;
            settings.voiceName = data.voice_name || "";
            settings.name = data.name;
            settings.personality = data.personality;
            settings.prompt = data.prompt;
            settings.knowledge = data.knowledge;
            settings.documentContent = data.document_content || "";
            settings.documentName = data.document_name || "";
            console.log("Enhanced settings with Supabase data:", settings);

            // Set global voice variables immediately
            window.customVoiceId = data.voice_id;
            window.customVoiceName = data.voice_name || "";
            console.log("Set global voice ID from Supabase:", data.voice_id);

            // Store complete alter properties globally for chat system
            window.alterProperties = {
              prompt: data.prompt,
              personality: data.personality,
              knowledge: data.knowledge,
              documentContent: data.document_content || "",
              type: "custom",
            };
          }
        } catch (supabaseError) {
          console.warn(
            "Failed to load from Supabase, using localStorage:",
            supabaseError
          );
          // Fallback to localStorage properties
          window.alterProperties = {
            prompt: settings.prompt || "",
            personality: settings.personality || "",
            knowledge: settings.knowledge || "",
            documentContent: settings.documentContent || "",
            type: "custom",
            name: settings.name,
          };
        }
      } else {
        // No session ID, use localStorage properties
        window.alterProperties = {
          prompt: settings.prompt || "",
          personality: settings.personality || "",
          knowledge: settings.knowledge || "",
          documentContent: settings.documentContent || "",
          type: "custom",
          name: settings.name,
        };
      }

      // Clear any existing alter data
      localStorage.removeItem("selectedAlter");
      sessionStorage.removeItem("currentAlter");

      // Set up the custom alter with all properties
      window.selectedAlter = {
        type: "custom",
        name: settings.name,
        prompt: window.alterProperties.prompt,
        personality: window.alterProperties.personality,
        knowledge: window.alterProperties.knowledge,
        voiceId: settings.voiceId,
        voiceName: settings.voiceName,
        documentContent: window.alterProperties.documentContent,
        // Only set image if avatarUrl exists
        image: settings.avatarUrl || null,
      };

      // Update chat header
      const chatHeader = document.querySelector(".chat-header h2");
      if (chatHeader && settings.name) {
        chatHeader.textContent = `Chat with ${settings.name}`;
      }

      // Load the alter image (will handle null/undefined gracefully)
      loadAlterImage(window.selectedAlter);

      // Store in sessionStorage for persistence
      sessionStorage.setItem(
        "currentAlter",
        JSON.stringify(window.selectedAlter)
      );

      // Set voice configuration globally and in session
      if (window.selectedAlter.voiceId) {
        window.customVoiceId = window.selectedAlter.voiceId;
        window.customVoiceName = window.selectedAlter.voiceName;

        // Store in sessionStorage for persistence during the session
        sessionStorage.setItem(
          "activeVoiceConfig",
          JSON.stringify({
            voiceId: window.selectedAlter.voiceId,
            voiceName: window.selectedAlter.voiceName,
          })
        );

        console.log(
          "Voice ID preserved in session:",
          window.selectedAlter.voiceId
        );
      }

      // Clear avatarSettings after successful load
      localStorage.removeItem("avatarSettings");
    } catch (e) {
      console.error("Failed to parse avatarSettings from localStorage:", e);
    }
  } else if (selectedAlter) {
    try {
      const alter = JSON.parse(selectedAlter);

      // For published alters, load properties from database
      if (alter.type === "published" && alter.id) {
        try {
          const configModule = await import("./config.js");
          const config = configModule.default;
          const supabaseModule = await import(
            "https://cdn.skypack.dev/@supabase/supabase-js@2"
          );
          const supabase = supabaseModule.createClient(
            config.supabaseUrl,
            config.supabaseKey
          );

          const { data, error } = await supabase
            .from("published_alters")
            .select("*")
            .eq("id", alter.id)
            .single();

          if (!error && data) {
            // Update alter with database properties
            alter.prompt = data.prompt;
            alter.personality = data.personality;
            alter.knowledge = data.knowledge;
            alter.voice_id = data.voice_id;
            alter.voice_name = data.voice_name;
            alter.document_content = data.document_content || "";
            console.log(
              "Loaded published alter properties from database:",
              data
            );

            // Store alter properties globally for chat system
            window.alterProperties = {
              prompt: data.prompt,
              personality: data.personality,
              knowledge: data.knowledge,
              documentContent: data.document_content || "",
              type: "published",
            };

            // Set voice variables for published alters
            if (data.voice_id) {
              window.customVoiceId = data.voice_id;
              window.customVoiceName = data.voice_name || "";
              console.log("Set voice ID for published alter:", data.voice_id);
            }
          }
        } catch (supabaseError) {
          console.warn(
            "Failed to load published alter properties:",
            supabaseError
          );
          // Fallback to existing alter properties
          window.alterProperties = {
            prompt: alter.prompt || alter.system_prompt || "",
            personality:
              alter.personality || alter.personality_description || "",
            knowledge: alter.knowledge || alter.category || "general",
            documentContent: alter.documentContent || "",
            type: alter.type || "premade",
          };
        }
      } else {
        // For non-published alters (premade), use existing properties
        window.alterProperties = {
          prompt: alter.prompt || alter.system_prompt || "",
          personality: alter.personality || alter.personality_description || "",
          knowledge: alter.knowledge || alter.category || "general",
          documentContent: alter.documentContent || "",
          type: alter.type || "premade",
        };
      }

      // Use the image manager to handle the alter image with error handling
      try {
        alterImageManager.handleAlterImage(alter);
      } catch (imageError) {
        console.warn("Image manager failed, using fallback:", imageError);
        loadAlterImage(alter);
      }

      // Set chat header name if available
      const chatHeader = document.querySelector(".chat-header h2");
      if (chatHeader && alter.name) {
        chatHeader.textContent = `Chat with ${alter.name}`;
      }

      // Store alter data for later use with updated properties
      window.selectedAlter = {
        ...alter,
        type: alter.type || "premade",
        prompt: window.alterProperties.prompt,
        personality: window.alterProperties.personality,
        name: alter.name,
        knowledge: window.alterProperties.knowledge,
        documentContent: window.alterProperties.documentContent,
        voiceId: alter.voiceId || alter.voice_id,
        voiceName: alter.voiceName || alter.voice_name,
      };

      // Set global voice variables for streaming client
      if (window.selectedAlter.voiceId) {
        window.customVoiceId = window.selectedAlter.voiceId;
        window.customVoiceName = window.customVoiceName;
        console.log(
          "Setting global custom voice ID from marketplace alter:",
          window.selectedAlter.voiceId
        );
      }

      // Debug log to verify properties are set
      console.log("Final alter properties for chat:", {
        prompt: window.alterProperties.prompt,
        personality: window.alterProperties.personality,
        knowledge: window.alterProperties.knowledge,
        documentContent: window.alterProperties.documentContent,
        type: window.alterProperties.type,
      });

      // Store in sessionStorage for persistence
      sessionStorage.setItem(
        "currentAlter",
        JSON.stringify(window.selectedAlter)
      );

      // Ensure voice ID is set globally after storing
      if (window.selectedAlter.voiceId) {
        window.customVoiceId = window.selectedAlter.voiceId;
        window.customVoiceName = window.selectedAlter.voiceName;
        console.log(
          "Voice ID preserved in session:",
          window.selectedAlter.voiceId
        );
      }

      // Remove from localStorage after loading
      localStorage.removeItem("selectedAlter");
    } catch (e) {
      console.error("Failed to parse selectedAlter from localStorage:", e);
    }
  }

  // Prevent multiple event listener attachments
  if (userInputField.dataset.listenersAttached) {
    console.log(
      "chat-interface.js: Event listeners already attached, skipping."
    );
    return;
  }
  userInputField.dataset.listenersAttached = "true";

  // Function to wait for videoAgent to be available
  async function waitForVideoAgent(timeout = 10000) {
    const start = Date.now();
    while (!window.videoAgent && Date.now() - start < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!window.videoAgent) {
      throw new Error("VideoAgent not initialized within timeout");
    }
    return window.videoAgent;
  }

  // Monitor connection status and toggle loading animation
  async function monitorConnection() {
    try {
      const videoAgent = await waitForVideoAgent();
      const checkConnection = () => {
        if (videoAgent.isConnecting) {
          enterButton.classList.add("loading");
          enterButton.disabled = true;
          enterButton.innerHTML = "";
        } else {
          enterButton.classList.remove("loading");
          enterButton.disabled = false;
          enterButton.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
        }
      };

      // Initial check
      checkConnection();

      // Poll connection status
      const intervalId = setInterval(checkConnection, 500);

      // Stop polling after 30 seconds or when connected
      setTimeout(() => {
        clearInterval(intervalId);
        checkConnection();
      }, 30000);
    } catch (error) {
      console.error("chat-interface.js: Error monitoring connection:", error);
      window.videoAgent.showToast("Failed to initialize, please refresh.");
      enterButton.classList.remove("loading");
      enterButton.disabled = false;
      enterButton.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
    }
  }

  // Start monitoring connection
  monitorConnection();

  // Initialize SpeechRecognition if available
  if (window.SpeechRecognition || window.webkitSpeechRecognition) {
    recognition = new (window.SpeechRecognition ||
      window.webkitSpeechRecognition)();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0])
        .map((result) => result.transcript)
        .join("");
      userInputField.value = transcript;
    };

    recognition.onend = () => {
      isRecording = false;
      voiceButton.classList.remove("recording");
      userInputField.placeholder = "Type a message...";
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      isRecording = false;
      voiceButton.classList.remove("recording");
      window.videoAgent.showToast(
        "Speech recognition failed. Please try again."
      );
    };

    voiceButton.addEventListener("click", () => {
      if (!recognition) {
        window.videoAgent.showToast(
          "Speech recognition is not supported in your browser."
        );
        return;
      }

      if (isRecording) {
        recognition.stop();
      } else {
        recognition.start();
        isRecording = true;
        voiceButton.classList.add("recording");
        userInputField.value = "";
        userInputField.placeholder = "Listening...";
      }
    });
  } else {
    voiceButton.addEventListener("click", () => {
      window.videoAgent.showToast(
        "Speech recognition is not supported in your browser."
      );
    });
  }

  // Function to add typing indicator
  function showTypingIndicator() {
    const typingDiv = document.createElement("div");
    typingDiv.classList.add("typing-indicator");
    typingDiv.innerHTML = `
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    `;
    chatHistory.appendChild(typingDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return typingDiv;
  }

  // Function to remove typing indicator
  function removeTypingIndicator(typingDiv) {
    if (typingDiv) {
      typingDiv.remove();
    }
  }

  // Function to send a message
  async function sendMessage() {
    if (isSending || enterButton.classList.contains("loading")) {
      console.log(
        "chat-interface.js: Message sending blocked (isSending or loading)"
      );
      return;
    }

    const message = userInputField.value.trim();
    if (!message) return;

    isSending = true;
    userInputField.disabled = true;
    enterButton.disabled = true;

    const typingDiv = showTypingIndicator();

    if (window.videoAgent) {
      try {
        console.log(
          `chat-interface.js: Calling videoAgent.handleTalk with message: "${message}"`
        );
        await window.videoAgent.handleTalk(message);
      } catch (error) {
        console.error("chat-interface.js: Error in handleTalk:", error);
        window.videoAgent.showToast("Server is slow, please try again later.");
      } finally {
        removeTypingIndicator(typingDiv);
        isSending = false;
        userInputField.disabled = false;
        enterButton.disabled = false;
        userInputField.value = "";
        userInputField.placeholder = "Type a message...";
      }
    } else {
      console.error("chat-interface.js: window.videoAgent is not defined");
      window.videoAgent.showToast("Chat service unavailable, please refresh.");
      removeTypingIndicator(typingDiv);
      isSending = false;
      userInputField.disabled = false;
      enterButton.disabled = false;
      userInputField.value = "";
      userInputField.placeholder = "Type a message...";
    }
  }

  // Add event listeners for sending messages
  enterButton.addEventListener("click", sendMessage);
  userInputField.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });
});
