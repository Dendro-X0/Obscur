"use client";

/**
 * Security Integration Service
 *
 * Wires v1.4.6 security services to production event flows:
 * - Security audit logging for security-relevant events
 * - Identicon display in message headers and contacts
 * - Key change detection when receiving messages
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  SecurityAuditLog,
  createSecurityAuditLog,
  type SecurityEventType,
  type SecurityEvent,
} from "./security-audit-log";
import { detectKeyChange, type KeyChangeResult } from "./key-change-detector";
import { generateIdenticonDataUrl, type IdenticonOptions } from "./identicon-service";

// Singleton audit log instance per session
let auditLogInstance: SecurityAuditLog | null = null;

/**
 * Get or create the security audit log instance
 */
async function getAuditLog(publicKeyHex: PublicKeyHex): Promise<SecurityAuditLog> {
  if (!auditLogInstance) {
    auditLogInstance = await createSecurityAuditLog(publicKeyHex, {
      maxEntries: 1000,
    });
  }
  return auditLogInstance;
}

/**
 * Log a security event to the audit log
 */
export async function logSecurityEvent(
  publicKeyHex: PublicKeyHex,
  event: Omit<SecurityEvent, "id" | "timestamp">,
): Promise<void> {
  try {
    const auditLog = await getAuditLog(publicKeyHex);
    await auditLog.add({
      ...event,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Failed to log security event:", error);
  }
}

/**
 * Log relay-related security events
 */
export async function logRelaySecurityEvent(
  publicKeyHex: PublicKeyHex,
  type: "relay_failure" | "relay_switch" | "suspicious_connection",
  relayUrl: string,
  details?: Record<string, unknown>,
): Promise<void> {
  const severity = type === "relay_failure" ? "warning" : type === "suspicious_connection" ? "critical" : "info";
  const messages: Record<string, string> = {
    relay_failure: `Relay connection failed: ${relayUrl}`,
    relay_switch: `Switched to relay: ${relayUrl}`,
    suspicious_connection: `Suspicious connection detected: ${relayUrl}`,
  };

  await logSecurityEvent(publicKeyHex, {
    type,
    severity,
    message: messages[type],
    details: { relayUrl, ...details },
    publicKeyHex,
  });
}

/**
 * Log identity/key-related security events
 */
export async function logIdentitySecurityEvent(
  publicKeyHex: PublicKeyHex,
  type: "identity_key_change" | "contact_key_change" | "failed_auth_attempt",
  details?: Record<string, unknown>,
): Promise<void> {
  const severity = type === "failed_auth_attempt" ? "critical" : type === "identity_key_change" ? "critical" : "warning";
  const messages: Record<string, string> = {
    identity_key_change: "Identity key changed detected",
    contact_key_change: "Contact key changed detected",
    failed_auth_attempt: "Failed authentication attempt",
  };

  await logSecurityEvent(publicKeyHex, {
    type,
    severity,
    message: messages[type],
    details,
    publicKeyHex,
  });
}

/**
 * Log settings change event
 */
export async function logSettingsChange(
  publicKeyHex: PublicKeyHex,
  settingName: string,
  previousValue?: unknown,
  newValue?: unknown,
): Promise<void> {
  await logSecurityEvent(publicKeyHex, {
    type: "settings_change",
    severity: "info",
    message: `Settings changed: ${settingName}`,
    details: { settingName, previousValue, newValue },
    publicKeyHex,
  });
}

/**
 * Log backup/restore event
 */
export async function logBackupRestore(
  publicKeyHex: PublicKeyHex,
  operation: "backup_created" | "restore_completed",
  details?: Record<string, unknown>,
): Promise<void> {
  await logSecurityEvent(publicKeyHex, {
    type: "backup_restore",
    severity: "info",
    message: operation === "backup_created" ? "Backup created" : "Account restored",
    details: { operation, ...details },
    publicKeyHex,
  });
}

/**
 * Hook for using identicons in components
 */
export function useIdenticon(publicKeyHex: string, options?: IdenticonOptions) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      try {
        setIsLoading(true);
        const url = await generateIdenticonDataUrl(publicKeyHex, options);
        if (!cancelled) {
          setDataUrl(url);
        }
      } catch (error) {
        console.error("Failed to generate identicon:", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    generate();

    return () => {
      cancelled = true;
    };
  }, [publicKeyHex, options?.size]);

  return { dataUrl, isLoading };
}

import { useState, useEffect } from "react";

/**
 * Key tracking state for a contact
 */
interface ContactKeyState {
  publicKeyHex: PublicKeyHex;
  firstSeenAt: number;
  lastVerifiedAt: number | null;
  keyHistory: Array<{
    publicKeyHex: PublicKeyHex;
    firstSeenAt: number;
  }>;
}

// In-memory store for contact key states (per session)
const contactKeyStates = new Map<PublicKeyHex, ContactKeyState>();

/**
 * Check for key changes when receiving a message from a contact
 * Returns key change info if detected, null if key is consistent
 */
export async function checkContactKeyOnMessage(
  userPublicKeyHex: PublicKeyHex,
  contactPublicKeyHex: PublicKeyHex,
  messageTimestamp: number,
): Promise<KeyChangeResult | null> {
  // Get or create contact state
  let contactState = contactKeyStates.get(contactPublicKeyHex);

  if (!contactState) {
    // First time seeing this contact
    contactState = {
      publicKeyHex: contactPublicKeyHex,
      firstSeenAt: messageTimestamp,
      lastVerifiedAt: null,
      keyHistory: [{
        publicKeyHex: contactPublicKeyHex,
        firstSeenAt: messageTimestamp,
      }],
    };
    contactKeyStates.set(contactPublicKeyHex, contactState);
    return null; // No change, just first contact
  }

  // Check if key matches what we've seen
  if (contactState.publicKeyHex !== contactPublicKeyHex) {
    // Key change detected!
    const changeResult = detectKeyChange(
      contactState.publicKeyHex,
      contactPublicKeyHex,
      contactState.firstSeenAt,
    );

    if (changeResult) {
      // Log the security event
      await logIdentitySecurityEvent(userPublicKeyHex, "contact_key_change", {
        contactPublicKeyHex,
        previousKey: contactState.publicKeyHex,
        newKey: contactPublicKeyHex,
        severity: changeResult.severity,
        recommendation: changeResult.recommendation,
      });

      // Update contact state with new key
      contactState.keyHistory.push({
        publicKeyHex: contactPublicKeyHex,
        firstSeenAt: messageTimestamp,
      });
      contactState.publicKeyHex = contactPublicKeyHex;
      contactState.firstSeenAt = messageTimestamp;
      contactState.lastVerifiedAt = null;

      return changeResult;
    }
  }

  return null;
}

/**
 * Mark a contact's key as verified (user has manually verified)
 */
export function verifyContactKey(contactPublicKeyHex: PublicKeyHex): void {
  const contactState = contactKeyStates.get(contactPublicKeyHex);
  if (contactState) {
    contactState.lastVerifiedAt = Date.now();
  }
}

/**
 * Get contact verification status
 */
export function getContactVerificationStatus(
  contactPublicKeyHex: PublicKeyHex,
): { isVerified: boolean; firstSeenAt: number | null; lastVerifiedAt: number | null } {
  const contactState = contactKeyStates.get(contactPublicKeyHex);
  if (!contactState) {
    return { isVerified: false, firstSeenAt: null, lastVerifiedAt: null };
  }

  return {
    isVerified: contactState.lastVerifiedAt !== null,
    firstSeenAt: contactState.firstSeenAt,
    lastVerifiedAt: contactState.lastVerifiedAt,
  };
}

/**
 * Get recent security events for display
 */
export async function getRecentSecurityEvents(
  publicKeyHex: PublicKeyHex,
  limit: number = 50,
): Promise<SecurityEvent[]> {
  try {
    const auditLog = await getAuditLog(publicKeyHex);
    return await auditLog.getRecent(limit);
  } catch (error) {
    console.error("Failed to get security events:", error);
    return [];
  }
}

/**
 * Clear security audit log (for account reset/logout)
 */
export function clearSecurityAuditLog(): void {
  auditLogInstance = null;
  contactKeyStates.clear();
}

// Re-export types from dependencies
export type { KeyChangeResult } from "./key-change-detector";
