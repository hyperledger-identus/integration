// Simplified iframe communication functionality for breadcrumb/history updates only
window.IframeMessenger = {
  // Setup message listener for Allure navigation
  setupMessageListener(callback) {
    const messageHandler = (event) => {
      // Only handle specific navigation messages from Allure
      if (event.data && event.data.type === 'navigation') {
        console.log('Allure navigation detected:', event.data);
        callback(event.data);
      }
    };

    window.addEventListener('message', messageHandler);
    
    // Return cleanup function
    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }
};