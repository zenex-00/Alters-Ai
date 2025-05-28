document.addEventListener("DOMContentLoaded", () => {
  console.log("publish-alter.js: Script loaded");

  // Select elements
  const publishButton = document.getElementById("publish-button");
  const publishModal = document.getElementById("publish-modal");
  const closeModal = publishModal.querySelector(".close-modal");
  const cancelPublish = document.getElementById("cancel-publish");
  const confirmPublish = document.getElementById("confirm-publish");
  const categorySelect = document.getElementById("alter-category");
  const descriptionInput = document.getElementById("alter-description");

  // Verify critical elements exist
  if (!publishButton) {
    console.error("publish-alter.js: #publish-button not found in DOM");
    return;
  }
  if (!publishModal) {
    console.error("publish-alter.js: #publish-modal not found in DOM");
    return;
  }

  // Show modal
  publishButton.addEventListener("click", () => {
    console.log("publish-alter.js: Publish button clicked");
    publishModal.style.display = "block";
  });

  // Hide modal
  const hideModal = () => {
    console.log("publish-alter.js: Hiding modal");
    publishModal.style.display = "none";
    resetForm();
  };

  closeModal.addEventListener("click", hideModal);
  cancelPublish.addEventListener("click", hideModal);

  // Reset form
  function resetForm() {
    categorySelect.value = "Professional";
    descriptionInput.value = "";
  }

  // Handle publish
  confirmPublish.addEventListener("click", async () => {
    const category = categorySelect.value;
    const description = descriptionInput.value.trim();

    if (!description) {
      showError("Please provide a description for your alter.");
      return;
    }

    try {
      // Get avatar settings from localStorage
      const avatarSettings = JSON.parse(localStorage.getItem("avatarSettings") || "{}" );
      const currentAlter = JSON.parse(sessionStorage.getItem("currentAlter") || "{}" );

      if (!avatarSettings && !currentAlter.name) {
        throw new Error(
          "No alter settings found. Please customize your alter first."
        );
      }

      // Get avatar image from the video container
      const avatarImage = document.getElementById("avatar-image");
      if (!avatarImage || !avatarImage.src) {
        throw new Error("No avatar image found. Please upload an image first.");
      }

      // Prepare alter data - prioritize current alter settings over avatarSettings
      const alterData = {
        name: currentAlter?.name || avatarSettings?.name || "Untitled Alter",
        description: description,
        category: category,
        avatar_url: avatarImage.src,
        personality: currentAlter?.personality || avatarSettings?.personality || "Friendly and helpful",
        prompt: currentAlter?.prompt || avatarSettings?.prompt || "You are a helpful AI assistant.",
        knowledge: currentAlter?.knowledge || avatarSettings?.knowledge || category.toLowerCase(),
        voice_id: currentAlter?.voiceId || avatarSettings?.voiceId || "",
        is_public: true,
        type: currentAlter?.type || "custom",
        documentContent: currentAlter?.documentContent || avatarSettings?.documentContent || ""
      };

      // Validate required fields
      if (!alterData.name || !alterData.description || !alterData.personality || 
          !alterData.prompt || !alterData.knowledge || !alterData.category) {
        throw new Error("Missing required fields. Please ensure all fields are filled out.");
      }

      console.log("publish-alter.js: Publishing alter:", alterData);

      const response = await fetch("/api/publish-alter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(alterData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to publish alter: ${response.statusText}`
        );
      }

      const result = await response.json();
      console.log("publish-alter.js: Alter published successfully:", result);

      // Store the published alter data in sessionStorage
      sessionStorage.setItem("currentAlter", JSON.stringify({
        ...alterData,
        id: result.alter.id,
        type: "published"
      }));

      // Remove avatarSettings after successful publishing
      localStorage.removeItem("avatarSettings");

      // Show success message
      const successDiv = document.createElement("div");
      successDiv.className = "success-message";
      successDiv.style.color = "green";
      successDiv.style.marginTop = "10px";
      successDiv.textContent = "Alter published successfully!";
      publishModal.querySelector(".modal-content").appendChild(successDiv);

      // Hide modal after success
      setTimeout(() => {
        hideModal();
        // Optionally refresh the page or update UI
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("publish-alter.js: Error publishing alter:", error);
      showError(error.message);
    }
  });

  // Show error message
  function showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.style.color = "red";
    errorDiv.style.marginTop = "10px";
    errorDiv.textContent = message;
    publishModal.querySelector(".modal-content").appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }

  // Close modal when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === publishModal) {
      hideModal();
    }
  });
});
