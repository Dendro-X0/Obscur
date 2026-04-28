import type {
  RelayRecoveryReasonCode,
  RelayRecoverySnapshot,
} from "./relay-recovery-policy";

export type RelayRuntimePhase =
  | "booting"
  | "connecting"
  | "healthy"
  | "degraded"
  | "recovering"
  | "offline"
  | "fatal";

export type RelayRecoveryStage =
  | "connect_relays"
  | "replay_subscriptions"
  | "repair_sync"
  | "drain_outbox"
  | "subsystem_recycle";

export type RelaySubscriptionReplayReasonCode =
  | "relay_open"
  | "manual"
  | "recycle";

export type RelaySubscriptionReplayResult =
  | "ok"
  | "partial"
  | "skipped"
  | "failed";

export type RelayTransportRoutingMode =
  | "direct"
  | "privacy_routed";

export type RelayRuntimeSnapshot = Readonly<{
  instanceId: string;
  windowLabel: string;
  profileId: string;
  publicKeyHexSummary?: string;
  transportRoutingMode: RelayTransportRoutingMode;
  transportProxySummary?: string;
  phase: RelayRuntimePhase;
  recoveryStage?: RelayRecoveryStage;
  enabledRelayUrls: ReadonlyArray<string>;
  writableRelayCount: number;
  subscribableRelayCount: number;
  activeSubscriptionCount: number;
  pendingOutboundCount: number;
  pendingSubscriptionBatchCount: number;
  lastSubscriptionReplayAttemptAtUnixMs?: number;
  lastSubscriptionReplayResultAtUnixMs?: number;
  lastSubscriptionReplayReasonCode?: RelaySubscriptionReplayReasonCode;
  lastSubscriptionReplayResult?: RelaySubscriptionReplayResult;
  lastSubscriptionReplayDetail?: string;
  lastInboundMessageAtUnixMs?: number;
  lastInboundEventAtUnixMs?: number;
  lastSuccessfulPublishAtUnixMs?: number;
  recoveryAttemptCount: number;
  recoveryReasonCode?: RelayRecoveryReasonCode;
  lastFailureReason?: string;
  fallbackRelayUrls: ReadonlyArray<string>;
  updatedAtUnixMs: number;
  recovery: RelayRecoverySnapshot;
}>;

const createDefaultRecoverySnapshot = (): RelayRecoverySnapshot => ({
  readiness: "offline",
  writableRelayCount: 0,
  fallbackWritableRelayCount: 0,
  subscribableRelayCount: 0,
  writeBlockedRelayCount: 0,
  coolingDownRelayCount: 0,
  recoveryAttemptCount: 0,
  fallbackRelayUrls: [],
});

const summarizePublicKeyHex = (publicKeyHex?: string | null): string | undefined => {
  if (!publicKeyHex) {
    return undefined;
  }
  return publicKeyHex.slice(0, 12);
};

export const createDefaultRelayRuntimeSnapshot = (params?: Readonly<{
  instanceId?: string;
  windowLabel?: string;
  profileId?: string;
  publicKeyHex?: string | null;
}>): RelayRuntimeSnapshot => {
  const recovery = createDefaultRecoverySnapshot();
  return {
    instanceId: params?.instanceId ?? "relay-runtime",
    windowLabel: params?.windowLabel ?? "main",
    profileId: params?.profileId ?? "default",
    publicKeyHexSummary: summarizePublicKeyHex(params?.publicKeyHex),
    transportRoutingMode: "direct",
    phase: "booting",
    enabledRelayUrls: [],
    writableRelayCount: 0,
    subscribableRelayCount: 0,
    activeSubscriptionCount: 0,
    pendingOutboundCount: 0,
    pendingSubscriptionBatchCount: 0,
    recoveryAttemptCount: 0,
    fallbackRelayUrls: [],
    updatedAtUnixMs: Date.now(),
    recovery,
  };
};

export const relayRuntimeContractsInternals = {
  summarizePublicKeyHex,
};
