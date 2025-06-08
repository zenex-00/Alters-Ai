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

  // Image loading is now handled by alterImageManager

  // Use the alter image manager to get alter data from any storage source
  const alter = alterImageManager.constructor.getAlterFromStorage();

  if (alter) {
    try {
      console.log("Loading alter from storage:", alter);

      // Use the image manager to handle the alter image
      await alterImageManager.handleAlterImage(alter);

      // Set chat header name if available
      const chatHeader = document.querySelector(".chat-header h2");
      if (chatHeader && alter.name) {
        chatHeader.textContent = `Chat with ${alter.name}`;
      }

      // Store alter data for later use
      window.selectedAlter = alter;

      // For custom alters without images, ensure placeholder is set
      if (alter.type === "custom") {
        const avatarImage = document.getElementById("avatar-image");
        if (avatarImage && !alter.image && !alter.avatar_url) {
          avatarImage.src = "/placeholder.svg";
          avatarImage.style.display = "block";
        }
      }

      // Clean up avatar settings after loading custom alter
      if (alter.type === "custom") {
        localStorage.removeItem("avatarSettings");
      }
    } catch (e) {
      console.error("Failed to process alter data:", e);
      // Fallback to placeholder
      const avatarImage = document.getElementById("avatar-image");
      if (avatarImage) {
        avatarImage.src = "/placeholder.svg";
        avatarImage.style.display = "block";
      }
    }
  } else {
    console.log("No alter data found in storage");
    // Set default placeholder
    const avatarImage = document.getElementById("avatar-image");
    if (avatarImage) {
      avatarImage.src = "/placeholder.svg";
      avatarImage.style.display = "block";
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
        const isConnecting =
          videoAgent.isConnecting ||
          !videoAgent.streamId ||
          !videoAgent.sessionId;
        if (isConnecting) {
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
    if (
      isSending ||
      enterButton.classList.contains("loading") ||
      enterButton.disabled
    ) {
      console.log(
        "chat-interface.js: Message sending blocked (isSending:",
        isSending,
        ", loading:",
        enterButton.classList.contains("loading"),
        ", disabled:",
        enterButton.disabled,
        ")"
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
