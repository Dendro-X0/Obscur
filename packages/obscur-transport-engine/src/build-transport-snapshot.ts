import { classifyTransportReadiness } from "./classify-transport-readiness";
import type {
  TransportAdapterMetrics,
  TransportPhase,
  TransportRecoverySnapshot,
  TransportRecoveryState,
  TransportSnapshot,
} from "./transport-types";
import type { EngineScope } from "@obscur/engine-contracts";

const createDefaultRecoverySnapshot = (): TransportRecoverySnapshot => ({
  readiness: "offline",
  writableRelayCount: 0,
  fallbackWritableRelayCount: 0,
  subscribableRelayCount: 0,
  writeBlockedRelayCount: 0,
  coolingDownRelayCount: 0,
  recoveryAttemptCount: 0,
  fallbackRelayUrls: [],
});

export const buildTransportRecoverySnapshot = (params: Readonly<{
  metrics: TransportAdapterMetrics;
  recoveryState?: Partial<TransportRecoveryState>;
  previous?: TransportRecoverySnapshot;
}>): TransportRecoverySnapshot => {
  const recoveryAttemptCount = params.recoveryState?.recoveryAttemptCount
    ?? params.previous?.recoveryAttemptCount
    ?? 0;
  const recoveryReasonCode = params.recoveryState?.recoveryReasonCode
    ?? (recoveryAttemptCount > 0 ? params.previous?.recoveryReasonCode : undefined);
  const isRecoveryExhausted = params.recoveryState?.recoveryReasonCode === "recovery_exhausted"
    || (recoveryReasonCode === "recovery_exhausted");

  return {
    readiness: classifyTransportReadiness({
      writableRelayCount: params.metrics.writableRelayCount,
      fallbackWritableRelayCount: params.metrics.fallbackWritableRelayCount,
      subscribableRelayCount: params.metrics.subscribableRelayCount,
      recoveryAttemptCount,
      recoveryReasonCode: isRecoveryExhausted ? "recovery_exhausted" : recoveryReasonCode,
    }),
    writableRelayCount: params.metrics.writableRelayCount,
    fallbackWritableRelayCount: params.metrics.fallbackWritableRelayCount,
    subscribableRelayCount: params.metrics.subscribableRelayCount,
    writeBlockedRelayCount: params.metrics.writeBlockedRelayCount,
    coolingDownRelayCount: params.metrics.coolingDownRelayCount,
    lastInboundMessageAtUnixMs: params.metrics.lastInboundMessageAtUnixMs,
    lastInboundEventAtUnixMs: params.metrics.lastInboundEventAtUnixMs,
    lastSuccessfulPublishAtUnixMs: params.metrics.lastSuccessfulPublishAtUnixMs,
    lastRecoveryAtUnixMs: params.recoveryState?.lastRecoveryAtUnixMs ?? params.previous?.lastRecoveryAtUnixMs,
    recoveryAttemptCount,
    recoveryReasonCode: isRecoveryExhausted ? "recovery_exhausted" : recoveryReasonCode,
    currentAction: params.recoveryState?.currentAction ?? (
      isRecoveryExhausted && params.previous?.currentAction === "reload_required"
        ? "reload_required"
        : (recoveryAttemptCount > 0 ? params.previous?.currentAction : undefined)
    ),
    lastFailureReason: params.metrics.lastFailureReason,
    fallbackRelayUrls: [...params.metrics.fallbackRelayUrls],
  };
};

const toPhase = (params: Readonly<{
  recovery: TransportRecoverySnapshot;
  enabledRelayCount: number;
  browserOffline?: boolean;
}>): TransportPhase => {
  if (params.browserOffline) {
    return "offline";
  }
  if (params.recovery.recoveryReasonCode === "recovery_exhausted") {
    return params.recovery.currentAction === "reload_required" ? "fatal" : "offline";
  }
  if (params.recovery.readiness === "healthy") {
    return "healthy";
  }
  if (params.recovery.readiness === "recovering") {
    return "recovering";
  }
  if (params.recovery.readiness === "degraded") {
    return "degraded";
  }
  if (params.enabledRelayCount > 0) {
    return "connecting";
  }
  return "offline";
};

export const buildTransportSnapshot = (params: Readonly<{
  scope: EngineScope;
  revision: number;
  enabledRelayUrls: ReadonlyArray<string>;
  metrics: TransportAdapterMetrics;
  recoveryState?: Partial<TransportRecoveryState>;
  previous?: TransportSnapshot;
  activeSubscriptionCount?: number;
  pendingOutboundCount?: number;
  browserOffline?: boolean;
}>): TransportSnapshot => {
  const recovery = buildTransportRecoverySnapshot({
    metrics: params.metrics,
    recoveryState: params.recoveryState,
    previous: params.previous?.recovery,
  });

  return {
    scope: params.scope,
    phase: toPhase({
      recovery,
      enabledRelayCount: params.enabledRelayUrls.length,
      browserOffline: params.browserOffline,
    }),
    revision: params.revision,
    enabledRelayUrls: [...params.enabledRelayUrls],
    activeSubscriptionCount: params.activeSubscriptionCount ?? params.previous?.activeSubscriptionCount ?? 0,
    pendingOutboundCount: params.pendingOutboundCount ?? params.previous?.pendingOutboundCount ?? 0,
    updatedAtUnixMs: Date.now(),
    recovery,
  };
};

export const createDefaultTransportSnapshot = (scope: EngineScope): TransportSnapshot => (
  buildTransportSnapshot({
    scope,
    revision: 0,
    enabledRelayUrls: [],
    metrics: {
      enabledRelayCount: 0,
      writableRelayCount: 0,
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: 0,
      writeBlockedRelayCount: 0,
      coolingDownRelayCount: 0,
      fallbackRelayUrls: [],
    },
    recoveryState: { recoveryAttemptCount: 0 },
    previous: {
      scope,
      phase: "booting",
      revision: 0,
      enabledRelayUrls: [],
      activeSubscriptionCount: 0,
      pendingOutboundCount: 0,
      updatedAtUnixMs: Date.now(),
      recovery: createDefaultRecoverySnapshot(),
    },
  })
);
