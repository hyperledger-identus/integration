// Display name mapping utilities
window.DisplayHelpers = {
  // Category mapping for navbar structure
  getCategoryDisplayName(component) {
    const categoryMap = {
      'release': 'Releases',
      'manual': 'Manual',
      'weekly': 'Weekly',
      'cloud-agent': 'Services',
      'mediator': 'Services',
      'sdk-ts': 'SDKs',
      'sdk-swift': 'SDKs',
      'sdk-kmp': 'SDKs',
      'typescript': 'SDKs',
      'swift': 'SDKs',
      'kmp': 'SDKs'
    };
    return categoryMap[component] || component.charAt(0).toUpperCase() + component.slice(1);
  },

  // Component display name mapping
  getComponentDisplayName(component) {
    const componentMap = {
      'cloud-agent': 'Cloud Agent',
      'mediator': 'Mediator',
      'sdk-ts': 'Typescript',
      'sdk-swift': 'Swift',
      'sdk-kmp': 'KMP',
      'typescript': 'Typescript',
      'swift': 'Swift',
      'kmp': 'KMP'
    };
    return componentMap[component] || component.charAt(0).toUpperCase() + component.slice(1);
  }
};