import type { EngineScope } from "@obscur/engine-contracts";

export type TransportReadiness = "healthy" | "degraded" | "recovering" | "offline";

export type TransportRecoveryReasonCode =
  | "startup_warmup"
  | "no_writable_relays"
  | "stale_subscriptions"
  | "stale_event_flow"
  | "write_queue_blocked"
  | "publish_timeouts"
  | "manual"
  | "cooldown_active"
  | "recovery_exhausted";

export type TransportRecoveryAction =
  | "reconnect"
  | "resubscribe"
  | "subsystem_reset"
  | "reload_required";

export type TransportPhase =
  | "booting"
  | "connecting"
  | "healthy"
  | "degraded"
  | "recovering"
  | "offline"
  | "fatal";

/** Adapter-neutral relay metrics — no WebSocket or pool types. */
export type TransportAdapterMetrics = Readonly<{
  enabledRelayCount: number;
  writableRelayCount: number;
  fallbackWritableRelayCount: number;
  subscribableRelayCount: number;
  writeBlockedRelayCount: number;
  coolingDownRelayCount: number;
  lastInboundMessageAtUnixMs?: number;
  lastInboundEventAtUnixMs?: number;
  lastSuccessfulPublishAtUnixMs?: number;
  fallbackRelayUrls: ReadonlyArray<string>;
  lastFailureReason?: string;
}>;

export type TransportRecoveryState = Readonly<{
  recoveryAttemptCount: number;
  recoveryReasonCode?: TransportRecoveryReasonCode;
  currentAction?: TransportRecoveryAction;
  lastRecoveryAtUnixMs?: number;
}>;

export type TransportRecoverySnapshot = Readonly<{
  readiness: TransportReadiness;
  writableRelayCount: number;
  fallbackWritableRelayCount: number;
  subscribableRelayCount: number;
  writeBlockedRelayCount: number;
  coolingDownRelayCount: number;
  lastInboundMessageAtUnixMs?: number;
  lastInboundEventAtUnixMs?: number;
  lastSuccessfulPublishAtUnixMs?: number;
  lastRecoveryAtUnixMs?: number;
  recoveryAttemptCount: number;
  recoveryReasonCode?: TransportRecoveryReasonCode;
  currentAction?: TransportRecoveryAction;
  lastFailureReason?: string;
  fallbackRelayUrls: ReadonlyArray<string>;
}>;

export type TransportSnapshot = Readonly<{
  scope: EngineScope;
  phase: TransportPhase;
  revision: number;
  enabledRelayUrls: ReadonlyArray<string>;
  activeSubscriptionCount: number;
  pendingOutboundCount: number;
  updatedAtUnixMs: number;
  recovery: TransportRecoverySnapshot;
}>;
