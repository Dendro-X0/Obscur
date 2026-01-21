import type { PublicKeyHex } from '@dweb/crypto';
import type { QRInviteData, ShareableProfile, InviteLink } from './types';
import { cryptoService } from '../crypto/crypto-service';

/**
 * Nostr Improvement Proposal (NIP) constants for cross-platform compatibility
 */
export const NOSTR_INVITE_KINDS = {
  CONTACT_LIST: 3,        // NIP-02: Contact List
  PROFILE_METADATA: 0,    // NIP-01: Profile Metadata
  INVITE_REQUEST: 30078,  // Custom kind for invite requests
  INVITE_RESPONSE: 30079, // Custom kind for invite responses
} as const;

/**
 * Standard Nostr event structure for cross-platform compatibility
 */
export interface NostrEvent {
  id: string;
  pubkey: PublicKeyHex;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/**
 * Nostr-compatible invite data structure
 */
export interface NostrInviteData {
  version: string;
  type: 'qr' | 'link';
  publicKey: PublicKeyHex;
  profile?: {
    name?: string;
    picture?: string;
    about?: string;
    nip05?: string;
    lud16?: string;
  };
  relays?: string[];
  message?: string;
  expires?: number;
  signature: string;
}

/**
 * Universal link format for cross-platform compatibility
 */
export interface UniversalInviteLink {
  url: string;
  fallbackUrl: string;
  appScheme: string;
  webUrl: string;
  data: NostrInviteData;
}

/**
 * Cross-platform invite format converter
 */
export class NostrCompatibilityService {
  
  /**
   * Convert internal QR invite data to Nostr-compatible format
   */
  static toNostrFormat(qrData: QRInviteData): NostrInviteData {
    return {
      version: '1.0',
      type: 'qr',
      publicKey: qrData.publicKey,
      profile: qrData.displayName || qrData.avatar ? {
        name: qrData.displayName,
        picture: qrData.avatar,
      } : undefined,
      message: qrData.message,
      expires: qrData.expirationTime,
      signature: qrData.signature
    };
  }

  /**
   * Convert Nostr-compatible format to internal QR invite data
   */
  static fromNostrFormat(nostrData: NostrInviteData): QRInviteData {
    return {
      version: nostrData.version,
      publicKey: nostrData.publicKey,
      displayName: nostrData.profile?.name,
      avatar: nostrData.profile?.picture,
      message: nostrData.message,
      timestamp: Date.now(),
      expirationTime: nostrData.expires || (Date.now() + 24 * 60 * 60 * 1000),
      signature: nostrData.signature
    };
  }

  /**
   * Generate universal link that works across platforms
   */
  static generateUniversalLink(inviteLink: InviteLink): UniversalInviteLink {
    const nostrData = this.profileToNostrFormat(inviteLink.profile, inviteLink.message);
    
    // Create different URL formats for different platforms
    const baseUrl = 'https://obscur.app';
    const shortCode = inviteLink.shortCode;
    
    return {
      url: `${baseUrl}/invite/${shortCode}`,
      fallbackUrl: `${baseUrl}/invite/${shortCode}?fallback=true`,
      appScheme: `obscur://invite/${shortCode}`,
      webUrl: `${baseUrl}/web/invite/${shortCode}`,
      data: nostrData
    };
  }

  /**
   * Convert shareable profile to Nostr format
   */
  static profileToNostrFormat(profile: ShareableProfile, message?: string): NostrInviteData {
    return {
      version: '1.0',
      type: 'link',
      publicKey: profile.publicKey,
      profile: {
        name: profile.displayName,
        picture: profile.avatar,
        about: profile.bio,
      },
      message,
      signature: profile.signature
    };
  }

