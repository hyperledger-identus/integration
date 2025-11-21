window.SpaRouter = class SpaRouter {
  constructor() {
    this.contentFrame = document.getElementById('content-iframe');
    this.basePath = window.AppConfig.getBasePath();
    this.routes = RouteMatcher.getRoutes();
  }

  loadContent(path) {
    if (path.endsWith('/') && path.length > this.basePath.length + 1) {
      path = path.slice(0, -1);
    }

    console.log('SpaRouter: loadContent called with path:', path);
    if (this.contentFrame) {
      console.log('SpaRouter: Loading in iframe');
      this.loadInIframe(path);
    } else {
      console.log('SpaRouter: Loading directly (no iframe)');
      this.loadDirectly(path);
    }
  }

  loadInIframe(path) {
    console.log('SpaRouter: loadInIframe called with path:', path);
    let route;
    if (!RouteMatcher.hasRoute(path)) {
      route = RouteMatcher.matchRoute(path);
      console.log('SpaRouter: Route not found, matched to:', route);
      this.contentFrame.contentWindow.location.replace(route + "?c=" + Date.now());
    } else {
      console.log('SpaRouter: Route found:', this.routes[path]);
      this.contentFrame.contentWindow.location.replace(this.routes[path] + "?c=" + Date.now());
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

  handlePopState(event) {
    if (event.state && event.state.page) {
      this.loadContent(event.state.page);
    } else {
      const storedPath = localStorage.getItem('resource');
      if (storedPath) {
        window.history.replaceState(null, '', storedPath);
        this.loadContent(storedPath);
        localStorage.removeItem('resource');
      } else {
        this.loadContent(this.basePath);
        history.replaceState({ page: this.basePath }, '', this.basePath);
      }
    }
  }

  check404Recovery() {
    const intendedRoute = localStorage.getItem('resource');
    if (intendedRoute && intendedRoute !== window.location.pathname) {
      window.history.replaceState({ page: intendedRoute }, '', intendedRoute);
      this.loadContent(intendedRoute);
      localStorage.removeItem('resource');
    }
  }

  setupIframeBasePath() {
    if (this.contentFrame) {
      this.contentFrame.onload = function () {
        if (this.contentWindow) {
          this.contentWindow.basePath = window.basePath;
        }
      };
    }
  }


};