// Main application bootstrap - orchestrates all modules
(function() {
  console.log('🚀 Initializing SPA Application...');

  // Initialize application configuration
  const config = window.AppConfig.init();
  console.log('✅ Configuration initialized:', { isLocalhost: config.isLocalhost, basePath: config.basePath });

  // Store global instances for cleanup
  window.appInstances = {};

  // Initialize core components
  try {
    // Initialize breadcrumb manager
    window.appInstances.breadcrumbManager = new window.BreadcrumbManager();
    console.log('✅ BreadcrumbManager initialized');

    // Initialize navbar controller
    window.appInstances.navbarController = new window.NavbarController();
    console.log('✅ NavbarController initialized');

    // Initialize SPA router
    window.appInstances.spaRouter = new window.SpaRouter();
    console.log('✅ SpaRouter initialized');

    // Initialize navigation handler
    window.appInstances.navigationHandler = new window.NavigationHandler(
      window.appInstances.spaRouter,
      window.appInstances.breadcrumbManager,
      window.appInstances.navbarController
    );
    console.log('✅ NavigationHandler initialized');

    // Initialize the router and handle initial route
    window.appInstances.navigationHandler.initialize();
    console.log('✅ Router initialized and initial route handled');

    // Expose global functions for backward compatibility
    window.loadContent = (path) => {
      window.appInstances.spaRouter.loadContent(path);
    };

    window.handleNavigation = (event, target) => {
      window.appInstances.navigationHandler.handleNavigation(event, target);
    };

    window.updateBreadcrumb = () => {
      window.appInstances.breadcrumbManager.updateBreadcrumb(window.location.pathname);
    };

    console.log('🎉 SPA Application initialized successfully!');

  } catch (error) {
    console.error('❌ Failed to initialize SPA Application:', error);
    
    // Show error message to user
    document.body.innerHTML = `
      <div class="container">
        <div class="notification is-danger">
          <strong>Application Error:</strong> Failed to initialize the application.
          <br><br>
          <details>
            <summary>Error Details</summary>
            <pre>${error.message}</pre>
          </details>
          <br>
          <button class="button is-danger" onclick="location.reload()">Reload Page</button>
        </div>
      </div>
    `;
  }

  // Show the body (hide loading)
  document.body.style = "";

  // Cleanup function for page unload
  window.addEventListener('beforeunload', () => {
    console.log('🧹 Cleaning up application instances...');
    
    Object.values(window.appInstances).forEach(instance => {
      if (instance && typeof instance.destroy === 'function') {
        try {
          instance.destroy();
        } catch (error) {
          console.warn('Error during cleanup:', error);
        }
      }
    });
  });

  // Global error handler
  window.addEventListener('error', (event) => {
    console.error('🚨 Global error:', event.error);
  });

  // Global unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled promise rejection:', event.reason);
  });
})();