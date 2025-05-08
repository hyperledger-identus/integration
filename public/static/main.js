document.addEventListener('DOMContentLoaded', () => {
  const isLocalhost = window.location.host.includes('localhost');
  const basePath = isLocalhost ? "/" : "/integration/";
  
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
    [`${basePath}releases`]: `${basePath}reports/releases/index.html`,
    [`${basePath}weekly`]: `${basePath}reports/weekly/index.html`,
    [`${basePath}weekly/{report}`]: `${basePath}reports/weekly/{report}/index.html`,
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
  
  function loadContent(path) {
    if (path.endsWith('/') && path.length > basePath.length + 1) {
      path = path.slice(0, -1);
    }
    if (!routes[path]) {
      const route = matchRoute(routes, path);
      contentFrame.contentWindow.location.replace(route + "?c=" + Date.now());
    } else {
      contentFrame.contentWindow.location.replace(routes[path] + "?c=" + Date.now());
    }
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
  
  document.body.style = "";
})
