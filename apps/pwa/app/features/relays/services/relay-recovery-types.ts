/**
 * Relay recovery contracts — canonical type surface from transport-engine.
 */
export type {
  TransportRecoveryAction as RecoveryAction,
  TransportRecoveryReasonCode as RelayRecoveryReasonCode,
  TransportRecoverySnapshot as RelayRecoverySnapshot,
  TransportReadiness as RelayReadinessState,
} from "@obscur/transport-engine";

export { classifyTransportReadiness as classifyRelayRecoveryState } from "@obscur/transport-engine";
