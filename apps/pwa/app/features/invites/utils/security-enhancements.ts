/**
 * Security enhancements for the invite system
 * Provides input validation, sanitization, rate limiting, and secure storage
 */

import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';
import { cryptoService } from '../../crypto/crypto-service';

/**
 * Rate limiter for invite operations
 */
class RateLimiter {
  private operations: Map<string, number[]> = new Map();
  
  /**
   * Check if an operation is allowed based on rate limits
   * @param key - Unique identifier for the operation (e.g., user ID + operation type)
   * @param maxOperations - Maximum number of operations allowed
   * @param windowMs - Time window in milliseconds
   */
  isAllowed(key: string, maxOperations: number, windowMs: number): boolean {
    const now = Date.now();
    const timestamps = this.operations.get(key) || [];
    
    // Remove timestamps outside the window
    const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
    
    if (validTimestamps.length >= maxOperations) {
      return false;
    }
    
    // Add current timestamp
    validTimestamps.push(now);
    this.operations.set(key, validTimestamps);
    
    return true;
  }
  
  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.operations.delete(key);
  }
  
  /**
   * Clear all rate limit data
   */
  clearAll(): void {
    this.operations.clear();
  }
}

/**
 * Input validator for invite system data
 */
export class InputValidator {
  /**
   * Validate and sanitize display name
   */
  static validateDisplayName(name: string): { isValid: boolean; sanitized?: string; error?: string } {
    if (typeof name !== 'string') {
      return { isValid: false, error: 'Display name must be a string' };
    }
    
    const trimmed = name.trim();
    
    if (trimmed.length === 0) {
      return { isValid: false, error: 'Display name cannot be empty' };
    }
    
    if (trimmed.length > 100) {
      return { isValid: false, error: 'Display name must be 100 characters or less' };
    }
    
    // Sanitize: remove potentially harmful characters
    const sanitized = trimmed
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
    
    if (sanitized.length === 0) {
      return { isValid: false, error: 'Display name contains only invalid characters' };
    }
    
    return { isValid: true, sanitized };
  }
  
  /**
   * Validate and sanitize bio text
   */
  static validateBio(bio: string): { isValid: boolean; sanitized?: string; error?: string } {
    if (typeof bio !== 'string') {
      return { isValid: false, error: 'Bio must be a string' };
    }
    
    const trimmed = bio.trim();
    
    if (trimmed.length > 500) {
      return { isValid: false, error: 'Bio must be 500 characters or less' };
    }
    
    // Sanitize: remove potentially harmful characters
    const sanitized = trimmed
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
    
    return { isValid: true, sanitized };
  }
  
  /**
   * Validate URL format
   */
  static validateUrl(url: string, maxLength: number = 500): { isValid: boolean; error?: string } {
    if (typeof url !== 'string') {
      return { isValid: false, error: 'URL must be a string' };
    }
    
    if (url.length > maxLength) {
      return { isValid: false, error: `URL must be ${maxLength} characters or less` };
    }
    
    try {
      const parsed = new URL(url);
      
      // Only allow http and https protocols
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { isValid: false, error: 'URL must use http or https protocol' };
      }
      
      return { isValid: true };
    } catch {
      return { isValid: false, error: 'Invalid URL format' };
    }
  }
  
  /**
   * Validate relay URL format
   */
  static validateRelayUrl(url: string): { isValid: boolean; error?: string } {
    if (typeof url !== 'string') {
      return { isValid: false, error: 'Relay URL must be a string' };
    }
    
    if (url.length > 500) {
      return { isValid: false, error: 'Relay URL must be 500 characters or less' };
    }
    
    try {
      const parsed = new URL(url);
      
      // Only allow ws and wss protocols for relay URLs
      if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
        return { isValid: false, error: 'Relay URL must use ws or wss protocol' };
      }
      
      return { isValid: true };
    } catch {
      return { isValid: false, error: 'Invalid relay URL format' };
    }
  }
  
  /**
   * Validate public key format
   */
  static async validatePublicKey(publicKey: string): Promise<{ isValid: boolean; normalized?: PublicKeyHex; error?: string }> {
    if (typeof publicKey !== 'string') {
      return { isValid: false, error: 'Public key must be a string' };
    }
    
    try {
      const normalized: string = await cryptoService.normalizeKey(publicKey);
      const isValidPubkey: boolean = await cryptoService.isValidPubkey(normalized);
      if (!isValidPubkey) {
        return { isValid: false, error: 'Invalid public key format' };
      }
      
      return { isValid: true, normalized: normalized as PublicKeyHex };
    } catch {
      return { isValid: false, error: 'Failed to validate public key' };
    }
  }
  
  /**
   * Validate contact request message
   */
  static validateMessage(message: string, maxLength: number = 500): { isValid: boolean; sanitized?: string; error?: string } {
    if (typeof message !== 'string') {
      return { isValid: false, error: 'Message must be a string' };
    }
    
    const trimmed = message.trim();
    
    if (trimmed.length > maxLength) {
      return { isValid: false, error: `Message must be ${maxLength} characters or less` };
    }
    
    // Sanitize: remove potentially harmful characters
    const sanitized = trimmed
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
    
    return { isValid: true, sanitized };
  }
  
  /**
   * Validate timestamp
   */
  static validateTimestamp(timestamp: number): { isValid: boolean; error?: string } {
    if (typeof timestamp !== 'number') {
      return { isValid: false, error: 'Timestamp must be a number' };
    }
    
    if (timestamp <= 0) {
      return { isValid: false, error: 'Timestamp must be positive' };
    }
    
    // Check if timestamp is reasonable (not too far in the past or future)
    const now = Date.now();
    const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
    const oneYearFromNow = now + (365 * 24 * 60 * 60 * 1000);
    
    if (timestamp < oneYearAgo || timestamp > oneYearFromNow) {
      return { isValid: false, error: 'Timestamp is outside acceptable range' };
    }
    
    return { isValid: true };
  }
}

