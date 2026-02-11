import type { ContactRequest } from './types';
import { inviteManager } from './invite-manager';
import { NostrCompatibilityService } from './nostr-compatibility';

/**
 * Deep link route types for invite processing
 */
export type DeepLinkRoute =
  | { type: 'invite'; shortCode: string; fallback?: boolean }
  | { type: 'qr'; data: string }
  | { type: 'contact'; publicKey: string }
  | { type: 'group'; groupId: string; relay?: string }
  | { type: 'nostr'; data: string }
  | { type: 'unknown'; url: string };

/**
 * Deep link processing result
 */
export interface DeepLinkResult {
  success: boolean;
  route?: DeepLinkRoute;
  contactRequest?: ContactRequest;
  error?: string;
  fallbackAction?: 'redirect' | 'show_install' | 'show_web_version';
}

/**
 * URL scheme configuration for different platforms
 */
export const URL_SCHEMES = {
  OBSCUR: 'obscur://',
  NOSTR: 'nostr:',
  WEB: 'https://obscur.app/',
  FALLBACK: 'https://obscur.app/web/',
} as const;

/**
 * Deep link handler for processing invite URLs across platforms
 */
export class DeepLinkHandler {

  /**
   * Parse and route deep link URLs
   */
  static parseDeepLink(url: string): DeepLinkRoute {
    try {
      const cleanUrl = url.trim();

      // Handle Obscur app scheme
      if (cleanUrl.startsWith(URL_SCHEMES.OBSCUR)) {
        return this.parseObscurScheme(cleanUrl);
      }

      // Handle Nostr protocol
      if (cleanUrl.startsWith(URL_SCHEMES.NOSTR)) {
        return this.parseNostrScheme(cleanUrl);
      }

      // Handle web URLs
      if (cleanUrl.startsWith(URL_SCHEMES.WEB) || cleanUrl.startsWith(URL_SCHEMES.FALLBACK)) {
        return this.parseWebUrl(cleanUrl);
      }

      // Handle other formats
      return this.parseAlternativeFormat(cleanUrl);

    } catch (error) {
      return { type: 'unknown', url };
    }
  }

  /**
   * Process deep link and return appropriate action
   */
  static async processDeepLink(url: string): Promise<DeepLinkResult> {
    try {
      const route = this.parseDeepLink(url);

      switch (route.type) {
        case 'invite':
          return await this.processInviteLink(route.shortCode, route.fallback);

        case 'qr':
          return await this.processQRData(route.data);

        case 'contact':
          return await this.processDirectContact(route.publicKey);

        case 'nostr':
          return await this.processNostrData(route.data);

        case 'group':
          return await this.processGroupLink(route.groupId, route.relay);

        default:
          return {
            success: false,
            route,
            error: 'Unsupported link format',
            fallbackAction: 'show_web_version'
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackAction: 'show_web_version'
      };
    }
  }

  /**
   * Parse Obscur app scheme URLs
   */
  private static parseObscurScheme(url: string): DeepLinkRoute {
    const path = url.replace(URL_SCHEMES.OBSCUR, '');
    const parts = path.split('/');

    if (parts[0] === 'invite' && parts[1]) {
      return { type: 'invite', shortCode: parts[1] };
    }

    if (parts[0] === 'qr' && parts[1]) {
      return { type: 'qr', data: decodeURIComponent(parts[1]) };
    }

    if (parts[0] === 'contact' && parts[1]) {
      return { type: 'contact', publicKey: parts[1] };
    }

    if (parts[0] === 'group' && parts[1]) {
      const urlObj = new URL(url);
      const relay = urlObj.searchParams.get('relay') || undefined;
      return { type: 'group', groupId: parts[1], relay };
    }

    return { type: 'unknown', url };
  }

  /**
   * Parse Nostr protocol URLs
   */
  private static parseNostrScheme(url: string): DeepLinkRoute {
    const data = url.replace(URL_SCHEMES.NOSTR, '');

    // Handle npub format
    if (data.startsWith('npub1')) {
      return { type: 'contact', publicKey: data };
    }

    // Handle raw hex public keys
    if (/^[0-9a-fA-F]{64}$/.test(data)) {
      return { type: 'contact', publicKey: data };
    }

    // Handle other Nostr data
    return { type: 'nostr', data };
  }

  /**
   * Parse web URLs
   */
  private static parseWebUrl(url: string): DeepLinkRoute {
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.split('/').filter(Boolean);

      // Check for fallback parameter
      const isFallback = parsed.searchParams.has('fallback');

      if (pathParts[0] === 'invite' && pathParts[1]) {
        return { type: 'invite', shortCode: pathParts[1], fallback: isFallback };
      }

      if (pathParts[0] === 'qr' && parsed.searchParams.has('data')) {
        return { type: 'qr', data: parsed.searchParams.get('data')! };
      }

      if (pathParts[0] === 'connect' && pathParts[1]) {
        return { type: 'contact', publicKey: pathParts[1] };
      }

      if (pathParts[0] === 'groups' && pathParts[1]) {
        return { type: 'group', groupId: pathParts[1], relay: parsed.searchParams.get('relay') || undefined };
      }

      // Handle web version paths
      if (pathParts[0] === 'web') {
        const subPath = pathParts.slice(1);
        if (subPath[0] === 'invite' && subPath[1]) {
          return { type: 'invite', shortCode: subPath[1], fallback: true };
        }
      }

      return { type: 'unknown', url };
    } catch {
      return { type: 'unknown', url };
    }
  }

