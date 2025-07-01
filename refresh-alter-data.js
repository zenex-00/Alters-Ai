// Script to refresh alter data from database
async function refreshAlterData() {
  console.log('🔄 Refreshing alter data from database...');
  
  try {
    // Clear all cached data
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.removeItem('alterCurrentAlter');
    localStorage.removeItem('selectedAlter');
    localStorage.removeItem('alterSelectedAlter');
    
    console.log('✅ Cached data cleared');
    
    // Fetch fresh data from database
    const response = await fetch('/api/premade-alters');
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const alters = await response.json();
    console.log('✅ Fetched', alters.length, 'alters from database');
    
    // Find Doctor Emma
    const doctorEmma = alters.find(alter => alter.name === 'Doctor Emma');
    if (doctorEmma) {
      console.log('✅ Found Doctor Emma with correct image URL:', doctorEmma.image);
      
      // Store the fresh data
      sessionStorage.setItem('alterCurrentAlter', JSON.stringify(doctorEmma));
      console.log('✅ Fresh alter data stored in sessionStorage');
      
      // Update the image manager if it exists
      if (window.alterImageManager) {
        window.alterImageManager.clearAllCaches();
        window.alterImageManager.setAlterData(doctorEmma);
        console.log('✅ Image manager updated with fresh data');
      }
      
      // Update the video agent if it exists
      if (window.videoAgent) {
        window.videoAgent.customAvatarUrl = doctorEmma.image;
        console.log('✅ Video agent updated with fresh avatar URL');
      }
      
      return doctorEmma;
    } else {
      console.log('❌ Doctor Emma not found in database');
      return null;
    }
  } catch (error) {
    console.error('❌ Error refreshing alter data:', error);
    return null;
  }
}

// Run the refresh
refreshAlterData().then(alter => {
  if (alter) {
    console.log('🎉 Alter data refreshed successfully!');
    console.log('Current image URL:', alter.image);
  } else {
    console.log('❌ Failed to refresh alter data');
  }
});

// Export for manual use
window.refreshAlterData = refreshAlterData; 