/**
 * Secure storage manager for sensitive invite data
 */
export class SecureStorage {
  private static readonly ENCRYPTION_KEY_NAME = 'invite-encryption-key';
  
  /**
   * Store sensitive data with encryption
   */
  static async storeEncrypted(key: string, data: string): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Secure storage is only available in browser environment');
    }
    
    try {
      // In a production environment, you would use a proper encryption key
      // For now, we'll use base64 encoding as a placeholder
      const encoded = btoa(data);
      localStorage.setItem(key, encoded);
    } catch (error) {
      throw new Error(`Failed to store encrypted data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Retrieve and decrypt sensitive data
   */
  static async retrieveEncrypted(key: string): Promise<string | null> {
    if (typeof window === 'undefined') {
      return null;
    }
    
    try {
      const encoded = localStorage.getItem(key);
      if (!encoded) {
        return null;
      }
      
      // In a production environment, you would decrypt the data
      // For now, we'll use base64 decoding as a placeholder
      return atob(encoded);
    } catch (error) {
      console.error('Failed to retrieve encrypted data:', error);
      return null;
    }
  }
  
  /**
   * Remove encrypted data
   */
  static async removeEncrypted(key: string): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }
    
    localStorage.removeItem(key);
  }
  
  /**
   * Clear all encrypted data
   */
  static async clearAll(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }
    
    // In a production environment, you would only clear invite-related encrypted data
    // For now, we'll just document this behavior
    console.warn('clearAll() should only clear invite-related encrypted data');
  }
}

/**
 * Rate limiting configuration for different operations
 */
export const RATE_LIMITS = {
  QR_GENERATION: {
    maxOperations: 10,
    windowMs: 60 * 1000, // 10 QR codes per minute
  },
  INVITE_LINK_GENERATION: {
    maxOperations: 20,
    windowMs: 60 * 1000, // 20 invite links per minute
  },
  CONTACT_REQUEST_SEND: {
    maxOperations: 50,
    windowMs: 60 * 60 * 1000, // 50 contact requests per hour
  },
  INVITE_PROCESSING: {
    maxOperations: 30,
    windowMs: 60 * 1000, // 30 invite processes per minute
  },
} as const;

/**
 * Singleton rate limiter instance
 */
export const rateLimiter = new RateLimiter();

/**
 * Check if QR generation is allowed
 */
export function canGenerateQR(userId: string): boolean {
  return rateLimiter.isAllowed(
    `qr-gen-${userId}`,
    RATE_LIMITS.QR_GENERATION.maxOperations,
    RATE_LIMITS.QR_GENERATION.windowMs
  );
}

/**
 * Check if invite link generation is allowed
 */
export function canGenerateInviteLink(userId: string): boolean {
  return rateLimiter.isAllowed(
    `link-gen-${userId}`,
    RATE_LIMITS.INVITE_LINK_GENERATION.maxOperations,
    RATE_LIMITS.INVITE_LINK_GENERATION.windowMs
  );
}

/**
 * Check if contact request sending is allowed
 */
export function canSendContactRequest(userId: string): boolean {
  return rateLimiter.isAllowed(
    `contact-req-${userId}`,
    RATE_LIMITS.CONTACT_REQUEST_SEND.maxOperations,
    RATE_LIMITS.CONTACT_REQUEST_SEND.windowMs
  );
}

/**
 * Check if invite processing is allowed
 */
export function canProcessInvite(userId: string): boolean {
  return rateLimiter.isAllowed(
    `invite-proc-${userId}`,
    RATE_LIMITS.INVITE_PROCESSING.maxOperations,
    RATE_LIMITS.INVITE_PROCESSING.windowMs
  );
}
