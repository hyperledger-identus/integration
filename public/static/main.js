const isLocalhost = window.location.host.includes('localhost')
const basePath = isLocalhost ? "/" : "/integration/"

const contentFrame = document.getElementById('content-iframe');
const dropdownLinks = document.querySelectorAll('nav a');

dropdownLinks.forEach(item => {
  const href = `${basePath}${item.getAttribute('href')}`.replace('//', '/')
  item.setAttribute('href', href)
  item.addEventListener('click', handleNavigation);
});

const routes = {};
routes[`${basePath}`] = `${basePath}static/home.html`;
routes[`${basePath}releases`] = `${basePath}reports/releases/index.html`;
routes[`${basePath}weekly`] = `${basePath}reports/weekly/index.html`;
routes[`${basePath}weekly/{report}`] = `${basePath}reports/weekly/{report}/index.html`;
routes[`${basePath}cloud-agent`] = `${basePath}reports/cloud-agent/index.html`;
routes[`${basePath}cloud-agent/{report}`] = `${basePath}reports/cloud-agent/{report}/index.html`;
routes[`${basePath}mediator`] = `${basePath}reports/mediator/index.html`;
routes[`${basePath}mediator/{report}`] = `${basePath}reports/mediator/{report}/index.html`;
routes[`${basePath}prism-node`] = `${basePath}reports/prism-node/index.html`;
routes[`${basePath}prism-node/{report}`] = `${basePath}reports/prism-node/{report}/index.html`;
routes[`${basePath}typescript`] = `${basePath}reports/sdk-ts/index.html`;
routes[`${basePath}typescript/{report}`] = `${basePath}reports/sdk-ts/{report}/index.html`;
routes[`${basePath}swift`] = `${basePath}reports/sdk-swift/index.html`;
routes[`${basePath}swift/{report}`] = `${basePath}reports/sdk-swift/{report}/index.html`;
routes[`${basePath}kotlin`] = `${basePath}reports/sdk-kmp/index.html`;
routes[`${basePath}kotlin/{report}`] = `${basePath}reports/sdk-kmp/{report}/index.html`;

const defaultPage = `${basePath}`;

function loadContent(path) {
  if (path.endsWith('/') && path.length > basePath.length + 1) {
    path = path.slice(0, -1)
  }
  if (!routes[path]) {
    const route = matchRoute(routes, path);
    console.info("match route", route)
    contentFrame.contentWindow.location.replace(route);
  } else {
    contentFrame.contentWindow.location.replace(routes[path]);
  }
}

function handleNavigation(event) {
  let target = event.target
  if (!target.href) {
    target = target.closest('a')
  }
  event.preventDefault();
  const host = window.location.origin
  const targetPage = target.href.replace(host, '')
  if (targetPage) {
    history.pushState({ page: targetPage }, '', targetPage);
    document.activeElement.blur()
    loadContent(targetPage);
  }
}

function handlePopState(event) {
  if (event.state && event.state.page) {
    loadContent(event.state.page);
  } else {
    const storedPath = localStorage.getItem('resource');
    localStorage.clear()
    if (storedPath) {
      window.history.replaceState(null, '', storedPath);
      loadContent(storedPath);
    } else {
      loadContent(defaultPage);
      history.replaceState({ page: defaultPage }, '', defaultPage);
    }
  }
}

// Listen for browser history navigation (back/forward buttons)
window.addEventListener('popstate', handlePopState);

// Handle initial load
handlePopState({ state: history.state });

// bulma burger menu
const navbarBurger = document.querySelector('.navbar-burger');
const navbarMenu = document.getElementById('navbar');

if (navbarBurger && navbarMenu) {
  navbarBurger.addEventListener('click', () => {
    navbarBurger.classList.toggle('is-active');
    navbarMenu.classList.toggle('is-active');
  });
}
document.body.style = "";

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
              return evaluatedFilePath
          }
      }
  }
  return `${basePath}static/404.html`;
}