  /**
   * Create Nostr event for invite request (NIP-compatible)
   */
  static async createInviteRequestEvent(
    senderPrivateKey: string,
    recipientPublicKey: PublicKeyHex,
    profile: ShareableProfile,
    message?: string
  ): Promise<NostrEvent> {
    const content = JSON.stringify({
      type: 'contact_request',
      profile: {
        name: profile.displayName,
        picture: profile.avatar,
        about: profile.bio,
      },
      message: message || '',
      timestamp: profile.timestamp
    });

    const tags = [
      ['p', recipientPublicKey], // Recipient public key
      ['t', 'contact-request'],  // Tag for filtering
    ];

    // Create event structure
    const eventData = {
      kind: NOSTR_INVITE_KINDS.INVITE_REQUEST,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content,
      pubkey: profile.publicKey
    };

    // Sign the event (this would use the actual Nostr signing implementation)
    const signature = await this.signNostrEvent(eventData, senderPrivateKey);
    const eventId = await this.calculateEventId(eventData);

    return {
      id: eventId,
      pubkey: profile.publicKey,
      created_at: eventData.created_at,
      kind: eventData.kind,
      tags: eventData.tags,
      content: eventData.content,
      sig: signature
    };
  }

  /**
   * Parse external Nostr client invite formats
   */
  static parseExternalInvite(data: string): NostrInviteData | null {
    try {
      // Try parsing as JSON first (most common format)
      const parsed = JSON.parse(data);
      
      // Check if it's already in our format
      if (this.isValidNostrInviteData(parsed)) {
        return parsed;
      }

      // Try to convert from common external formats
      return this.convertExternalFormat(parsed);
    } catch {
      // Try parsing as other formats (e.g., bech32, hex, etc.)
      return this.parseAlternativeFormats(data);
    }
  }

  /**
   * Validate Nostr invite data structure
   */
  static isValidNostrInviteData(data: any): data is NostrInviteData {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof data.version === 'string' &&
      typeof data.publicKey === 'string' &&
      typeof data.signature === 'string' &&
      (data.type === 'qr' || data.type === 'link')
    );
  }

  /**
   * Convert from external Nostr client formats
   */
  private static convertExternalFormat(data: any): NostrInviteData | null {
    // Handle Damus-style invites
    if (data.kind === 0 && data.content) {
      try {
        const profile = JSON.parse(data.content);
        return {
          version: '1.0',
          type: 'qr',
          publicKey: data.pubkey,
          profile: {
            name: profile.name,
            picture: profile.picture,
            about: profile.about,
            nip05: profile.nip05,
            lud16: profile.lud16,
          },
          signature: data.sig
        };
      } catch {
        return null;
      }
    }

    // Handle Amethyst-style invites
    if (data.npub && data.profile) {
      return {
        version: '1.0',
        type: 'qr',
        publicKey: this.npubToHex(data.npub),
        profile: data.profile,
        signature: data.signature || ''
      };
    }

    // Handle simple public key formats
    if (typeof data === 'string' && data.length === 64) {
      return {
        version: '1.0',
        type: 'qr',
        publicKey: data as PublicKeyHex,
        signature: ''
      };
    }

    return null;
  }

  /**
   * Parse alternative formats (bech32, etc.)
   */
  private static parseAlternativeFormats(data: string): NostrInviteData | null {
    // Handle npub format (bech32)
    if (data.startsWith('npub1')) {
      const publicKey = this.npubToHex(data);
      if (publicKey) {
        return {
          version: '1.0',
          type: 'qr',
          publicKey,
          signature: ''
        };
      }
    }

    // Handle raw hex public keys
    if (/^[0-9a-fA-F]{64}$/.test(data)) {
      return {
        version: '1.0',
        type: 'qr',
        publicKey: data as PublicKeyHex,
        signature: ''
      };
    }

    // Handle nostr: protocol URLs
    if (data.startsWith('nostr:')) {
      const cleanData = data.replace('nostr:', '');
      return this.parseAlternativeFormats(cleanData);
    }

    return null;
  }

