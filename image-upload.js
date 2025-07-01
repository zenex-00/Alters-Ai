document.addEventListener("DOMContentLoaded", async () => {
  console.log("image-upload.js: DOMContentLoaded fired");

  // Select elements with error checking
  const uploadButton = document.getElementById("upload-avatar-button");
  const modal = document.getElementById("image-upload-modal");
  const closeModal = document.querySelector(".close-modal");
  const dropArea = document.getElementById("drop-area");
  const fileInput = document.getElementById("file-input");
  const imagePreview = document.getElementById("image-preview");
  const confirmButton = document.getElementById("confirm-upload");
  const cancelButton = document.getElementById("cancel-upload");

  // Verify critical elements exist
  if (!uploadButton) {
    console.error("image-upload.js: #upload-avatar-button not found in DOM");
    return;
  }
  if (!modal) {
    console.error("image-upload.js: #image-upload-modal not found in DOM");
    return;
  }

  console.log("image-upload.js: Attaching event listener to upload button");
  uploadButton.addEventListener("click", () => {
    console.log("image-upload.js: Upload button clicked");
    modal.style.display = "block";
  });

  closeModal.addEventListener("click", () => {
    console.log("image-upload.js: Close modal clicked");
    modal.style.display = "none";
    resetUpload();
  });

  cancelButton.addEventListener("click", () => {
    console.log("image-upload.js: Cancel upload clicked");
    modal.style.display = "none";
    resetUpload();
  });

  dropArea.addEventListener("click", () => {
    console.log("image-upload.js: Drop area clicked");
    fileInput.click();
  });

  dropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropArea.classList.add("drag-over");
  });

  dropArea.addEventListener("dragleave", () => {
    dropArea.classList.remove("drag-over");
  });

  dropArea.addEventListener("drop", (e) => {
    e.preventDefault();
    dropArea.classList.remove("drag-over");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      console.log("image-upload.js: File dropped");
      handleFile(files[0]);
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
      console.log("image-upload.js: File selected via input");
      handleFile(fileInput.files[0]);
    }
  });

  function handleFile(file) {
    // Validate image format and size
    if (!file.type.match("image/(jpeg|png|jpg)")) {
      window.videoAgent.showToast("Please use a JPEG or PNG image format");
      console.warn("image-upload.js: Invalid file type", file.type);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      window.videoAgent.showToast("Image is too large (maximum 25MB allowed)");
      console.warn("image-upload.js: File too large", file.size);
      return;
    }

    // Log dimensions for debugging (non-blocking)
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        console.log(
          `image-upload.js: Image dimensions: ${img.width}x${img.height}`
        );
        imagePreview.src = e.target.result;
        imagePreview.style.display = "block";
        console.log("image-upload.js: Image preview updated");
        fileInput.file = file;
      };
      img.onerror = () => {
        console.warn(
          "image-upload.js: Failed to load image for dimension logging"
        );
        imagePreview.src = e.target.result;
        imagePreview.style.display = "block";
        console.log(
          "image-upload.js: Image preview updated (despite load error)"
        );
        fileInput.file = file;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

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

  confirmButton.addEventListener("click", async () => {
    if (!fileInput.file) {
      window.videoAgent.showToast("Please select an image to upload");
      console.warn("image-upload.js: No file selected for upload");
      return;
    }

    // Set button to uploading state
    confirmButton.textContent = "Uploading...";
    confirmButton.classList.add("uploading");
    confirmButton.disabled = true;

    const formData = new FormData();
    formData.append("avatar", fileInput.file);

    try {
      console.log("image-upload.js: Attempting upload to /upload");
      const response = await fetch("/upload", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error || `Upload failed with status ${response.status}`;
        console.error(
          `image-upload.js: Upload failed. Status: ${response.status}, Error: ${errorMessage}`
        );
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Normalize the image URL
      let imageUrl = data.url;
      if (imageUrl.startsWith('/')) {
        imageUrl = `${window.location.origin}${imageUrl}`;
      }
      
      // Add cache busting
      const timestamp = Date.now();
      imageUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}_=${timestamp}`;
      
      try {
        const videoAgent = await waitForVideoAgent();
        await videoAgent.setCustomAvatar(imageUrl);
        // Restart the stream to apply the new avatar
        await videoAgent.handleDestroy(); // Clean up existing stream
        await videoAgent.handleConnectWithRetry(); // Create new stream with custom avatar
        
        // Store the alter data with the normalized image URL
        if (window.AlterStorageManager) {
          window.AlterStorageManager.setSelectedAlter({
            image: imageUrl,
            name: "Custom Avatar",
            type: "custom"
          });
        }
        
        // Set button to uploaded state
        confirmButton.textContent = "Uploaded";
        confirmButton.classList.remove("uploading");
        confirmButton.classList.add("uploaded");
        console.log("image-upload.js: Avatar uploaded, stream restarted");
        modal.style.display = "none";
        resetUpload();
        // Reset button after 3 seconds
        setTimeout(() => {
          confirmButton.textContent = "Confirm";
          confirmButton.classList.remove("uploaded");
          confirmButton.disabled = false;
        }, 3000);
      } catch (error) {
        console.error(
          "image-upload.js: Error setting custom avatar or restarting stream:",
          error
        );
        window.videoAgent.showToast(
          error.message.includes("not supported")
            ? "Avatar image not supported. Please try a different image"
            : "Unable to set avatar. Please try again"
        );
      }
    } catch (error) {
      console.error("image-upload.js: Upload error:", error);
      window.videoAgent.showToast("Upload failed. Please try again");
      confirmButton.textContent = "Upload Failed";
      confirmButton.classList.remove("uploading");
      confirmButton.classList.add("error");
      setTimeout(() => {
        confirmButton.textContent = "Confirm";
        confirmButton.classList.remove("error");
        confirmButton.disabled = false;
      }, 3000);
    }
  });

  function resetUpload() {
    fileInput.value = "";
    imagePreview.src = "#";
    imagePreview.style.display = "none";
    fileInput.file = null;
    console.log("image-upload.js: Upload state reset");
  }
});
