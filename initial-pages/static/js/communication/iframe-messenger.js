// Iframe communication functionality
window.IframeMessenger = {
  // Communication script to inject into iframe
  getCommunicationScript() {
    return `
      (function() {
        let currentUrl = window.location.href;
        let currentPath = window.location.pathname;
        
        // Override pushState/replaceState to detect navigation
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(...args) {
          originalPushState.apply(this, args);
          setTimeout(notifyParent, 50);
        };
        
        history.replaceState = function(...args) {
          originalReplaceState.apply(this, args);
          setTimeout(notifyParent, 50);
        };
        
        // Monitor link clicks for navigation
        document.addEventListener('click', function(e) {
          const link = e.target.closest('a');
          if (link && link.href && link.href !== window.location.href) {
            setTimeout(notifyParent, 100);
          }
        });
        
        // Monitor hash changes
        window.addEventListener('hashchange', notifyParent);
        
        // Monitor popstate
        window.addEventListener('popstate', notifyParent);
        
        function notifyParent() {
          const newUrl = window.location.href;
          const newPath = window.location.pathname;
          
          if (newUrl !== currentUrl || newPath !== currentPath) {
            currentUrl = newUrl;
            currentPath = newPath;
            
            // Extract report ID from path for parent
            const pathParts = newPath.split('/').filter(p => p);
            let reportId = null;
            let component = null;
            
            if (pathParts.length >= 2) {
              component = pathParts[0];
              reportId = pathParts[1];
            }
            
            console.log('Iframe navigation detected:', { newPath, component, reportId });
            
            window.parent.postMessage({
              type: 'iframeNavigation',
              url: newUrl,
              path: newPath,
              component: component,
              reportId: reportId,
              timestamp: Date.now()
            }, '*');
          }
        }
        
        // Initial notification after page loads
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', notifyParent);
        } else {
          setTimeout(notifyParent, 100);
        }
      })();
    `;
  },

  // Inject communication script into iframe
  injectCommunicationScript(iframe) {
    // Wait for iframe to load, then inject script
    const loadHandler = function() {
      setTimeout(() => {
        try {
          // Create script element directly in iframe
          const scriptElement = iframe.contentDocument.createElement('script');
          scriptElement.textContent = IframeMessenger.getCommunicationScript();
          iframe.contentDocument.head.appendChild(scriptElement);
          console.log('Communication script injected into iframe');
        } catch (e) {
          console.log('Could not inject communication script:', e);
        }
      }, 200); // Slightly longer delay for iframe to be fully ready
    };

    iframe.addEventListener('load', loadHandler);
    
    // Return cleanup function
    return () => {
      iframe.removeEventListener('load', loadHandler);
    };
  },

  // Send message to iframe
  sendMessageToIframe(iframe, message) {
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(message, '*');
    }
  },

  // Setup message listener for iframe communication
  setupMessageListener(callback) {
    const messageHandler = (event) => {
      // Basic security check - you may want to add origin validation
      if (event.data && event.data.type) {
        callback(event.data);
      }
    };

    window.addEventListener('message', messageHandler);
    
    // Return cleanup function
    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }
};