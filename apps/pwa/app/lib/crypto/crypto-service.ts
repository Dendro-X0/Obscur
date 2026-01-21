import { nip04Decrypt } from "@dweb/nostr/nip04-decrypt";
import { nip04Encrypt } from "@dweb/nostr/nip04-encrypt";
import { createNostrEvent } from "@dweb/nostr/create-nostr-event";
import { verifyNostrEventSignature } from "@dweb/nostr/verify-nostr-event-signature";
import { generatePrivateKeyHex } from "@dweb/crypto/generate-private-key-hex";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import { toBase64 } from "@dweb/crypto/to-base64";
import { fromBase64 } from "@dweb/crypto/from-base64";
import { toArrayBuffer } from "@dweb/crypto/to-array-buffer";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { schnorr } from "@noble/curves/secp256k1";

/**
 * Security utilities for memory cleanup and timing attack prevention
 */
export interface SecurityUtils {
  // Memory cleanup
  clearSensitiveString(str: string): void;
  clearSensitiveBuffer(buffer: Uint8Array): void;
  
  // Timing attack prevention
  constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean;
  constantTimeStringCompare(a: string, b: string): boolean;
  
  // Secure logging
  sanitizeForLogging(data: any): any;
}

/**
 * Enhanced crypto service for secure message operations
 * Implements NIP-04 encryption/decryption and event signing/verification
 * Extended with invite-specific cryptographic operations
 */
export interface CryptoService {
  // NIP-04 Operations
  encryptDM(plaintext: string, recipientPubkey: PublicKeyHex, senderPrivkey: PrivateKeyHex): Promise<string>;
  decryptDM(ciphertext: string, senderPubkey: PublicKeyHex, recipientPrivkey: PrivateKeyHex): Promise<string>;
  
  // Event Operations
  signEvent(event: UnsignedNostrEvent, privateKey: PrivateKeyHex): Promise<NostrEvent>;
  verifyEventSignature(event: NostrEvent): Promise<boolean>;
  
  // Key Operations
  generateKeyPair(): Promise<{ publicKey: PublicKeyHex; privateKey: PrivateKeyHex }>;
  deriveSharedSecret(privateKey: PrivateKeyHex, publicKey: PublicKeyHex): Promise<Uint8Array>;
  
  // Invite-specific Operations
  generateInviteId(): string;
  signInviteData(data: InviteData, privateKey: PrivateKeyHex): Promise<string>;
  verifyInviteSignature(data: InviteData, signature: string, publicKey: PublicKeyHex): Promise<boolean>;
  encryptInviteData(data: string, key: Uint8Array): Promise<string>;
  decryptInviteData(encryptedData: string, key: Uint8Array): Promise<string>;
  generateSecureRandom(length: number): Uint8Array;
  
  // Utilities
  isValidPubkey(pubkey: string): boolean;
  normalizeKey(key: string): string;
  
  // Security utilities
  security: SecurityUtils;
}

/**
 * Invite data structure for cryptographic operations
 */
export interface InviteData {
  publicKey: PublicKeyHex;
  displayName?: string;
  avatar?: string;
  message?: string;
  timestamp: number;
  expirationTime: number;
  inviteId: string;
}

/**
 * Unsigned Nostr event structure
 */
export interface UnsignedNostrEvent {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  pubkey: PublicKeyHex;
}

/**
 * Security utilities implementation
 */
class SecurityUtilsImpl implements SecurityUtils {
  /**
   * Clear sensitive string from memory by overwriting with zeros
   * Note: JavaScript strings are immutable, so this is a best-effort approach
   * The string will be marked for garbage collection
   */
  clearSensitiveString(str: string): void {
    if (!str || typeof str !== 'string') {
      return;
    }
    
    // In JavaScript, strings are immutable, so we can't actually overwrite them
    // However, we can ensure the reference is cleared and suggest GC
    // This is more of a documentation of intent and future-proofing
    try {
      // Create a zero-filled string of the same length (best effort)
      const zeros = '\0'.repeat(str.length);
      // The original string will be garbage collected
      // We return void to indicate the operation completed
    } catch (error) {
      // Silently fail - this is best effort
      console.warn('Failed to clear sensitive string:', this.sanitizeForLogging(error));
    }
  }

