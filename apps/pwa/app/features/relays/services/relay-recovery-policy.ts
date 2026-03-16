import type { EnhancedRelayPoolResult } from "@/app/features/relays/hooks/enhanced-relay-pool";

export type RelayReadinessState = "healthy" | "degraded" | "recovering" | "offline";
export type RecoveryAction = "reconnect" | "resubscribe" | "subsystem_reset" | "reload_required";
export type RelayRecoveryReasonCode =
  | "startup_warmup"
  | "no_writable_relays"
  | "stale_subscriptions"
  | "stale_event_flow"
  | "write_queue_blocked"
  | "publish_timeouts"
  | "manual"
  | "cooldown_active"
  | "recovery_exhausted";

export type RelayRecoverySnapshot = Readonly<{
  readiness: RelayReadinessState;
  writableRelayCount: number;
  subscribableRelayCount: number;
  writeBlockedRelayCount: number;
  coolingDownRelayCount: number;
  lastInboundMessageAtUnixMs?: number;
  lastInboundEventAtUnixMs?: number;
  lastSuccessfulPublishAtUnixMs?: number;
  lastRecoveryAtUnixMs?: number;
  recoveryAttemptCount: number;
  recoveryReasonCode?: RelayRecoveryReasonCode;
  currentAction?: RecoveryAction;
  lastFailureReason?: string;
  fallbackRelayUrls: ReadonlyArray<string>;
}>;

type RelayRecoveryControllerConfig = Readonly<{
  pool: EnhancedRelayPoolResult;
  enabledRelayUrls: ReadonlyArray<string>;
}>;

const WATCHDOG_INTERVAL_MS = 12_000;
const STALE_INBOUND_WINDOW_MS = 45_000;
const RECOVERY_COOLDOWN_MS = 8_000;
const MAX_RECOVERY_ATTEMPTS = 4;
const CYCLIC_RECOVERY_REASONS: ReadonlyArray<RelayRecoveryReasonCode> = [
  "no_writable_relays",
  "write_queue_blocked",
  "cooldown_active",
];

const createDefaultSnapshot = (): RelayRecoverySnapshot => ({
  readiness: "offline",
  writableRelayCount: 0,
  subscribableRelayCount: 0,
  writeBlockedRelayCount: 0,
  coolingDownRelayCount: 0,
  recoveryAttemptCount: 0,
  fallbackRelayUrls: [],
});

const findLastFailureReason = (pool: EnhancedRelayPoolResult): string | undefined => {
  const sorted = [...pool.healthMetrics].sort((a, b) => {
    const aTime = a.lastErrorAt?.getTime() ?? 0;
    const bTime = b.lastErrorAt?.getTime() ?? 0;
    return bTime - aTime;
  });
  return sorted.find((metric) => typeof metric.lastError === "string" && metric.lastError.length > 0)?.lastError;
};

export const classifyRelayRecoveryState = (params: Readonly<{
  writableRelayCount: number;
  subscribableRelayCount: number;
  recoveryAttemptCount: number;
}>): RelayReadinessState => {
  if (params.writableRelayCount > 0 && params.subscribableRelayCount > 0) {
    return "healthy";
  }
  if (params.recoveryAttemptCount > 0) {
    return "recovering";
  }
  if (params.writableRelayCount > 0 || params.subscribableRelayCount > 0) {
    return "degraded";
  }
  return "offline";
};

const getNextRecoveryAttemptCount = (params: Readonly<{
  reason: RelayRecoveryReasonCode;
  previousAttemptCount: number;
}>): number => {
  if (CYCLIC_RECOVERY_REASONS.includes(params.reason)) {
    return (params.previousAttemptCount % 3) + 1;
  }
  return params.previousAttemptCount + 1;
};