  /**
   * Convert npub (bech32) to hex format
   */
  private static npubToHex(npub: string): PublicKeyHex | null {
    try {
      // This is a simplified implementation
      // In a real app, you'd use a proper bech32 decoder
      if (!npub.startsWith('npub1')) {
        return null;
      }
      
      // For now, return null to indicate this needs proper bech32 implementation
      // TODO: Implement proper bech32 decoding
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Sign Nostr event (placeholder for actual implementation)
   */
  private static async signNostrEvent(eventData: any, privateKey: string): Promise<string> {
    // This would use the actual Nostr signing implementation
    // For now, return a placeholder
    return 'placeholder_signature';
  }

  /**
   * Calculate Nostr event ID (placeholder for actual implementation)
   */
  private static async calculateEventId(eventData: any): Promise<string> {
    // This would calculate the actual Nostr event ID
    // For now, return a placeholder
    return 'placeholder_event_id';
  }

  /**
   * Generate QR code data in multiple formats for compatibility
   */
  static generateCompatibleQRData(qrData: QRInviteData): {
    obscur: string;
    nostr: string;
    universal: string;
  } {
    const nostrFormat = this.toNostrFormat(qrData);
    
    return {
      // Obscur native format
      obscur: JSON.stringify(qrData),
      
      // Standard Nostr format
      nostr: JSON.stringify(nostrFormat),
      
      // Universal format with fallbacks
      universal: JSON.stringify({
        ...nostrFormat,
        fallbacks: [
          `nostr:${qrData.publicKey}`,
          `https://obscur.app/connect/${qrData.publicKey}`,
        ]
      })
    };
  }

  /**
   * Detect and parse any supported invite format
   */
  static parseAnyFormat(data: string): QRInviteData | null {
    // Try parsing as Nostr format first
    const nostrData = this.parseExternalInvite(data);
    if (nostrData) {
      return this.fromNostrFormat(nostrData);
    }

    // Try parsing as native Obscur format
    try {
      const parsed = JSON.parse(data);
      if (this.isValidQRInviteData(parsed)) {
        return parsed;
      }
    } catch {
      // Not JSON, continue with other formats
    }

    return null;
  }

  /**
   * Validate internal QR invite data structure
   */
  private static isValidQRInviteData(data: any): data is QRInviteData {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof data.version === 'string' &&
      typeof data.publicKey === 'string' &&
      typeof data.signature === 'string' &&
      typeof data.timestamp === 'number' &&
      typeof data.expirationTime === 'number'
    );
  }
}

/**
 * Relay URL validation for Nostr compatibility
 */
export class NostrRelayValidator {
  
  /**
   * Validate and normalize relay URLs for Nostr compatibility
   */
  static validateRelayUrl(url: string): { isValid: boolean; normalizedUrl?: string; error?: string } {
    try {
      const parsed = new URL(url);
      
      // Check protocol
      if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
        return { isValid: false, error: 'Relay URL must use ws:// or wss:// protocol' };
      }

      // Prefer secure connections
      if (parsed.protocol === 'ws:' && parsed.hostname !== 'localhost') {
        parsed.protocol = 'wss:';
      }

      return { isValid: true, normalizedUrl: parsed.toString() };
    } catch (error) {
      return { isValid: false, error: 'Invalid URL format' };
    }
  }

  /**
   * Get default Nostr relays for invite distribution
   */
  static getDefaultRelays(): string[] {
    return [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band',
      'wss://nostr.wine',
      'wss://relay.snort.social'
    ];
  }

  /**
   * Test relay connectivity
   */
  static async testRelay(url: string): Promise<{ connected: boolean; latency?: number; error?: string }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const ws = new WebSocket(url);
      
      const timeout = setTimeout(() => {
        ws.close();
        resolve({ connected: false, error: 'Connection timeout' });
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        const latency = Date.now() - startTime;
        ws.close();
        resolve({ connected: true, latency });
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve({ connected: false, error: 'Connection failed' });
      };
    });
  }
}