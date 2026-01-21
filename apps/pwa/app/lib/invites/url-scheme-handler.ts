import { DeepLinkHandler, type DeepLinkResult } from './deep-link-handler';

/**
 * URL scheme registration and handling for PWA
 */
export class URLSchemeHandler {
  
  /**
   * Register URL scheme handlers for the PWA
   */
  static registerSchemeHandlers(): void {
    if (typeof window === 'undefined') return;

    // Register service worker for URL handling
    this.registerServiceWorkerHandler();
    
    // Register protocol handlers if supported
    this.registerProtocolHandlers();
    
    // Listen for URL changes
    this.setupUrlChangeListener();
  }

  /**
   * Register service worker to handle URL schemes
   */
  private static registerServiceWorkerHandler(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'DEEP_LINK') {
          this.handleDeepLinkMessage(event.data.url);
        }
      });
    }
  }

  /**
   * Register protocol handlers for web browsers
   */
  private static registerProtocolHandlers(): void {
    if ('registerProtocolHandler' in navigator) {
      try {
        // Register Nostr protocol handler
        navigator.registerProtocolHandler(
          'nostr',
          '/invite?nostr=%s',
          'Obscur - Nostr Invites'
        );
      } catch (error) {
        console.warn('Failed to register nostr protocol handler:', error);
      }
    }
  }

  /**
   * Setup listener for URL changes (back/forward navigation)
   */
  private static setupUrlChangeListener(): void {
    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', () => {
      this.checkCurrentUrl();
    });

    // Check URL on initial load
    this.checkCurrentUrl();
  }

  /**
   * Check current URL for deep link parameters
   */
  private static checkCurrentUrl(): void {
    const url = window.location.href;
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check for various deep link parameters
    const inviteCode = urlParams.get('invite');
    const nostrData = urlParams.get('nostr');
    const qrData = urlParams.get('qr');
    const contactKey = urlParams.get('contact');
    
    if (inviteCode) {
      this.handleDeepLinkMessage(`obscur://invite/${inviteCode}`);
    } else if (nostrData) {
      this.handleDeepLinkMessage(`nostr:${nostrData}`);
    } else if (qrData) {
      this.handleDeepLinkMessage(`obscur://qr/${encodeURIComponent(qrData)}`);
    } else if (contactKey) {
      this.handleDeepLinkMessage(`obscur://contact/${contactKey}`);
    }
  }

  /**
   * Handle deep link message from service worker or URL params
   */
  private static async handleDeepLinkMessage(url: string): Promise<void> {
    try {
      const result = await DeepLinkHandler.processDeepLink(url);
      
      // Dispatch custom event for app components to handle
      window.dispatchEvent(new CustomEvent('deeplink', {
        detail: { url, result }
      }));
      
      // Handle fallback actions
      if (!result.success && result.fallbackAction) {
        this.handleFallbackAction(result);
      }
    } catch (error) {
      console.error('Failed to handle deep link:', error);
    }
  }

  /**
   * Handle fallback actions for failed deep links
   */
  private static handleFallbackAction(result: DeepLinkResult): void {
    switch (result.fallbackAction) {
      case 'redirect':
        if (result.route) {
          const fallbackUrls = DeepLinkHandler.generateFallbackUrls(result.route);
          window.location.href = fallbackUrls.universalUrl;
        }
        break;
        
      case 'show_install':
        // Trigger PWA install prompt
        this.showInstallPrompt();
        break;
        
      case 'show_web_version':
        // Navigate to web version
        if (result.route) {
          const fallbackUrls = DeepLinkHandler.generateFallbackUrls(result.route);
          window.location.href = fallbackUrls.webUrl;
        }
        break;
    }
  }

  /**
   * Show PWA install prompt
   */
  private static showInstallPrompt(): void {
    // Dispatch event for install prompt component
    window.dispatchEvent(new CustomEvent('show-install-prompt'));
  }

  /**
   * Generate manifest.json entries for URL scheme handling
   */
  static generateManifestProtocolHandlers(): Array<{
    protocol: string;
    url: string;
  }> {
    return [
      {
        protocol: 'nostr',
        url: '/invite?nostr=%s'
      },
      {
        protocol: 'web+obscur',
        url: '/invite?data=%s'
      }
    ];
  }

  /**
   * Generate service worker URL handling code
   */
  static generateServiceWorkerUrlHandler(): string {
    return `
      // Handle URL scheme activation
      self.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'URL_SCHEME') {
          // Forward to main thread
          self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
              client.postMessage({
                type: 'DEEP_LINK',
                url: event.data.url
              });
            });
          });
        }
      });

      // Handle fetch events for protocol handlers
      self.addEventListener('fetch', (event) => {
        const url = new URL(event.request.url);
        
        // Handle nostr protocol redirects
        if (url.pathname === '/invite' && url.searchParams.has('nostr')) {
          const nostrData = url.searchParams.get('nostr');
          event.respondWith(
            Response.redirect(\`/\${url.search}\`, 302)
          );
        }
      });
    `;
  }
}

/**
 * React hook for URL scheme handling
 */
export const useURLSchemeHandler = () => {
  const registerHandlers = () => {
    URLSchemeHandler.registerSchemeHandlers();
  };

  const handleCustomUrl = async (url: string): Promise<DeepLinkResult> => {
    return DeepLinkHandler.processDeepLink(url);
  };

  return {
    registerHandlers,
    handleCustomUrl
  };
};