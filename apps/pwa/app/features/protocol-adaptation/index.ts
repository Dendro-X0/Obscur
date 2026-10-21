export type {
  ProtocolId,
  TransportId,
  CanonicalMessage,
  CanonicalConversation,
  ProtocolCapabilities,
  ProtocolAdapter,
} from "./types";
export {
  PROTOCOL_IDS,
  TRANSPORT_IDS,
  PHASE0_SELECTABLE_PROTOCOL_IDS,
  SELECTABLE_PROTOCOL_IDS,
  PHASE0_ACTIVE_TRANSPORT_ID,
} from "./types";
export {
  readActiveProtocolId,
  writeActiveProtocolId,
  readActiveTransportId,
  writeActiveTransportId,
  getActiveProtocolStorageKey,
  getActiveTransportStorageKey,
  PROTOCOL_ADAPTATION_CHANGED_EVENT,
} from "./preferences";
export {
  getProtocolMigrationHints,
  getProtocolSwitchSummary,
} from "./migration-hints";
export type { ProtocolMigrationHint } from "./migration-hints";
export { PROTOCOL_ADAPTATION_PERF_BUDGETS } from "./performance-budgets";
export type { ProtocolAdaptationPerfBudgets } from "./performance-budgets";
export { useActiveProtocolCapabilities } from "./use-active-protocol-capabilities";
export type { ActiveProtocolSnapshot } from "./use-active-protocol-capabilities";
export {
  ProtocolAdaptationLayer,
  listConversations,
  listMessages,
  sendMessage,
  listDmConversations,
  listDmMessages,
  sendDm,
  sendConnectionRequest,
} from "./layer";
export {
  PLATFORM_CANONICAL_PORTS,
  OBSCUR_NOSTR_RICH_PORTS,
  OBSCUR_NOSTR_PRIVATE_SEND,
} from "./port-surfaces";
export {
  OBSCUR_NOSTR_PACKAGE_NAME,
  OBSCUR_NOSTR_PROTOCOL_ID,
  OBSCUR_NOSTR_IMPLEMENTATION_HOME,
} from "@obscur/protocol-nostr";
export type { SendConfirmation } from "./nostr-adapter";
/** Obscur-Nostr module entry — private send lives on `nostrAdapter.sendDm`. */
export { nostrAdapter, getNostrConnectedTransport } from "./nostr-adapter";
export {
  applyActiveTransport,
  applyTorGatewayPreference,
  syncTransportIdFromTorPreference,
} from "./apply-active-transport";
export type { ApplyActiveTransportResult } from "./apply-active-transport";
export {
  readMatrixSession,
  writeMatrixSession,
  clearMatrixSession,
  hasMatrixSession,
} from "./matrix-session";
export type { MatrixSession } from "./matrix-session";
export {
  matrixLogin,
  matrixLoginAccessToken,
  matrixLogout,
  matrixAdapter,
} from "./matrix-adapter";
