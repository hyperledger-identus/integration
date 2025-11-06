// SPA Router functionality
window.SpaRouter = class SpaRouter {
  constructor() {
    this.contentFrame = document.getElementById('content-iframe');
    this.basePath = window.AppConfig.getBasePath();
    this.routes = RouteMatcher.getRoutes();
    
    // Setup message listener for Allure navigation
    this.setupIframeMessageListener();
  }

  // Load content for a given path
  loadContent(path) {
    // Normalize path
    if (path.endsWith('/') && path.length > this.basePath.length + 1) {
      path = path.slice(0, -1);
    }

    // Check if we're in the main SPA context (has iframe) or direct page
    if (this.contentFrame) {
      // Main SPA context - use iframe
      this.loadInIframe(path);
    } else {
      // Direct page context - navigate the main window
      this.loadDirectly(path);
    }
  }

  loadInIframe(path) {
    let route;
    if (!RouteMatcher.hasRoute(path)) {
      route = RouteMatcher.matchRoute(path);
      this.contentFrame.contentWindow.location.replace(route + "?c=" + Date.now());
    } else {
      this.contentFrame.contentWindow.location.replace(this.routes[path] + "?c=" + Date.now());
    }
    
    // Communication script injection removed - using simplified approach
    
    // Update breadcrumbs after loading content
    if (window.appInstances && window.appInstances.breadcrumbManager) {
      window.appInstances.breadcrumbManager.updateBreadcrumb(path);
    }
  }

  loadDirectly(path) {
    let route;
    if (!RouteMatcher.hasRoute(path)) {
      route = RouteMatcher.matchRoute(path);
      window.location.href = route + "?c=" + Date.now();
    } else {
      window.location.href = this.routes[path] + "?c=" + Date.now();
    }
  }

  // Handle popstate events (browser back/forward)
  handlePopState(event) {
    if (event.state && event.state.page) {
      this.loadContent(event.state.page);
    } else {
      // Recover from error page using localStorage (intentional for SPA)
      const storedPath = localStorage.getItem('resource');
      if (storedPath) {
        window.history.replaceState(null, '', storedPath);
        this.loadContent(storedPath);
        // Clear localStorage only after successful recovery
        localStorage.removeItem('resource');
      } else {
        this.loadContent(this.basePath);
        history.replaceState({ page: this.basePath }, '', this.basePath);
      }
    }
  }

  // Check if we're recovering from a 404 redirect
  check404Recovery() {
    const intendedRoute = localStorage.getItem('resource');
    if (intendedRoute && intendedRoute !== window.location.pathname) {
      // We were redirected from 404, recover the intended route
      window.history.replaceState({ page: intendedRoute }, '', intendedRoute);
      
      // Small delay to ensure iframe is ready
      setTimeout(() => {
        this.loadContent(intendedRoute);
        localStorage.removeItem('resource');
      }, 100);
    }
  }

  // Setup iframe base path
  setupIframeBasePath() {
    if (this.contentFrame) {
      this.contentFrame.onload = function () {
        if (this.contentWindow) {
          this.contentWindow.basePath = window.basePath;
        }
      };
    }
  }

  // Setup message listener for Allure navigation
  setupIframeMessageListener() {
    if (window.IframeMessenger) {
      window.IframeMessenger.setupMessageListener((message) => {
        debugger;
        if (message.type === 'navigation') {
          console.log('SPA Router received navigation message:', message);
          
          const COMPONENT_PATH_MAP = {
            'sdk-ts': 'typescript',
            'sdk-swift': 'swift',
            'sdk-kmp': 'kotlin',
            'cloud-agent': 'cloud-agent',
            'mediator': 'mediator',
            'weekly': 'weekly',
            'release': 'release',
            'manual': 'manual'
          };

          // Construct the target path
          const spaRoute = COMPONENT_PATH_MAP[message.component]
          const targetPath = `${window.basePath}${spaRoute}/${message.reportId}`;
          
          // Update browser history and URL
          window.history.pushState({page: targetPath}, '', targetPath);
          
          // Update breadcrumbs
          if (window.appInstances && window.appInstances.breadcrumbManager) {
            window.appInstances.breadcrumbManager.updateBreadcrumb(targetPath);
          }
          
          // Load the content
          this.loadContent(targetPath);
        }
      });
    }
  }
};