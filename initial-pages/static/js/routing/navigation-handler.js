// Navigation handler for click events and browser history
window.NavigationHandler = class NavigationHandler {
  constructor(spaRouter, breadcrumbManager, navbarController) {
    this.spaRouter = spaRouter;
    this.breadcrumbManager = breadcrumbManager;
    this.navbarController = navbarController;
    this.basePath = window.AppConfig.getBasePath();
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Handle popstate events
    this.popstateCleanup = DomUtils.addEventListenerWithCleanup(window, 'popstate', (event) => {
      this.spaRouter.handlePopState(event);
      this.updateBreadcrumb(window.location.pathname);
    });

    // Handle messages from iframe
    this.messageCleanup = DomUtils.addEventListenerWithCleanup(window, 'message', (event) => {
      this.handleIframeMessage(event);
    });
  }

  // Handle navigation clicks
  handleNavigation(event, target) {
    // Close mobile menu
    if (this.navbarController) {
      this.navbarController.closeMobileMenu();
    }

    if (!target) {
      target = event.target;
      if (!target.href) {
        target = target.closest('a');
      }
    }

    // Navigate only for non-dropdown links or on desktop if not a navbar-link
    if (!target.classList.contains('navbar-link') || window.innerWidth > 1024) {
      event.preventDefault();
      const host = window.location.origin;
      const targetPage = target.href.replace(host, '');
      
      if (targetPage) {
        history.pushState({ page: targetPage }, '', targetPage);
        document.activeElement.blur();
        this.spaRouter.loadContent(targetPage);
        this.updateBreadcrumb(targetPage);
      }
    }
  }

  // Handle messages from iframe
  handleIframeMessage(event) {
    if (event.data.type === 'iframeNavigation') {
      const newPath = event.data.path;
      
      // Validate message data
      if (!newPath || typeof newPath !== 'string') {
        console.warn('Invalid iframe navigation message:', event.data);
        return;
      }
      
      console.log('Processing iframe navigation:', newPath);
      
      // Update browser URL to match iframe content
      if (newPath !== window.location.pathname) {
        history.pushState({ page: newPath }, '', newPath);
        console.log('Updated browser URL to:', newPath);
      }
      
      // Update breadcrumbs to reflect actual iframe content
      this.updateBreadcrumb(newPath);
    }
  }

  // Update breadcrumb
  updateBreadcrumb(path) {
    if (this.breadcrumbManager) {
      this.breadcrumbManager.updateBreadcrumb(path);
    }
  }

  // Initialize router and handle initial route
  initialize() {
    this.spaRouter.setupIframeBasePath();
    this.spaRouter.check404Recovery();
    
    // Handle initial popstate
    this.spaRouter.handlePopState({ state: history.state });
    
    // Initialize breadcrumb on page load
    this.updateBreadcrumb(window.location.pathname);
  }

  // Cleanup method
  destroy() {
    if (this.popstateCleanup) this.popstateCleanup();
    if (this.messageCleanup) this.messageCleanup();
  }
};