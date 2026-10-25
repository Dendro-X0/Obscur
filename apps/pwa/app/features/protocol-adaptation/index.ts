/**
 * Prefer leaf imports:
 * - `@/app/features/protocol-adaptation/types`
 * - `@/app/features/protocol-adaptation/layer`
 * - `@/app/features/protocol-adaptation/matrix-adapter`
 * Thin root keeps types only for discoverability.
 */
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
