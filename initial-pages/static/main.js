document.addEventListener('DOMContentLoaded', () => {
  const isLocalhost = window.location.host.includes('localhost');
  const basePath = isLocalhost ? "/" : "/integration/";
  
  // BreadcrumbManager class to handle breadcrumb updates
  class BreadcrumbManager {
    constructor() {
      this.breadcrumbsElement = document.getElementById('breadcrumbs');
    }
    
    updateBreadcrumb(pageTitle) {
      if (!this.breadcrumbsElement) return;
      
      if (pageTitle) {
        this.breadcrumbsElement.textContent = pageTitle;
        this.breadcrumbsElement.classList.remove('is-hidden');
      } else {
        this.breadcrumbsElement.classList.add('is-hidden');
      }
    }
  }
  
  const breadcrumbManager = new BreadcrumbManager();
  
  // ReleaseCardManager class to handle release cards
  window.ReleaseCardManager = class ReleaseCardManager {
    constructor() {
      this.cardsContainer = null;
      this.basePath = isLocalhost ? "/" : "/integration/";
    }
    
    async initialize(containerId) {
      this.cardsContainer = document.getElementById(containerId);
      if (!this.cardsContainer) {
        console.error(`Container with id '${containerId}' not found`);
        return;
      }
      
      await this.loadReleases();
    }
    
    async loadReleases() {
      try {
        // Discover release directories by trying common version patterns
        const releases = await this.discoverReleases();
        
        // Sort releases by version (newest first)
        releases.sort((a, b) => this.compareVersions(b.version, a.version));
        
        // Create cards for each release
        for (const release of releases) {
          const card = await this.createReleaseCard(release);
          this.cardsContainer.appendChild(card);
        }
        
        // Show message if no releases found
        if (releases.length === 0) {
          this.showNoReleasesMessage();
        }
        
      } catch (error) {
        console.error('Error loading releases:', error);
        this.showErrorMessage();
      }
    }
    
    async discoverReleases() {
      const releases = [];
      
      try {
        // Try to get releases from a central releases.json
        // This should be generated during build process
        const response = await fetch('./releases.json');
        if (response.ok) {
          const releasesList = await response.json();
          for (const release of releasesList) {
            try {
              const dataResponse = await fetch(`./${release.version}/release-info.json`);
              if (dataResponse.ok) {
                const data = await dataResponse.json();
                releases.push({
                  version: release.version,
                  path: `./${release.version}/index.html`,
                  data
                });
              }
            } catch (error) {
              console.log(`Release ${release.version} missing release-info.json`);
            }
          }
        } else {
          console.log('No releases.json found - build process should generate this file');
        }
      } catch (error) {
        console.error('Error loading releases.json:', error);
      }
      
      return releases;
    }
    
    async createReleaseCard(release) {
      const column = document.createElement('div');
      column.className = 'column is-12-mobile is-6-tablet is-3-desktop';
      
      const card = document.createElement('div');
      card.className = 'card is-clickable';
      card.style.cursor = 'pointer';
      
      const statusClass = release.data.status === 'released' ? 'is-success' : 'is-warning';
      const statusText = release.data.status === 'released' ? 'Released' : 'In Progress';
      
      // Generate component version tags
      const componentTags = Object.entries(release.data.components).map(([name, version]) => 
        `<span class="tag is-info is-light is-small">${name}: ${version}</span>`
      ).join(' ');
      
      // Generate SDK runner version tags
      const sdkTags = Object.entries(release.data.runners).map(([name, version]) => 
        `<span class="tag is-primary is-light is-small">${name}: ${version}</span>`
      ).join(' ');
      
      card.innerHTML = `
        <header class="card-header">
          <p class="card-header-title">
            <span class="tag ${statusClass} mr-2">${statusText}</span>
            <span class="is-size-6">${release.version}</span>
          </p>
          <span class="card-header-icon">
            <span class="icon has-text-info">
              <i class="fas fa-code-branch"></i>
            </span>
          </span>
        </header>
        <div class="card-content">
          <div class="content">
            <div class="field is-grouped is-grouped-multiline">
              <div class="control">
                <div class="tags has-addons">
                  <span class="tag is-success">${release.data.testResults.passed}</span>
                  <span class="tag is-light">Passed</span>
                </div>
              </div>
              <div class="control">
                <div class="tags has-addons">
                  <span class="tag is-danger">${release.data.testResults.failed}</span>
                  <span class="tag is-light">Failed</span>
                </div>
              </div>
              <div class="control">
                <div class="tags has-addons">
                  <span class="tag is-dark">${release.data.testResults.total}</span>
                  <span class="tag is-light">Total</span>
                </div>
              </div>
            </div>
            
            <div class="mt-3">
              <p class="has-text-weight-semibold is-size-7 mb-2">Components:</p>
              <div class="tags are-small mb-3">
                ${componentTags}
              </div>
              
              <p class="has-text-weight-semibold is-size-7 mb-2">SDK Runners:</p>
              <div class="tags are-small mb-3">
                ${sdkTags}
              </div>
              
              <p class="has-text-grey is-size-7">
                <strong>Updated:</strong> ${release.data.lastUpdated}
              </p>
            </div>
          </div>
        </div>
      `;
      
      // Add click handler to navigate to release detail
      card.addEventListener('click', () => {
        const targetPath = `${this.basePath}release/${release.version}`;
        
        // Check if we're in iframe (SPA context) or direct page
        if (window.parent && window.parent !== window && window.parent.loadContent) {
          // We're in iframe - use parent's navigation
          window.parent.history.pushState({ page: targetPath }, '', targetPath);
          window.parent.loadContent(targetPath);
        } else {
          // We're on direct page - navigate directly
          window.history.pushState({ page: targetPath }, '', targetPath);
          window.location.href = targetPath;
        }
      });
      
      column.appendChild(card);
      return column;
    }
    
    createErrorCard(version, error) {
      const column = document.createElement('div');
      column.className = 'column is-12-mobile is-6-tablet is-3-desktop';
      
      const card = document.createElement('div');
      card.className = 'card';
      
      card.innerHTML = `
        <header class="card-header">
          <p class="card-header-title">
            <span class="tag is-danger mr-2">Error</span>
            <span class="is-size-6">${version}</span>
          </p>
          <span class="card-header-icon">
            <span class="icon has-text-danger">
              <i class="fas fa-exclamation-triangle"></i>
            </span>
          </span>
        </header>
        <div class="card-content">
          <div class="content">
            <p class="has-text-danger is-size-7">
              Unable to load release information.
            </p>
            <p class="has-text-grey is-size-7">
              ${error.message}
            </p>
          </div>
        </div>
      `;
      
      column.appendChild(card);
      return column;
    }
    
    showNoReleasesMessage() {
      this.cardsContainer.innerHTML = `
        <div class="column is-12">
          <div class="notification is-info">
            <strong>No releases found.</strong> Release directories will appear here when available.
          </div>
        </div>
      `;
    }
    
    showErrorMessage() {
      this.cardsContainer.innerHTML = `
        <div class="column is-12">
          <div class="notification is-danger">
            <strong>Error loading releases.</strong> Please try refreshing the page.
          </div>
        </div>
      `;
    }
    
    compareVersions(a, b) {
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);
      
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        
        if (aPart > bPart) return 1;
        if (aPart < bPart) return -1;
      }
      
      return 0;
    }
  }
  
  const contentFrame = document.getElementById('content-iframe');
  const dropdownLinks = document.querySelectorAll('nav a');
  const navbarBurger = document.querySelector('.navbar-burger');
  const navbarMenu = document.getElementById('navbar');
  
  // Update navbar links with basePath and attach navigation handler
  dropdownLinks.forEach(item => {
    const href = item.getAttribute('href');
    if (!href || href === '') return;
    item.setAttribute('href', `${basePath}${href.replace(/^\//, '')}`);
    item.addEventListener('click', handleNavigation);
  });
  
  // Burger menu toggle with accessibility
  if (navbarBurger && navbarMenu) {
    const toggleBurger = () => {
      navbarBurger.classList.toggle('is-active');
      navbarMenu.classList.toggle('is-active');
    };
  
    navbarBurger.addEventListener('click', toggleBurger);
    navbarBurger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleBurger();
      }
    });
  }
  
  // Dropdown toggle for mobile and desktop click-to-close
  document.querySelectorAll('.navbar-item.has-dropdown').forEach(dropdown => {
    const link = dropdown.querySelector('.navbar-link');
    const dropdownMenu = dropdown.querySelector('.navbar-dropdown');
  
    link.addEventListener('click', (e) => {
      if (window.innerWidth <= 1024) {
        // Mobile: Toggle dropdown
        e.preventDefault();
        dropdown.classList.toggle('is-active');
        if (dropdown.classList.contains('is-active')) {
          // Set dynamic max-height based on content
          dropdownMenu.style.maxHeight = `${dropdownMenu.scrollHeight}px`;
        } else {
          dropdownMenu.style.maxHeight = '0';
        }
      } else {
        // Desktop: Close dropdown on click (hover handles showing)
        e.preventDefault();
        dropdown.classList.remove('is-active');
      }
    });
  });
  
  // Ensure dropdowns reset max-height on resize (e.g., from mobile to desktop)
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) {
      document.querySelectorAll('.navbar-item.has-dropdown.is-active').forEach(dropdown => {
        dropdown.classList.remove('is-active');
        dropdown.querySelector('.navbar-dropdown').style.maxHeight = '';
      });
    }
  });
  
  // Routing logic
  const routes = {
    [`${basePath}`]: `${basePath}static/home.html`,
    [`${basePath}release`]: `${basePath}reports/release/index.html`,
    [`${basePath}release/{version}`]: `${basePath}reports/release/{version}/index.html`,
    [`${basePath}weekly`]: `${basePath}reports/weekly/index.html`,
    [`${basePath}weekly/{report}`]: `${basePath}reports/weekly/{report}/index.html`,
    [`${basePath}manual`]: `${basePath}reports/manual/index.html`,
    [`${basePath}manual/{report}`]: `${basePath}reports/manual/{report}/index.html`,
    [`${basePath}cloud-agent`]: `${basePath}reports/cloud-agent/index.html`,
    [`${basePath}cloud-agent/{report}`]: `${basePath}reports/cloud-agent/{report}/index.html`,
    [`${basePath}mediator`]: `${basePath}reports/mediator/index.html`,
    [`${basePath}mediator/{report}`]: `${basePath}reports/mediator/{report}/index.html`,
    [`${basePath}prism-node`]: `${basePath}reports/prism-node/index.html`,
    [`${basePath}prism-node/{report}`]: `${basePath}reports/prism-node/{report}/index.html`,
    [`${basePath}typescript`]: `${basePath}reports/sdk-ts/index.html`,
    [`${basePath}typescript/{report}`]: `${basePath}reports/sdk-ts/{report}/index.html`,
    [`${basePath}swift`]: `${basePath}reports/sdk-swift/index.html`,
    [`${basePath}swift/{report}`]: `${basePath}reports/sdk-swift/{report}/index.html`,
    [`${basePath}kotlin`]: `${basePath}reports/sdk-kmp/index.html`,
    [`${basePath}kotlin/{report}`]: `${basePath}reports/sdk-kmp/{report}/index.html`,
  };
  
  function matchRoute(routes, path) {
    for (const routePattern in routes) {
      if (routes.hasOwnProperty(routePattern)) {
        const routeValue = routes[routePattern];
        const escapedPattern = routePattern.replace(/[-\/\\^$*+?.()|[\]]/g, '\\$&').replace(/\{\w+\}/g, '([^/]+)');
        const regexPattern = `^${escapedPattern}$`;
        const variableNames = (routePattern.match(/\{\w+\}/g) || []).map(v => v.slice(1, -1));
        const match = path.match(new RegExp(regexPattern));
  
        if (match) {
          const variableValues = match.slice(1);
          const variables = {};
          variableNames.forEach((name, index) => {
            variables[name] = variableValues[index];
          });
          let evaluatedFilePath = routeValue;
          for (const variableName of variableNames) {
            evaluatedFilePath = evaluatedFilePath.replace(new RegExp(`\\{${variableName}\\}`, 'g'), variables[variableName] ?? '');
          }
          return evaluatedFilePath;
        }
      }
    }
    return `${basePath}static/404.html`;
  }
  
  function updateBreadcrumb(path) {
    const pathParts = path.replace(basePath, '').split('/').filter(part => part);
    let pageTitle = '';
    
    if (pathParts.length === 0) {
      pageTitle = ''; // Home page - no breadcrumb
    } else if (pathParts.length === 1) {
      pageTitle = pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1);
    } else {
      const category = pathParts[0];
      const report = pathParts[1];
      pageTitle = `${category.charAt(0).toUpperCase() + category.slice(1)} / ${report}`;
    }
    
    breadcrumbManager.updateBreadcrumb(pageTitle);
  }
  
  function loadContent(path) {
    if (path.endsWith('/') && path.length > basePath.length + 1) {
      path = path.slice(0, -1);
    }
    
    // Check if we're in the main SPA context (has iframe) or direct page
    if (contentFrame) {
      // Main SPA context - use iframe
      if (!routes[path]) {
        const route = matchRoute(routes, path);
        contentFrame.contentWindow.location.replace(route + "?c=" + Date.now());
      } else {
        contentFrame.contentWindow.location.replace(routes[path] + "?c=" + Date.now());
      }
    } else {
      // Direct page context - navigate the main window
      if (!routes[path]) {
        const route = matchRoute(routes, path);
        window.location.href = route + "?c=" + Date.now();
      } else {
        window.location.href = routes[path] + "?c=" + Date.now();
      }
    }
    
    updateBreadcrumb(path);
  }
  
  function handleNavigation(event) {
    navbarBurger.classList.remove('is-active');
    navbarMenu.classList.remove('is-active');
    let target = event.target;
    if (!target.href) {
      target = target.closest('a');
    }
    // Navigate only for non-dropdown links or on desktop if not a navbar-link
    if (!target.classList.contains('navbar-link') || window.innerWidth > 1024) {
      event.preventDefault();
      const host = window.location.origin;
      const targetPage = target.href.replace(host, '');
      if (targetPage) {
        history.pushState({ page: targetPage }, '', targetPage);
        document.activeElement.blur();
        loadContent(targetPage);
      }
    }
  }
  
  function handlePopState(event) {
    if (event.state && event.state.page) {
      loadContent(event.state.page);
    } else {
      // Recover from error page using localStorage (intentional for SPA)
      const storedPath = localStorage.getItem('resource');
      if (storedPath) {
        window.history.replaceState(null, '', storedPath);
        loadContent(storedPath);
        // Clear localStorage only after successful recovery
        localStorage.removeItem('resource');
      } else {
        loadContent(basePath);
        history.replaceState({ page: basePath }, '', basePath);
      }
    }
  }
  
  window.addEventListener('popstate', handlePopState);
  handlePopState({ state: history.state });
  
  // Initialize breadcrumb on page load
  updateBreadcrumb(window.location.pathname);
  
  document.body.style = "";
})
