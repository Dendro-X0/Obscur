/**
 * Security Audit Log Service
 * 
 * Maintains an encrypted, append-only log of security-relevant events.
 * All entries are encrypted with the user's identity key and stored locally.
 */

import { openMessageDb } from "../../messaging/lib/open-message-db";

export type SecurityEventType =
  | "identity_key_change"
  | "contact_key_change"
  | "relay_failure"
  | "relay_switch"
  | "suspicious_connection"
  | "unusual_message_pattern"
  | "failed_auth_attempt"
  | "profile_switch"
  | "backup_restore"
  | "settings_change";

export interface SecurityEvent {
  id: string;
  timestamp: number;
  type: SecurityEventType;
  severity: "info" | "warning" | "critical";
  message: string;
  details?: Record<string, unknown>;
  publicKeyHex?: string; // User's public key at time of event
}

export interface SecurityLogOptions {
  maxEntries?: number;
  encryptionKey?: string;
}

const DEFAULT_OPTIONS: Required<SecurityLogOptions> = {
  maxEntries: 1000,
  encryptionKey: "", // Will be derived from identity
};

const STORE_NAME = "security_audit_log";
const LOG_KEY = "security_events";

/**
 * Derive encryption key from identity public key
 */
async function deriveKey(identityPubkey: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const data = encoder.encode(identityPubkey);
  const hash = await crypto.subtle.digest("SHA-256", data);
  
  return await crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt security event
 */
async function encryptEvent(
  event: SecurityEvent,
  key: CryptoKey
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(event));
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt security event
 */
async function decryptEvent(
  encryptedData: string,
  key: CryptoKey
): Promise<SecurityEvent | null> {
  try {
    const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  } catch (error) {
    console.error("Failed to decrypt security event:", error);
    return null;
  }
}

/**
 * Security Audit Log Service
 */
export class SecurityAuditLog {
  private identityPubkey: string;
  private options: Required<SecurityLogOptions>;
  private encryptionKey: CryptoKey | null = null;

  constructor(identityPubkey: string, options: SecurityLogOptions = {}) {
    this.identityPubkey = identityPubkey;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Initialize encryption key
   */
  async initialize(): Promise<void> {
    this.encryptionKey = await deriveKey(this.identityPubkey);
  }

  /**
   * Log a security event
   */
  async logEvent(
    type: SecurityEventType,
    severity: SecurityEvent["severity"],
    message: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    if (!this.encryptionKey) {
      await this.initialize();
    }

    const event: SecurityEvent = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      timestamp: Date.now(),
      type,
      severity,
      message,
      details,
      publicKeyHex: this.identityPubkey,
    };

    try {
      const db = await openMessageDb();
      const encrypted = await encryptEvent(event, this.encryptionKey!);

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);

        // Get existing log
        const getRequest = store.get(LOG_KEY);

        getRequest.onsuccess = async () => {
          const existing = (getRequest.result as { entries?: string[] }) || { entries: [] };
          const entries = existing.entries || [];

          // Add new entry
          entries.push(encrypted);

          // Trim to max entries
          if (entries.length > this.options.maxEntries) {
            entries.splice(0, entries.length - this.options.maxEntries);
          }

          // Save back
          const saveRequest = store.put({ entries }, LOG_KEY);
          saveRequest.onsuccess = () => resolve();
          saveRequest.onerror = () => reject(saveRequest.error);
        };

        getRequest.onerror = () => reject(getRequest.error);
      });

      // Emit to console for debugging (remove in production)
      if (process.env.NODE_ENV === "development") {
        console.log(`[Security Audit] ${severity}: ${message}`, details);
      }
    } catch (error) {
      console.error("Failed to log security event:", error);
      // Don't throw - security logging should not break app flow
    }
  }

  /**
   * Get all security events
   */
  async getEvents(
    options: {
      type?: SecurityEventType;
      severity?: SecurityEvent["severity"];
      since?: number;
      until?: number;
      limit?: number;
    } = {}
  ): Promise<SecurityEvent[]> {
    if (!this.encryptionKey) {
      await this.initialize();
    }

    try {
      const db = await openMessageDb();

      const data = await new Promise<{ entries?: string[] } | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(LOG_KEY);

        request.onsuccess = () => resolve(request.result as { entries?: string[] });
        request.onerror = () => reject(request.error);
      });

      const entries = data?.entries || [];
      const events: SecurityEvent[] = [];

      for (const encrypted of entries) {
        const event = await decryptEvent(encrypted, this.encryptionKey!);
        if (!event) continue;

        // Apply filters
        if (options.type && event.type !== options.type) continue;
        if (options.severity && event.severity !== options.severity) continue;
        if (options.since && event.timestamp < options.since) continue;
        if (options.until && event.timestamp > options.until) continue;

        events.push(event);
      }

      // Sort by timestamp descending
      events.sort((a, b) => b.timestamp - a.timestamp);

      // Apply limit
      if (options.limit && events.length > options.limit) {
        return events.slice(0, options.limit);
      }

      return events;
    } catch (error) {
      console.error("Failed to get security events:", error);
      return [];
    }
  }

  /**
   * Get recent critical events
   */
  async getRecentCriticalEvents(limit: number = 10): Promise<SecurityEvent[]> {
    return this.getEvents({ severity: "critical", limit });
  }

  /**
   * Check if there are any unacknowledged critical events
   */
  async hasUnacknowledgedCritical(since: number = Date.now() - 24 * 60 * 60 * 1000): Promise<boolean> {
    const events = await this.getEvents({
      severity: "critical",
      since,
      limit: 1,
    });
    return events.length > 0;
  }

  /**
   * Export log for debugging (encrypted)
   */
  async exportLog(): Promise<string | null> {
    try {
      const db = await openMessageDb();

      const data = await new Promise<{ entries?: string[] } | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(LOG_KEY);

        request.onsuccess = () => resolve(request.result as { entries?: string[] });
        request.onerror = () => reject(request.error);
      });

      return JSON.stringify({
        exportedAt: Date.now(),
        identityPubkey: this.identityPubkey,
        entryCount: data?.entries?.length || 0,
        encryptedEntries: data?.entries || [],
      });
    } catch (error) {
      console.error("Failed to export security log:", error);
      return null;
    }
  }

  /**
   * Clear all security events
   */
  async clearLog(): Promise<void> {
    try {
      const db = await openMessageDb();

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(LOG_KEY);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to clear security log:", error);
    }
  }
}

/**
 * Create security audit log instance
 */
export function createSecurityAuditLog(identityPubkey: string): SecurityAuditLog {
  return new SecurityAuditLog(identityPubkey);
}