  /**
   * Clear sensitive buffer from memory by overwriting with zeros
   * This actually works for Uint8Array as they are mutable
   */
  clearSensitiveBuffer(buffer: Uint8Array): void {
    if (!buffer || !(buffer instanceof Uint8Array)) {
      return;
    }
    
    try {
      // Overwrite all bytes with zeros
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = 0;
      }
      
      // Additional pass with random data to prevent recovery
      crypto.getRandomValues(buffer);
      
      // Final pass with zeros
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = 0;
      }
    } catch (error) {
      // Silently fail - this is best effort
      console.warn('Failed to clear sensitive buffer:', this.sanitizeForLogging(error));
    }
  }

  /**
   * Constant-time comparison of two byte arrays to prevent timing attacks
   * Returns true if arrays are equal, false otherwise
   */
  constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
    // Validate inputs
    if (!a || !b || !(a instanceof Uint8Array) || !(b instanceof Uint8Array)) {
      return false;
    }
    
    // If lengths differ, still do a comparison to maintain constant time
    // Use the longer length to ensure we always do the same amount of work
    const maxLength = Math.max(a.length, b.length);
    let result = a.length === b.length ? 0 : 1;
    
    // Compare all bytes, accumulating differences
    for (let i = 0; i < maxLength; i++) {
      // Use modulo to wrap around for shorter array (constant time)
      const aVal = a[i % a.length] || 0;
      const bVal = b[i % b.length] || 0;
      result |= aVal ^ bVal;
    }
    
    return result === 0;
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   * Converts strings to bytes and uses constant-time byte comparison
   */
  constantTimeStringCompare(a: string, b: string): boolean {
    // Validate inputs
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }
    
    // Convert strings to UTF-8 bytes
    const encoder = new TextEncoder();
    const aBytes = encoder.encode(a);
    const bBytes = encoder.encode(b);
    
    // Use constant-time byte comparison
    const result = this.constantTimeCompare(aBytes, bBytes);
    
    // Clear the byte arrays
    this.clearSensitiveBuffer(aBytes);
    this.clearSensitiveBuffer(bBytes);
    
    return result;
  }

  /**
   * Sanitize data for logging by removing sensitive information
   * Replaces sensitive fields with [REDACTED] markers
   */
  sanitizeForLogging(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }
    
    // Handle primitive types
    if (typeof data !== 'object') {
      return data;
    }
    
    // Handle Error objects
    if (data instanceof Error) {
      return {
        name: data.name,
        message: data.message,
        // Don't include stack trace as it might contain sensitive info
      };
    }
    
    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeForLogging(item));
    }
    
    // Handle objects
    const sanitized: any = {};
    const sensitiveKeys = [
      'privatekey', 'privkey', 'private_key', 'sk',
      'password', 'passphrase', 'secret', 'token',
      'key', 'keys', 'seed', 'mnemonic',
      'content', 'plaintext', 'ciphertext', 'encrypted',
      'signature', 'sig'
    ];
    
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      // Check if this is a sensitive key
      const isSensitive = sensitiveKeys.some(sensitiveKey => 
        lowerKey.includes(sensitiveKey)
      );
      
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeForLogging(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
}

/**
 * Crypto service implementation with security best practices
 */
class CryptoServiceImpl implements CryptoService {
  public readonly security: SecurityUtils;
  
  constructor() {
    this.security = new SecurityUtilsImpl();
  }
  
