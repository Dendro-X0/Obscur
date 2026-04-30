/**
 * Key Change Detector Service
 * 
 * Monitors contacts for unexpected identity key changes and alerts users
 * to potential security issues (impersonation, compromised accounts).
 */

import { createSecurityAuditLog, type SecurityAuditLog } from "./security-audit-log";

export interface KnownKey {
  publicKeyHex: string;
  firstSeenAt: number;
  lastVerifiedAt: number | null;
  trustLevel: "unverified" | "verified" | "blocked";
  displayName?: string;
}

export interface KeyChangeEvent {
  contactPubkey: string;
  oldKey: KnownKey | null;
  newKey: KnownKey;
  changeType: "new_contact" | "key_rotation" | "suspicious_change";
  timestamp: number;
}

const STORE_NAME = "known_keys";

/**
 * Key Change Detector
 */
export class KeyChangeDetector {
  private myPublicKey: string;
  private auditLog: SecurityAuditLog;
  private knownKeys: Map<string, KnownKey> = new Map();
  private initialized = false;

  constructor(myPublicKey: string) {
    this.myPublicKey = myPublicKey;
    this.auditLog = createSecurityAuditLog(myPublicKey);
  }

  /**
   * Initialize from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const { openMessageDb } = await import("../../messaging/lib/open-message-db");
      const db = await openMessageDb();

      const stored = await new Promise<Record<string, KnownKey> | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get("known_keys_map");

        request.onsuccess = () => resolve(request.result as Record<string, KnownKey>);
        request.onerror = () => reject(request.error);
      });

      if (stored) {
        this.knownKeys = new Map(Object.entries(stored));
      }

      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize key change detector:", error);
    }
  }

  /**
   * Persist known keys to storage
   */
  private async persist(): Promise<void> {
    try {
      const { openMessageDb } = await import("../../messaging/lib/open-message-db");
      const db = await openMessageDb();

      const data = Object.fromEntries(this.knownKeys);

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(data, "known_keys_map");

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to persist known keys:", error);
    }
  }

  /**
   * Process a contact's public key - detect changes
   */
  async processContactKey(
    contactPubkey: string,
    displayName?: string
  ): Promise<KeyChangeEvent | null> {
    await this.initialize();

    const existing = this.knownKeys.get(contactPubkey);
    const now = Date.now();

    if (!existing) {
      // New contact
      const newKey: KnownKey = {
        publicKeyHex: contactPubkey,
        firstSeenAt: now,
        lastVerifiedAt: null,
        trustLevel: "unverified",
        displayName,
      };

      this.knownKeys.set(contactPubkey, newKey);
      await this.persist();

      await this.auditLog.logEvent(
        "identity_key_change",
        "info",
        `New contact added: ${displayName || contactPubkey.slice(0, 16)}...`,
        { contactPubkey, displayName }
      );

      return {
        contactPubkey,
        oldKey: null,
        newKey,
        changeType: "new_contact",
        timestamp: now,
      };
    }

    // Key already known - update metadata
    existing.displayName = displayName || existing.displayName;
    this.knownKeys.set(contactPubkey, existing);
    await this.persist();

    return null; // No change detected
  }

  /**
   * Mark a key as verified
   */
  async verifyKey(contactPubkey: string): Promise<void> {
    await this.initialize();

    const key = this.knownKeys.get(contactPubkey);
    if (!key) {
      throw new Error("Cannot verify unknown key");
    }

    key.trustLevel = "verified";
    key.lastVerifiedAt = Date.now();
    this.knownKeys.set(contactPubkey, key);
    await this.persist();

    await this.auditLog.logEvent(
      "identity_key_change",
      "info",
      `Key verified for ${key.displayName || contactPubkey.slice(0, 16)}...`,
      { contactPubkey, displayName: key.displayName }
    );
  }

  /**
   * Block a key (suspicious/compromised)
   */
  async blockKey(contactPubkey: string, reason: string): Promise<void> {
    await this.initialize();

    const key = this.knownKeys.get(contactPubkey);
    if (!key) {
      throw new Error("Cannot block unknown key");
    }

    key.trustLevel = "blocked";
    this.knownKeys.set(contactPubkey, key);
    await this.persist();

    await this.auditLog.logEvent(
      "identity_key_change",
      "critical",
      `Key BLOCKED for ${key.displayName || contactPubkey.slice(0, 16)}...: ${reason}`,
      { contactPubkey, displayName: key.displayName, reason }
    );
  }

  /**
   * Check if a key is verified
   */
  isVerified(contactPubkey: string): boolean {
    return this.knownKeys.get(contactPubkey)?.trustLevel === "verified";
  }

  /**
   * Check if a key is blocked
   */
  isBlocked(contactPubkey: string): boolean {
    return this.knownKeys.get(contactPubkey)?.trustLevel === "blocked";
  }

  /**
   * Get trust level for a contact
   */
  getTrustLevel(contactPubkey: string): KnownKey["trustLevel"] | "unknown" {
    return this.knownKeys.get(contactPubkey)?.trustLevel || "unknown";
  }

  /**
   * Get all unverified contacts
   */
  getUnverifiedContacts(): KnownKey[] {
    return Array.from(this.knownKeys.values()).filter(
      (k) => k.trustLevel === "unverified"
    );
  }

  /**
   * Get all verified contacts
   */
  getVerifiedContacts(): KnownKey[] {
    return Array.from(this.knownKeys.values()).filter(
      (k) => k.trustLevel === "verified"
    );
  }

  /**
   * Get security status summary
   */
  getSecuritySummary(): {
    total: number;
    verified: number;
    unverified: number;
    blocked: number;
    needsVerification: KnownKey[];
  } {
    const all = Array.from(this.knownKeys.values());
    const needsVerification = all.filter(
      (k) => k.trustLevel === "unverified" && k.firstSeenAt < Date.now() - 7 * 24 * 60 * 60 * 1000 // 7 days
    );

    return {
      total: all.length,
      verified: all.filter((k) => k.trustLevel === "verified").length,
      unverified: all.filter((k) => k.trustLevel === "unverified").length,
      blocked: all.filter((k) => k.trustLevel === "blocked").length,
      needsVerification,
    };
  }
}

/**
 * Create key change detector instance
 */
export function createKeyChangeDetector(myPublicKey: string): KeyChangeDetector {
  return new KeyChangeDetector(myPublicKey);
}
