// Application configuration and environment detection
window.AppConfig = {
  // Initialize configuration
  init() {
    const isLocalhost = window.location.host.includes('localhost');
    const basePath = isLocalhost ? "/" : "/integration/";
    window.basePath = basePath;
    
    return {
      isLocalhost,
      basePath
    };
  },

  // Get current base path
  getBasePath() {
    return window.basePath || this.init().basePath;
  },

  // Check if running in localhost
  isLocalhost() {
    return window.location.host.includes('localhost');
  }
};