// Breadcrumb management functionality
window.BreadcrumbManager = class BreadcrumbManager {
  constructor() {
    this.breadcrumbsElement = document.getElementById('breadcrumbs');
    if (!this.breadcrumbsElement) return;
    
    console.log('BreadcrumbManager constructor called');
    
    this.setupEventListeners();
    this.updateBreadcrumb(window.location.pathname);
  }

  setupEventListeners() {
    // Listen for popstate events to handle browser navigation
    this.popstateCleanup = DomUtils.addEventListenerWithCleanup(window, 'popstate', () => {
      console.log('popstate event fired');
      this.updateBreadcrumb(window.location.pathname);
    });
    
    // Listen for hash changes
    this.hashchangeCleanup = DomUtils.addEventListenerWithCleanup(window, 'hashchange', () => {
      console.log('hashchange event fired');
      this.updateBreadcrumb(window.location.pathname);
    });
  }

  updateBreadcrumb(path) {
    console.log('updateBreadcrumb called with path:', path);
    if (!this.breadcrumbsElement) return;

    const basePath = window.AppConfig.getBasePath();
    const pathParts = path.replace(basePath, '').split('/').filter(part => part);

    if (pathParts.length === 0) {
      // Home page - hide breadcrumb
      this.breadcrumbsElement.classList.add('is-hidden');
      this.breadcrumbsElement.innerHTML = '';
    } else {
      // Show breadcrumb with proper hierarchy
      this.breadcrumbsElement.classList.remove('is-hidden');
      
      let breadcrumbHTML = '<nav class="breadcrumb" aria-label="breadcrumbs"><ul>';
      
      // Home breadcrumb
      breadcrumbHTML += '<li><a href="/" class="breadcrumb-item">Home</a></li>';
      
      // Build path incrementally
      let currentPath = '';
      pathParts.forEach((part, index) => {
        currentPath += '/' + part;
        const isLast = index === pathParts.length - 1;
        
        let displayName;
        if (index === 0) {
          // First level - category or component
          if (['release', 'manual'].includes(part)) {
            displayName = DisplayHelpers.getCategoryDisplayName(part);
          } else {
            displayName = DisplayHelpers.getComponentDisplayName(part);
          }
        } else {
          // Report ID level
          displayName = part;
        }
        
        if (isLast) {
          breadcrumbHTML += `<li class="is-active"><a href="#" class="breadcrumb-item" aria-current="page">${displayName}</a></li>`;
        } else {
          breadcrumbHTML += `<li><a href="${currentPath}" class="breadcrumb-item">${displayName}</a></li>`;
        }
      });
      
      breadcrumbHTML += '</ul></nav>';
      this.breadcrumbsElement.innerHTML = breadcrumbHTML;
      
      this.addBreadcrumbClickHandlers();
    }
  }

  addBreadcrumbClickHandlers() {
    // Add click handlers for SPA navigation
    this.breadcrumbsElement.querySelectorAll('a:not([aria-current="page"])').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        
        // Use SPA navigation
        if (window.loadContent) {
          window.history.pushState({ page: href }, '', href);
          window.loadContent(href);
        } else {
          window.location.href = href;
        }
      });
    });
  }

  // Cleanup method to remove event listeners
  destroy() {
    if (this.popstateCleanup) this.popstateCleanup();
    if (this.hashchangeCleanup) this.hashchangeCleanup();
  }
};