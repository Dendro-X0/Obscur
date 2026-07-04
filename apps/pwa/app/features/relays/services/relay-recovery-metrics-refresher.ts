import { buildTransportRecoverySnapshot } from "@obscur/transport-engine";
import type {
  RelayRecoveryReasonCode,
  RelayRecoverySnapshot,
} from "@/app/features/relays/services/relay-recovery-types";
import {
  createDefaultRelayRecoverySnapshot,
  extractRelayRecoveryAdapterMetrics,
  type RelayRecoveryAdapterConfig,
} from "./relay-recovery-adapter-metrics";

type RelayRecoveryMetricsRefresherConfig = RelayRecoveryAdapterConfig & Readonly<{
  beforeRecovery?: (reason: RelayRecoveryReasonCode) => boolean;
}>;

/** Transport-kernel metrics refresher — snapshot evidence only, no watchdog orchestration. */
class RelayRecoveryMetricsRefresher {
  private config: RelayRecoveryMetricsRefresherConfig | null = null;
  private snapshot: RelayRecoverySnapshot = createDefaultRelayRecoverySnapshot();

  configure(config: RelayRecoveryMetricsRefresherConfig): void {
    this.config = config;
    this.refreshSnapshot();
  }

  subscribeRecoveryState(_listener: (snapshot: RelayRecoverySnapshot) => void): () => void {
    return () => {};
  }

  startWarmup(): void {}

  getRecoverySnapshot(): RelayRecoverySnapshot {
    return this.snapshot;
  }

  refreshSnapshot(): RelayRecoverySnapshot {
    if (!this.config) {
      return this.snapshot;
    }

    const metrics = extractRelayRecoveryAdapterMetrics(this.config);
    const relaysRecovered = (
      metrics.writableRelayCount > 0
      || metrics.fallbackWritableRelayCount > 0
      || metrics.subscribableRelayCount > 0
    );
    const recoveryAttemptCount = relaysRecovered ? 0 : this.snapshot.recoveryAttemptCount;
    const isRecoveryExhausted = !relaysRecovered
      && this.snapshot.recoveryReasonCode === "recovery_exhausted";
    const recoveryReasonCode = isRecoveryExhausted
      ? "recovery_exhausted"
      : (recoveryAttemptCount > 0 ? this.snapshot.recoveryReasonCode : undefined);

    this.snapshot = buildTransportRecoverySnapshot({
      metrics,
      recoveryState: {
        recoveryAttemptCount,
        recoveryReasonCode,
        currentAction: isRecoveryExhausted
          ? (this.snapshot.currentAction === "reload_required" ? "reload_required" : undefined)
          : (recoveryAttemptCount > 0 ? this.snapshot.currentAction : undefined),
        lastRecoveryAtUnixMs: this.snapshot.lastRecoveryAtUnixMs,
      },
      previous: this.snapshot,
    });
    return this.snapshot;
  }

  resetAfterPrimaryFailover(): RelayRecoverySnapshot {
    this.snapshot = {
      ...this.refreshSnapshot(),
      recoveryAttemptCount: 0,
      recoveryReasonCode: undefined,
      currentAction: undefined,
      lastRecoveryAtUnixMs: undefined,
    };
    return this.snapshot;
  }

  async triggerRecovery(reason: RelayRecoveryReasonCode): Promise<RelayRecoverySnapshot> {
    if (this.config?.beforeRecovery?.(reason)) {
      return this.refreshSnapshot();
    }
    return this.refreshSnapshot();
  }

  dispose(): void {
    this.config = null;
    this.snapshot = createDefaultRelayRecoverySnapshot();
  }
}

export const createRelayRecoveryMetricsRefresher = (): RelayRecoveryMetricsRefresher => (
  new RelayRecoveryMetricsRefresher()
);