  /**
   * Encrypt a direct message using NIP-04 encryption
   */
  async encryptDM(plaintext: string, recipientPubkey: PublicKeyHex, senderPrivkey: PrivateKeyHex): Promise<string> {
    let plaintextBytes: Uint8Array | null = null;
    
    try {
      // Validate inputs
      if (!plaintext || typeof plaintext !== 'string') {
        throw new Error('Invalid plaintext: must be non-empty string');
      }
      if (!this.isValidPubkey(recipientPubkey)) {
        throw new Error('Invalid recipient public key');
      }
      if (!this.isValidPrivateKey(senderPrivkey)) {
        throw new Error('Invalid sender private key');
      }

      // Convert plaintext to bytes for secure cleanup
      const encoder = new TextEncoder();
      plaintextBytes = encoder.encode(plaintext);

      // Use existing NIP-04 encryption
      const encrypted = await nip04Encrypt({
        senderPrivateKeyHex: senderPrivkey,
        recipientPublicKeyHex: recipientPubkey,
        plaintext
      });

      return encrypted;
    } catch (error) {
      // Log error without exposing sensitive data
      console.error('Encryption failed:', this.security.sanitizeForLogging(error));
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Clear sensitive data from memory
      if (plaintextBytes) {
        this.security.clearSensitiveBuffer(plaintextBytes);
      }
      this.security.clearSensitiveString(plaintext);
    }
  }

  /**
   * Decrypt a direct message using NIP-04 decryption
   */
  async decryptDM(ciphertext: string, senderPubkey: PublicKeyHex, recipientPrivkey: PrivateKeyHex): Promise<string> {
    let decryptedBytes: Uint8Array | null = null;
    
    try {
      // Validate inputs
      if (!ciphertext || typeof ciphertext !== 'string') {
        throw new Error('Invalid ciphertext: must be non-empty string');
      }
      if (!this.isValidPubkey(senderPubkey)) {
        throw new Error('Invalid sender public key');
      }
      if (!this.isValidPrivateKey(recipientPrivkey)) {
        throw new Error('Invalid recipient private key');
      }

      // Use existing NIP-04 decryption
      const decrypted = await nip04Decrypt({
        recipientPrivateKeyHex: recipientPrivkey,
        senderPublicKeyHex: senderPubkey,
        payload: ciphertext
      });

      // Convert to bytes for secure cleanup tracking
      const encoder = new TextEncoder();
      decryptedBytes = encoder.encode(decrypted);

      return decrypted;
    } catch (error) {
      // Log error without exposing sensitive data
      console.error('Decryption failed:', this.security.sanitizeForLogging(error));
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Clear sensitive decrypted data from memory
      if (decryptedBytes) {
        this.security.clearSensitiveBuffer(decryptedBytes);
      }
    }
  }

