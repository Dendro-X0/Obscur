/**
 * Relay recovery port — sole features entry for recovery runtime wiring.
 * Web legacy controller is quarantined in relay-recovery-controller-legacy.ts.
 */
import type { RelayPoolRuntime } from "./relay-pool-runtime-port";
import { shouldRunLegacyRelayRecoveryOrchestration } from "@/app/features/transport-kernel/transport-kernel-recovery-port";
import {
  createWebLegacyRelayRecoveryController,
  relayRecoveryInternals,
} from "./relay-recovery-controller-legacy";
import { createRelayRecoveryMetricsRefresher } from "./relay-recovery-metrics-refresher";
import type {
  RecoveryAction,
  RelayRecoveryReasonCode,
  RelayRecoverySnapshot,
  RelayReadinessState,
} from "./relay-recovery-types";

export type RelayRecoveryRuntimeConfig = Readonly<{
  pool: RelayPoolRuntime;
  enabledRelayUrls: ReadonlyArray<string>;
  beforeRecovery?: (reason: RelayRecoveryReasonCode) => boolean;
}>;

export type RelayRecoveryRuntime = Readonly<{
  configure: (config: RelayRecoveryRuntimeConfig) => void;
  subscribeRecoveryState: (listener: (snapshot: RelayRecoverySnapshot) => void) => () => void;
  getRecoverySnapshot: () => RelayRecoverySnapshot;
  refreshSnapshot: () => RelayRecoverySnapshot;
  resetAfterPrimaryFailover: () => RelayRecoverySnapshot;
  startWarmup: () => void;
  triggerRecovery: (reason: RelayRecoveryReasonCode) => Promise<RelayRecoverySnapshot>;
  dispose: () => void;
}>;

/** Canonical recovery runtime — legacy watchdog on web, metrics refresher on transport-kernel authority. */
export const createRelayRecoveryRuntime = (): RelayRecoveryRuntime => (
  shouldRunLegacyRelayRecoveryOrchestration()
    ? createWebLegacyRelayRecoveryController()
    : createRelayRecoveryMetricsRefresher()
);

/** @deprecated Use createRelayRecoveryRuntime */
export const createLegacyRelayRecoveryController = createWebLegacyRelayRecoveryController;

/** @deprecated Use createRelayRecoveryRuntime */
export const createRelayRecoveryController = createWebLegacyRelayRecoveryController;

export { relayRecoveryInternals };

export type {
  RecoveryAction,
  RelayRecoveryReasonCode,
  RelayRecoverySnapshot,
  RelayReadinessState,
};

export { classifyRelayRecoveryState } from "./relay-recovery-types";
