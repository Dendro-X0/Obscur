/**
 * @obscur/protocol-nostr — attachment point for Obscur-Nostr.
 *
 * Register the live adapter with ProtocolAdaptationLayer under OBSCUR_NOSTR_PROTOCOL_ID.
 * Runtime adapter orchestration: OBSCUR_NOSTR_IMPLEMENTATION_HOME (apps/pwa).
 * P7+: pure body leaves (canonical maps) live in this package.
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

export {
  mapRichConversationToCanonical,
  mapRichMessageToCanonical,
  type ObscurNostrCanonicalConversation,
  type ObscurNostrCanonicalMessage,
  type ObscurNostrRichConversationLike,
  type ObscurNostrRichMessageLike,
} from "./canonical-from-rich";

export {
  OBSCUR_NOSTR_CAPABILITIES,
  formatNostrCanonicalSendRequiresCredentialsError,
  type ObscurNostrCapabilities,
} from "./capabilities";

export { OBSCUR_NOSTR_DISPLAY_NAME } from "./display-name";

export {
  getObscurNostrMigrationHints,
  getObscurNostrSwitchSummary,
  type ObscurNostrMigrationHint,
} from "./migration-hints";
