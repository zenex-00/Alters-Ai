// Script to clear all caches and localStorage for testing
console.log('🧹 Clearing all caches and localStorage...');

// Clear localStorage
localStorage.clear();
console.log('✅ localStorage cleared');

// Clear sessionStorage
sessionStorage.clear();
console.log('✅ sessionStorage cleared');

// Clear specific alter data
sessionStorage.removeItem('alterCurrentAlter');
localStorage.removeItem('selectedAlter');
localStorage.removeItem('alterSelectedAlter');
console.log('✅ Alter data cleared');

// Clear image cache if it exists
if (window.alterImageManager) {
  window.alterImageManager.clearAllCaches();
  console.log('✅ Image cache cleared');
}

// Clear any other caches
if ('caches' in window) {
  caches.keys().then(function(names) {
    for (let name of names) {
      caches.delete(name);
    }
    console.log('✅ Browser caches cleared');
  });
}

console.log('🎉 All caches cleared! Please refresh the page to test with fresh data.'); 