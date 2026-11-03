/**
 * Obscur-Nostr package identity (Slice S5).
 * Public product name stays Obscur; this package names the Nostr protocol module.
 */

export const OBSCUR_NOSTR_PACKAGE_NAME = "@obscur/protocol-nostr" as const;

/** ProtocolAdaptationLayer registry id for this module. */
export const OBSCUR_NOSTR_PROTOCOL_ID = "nostr" as const;

/**
 * Live adapter orchestration home (connect/send/list wiring).
 * Pure body leaves (e.g. canonical-from-rich) already live in this package (P7).
 */
export const OBSCUR_NOSTR_IMPLEMENTATION_HOME =
  "apps/pwa/app/features/protocol-adaptation/nostr/" as const;
