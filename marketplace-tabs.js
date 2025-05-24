document.addEventListener('DOMContentLoaded', () => {
  // Select tab elements
  const premadeTab = document.getElementById('premade-tab');
  const publishedTab = document.getElementById('published-tab');
  const premadeContent = document.getElementById('premade-content');
  const publishedContent = document.getElementById('published-content');
  const categoryFilter = document.getElementById('category-filter');
  const searchInput = document.getElementById('search-input');

  // Error handling for critical elements
  if (!premadeTab || !publishedTab || !premadeContent || !publishedContent) {
      console.error('Critical tab elements not found');
      return;
  }

  // Tab switching functionality
  premadeTab.addEventListener('click', () => {
      premadeTab.classList.add('active');
      publishedTab.classList.remove('active');
      premadeContent.style.display = 'grid';
      publishedContent.style.display = 'none';
  });

  publishedTab.addEventListener('click', () => {
      publishedTab.classList.add('active');
      premadeTab.classList.remove('active');
      publishedContent.style.display = 'grid';
      premadeContent.style.display = 'none';
      loadPublishedAlters(); // Load published alters when switching to that tab
  });

  // Load published alters
  async function loadPublishedAlters() {
      try {
          const response = await fetch('/api/published-alters');
          if (!response.ok) {
              throw new Error('Failed to fetch published alters');
          }
          const alters = await response.json();
          displayPublishedAlters(alters);
      } catch (error) {
          console.error('Error loading published alters:', error);
          showError('Failed to load published alters');
      }
  }

  // Display published alters
  function displayPublishedAlters(alters) {
      const container = document.getElementById('published-content');
      container.innerHTML = ''; // Clear existing content

      alters.forEach(alter => {
          const alterCard = createAlterCard(alter);
          container.appendChild(alterCard);
      });
  }

  // Create alter card element
  function createAlterCard(alter) {
      // Use the same structure as premade alters (product-card)
      const card = document.createElement('div');
      card.className = 'bg-secondary bg-opacity-30 rounded-lg overflow-hidden product-card';
      card.innerHTML = `
          <div class="relative">
              <img src="${alter.avatar_url}" alt="${alter.name}" class="w-full h-64 object-cover">
              <div class="absolute top-3 right-3 flex space-x-2">
                  <div class="w-8 h-8 bg-black bg-opacity-50 rounded-full flex items-center justify-center backdrop-blur-sm"></div>
                  <div class="w-8 h-8 bg-black bg-opacity-50 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <i class="ri-share-line text-white"></i>
                  </div>
              </div>
              <div class="absolute bottom-3 left-3">
                  <div class="bg-primary text-white text-xs px-3 py-1 rounded-full">
                      ${alter.category}
                  </div>
              </div>
              <div class="absolute inset-0 flex items-center justify-center quick-view"></div>
          </div>
          <div class="p-4">
              <div class="flex items-center justify-between mb-2">
                  <h3 class="font-bold">${alter.name}</h3>
                  <div class="flex text-yellow-400 text-sm">
                      <i class="ri-star-fill"></i>
                      <span class="ml-1">${alter.rating ? alter.rating : '4.9'}</span>
                  </div>
              </div>
              <div class="flex items-center mb-4">
                  <div class="w-6 h-6 rounded-full overflow-hidden mr-2">
                      <img src="${alter.creator_avatar || '/placeholder.svg'}" alt="Creator" class="w-full h-full object-cover" />
                  </div>
                  <span class="text-sm text-gray-400">by <span class="text-primary">${alter.creator_name || 'Unknown'}</span></span>
                  <div class="ml-2 w-4 h-4 bg-primary bg-opacity-20 rounded-full flex items-center justify-center">
                      <i class="ri-check-line text-primary text-xs"></i>
                  </div>
              </div>
              <div class="flex items-center justify-between">
                  <div>
                      <div class="text-xl font-bold">$${alter.price ? alter.price : '9.99'}</div>
                  </div>
                  <button class="add-to-cart bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center">
                      <i class="ri-mic-line"></i>
                  </button>
                  <button class="talk-to-alter bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center ml-2" title="Talk to this alter">
                      <i class="ri-chat-3-line"></i>
                  </button>
                  ${alter.is_owner ? `<button class="delete-button ml-2" data-alter-id="${alter.id}"><i class="fas fa-trash"></i></button>` : ''}
              </div>
          </div>
      `;

      // Add delete functionality for owner
      if (alter.is_owner) {
          const deleteButton = card.querySelector('.delete-button');
          deleteButton.addEventListener('click', () => deleteAlter(alter.id));
      }

      // Add talk/chat button functionality
      const talkButton = card.querySelector('.talk-to-alter');
      if (talkButton) {
          talkButton.addEventListener('click', () => {
              // Save alter data to localStorage for chat page
              localStorage.setItem('selectedAlter', JSON.stringify(alter));
              window.location.href = '/chat';
          });
      }

      return card;
  }

  // Delete alter functionality
  async function deleteAlter(alterId) {
      if (!confirm('Are you sure you want to delete this alter?')) {
          return;
      }

      try {
          const response = await fetch(`/api/published-alters/${alterId}`, {
              method: 'DELETE'
          });

          if (!response.ok) {
              throw new Error('Failed to delete alter');
          }

          // Remove the card from the UI
          const card = document.querySelector(`[data-alter-id="${alterId}"]`).closest('.alter-card');
          card.remove();

          showSuccess('Alter deleted successfully');
      } catch (error) {
          console.error('Error deleting alter:', error);
          showError('Failed to delete alter');
      }
  }

  // Category filter functionality
  if (categoryFilter) {
      categoryFilter.addEventListener('change', () => {
          const selectedCategory = categoryFilter.value;
          filterAlters(selectedCategory, searchInput.value);
      });
  }

  // Search functionality
  if (searchInput) {
      searchInput.addEventListener('input', () => {
          filterAlters(categoryFilter.value, searchInput.value);
      });
  }

  // Filter alters based on category and search term
  function filterAlters(category, searchTerm) {
      const cards = document.querySelectorAll('.alter-card');
      cards.forEach(card => {
          const cardCategory = card.querySelector('.category').textContent;
          const cardName = card.querySelector('h3').textContent;
          const cardDescription = card.querySelector('.description').textContent;

          const matchesCategory = category === 'all' || cardCategory === category;
          const matchesSearch = searchTerm === '' || 
              cardName.toLowerCase().includes(searchTerm.toLowerCase()) ||
              cardDescription.toLowerCase().includes(searchTerm.toLowerCase());

          card.style.display = matchesCategory && matchesSearch ? 'block' : 'none';
      });
  }

  // Toast notification functions
  function showSuccess(message) {
      // Implement your toast notification system here
      console.log('Success:', message);
  }

  function showError(message) {
      // Implement your toast notification system here
      console.error('Error:', message);
  }
}); 