const selectRecoveryAction = (params: Readonly<{
  reason: RelayRecoveryReasonCode;
  nextAttempt: number;
}>): RecoveryAction => {
  if (CYCLIC_RECOVERY_REASONS.includes(params.reason)) {
    const cycleStep = ((params.nextAttempt - 1) % 3) + 1;
    if (cycleStep === 1) {
      return "reconnect";
    }
    if (cycleStep === 2) {
      return "resubscribe";
    }
    return "subsystem_reset";
  }
  if (params.nextAttempt === 1) {
    return "reconnect";
  }
  if (params.nextAttempt === 2) {
    return "resubscribe";
  }
  if (params.nextAttempt === 3) {
    return "subsystem_reset";
  }
  return "reload_required";
};

const resolveWatchdogRecoveryReason = (params: Readonly<{
  enabledRelayCount: number;
  writableRelayCount: number;
  subscribableRelayCount: number;
  writeBlockedRelayCount: number;
  coolingDownRelayCount: number;
  eventFreshnessReferenceUnixMs?: number;
  nowUnixMs?: number;
}>): RelayRecoveryReasonCode | undefined => {
  if (params.enabledRelayCount <= 0) {
    return undefined;
  }

  if (params.writableRelayCount === 0) {
    if (params.coolingDownRelayCount > 0) {
      return "cooldown_active";
    }
    if (params.writeBlockedRelayCount > 0 || params.subscribableRelayCount > 0) {
      return "write_queue_blocked";
    }
    return "no_writable_relays";
  }

  if (
    params.subscribableRelayCount > 0
    && params.eventFreshnessReferenceUnixMs
    && ((params.nowUnixMs ?? Date.now()) - params.eventFreshnessReferenceUnixMs) > STALE_INBOUND_WINDOW_MS
  ) {
    return "stale_event_flow";
  }

  return undefined;
};

class RelayRecoveryController {
  private config: RelayRecoveryControllerConfig | null = null;
  private snapshot: RelayRecoverySnapshot = createDefaultSnapshot();
  private listeners = new Set<(snapshot: RelayRecoverySnapshot) => void>();
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private warmupStarted = false;

  configure(config: RelayRecoveryControllerConfig): void {
    this.config = config;
    this.refreshSnapshot();
  }

  startWarmup(): void {
    if (!this.config || this.warmupStarted) {
      this.ensureWatchdog();
      return;
    }
    this.warmupStarted = true;
    void this.config.pool.waitForConnection(3_500).finally(() => {
      this.snapshot = {
        ...this.snapshot,
        recoveryReasonCode: "startup_warmup",
      };
      this.refreshSnapshot();
    });
    this.ensureWatchdog();
  }

