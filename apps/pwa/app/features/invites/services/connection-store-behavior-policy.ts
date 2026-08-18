/**
 * Legacy `connectionStore` (global IndexedDB `obscur-invites`) is display/import
 * artifact only. It must not gate trust, messaging, voice, or request routing.
 *
 * Canonical relationship truth: account projection + requests inbox + peerTrust
 * read adapter (see system-logic-remediation-charter-2026-08 Containment B).
 */
export const isConnectionStoreBehaviorDeprivileged = (): boolean => true;

/** Legacy address-book rows must not imply contact acceptance for any UI gate. */
export const canLegacyConnectionStoreImplyContactAcceptance = (): boolean => false;

/** Legacy store presence must not unlock DM compose or voice affordances. */
export const canLegacyConnectionStoreGatePrivilegedMessaging = (): boolean => false;
