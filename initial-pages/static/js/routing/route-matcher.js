// Route matching functionality
window.RouteMatcher = {
  // Define route patterns
  getRoutes() {
    const basePath = window.AppConfig.getBasePath();
    return {
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
  },

  // Match a path against route patterns
  matchRoute(path) {
    const routes = this.getRoutes();
    
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
    
    // Return 404 page if no match found
    const basePath = window.AppConfig.getBasePath();
    return `${basePath}static/404.html`;
  },

  // Check if a path exists in routes
  hasRoute(path) {
    const routes = this.getRoutes();
    return routes.hasOwnProperty(path);
  }
};