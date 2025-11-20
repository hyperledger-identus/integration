// Navbar controller for mobile menu and dropdown management
window.NavbarController = class NavbarController {
  constructor() {
    this.navbarBurger = document.querySelector('.navbar-burger');
    this.navbarMenu = document.getElementById('navbar');
    this.dropdownLinks = document.querySelectorAll('nav a');
    this.basePath = window.AppConfig.getBasePath();
    
    this.cleanupFunctions = [];
    this.init();
  }

  init() {
    this.setupBurgerMenu();
    this.setupDropdowns();
    this.setupNavigationLinks();
    this.setupResizeHandler();
  }

  setupBurgerMenu() {
    if (!this.navbarBurger || !this.navbarMenu) return;

    const toggleBurger = () => {
      DomUtils.toggleClasses(this.navbarBurger, { 'is-active': undefined });
      DomUtils.toggleClasses(this.navbarMenu, { 'is-active': undefined });
    };

    // Click handler
    const clickCleanup = DomUtils.addEventListenerWithCleanup(this.navbarBurger, 'click', toggleBurger);
    this.cleanupFunctions.push(clickCleanup);

    // Keyboard handler for accessibility
    const keydownCleanup = DomUtils.addEventListenerWithCleanup(this.navbarBurger, 'keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleBurger();
      }
    });
    this.cleanupFunctions.push(keydownCleanup);
  }

  setupDropdowns() {
    document.querySelectorAll('.navbar-item.has-dropdown').forEach(dropdown => {
      const link = dropdown.querySelector('.navbar-link');
      const dropdownMenu = dropdown.querySelector('.navbar-dropdown');

      const clickHandler = (e) => {
        if (window.innerWidth <= 1024) {
          // Mobile: Toggle dropdown
          e.preventDefault();
          DomUtils.toggleClasses(dropdown, { 'is-active': undefined });
          
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
      };

      const cleanup = DomUtils.addEventListenerWithCleanup(link, 'click', clickHandler);
      this.cleanupFunctions.push(cleanup);
    });
  }

  setupNavigationLinks() {
    this.dropdownLinks.forEach(item => {
      const href = item.getAttribute('href');
      if (!href || href === '') return;
      
      // Update href with base path
      item.setAttribute('href', `${this.basePath}${href.replace(/^\//, '')}`);
      
      // Add navigation handler
      const cleanup = DomUtils.addEventListenerWithCleanup(item, 'click', (event) => {
        this.handleNavigation(event);
      });
      this.cleanupFunctions.push(cleanup);
    });
  }

  setupResizeHandler() {
    const resizeCleanup = DomUtils.addEventListenerWithCleanup(window, 'resize', () => {
      this.handleResize();
    });
    this.cleanupFunctions.push(resizeCleanup);
  }

  handleNavigation(event) {
    // Close mobile menu
    if (this.navbarBurger && this.navbarMenu) {
      this.navbarBurger.classList.remove('is-active');
      this.navbarMenu.classList.remove('is-active');
    }

    let target = event.target;
    if (!target.href) {
      target = target.closest('a');
    }

    // Navigate only for non-dropdown links or on desktop if not a navbar-link
    if (!target.classList.contains('navbar-link') || window.innerWidth > 1024) {
      event.preventDefault();
      const host = window.location.origin;
      const targetPage = target.href.replace(host, '');
      
      if (targetPage && window.handleNavigation) {
        window.handleNavigation(event, target);
      }
    }
  }

  handleResize() {
    if (window.innerWidth > 1024) {
      // Reset dropdowns on desktop resize
      document.querySelectorAll('.navbar-item.has-dropdown.is-active').forEach(dropdown => {
        dropdown.classList.remove('is-active');
        const dropdownMenu = dropdown.querySelector('.navbar-dropdown');
        if (dropdownMenu) {
          dropdownMenu.style.maxHeight = '';
        }
      });
    }
  }

  // Method to close mobile menu programmatically
  closeMobileMenu() {
    if (this.navbarBurger && this.navbarMenu) {
      this.navbarBurger.classList.remove('is-active');
      this.navbarMenu.classList.remove('is-active');
    }
  }

  // Method to close all dropdowns
  closeAllDropdowns() {
    document.querySelectorAll('.navbar-item.has-dropdown.is-active').forEach(dropdown => {
      dropdown.classList.remove('is-active');
      const dropdownMenu = dropdown.querySelector('.navbar-dropdown');
      if (dropdownMenu) {
        dropdownMenu.style.maxHeight = '';
      }
    });
  }

  // Cleanup method to remove all event listeners
  destroy() {
    this.cleanupFunctions.forEach(cleanup => {
      if (cleanup) cleanup();
    });
    this.cleanupFunctions = [];
  }
};