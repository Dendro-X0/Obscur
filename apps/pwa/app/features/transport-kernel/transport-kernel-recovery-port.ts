import type { TransportSnapshot } from "@obscur/transport-engine";
import type { RelayPoolRuntime } from "@/app/features/relays/services/relay-pool-runtime-port";
import type { RelayRuntimePhase } from "@/app/features/relays/services/relay-runtime-contracts";
import type {
  RelayRecoveryReasonCode,
  RelayRecoverySnapshot,
} from "@/app/features/relays/services/relay-recovery-types";
import { isTransportKernelAuthority } from "./transport-kernel-policy";

/** Transport-engine recovery snapshot is published truth when transport-kernel authority is active. */
export const isTransportKernelRecoverySnapshotOwner = (): boolean => isTransportKernelAuthority();

/** Legacy PWA recovery controller must not push snapshot updates when transport-kernel owns recovery. */
export const shouldSubscribeLegacyRelayRecoverySnapshot = (): boolean => (
  !isTransportKernelRecoverySnapshotOwner()
);

/** Legacy watchdog/auto-recovery state machine must not run when transport-kernel owns recovery actions. */
export const shouldRunLegacyRelayRecoveryOrchestration = (): boolean => (
  !isTransportKernelRecoverySnapshotOwner()
);

/** Direct pool recovery — no legacy attempt counter or watchdog orchestration. */
export const executeTransportKernelPoolRecovery = async (
  params: Readonly<{
    pool: RelayPoolRuntime;
    reason: RelayRecoveryReasonCode;
  }>,
): Promise<void> => {
  switch (params.reason) {
    case "stale_subscriptions":
    case "stale_event_flow":
      params.pool.resubscribeAll();
      return;
    case "recovery_exhausted":
      await params.pool.recycle();
      return;
    case "write_queue_blocked":
    case "cooldown_active":
    case "publish_timeouts":
    case "no_writable_relays":
    case "startup_warmup":
    case "manual":
    default:
      params.pool.reconnectAll({ force: true });
  }
};

export const resolvePublishedRelayRecoverySnapshot = (params: Readonly<{
  legacyRecovery: RelayRecoverySnapshot;
  transportSnapshot: TransportSnapshot | null;
}>): RelayRecoverySnapshot => {
  if (!isTransportKernelRecoverySnapshotOwner() || !params.transportSnapshot) {
    return params.legacyRecovery;
  }
  return params.transportSnapshot.recovery;
};

/** Legacy relay-runtime phase classifier — used only when transport-kernel authority is inactive. */
export const resolveLegacyRelayRuntimePhase = (params: Readonly<{
  recovery: RelayRecoverySnapshot;
  enabledRelayCount: number;
}>): RelayRuntimePhase => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
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
