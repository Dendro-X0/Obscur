/**
 * Obscur-Nostr package identity (Slice S5).
 * Public product name stays Obscur; this package names the Nostr protocol module.
 */

export const OBSCUR_NOSTR_PACKAGE_NAME = "@obscur/protocol-nostr" as const;

/** ProtocolAdaptationLayer registry id for this module. */
export const OBSCUR_NOSTR_PROTOCOL_ID = "nostr" as const;

/**
 * Live runtime home until a later extract moves the adapter body into this package.
 * Do not treat the package as empty — port surfaces and identity live here now.
 */
export const OBSCUR_NOSTR_IMPLEMENTATION_HOME =
  "apps/pwa/app/features/protocol-adaptation/nostr/" as const;