  /**
   * Parse alternative formats (direct data, etc.)
   */
  private static parseAlternativeFormat(url: string): DeepLinkRoute {
    // Try to detect if it's QR data or contact data
    try {
      // Check if it's JSON (QR data)
      JSON.parse(url);
      return { type: 'qr', data: url };
    } catch {
      // Check if it's a public key
      if (/^[0-9a-fA-F]{64}$/.test(url)) {
        return { type: 'contact', publicKey: url };
      }

      // Check if it's npub format
      if (url.startsWith('npub1')) {
        return { type: 'contact', publicKey: url };
      }
    }

    return { type: 'unknown', url };
  }

  /**
   * Process invite link
   */
  private static async processInviteLink(shortCode: string, fallback?: boolean): Promise<DeepLinkResult> {
    try {
      const linkData = `${shortCode}`;
      const contactRequest = await inviteManager.processInviteLink(linkData);

      return {
        success: true,
        route: { type: 'invite', shortCode, fallback },
        contactRequest
      };
    } catch (error) {
      return {
        success: false,
        route: { type: 'invite', shortCode, fallback },
        error: error instanceof Error ? error.message : 'Failed to process invite link',
        fallbackAction: fallback ? 'show_web_version' : 'redirect'
      };
    }
  }

  /**
   * Process QR data
   */
  private static async processQRData(data: string): Promise<DeepLinkResult> {
    try {
      const contactRequest = await inviteManager.processQRInvite(data);

      return {
        success: true,
        route: { type: 'qr', data },
        contactRequest
      };
    } catch (error) {
      return {
        success: false,
        route: { type: 'qr', data },
        error: error instanceof Error ? error.message : 'Failed to process QR data',
        fallbackAction: 'show_web_version'
      };
    }
  }

  /**
   * Process direct contact connection
   */
  private static async processDirectContact(publicKey: string): Promise<DeepLinkResult> {
    try {
      // Create a minimal contact request for direct connections
      const contactRequest = await inviteManager.sendContactRequest({
        recipientPublicKey: publicKey as any,
        includeProfile: true,
        message: 'Connected via direct link'
      });

      return {
        success: true,
        route: { type: 'contact', publicKey }
      };
    } catch (error) {
      return {
        success: false,
        route: { type: 'contact', publicKey },
        error: error instanceof Error ? error.message : 'Failed to connect to contact',
        fallbackAction: 'show_web_version'
      };
    }
  }

  /**
   * Process group join link
   */
  private static async processGroupLink(groupId: string, relay?: string): Promise<DeepLinkResult> {
    return {
      success: true,
      route: { type: 'group', groupId, relay },
      // Note: Group joining logic will be handled by GroupJoinDialog
    };
  }

