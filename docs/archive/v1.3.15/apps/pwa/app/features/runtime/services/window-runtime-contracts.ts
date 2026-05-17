import type { RelayRuntimeSnapshot } from "@/app/features/relays/services/relay-runtime-contracts";

export type WindowRuntimePhase =
  | "booting"
  | "binding_profile"
  | "auth_required"
  | "unlocking"
  | "activating_runtime"
  | "ready"
  | "degraded"
  | "fatal";

export type WindowRuntimeDegradedReason =
  | "none"
  | "activation_timeout"
  | "account_sync_degraded"
  | "relay_runtime_degraded"
  | "identity_error"
  | "native_session_mismatch"
  | "profile_binding_error";

export type WindowRuntimeTraceEntry = Readonly<{
  phase: WindowRuntimePhase;
  enteredAtUnixMs: number;
  completedAtUnixMs?: number;
  durationMs?: number;
  outcome: "entered" | "completed" | "failed";
  reason?: string;
}>;

export type ProfileBoundSessionSnapshot = Readonly<{
  windowLabel: string;
  profileId: string;
  profileLabel: string;
  identityStatus: "loading" | "locked" | "unlocked" | "error";
  storedPublicKeyHex?: string;
  unlockedPublicKeyHex?: string;
}>;

export type RuntimeActivationReport = Readonly<{
  completedAtUnixMs: number;
  relayOpenCount?: number;
  relayTotalCount?: number;
  accountSyncPhase?: string;
  accountSyncStatus?: string;
  accountProjectionReady?: boolean;
  accountProjectionPhase?: string;
  accountProjectionStatus?: string;
  projectionPhase?: string;
  projectionStatus?: string;
  migrationPhase?: string;
  driftStatus?: "unknown" | "clean" | "drifted";
  degradedReason?: WindowRuntimeDegradedReason;
  message?: string;
}>;

export type TransportQueueSnapshot = Readonly<{
  pendingCount: number;
  updatedAtUnixMs: number;
}>;

export type RelationshipRuntimeSnapshot = Readonly<{
  acceptedPeerCount: number;
  pendingIncomingCount: number;
  pendingOutgoingCount: number;
  updatedAtUnixMs: number;
}>;

export type MessagingTransportRuntimeSnapshot = Readonly<{
  activeIncomingOwnerCount: number;
  activeQueueProcessorCount: number;
  updatedAtUnixMs: number;
}>;

export type WindowRuntimeSnapshot = Readonly<{
  phase: WindowRuntimePhase;
  degradedReason: WindowRuntimeDegradedReason;
  lastError?: string;
  phaseEnteredAtUnixMs: number;
  runtimeActivatedAtUnixMs?: number;
  session: ProfileBoundSessionSnapshot;
  lastActivationReport?: RuntimeActivationReport;
  relayRuntime: RelayRuntimeSnapshot;
  transportQueue: TransportQueueSnapshot;
  relationshipRuntime: RelationshipRuntimeSnapshot;
  messagingTransportRuntime: MessagingTransportRuntimeSnapshot;
  traces: ReadonlyArray<WindowRuntimeTraceEntry>;
}>;
