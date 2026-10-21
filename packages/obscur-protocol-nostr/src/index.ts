/**
 * @obscur/protocol-nostr — attachment point for Obscur-Nostr.
 *
 * Register the live adapter with ProtocolAdaptationLayer under OBSCUR_NOSTR_PROTOCOL_ID.
 * Runtime adapter body: OBSCUR_NOSTR_IMPLEMENTATION_HOME (apps/pwa) until a later move.
 * Forks depend on this package for identity + port-surface constants first.
 */

export {
  OBSCUR_NOSTR_PACKAGE_NAME,
  OBSCUR_NOSTR_PROTOCOL_ID,
  OBSCUR_NOSTR_IMPLEMENTATION_HOME,
} from "./module-identity";

export {
  PLATFORM_CANONICAL_PORTS,
  OBSCUR_NOSTR_RICH_PORTS,
  OBSCUR_NOSTR_PRIVATE_SEND,
} from "./port-surfaces";