  /**
   * Process Nostr protocol data
   */
  private static async processNostrData(data: string): Promise<DeepLinkResult> {
    try {
      // Try to parse as Nostr invite format
      const nostrData = NostrCompatibilityService.parseExternalInvite(data);
      if (nostrData) {
        const qrData = NostrCompatibilityService.fromNostrFormat(nostrData);
        const contactRequest = await inviteManager.processQRInvite(JSON.stringify(qrData));

        return {
          success: true,
          route: { type: 'nostr', data },
          contactRequest
        };
      }

      return {
        success: false,
        route: { type: 'nostr', data },
        error: 'Unsupported Nostr data format',
        fallbackAction: 'show_web_version'
      };
    } catch (error) {
      return {
        success: false,
        route: { type: 'nostr', data },
        error: error instanceof Error ? error.message : 'Failed to process Nostr data',
        fallbackAction: 'show_web_version'
      };
    }
  }

  /**
   * Generate fallback URLs for unsupported platforms
   */
  static generateFallbackUrls(route: DeepLinkRoute): {
    webUrl: string;
    installUrl: string;
    universalUrl: string;
  } {
    const baseUrl = 'https://obscur.app';

    switch (route.type) {
      case 'invite':
        return {
          webUrl: `${baseUrl}/web/invite/${route.shortCode}`,
          installUrl: `${baseUrl}/install?redirect=invite/${route.shortCode}`,
          universalUrl: `${baseUrl}/invite/${route.shortCode}`
        };

      case 'contact':
        return {
          webUrl: `${baseUrl}/web/connect/${route.publicKey}`,
          installUrl: `${baseUrl}/install?redirect=connect/${route.publicKey}`,
          universalUrl: `${baseUrl}/connect/${route.publicKey}`
        };

      case 'group':
        const relayParam = route.relay ? `?relay=${encodeURIComponent(route.relay)}` : '';
        return {
          webUrl: `${baseUrl}/groups/${route.groupId}${relayParam}`,
          installUrl: `${baseUrl}/install?redirect=groups/${route.groupId}${relayParam}`,
          universalUrl: `${baseUrl}/groups/${route.groupId}${relayParam}`
        };

      default:
        return {
          webUrl: `${baseUrl}/web`,
          installUrl: `${baseUrl}/install`,
          universalUrl: baseUrl
        };
    }
  }

  /**
   * Check if the current platform supports the app
   */
  static getPlatformSupport(): {
    hasNativeApp: boolean;
    canInstall: boolean;
    platform: 'web' | 'ios' | 'android' | 'desktop' | 'unknown';
  } {
    if (typeof window === 'undefined') {
      return { hasNativeApp: false, canInstall: false, platform: 'unknown' };
    }

    const userAgent = window.navigator.userAgent.toLowerCase();

    // Detect platform
    let platform: 'web' | 'ios' | 'android' | 'desktop' | 'unknown' = 'web';
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      platform = 'ios';
    } else if (userAgent.includes('android')) {
      platform = 'android';
    } else if (userAgent.includes('electron')) {
      platform = 'desktop';
    }

    // Check for PWA installation capability
    const canInstall = 'serviceWorker' in navigator && 'BeforeInstallPromptEvent' in window;

    // Check if running in standalone mode (installed PWA)
    const hasNativeApp = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    return { hasNativeApp, canInstall, platform };
  }

  /**
   * Handle unsupported format with appropriate fallback
   */
  static handleUnsupportedFormat(url: string): DeepLinkResult {
    const platformSupport = this.getPlatformSupport();

    if (platformSupport.hasNativeApp) {
      return {
        success: false,
        error: 'Unsupported invite format',
        fallbackAction: 'show_web_version'
      };
    }

    if (platformSupport.canInstall) {
      return {
        success: false,
        error: 'App not installed',
        fallbackAction: 'show_install'
      };
    }

    return {
      success: false,
      error: 'Platform not supported',
      fallbackAction: 'show_web_version'
    };
  }
}

/**
 * React hook for handling deep links in components
 */
export const useDeepLinkHandler = () => {
  const processDeepLink = async (url: string): Promise<DeepLinkResult> => {
    return DeepLinkHandler.processDeepLink(url);
  };

  const parseDeepLink = (url: string): DeepLinkRoute => {
    return DeepLinkHandler.parseDeepLink(url);
  };

  const generateFallbackUrls = (route: DeepLinkRoute) => {
    return DeepLinkHandler.generateFallbackUrls(route);
  };

  const getPlatformSupport = () => {
    return DeepLinkHandler.getPlatformSupport();
  };

  return {
    processDeepLink,
    parseDeepLink,
    generateFallbackUrls,
    getPlatformSupport
  };
};