  subscribeRecoveryState(listener: (snapshot: RelayRecoverySnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getRecoverySnapshot(): RelayRecoverySnapshot {
    return this.snapshot;
  }

  refreshSnapshot(): RelayRecoverySnapshot {
    if (!this.config) {
      return this.snapshot;
    }

    const writableSnapshot = this.config.pool.getWritableRelaySnapshot(this.config.enabledRelayUrls);
    const activity = this.config.pool.getTransportActivitySnapshot();
    const recoveryAttemptCount = writableSnapshot.writableRelayUrls.length > 0 ? 0 : this.snapshot.recoveryAttemptCount;

    this.snapshot = {
      ...this.snapshot,
      readiness: classifyRelayRecoveryState({
        writableRelayCount: writableSnapshot.writableRelayUrls.length,
        subscribableRelayCount: activity.subscribableRelayCount,
        recoveryAttemptCount,
      }),
      writableRelayCount: writableSnapshot.writableRelayUrls.length,
      subscribableRelayCount: activity.subscribableRelayCount,
      writeBlockedRelayCount: activity.writeBlockedRelayCount,
      coolingDownRelayCount: activity.coolingDownRelayCount,
      lastInboundMessageAtUnixMs: activity.lastInboundMessageAtUnixMs,
      lastInboundEventAtUnixMs: activity.lastInboundEventAtUnixMs,
      lastSuccessfulPublishAtUnixMs: activity.lastSuccessfulPublishAtUnixMs,
      recoveryAttemptCount,
      fallbackRelayUrls: activity.fallbackRelayUrls,
      lastFailureReason: findLastFailureReason(this.config.pool),
      currentAction: recoveryAttemptCount > 0 ? this.snapshot.currentAction : undefined,
      recoveryReasonCode: recoveryAttemptCount > 0 ? this.snapshot.recoveryReasonCode : undefined,
    };
    this.emit();
    return this.snapshot;
  }

  async triggerRecovery(reason: RelayRecoveryReasonCode): Promise<RelayRecoverySnapshot> {
    if (!this.config) {
      return this.snapshot;
    }

    const nowUnixMs = Date.now();
    if (this.snapshot.lastRecoveryAtUnixMs && nowUnixMs - this.snapshot.lastRecoveryAtUnixMs < RECOVERY_COOLDOWN_MS) {
      this.snapshot = {
        ...this.snapshot,
        readiness: "recovering",
        recoveryReasonCode: "cooldown_active",
      };
      this.emit();
      return this.snapshot;
    }

    const nextAttempt = getNextRecoveryAttemptCount({
      reason,
      previousAttemptCount: this.snapshot.recoveryAttemptCount,
    });
    const action = selectRecoveryAction({ reason, nextAttempt });
    const isRecoveryExhausted = !CYCLIC_RECOVERY_REASONS.includes(reason) && nextAttempt > MAX_RECOVERY_ATTEMPTS;

    this.snapshot = {
      ...this.snapshot,
      readiness: "recovering",
      recoveryAttemptCount: nextAttempt,
      lastRecoveryAtUnixMs: nowUnixMs,
      recoveryReasonCode: isRecoveryExhausted ? "recovery_exhausted" : reason,
      currentAction: action,
    };
    this.emit();

    if (action === "reconnect") {
      this.config.pool.reconnectAll();
    } else if (action === "resubscribe") {
      this.config.pool.resubscribeAll();
    } else if (action === "subsystem_reset") {
      await this.config.pool.recycle();
    }

    this.refreshSnapshot();
    return this.snapshot;
  }

  dispose(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    this.config = null;
    this.warmupStarted = false;
    this.listeners.clear();
    this.snapshot = createDefaultSnapshot();
  }

  private ensureWatchdog(): void {
    if (this.watchdogTimer) {
      return;
    }
    this.watchdogTimer = setInterval(() => {
      void this.runWatchdog();
    }, WATCHDOG_INTERVAL_MS);
  }

  private async runWatchdog(): Promise<void> {
    if (!this.config) {
      return;
    }
    const snapshot = this.refreshSnapshot();
    const eventFreshnessReferenceUnixMs = snapshot.lastInboundEventAtUnixMs
      ?? snapshot.lastRecoveryAtUnixMs
      ?? snapshot.lastSuccessfulPublishAtUnixMs;
    const watchdogReason = resolveWatchdogRecoveryReason({
      enabledRelayCount: this.config.enabledRelayUrls.length,
      writableRelayCount: snapshot.writableRelayCount,
      subscribableRelayCount: snapshot.subscribableRelayCount,
      writeBlockedRelayCount: snapshot.writeBlockedRelayCount ?? 0,
      coolingDownRelayCount: snapshot.coolingDownRelayCount ?? 0,
      eventFreshnessReferenceUnixMs,
      nowUnixMs: Date.now(),
    });

    if (watchdogReason) {
      await this.triggerRecovery(watchdogReason);
    }
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener(this.snapshot));
  }
}

export const createRelayRecoveryController = (): RelayRecoveryController => new RelayRecoveryController();

export const relayRecoveryInternals = {
  createDefaultSnapshot,
  classifyRelayRecoveryState,
  getNextRecoveryAttemptCount,
  selectRecoveryAction,
  resolveWatchdogRecoveryReason,
};
