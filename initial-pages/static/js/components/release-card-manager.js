// Release card management functionality
window.ReleaseCardManager = class ReleaseCardManager {
  constructor() {
    this.cardsContainer = null;
    this.basePath = window.AppConfig.getBasePath();
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
    const column = DomUtils.createElement('div', { 
      className: 'column is-12-mobile is-6-tablet is-3-desktop' 
    });

    const card = DomUtils.createElement('div', { 
      className: 'card is-clickable',
      style: 'cursor: pointer;'
    });

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
      this.handleReleaseClick(release);
    });

    column.appendChild(card);
    return column;
  }

  handleReleaseClick(release) {
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
  }

  createErrorCard(version, error) {
    const column = DomUtils.createElement('div', { 
      className: 'column is-12-mobile is-6-tablet is-3-desktop' 
    });

    const card = DomUtils.createElement('div', { className: 'card' });

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
};