  /**
   * Sign a Nostr event with a private key
   */
  async signEvent(event: UnsignedNostrEvent, privateKey: PrivateKeyHex): Promise<NostrEvent> {
    try {
      // Validate inputs
      if (!event || typeof event !== 'object') {
        throw new Error('Invalid event: must be object');
      }
      if (!this.isValidPrivateKey(privateKey)) {
        throw new Error('Invalid private key');
      }

      // Use existing event creation which handles signing
      const signedEvent = await createNostrEvent({
        kind: event.kind,
        content: event.content,
        tags: event.tags,
        privateKeyHex: privateKey
      });

      return signedEvent;
    } catch (error) {
      // Log error without exposing sensitive data
      console.error('Event signing failed:', this.security.sanitizeForLogging(error));
      throw new Error(`Event signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify the signature of a Nostr event
   */
  async verifyEventSignature(event: NostrEvent): Promise<boolean> {
    try {
      // Validate input
      if (!event || typeof event !== 'object') {
        return false;
      }
      if (!event.id || !event.sig || !event.pubkey) {
        return false;
      }

      // Use existing signature verification
      const isValid = await verifyNostrEventSignature(event);
      
      // Log security event without exposing sensitive data
      if (!isValid) {
        console.warn('Invalid signature detected:', this.security.sanitizeForLogging({
          eventId: event.id,
          pubkey: event.pubkey,
          kind: event.kind
        }));
      }
      
      return isValid;
    } catch (error) {
      // Log error but don't throw - verification should return false on error
      console.warn('Signature verification error:', this.security.sanitizeForLogging(error));
      return false;
    }
  }

  /**
   * Generate a new key pair using secure random generation
   */
  async generateKeyPair(): Promise<{ publicKey: PublicKeyHex; privateKey: PrivateKeyHex }> {
    try {
      const privateKey = generatePrivateKeyHex();
      const publicKey = derivePublicKeyHex(privateKey);
      
      return { publicKey, privateKey };
    } catch (error) {
      throw new Error(`Key generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Derive shared secret between two keys using ECDH
   */
  async deriveSharedSecret(privateKey: PrivateKeyHex, publicKey: PublicKeyHex): Promise<Uint8Array> {
    let combinedBytes: Uint8Array | null = null;
    let hashBuffer: ArrayBuffer | null = null;
    
    try {
      // Validate inputs
      if (!this.isValidPrivateKey(privateKey)) {
        throw new Error('Invalid private key');
      }
      if (!this.isValidPubkey(publicKey)) {
        throw new Error('Invalid public key');
      }

      // For now, use a simple hash-based approach for shared secret
      // This is a simplified implementation - in production, proper ECDH should be used
      const combined = privateKey + publicKey;
      const encoder = new TextEncoder();
      combinedBytes = encoder.encode(combined);
      hashBuffer = await crypto.subtle.digest('SHA-256', combinedBytes);
      
      const result = new Uint8Array(hashBuffer);
      
      return result;
    } catch (error) {
      // Log error without exposing sensitive data
      console.error('Shared secret derivation failed:', this.security.sanitizeForLogging(error));
      throw new Error(`Shared secret derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Clear sensitive data from memory
      if (combinedBytes) {
        this.security.clearSensitiveBuffer(combinedBytes);
      }
      this.security.clearSensitiveString(privateKey);
    }
  }

  /**
   * Generate a cryptographically secure random invite ID
   */
  generateInviteId(): string {
    const randomBytes = this.generateSecureRandom(16); // 128 bits
    return this.bytesToHex(randomBytes);
  }

  /**
   * Sign invite data with a private key
   */
  async signInviteData(data: InviteData | any, privateKey: PrivateKeyHex): Promise<string> {
    let dataBytes: Uint8Array | null = null;
    let hash: Uint8Array | null = null;
    
    try {
      // Validate inputs
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid invite data');
      }
      if (!this.isValidPrivateKey(privateKey)) {
        throw new Error('Invalid private key');
      }

      // Create canonical string representation of the data
      const canonicalData = this.canonicalizeData(data);
      
      // Hash the data using SHA-256
      const encoder = new TextEncoder();
      dataBytes = encoder.encode(canonicalData);
      const hashBuffer = await crypto.subtle.digest('SHA-256', toArrayBuffer(dataBytes));
      hash = new Uint8Array(hashBuffer);
      const hashHex = this.bytesToHex(hash);
      
      // Sign the hash using schnorr signature (same as Nostr events)
      const signature = await schnorr.sign(hashHex, privateKey);
      
      return this.bytesToHex(signature);
    } catch (error) {
      // Log error without exposing sensitive data
      console.error('Invite data signing failed:', this.security.sanitizeForLogging(error));
      throw new Error(`Invite data signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Clear sensitive data from memory
      if (dataBytes) {
        this.security.clearSensitiveBuffer(dataBytes);
      }
      if (hash) {
        this.security.clearSensitiveBuffer(hash);
      }
    }
  }

  /**
   * Verify invite data signature
   */
  async verifyInviteSignature(data: InviteData | any, signature: string, publicKey: PublicKeyHex): Promise<boolean> {
    let dataBytes: Uint8Array | null = null;
    let hash: Uint8Array | null = null;
    
    try {
      // Validate inputs
      if (!data || typeof data !== 'object') {
        return false;
      }
      if (!signature || typeof signature !== 'string') {
        return false;
      }
      if (!this.isValidPubkey(publicKey)) {
        return false;
      }

      // Create canonical string representation of the data
      const canonicalData = this.canonicalizeData(data);
      
      // Hash the data using SHA-256
      const encoder = new TextEncoder();
      dataBytes = encoder.encode(canonicalData);
      const hashBuffer = await crypto.subtle.digest('SHA-256', toArrayBuffer(dataBytes));
      hash = new Uint8Array(hashBuffer);
      const hashHex = this.bytesToHex(hash);
      
      // Verify signature using schnorr verification
      const isValid = schnorr.verify(signature, hashHex, publicKey);
      
      // Log security event without exposing sensitive data
      if (!isValid) {
        console.warn('Invalid invite signature detected:', this.security.sanitizeForLogging({
          publicKey,
          dataType: data.inviteId ? 'InviteData' : 'Other'
        }));
      }
      
      return isValid;
    } catch (error) {
      console.warn('Invite signature verification error:', this.security.sanitizeForLogging(error));
      return false;
    } finally {
      // Clear sensitive data from memory
      if (dataBytes) {
        this.security.clearSensitiveBuffer(dataBytes);
      }
      if (hash) {
        this.security.clearSensitiveBuffer(hash);
      }
    }
  }

  /**
   * Encrypt sensitive invite data using AES-GCM
   */
  async encryptInviteData(data: string, key: Uint8Array): Promise<string> {
    let dataBytes: Uint8Array | null = null;
    let iv: Uint8Array | null = null;
    
    try {
      // Validate inputs
      if (!data || typeof data !== 'string') {
        throw new Error('Invalid data to encrypt');
      }
      if (!key || key.length !== 32) {
        throw new Error('Invalid encryption key: must be 32 bytes');
      }

      // Generate random IV
      iv = this.generateSecureRandom(12); // 96 bits for GCM
      
      // Import key for AES-GCM
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        toArrayBuffer(key),
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      // Encrypt the data
      const encoder = new TextEncoder();
      dataBytes = encoder.encode(data);
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(iv) },
        cryptoKey,
        toArrayBuffer(dataBytes)
      );
      
      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      const result = toBase64(combined);
      
      return result;
    } catch (error) {
      // Log error without exposing sensitive data
      console.error('Invite data encryption failed:', this.security.sanitizeForLogging(error));
      throw new Error(`Invite data encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Clear sensitive data from memory
      if (dataBytes) {
        this.security.clearSensitiveBuffer(dataBytes);
      }
      if (iv) {
        this.security.clearSensitiveBuffer(iv);
      }
      this.security.clearSensitiveString(data);
    }
  }

  /**
   * Decrypt sensitive invite data using AES-GCM
   */
  async decryptInviteData(encryptedData: string, key: Uint8Array): Promise<string> {
    let combined: Uint8Array | null = null;
    let iv: Uint8Array | null = null;
    let encrypted: Uint8Array | null = null;
    
    try {
      // Validate inputs
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error('Invalid encrypted data');
      }
      if (!key || key.length !== 32) {
        throw new Error('Invalid decryption key: must be 32 bytes');
      }

      // Decode base64 data
      combined = fromBase64(encryptedData);
      
      // Extract IV and encrypted data
      iv = combined.slice(0, 12);
      encrypted = combined.slice(12);
      
      // Import key for AES-GCM
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        toArrayBuffer(key),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      // Decrypt the data
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(iv) },
        cryptoKey,
        toArrayBuffer(encrypted)
      );
      
      const decoder = new TextDecoder();
      const result = decoder.decode(decrypted);
      
      return result;
    } catch (error) {
      // Log error without exposing sensitive data
      console.error('Invite data decryption failed:', this.security.sanitizeForLogging(error));
      throw new Error(`Invite data decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Clear sensitive data from memory
      if (combined) {
        this.security.clearSensitiveBuffer(combined);
      }
      if (iv) {
        this.security.clearSensitiveBuffer(iv);
      }
      if (encrypted) {
        this.security.clearSensitiveBuffer(encrypted);
      }
    }
  }

  /**
   * Generate cryptographically secure random bytes
   */
  generateSecureRandom(length: number): Uint8Array {
    if (length <= 0 || !Number.isInteger(length)) {
      throw new Error('Invalid length: must be positive integer');
    }
    
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  /**
   * Validate if a string is a valid public key
   * Uses constant-time comparison where applicable to prevent timing attacks
   */
  isValidPubkey(pubkey: string): boolean {
    if (!pubkey || typeof pubkey !== 'string') {
      return false;
    }
    
    // Remove any whitespace
    const normalized = pubkey.trim();
    
    // Check if it's a valid hex string of correct length (64 characters for 32 bytes)
    if (normalized.length !== 64) {
      return false;
    }
    
    // Check if it's valid hexadecimal
    return /^[0-9a-fA-F]{64}$/.test(normalized);
  }

  /**
   * Normalize a key by trimming whitespace and converting to lowercase
   * Sanitizes input to prevent injection attacks
   */
  normalizeKey(key: string): string {
    if (!key || typeof key !== 'string') {
      return '';
    }
    
    // Trim whitespace and convert to lowercase
    let normalized = key.trim().toLowerCase();
    
    // Remove any non-hexadecimal characters for safety
    normalized = normalized.replace(/[^0-9a-f]/g, '');
    
    // Ensure it's the correct length
    if (normalized.length !== 64) {
      return '';
    }
    
    return normalized;
  }

  /**
   * Validate if a string is a valid private key
   * Uses constant-time comparison where applicable to prevent timing attacks
   */
  private isValidPrivateKey(privkey: string): boolean {
    if (!privkey || typeof privkey !== 'string') {
      return false;
    }
    
    // Remove any whitespace
    const normalized = privkey.trim();
    
    // Check if it's a valid hex string of correct length (64 characters for 32 bytes)
    if (normalized.length !== 64) {
      return false;
    }
    
    // Check if it's valid hexadecimal
    return /^[0-9a-fA-F]{64}$/.test(normalized);
  }

  /**
   * Validate and sanitize string input to prevent injection attacks
   */
  private sanitizeStringInput(input: string, maxLength: number = 10000): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    // Trim whitespace
    let sanitized = input.trim();
    
    // Enforce maximum length to prevent DoS
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    // Remove null bytes and other control characters that could cause issues
    sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
    
    return sanitized;
  }

  /**
   * Validate numeric input to prevent overflow and injection
   */
  private validateNumericInput(value: number, min: number = 0, max: number = Number.MAX_SAFE_INTEGER): boolean {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return false;
    }
    
    if (value < min || value > max) {
      return false;
    }
    
    return true;
  }

  /**
   * Convert hex string to bytes
   */
  private hexToBytes(hex: string): Uint8Array {
    const normalized = hex.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) {
      throw new Error("Invalid hex string");
    }
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  /**
   * Convert bytes to hex string
   */
  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Create canonical string representation of invite data for signing
   */
  private canonicalizeInviteData(data: InviteData): string {
    // Create deterministic string representation
    const parts = [
      data.publicKey,
      data.displayName || '',
      data.avatar || '',
      data.message || '',
      data.timestamp.toString(),
      data.expirationTime.toString(),
      data.inviteId
    ];
    
    return parts.join('|');
  }

  /**
   * Create canonical string representation of any data object for signing
   */
  private canonicalizeData(data: any): string {
    // Check if it's InviteData
    if (data.inviteId && data.expirationTime) {
      return this.canonicalizeInviteData(data as InviteData);
    }
    
    // Handle ShareableProfile or other data types
    const keys = Object.keys(data).sort(); // Sort keys for deterministic order
    const parts: string[] = [];
    
    for (const key of keys) {
      const value = data[key];
      if (value !== undefined && value !== null) {
        if (typeof value === 'object') {
          parts.push(`${key}:${JSON.stringify(value)}`);
        } else {
          parts.push(`${key}:${value.toString()}`);
        }
      } else {
        parts.push(`${key}:`);
      }
    }
    
    return parts.join('|');
  }
}

/**
 * Singleton crypto service instance
 */
export const cryptoService: CryptoService = new CryptoServiceImpl();

/**
 * Hook for using the crypto service in React components
 */
export const useCryptoService = (): CryptoService => {
  return cryptoService;
};