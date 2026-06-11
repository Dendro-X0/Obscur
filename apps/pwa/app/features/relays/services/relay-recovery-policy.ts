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
  fallbackWritableRelayCount: number;
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
  beforeRecovery?: (reason: RelayRecoveryReasonCode) => boolean;
}>;

const WATCHDOG_INTERVAL_MS = 8_000;
const STALE_INBOUND_WINDOW_MS = 16_000;
const RECOVERY_COOLDOWN_MS = 8_000;
const MAX_RECOVERY_ATTEMPTS = 8;
/** Full reconnect → resubscribe → recycle cycles before pausing automatic recovery. */
const MAX_CYCLIC_RECOVERY_TRIGGERS = 6;
const CYCLIC_RECOVERY_REASONS: ReadonlyArray<RelayRecoveryReasonCode> = [
  "no_writable_relays",
  "write_queue_blocked",
  "cooldown_active",
  "stale_event_flow",
];

const isCyclicRecoveryReason = (
  reason?: RelayRecoveryReasonCode,
): reason is RelayRecoveryReasonCode => (
  typeof reason === "string" && CYCLIC_RECOVERY_REASONS.includes(reason)
);

const areRelayRecoverySnapshotsEqual = (
  previous: RelayRecoverySnapshot,
  next: RelayRecoverySnapshot,
): boolean => (
  previous.readiness === next.readiness
  && previous.writableRelayCount === next.writableRelayCount
  && previous.fallbackWritableRelayCount === next.fallbackWritableRelayCount
  && previous.subscribableRelayCount === next.subscribableRelayCount
  && previous.writeBlockedRelayCount === next.writeBlockedRelayCount
  && previous.coolingDownRelayCount === next.coolingDownRelayCount
  && previous.recoveryAttemptCount === next.recoveryAttemptCount
  && previous.lastInboundMessageAtUnixMs === next.lastInboundMessageAtUnixMs
  && previous.lastInboundEventAtUnixMs === next.lastInboundEventAtUnixMs
  && previous.lastSuccessfulPublishAtUnixMs === next.lastSuccessfulPublishAtUnixMs
  && previous.recoveryReasonCode === next.recoveryReasonCode
  && previous.currentAction === next.currentAction
  && previous.fallbackRelayUrls.join("|") === next.fallbackRelayUrls.join("|")
);

const createDefaultSnapshot = (): RelayRecoverySnapshot => ({
  readiness: "offline",
  writableRelayCount: 0,
  fallbackWritableRelayCount: 0,
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
  fallbackWritableRelayCount: number;
  subscribableRelayCount: number;
  recoveryAttemptCount: number;
  recoveryReasonCode?: RelayRecoveryReasonCode;
}>): RelayReadinessState => {
  if (params.recoveryReasonCode === "startup_warmup") {
    return "recovering";
  }
  if (params.recoveryReasonCode === "recovery_exhausted") {
    return "offline";
  }
  const effectiveWritableRelayCount = params.writableRelayCount + params.fallbackWritableRelayCount;
  if (params.writableRelayCount > 0 && params.subscribableRelayCount > 0) {
    return "healthy";
  }
  if (params.recoveryAttemptCount > 0 && effectiveWritableRelayCount === 0) {
    return "recovering";
  }
  if (effectiveWritableRelayCount > 0 || params.subscribableRelayCount > 0) {
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
  fallbackWritableRelayCount: number;
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
    if (params.fallbackWritableRelayCount > 0) {
      if (params.writeBlockedRelayCount > 0) {
        return "write_queue_blocked";
      }
      return undefined;
    }
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

const resolveManualRecoveryReason = (params: Readonly<{
  requestedReason: RelayRecoveryReasonCode;
  snapshot: RelayRecoverySnapshot;
  enabledRelayCount: number;
}>): RelayRecoveryReasonCode => {
  if (params.requestedReason !== "manual" || params.enabledRelayCount <= 0) {
    return params.requestedReason;
  }
  if (params.snapshot.writableRelayCount > 0) {
    return params.requestedReason;
  }
  if (params.snapshot.fallbackWritableRelayCount > 0) {
    return params.requestedReason;
  }
  if (params.snapshot.coolingDownRelayCount > 0) {
    return "cooldown_active";
  }
  if (params.snapshot.writeBlockedRelayCount > 0 || params.snapshot.subscribableRelayCount > 0) {
    return "write_queue_blocked";
  }
  return "no_writable_relays";
};

const resolveAttemptBaseline = (params: Readonly<{
  reason: RelayRecoveryReasonCode;
  previousReason?: RelayRecoveryReasonCode;
  previousAttemptCount: number;
}>): number => {
  const nextIsCyclic = isCyclicRecoveryReason(params.reason);
  const previousIsCyclic = isCyclicRecoveryReason(params.previousReason);
  if (nextIsCyclic && previousIsCyclic) {
    return params.previousAttemptCount;
  }
  if (!nextIsCyclic && !previousIsCyclic && params.reason === params.previousReason) {
    return params.previousAttemptCount;
  }
  return 0;
};

class RelayRecoveryController {
  private config: RelayRecoveryControllerConfig | null = null;
  private configSignature: string | null = null;
  private snapshot: RelayRecoverySnapshot = createDefaultSnapshot();
  private listeners = new Set<(snapshot: RelayRecoverySnapshot) => void>();
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private warmupStarted = false;
  private totalCyclicRecoveryTriggers = 0;

  configure(config: RelayRecoveryControllerConfig): void {
    const nextSignature = config.enabledRelayUrls.join("|");
    const configChanged = this.configSignature !== nextSignature;
    this.config = config;
    this.configSignature = nextSignature;
    if (configChanged) {
      this.totalCyclicRecoveryTriggers = 0;
      this.refreshSnapshot();
    }
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
    const fallbackWritableRelayCount = activity.fallbackWritableRelayCount ?? 0;
    const relaysRecovered = writableSnapshot.writableRelayUrls.length > 0 || fallbackWritableRelayCount > 0;
    if (relaysRecovered) {
      this.totalCyclicRecoveryTriggers = 0;
    }
    const recoveryAttemptCount = relaysRecovered
      ? 0
      : this.snapshot.recoveryAttemptCount;
    const isRecoveryExhausted = this.snapshot.recoveryReasonCode === "recovery_exhausted";
    const recoveryReasonCode = isRecoveryExhausted
      ? "recovery_exhausted"
      : (recoveryAttemptCount > 0 ? this.snapshot.recoveryReasonCode : undefined);

    const nextSnapshot: RelayRecoverySnapshot = {
      ...this.snapshot,
      readiness: classifyRelayRecoveryState({
        writableRelayCount: writableSnapshot.writableRelayUrls.length,
        fallbackWritableRelayCount,
        subscribableRelayCount: activity.subscribableRelayCount,
        recoveryAttemptCount,
        recoveryReasonCode,
      }),
      writableRelayCount: writableSnapshot.writableRelayUrls.length,
      fallbackWritableRelayCount,
      subscribableRelayCount: activity.subscribableRelayCount,
      writeBlockedRelayCount: activity.writeBlockedRelayCount,
      coolingDownRelayCount: activity.coolingDownRelayCount,
      lastInboundMessageAtUnixMs: activity.lastInboundMessageAtUnixMs,
      lastInboundEventAtUnixMs: activity.lastInboundEventAtUnixMs,
      lastSuccessfulPublishAtUnixMs: activity.lastSuccessfulPublishAtUnixMs,
      recoveryAttemptCount,
      fallbackRelayUrls: activity.fallbackRelayUrls,
      lastFailureReason: findLastFailureReason(this.config.pool),
      currentAction: isRecoveryExhausted
        ? (this.snapshot.currentAction === "reload_required" ? "reload_required" : undefined)
        : (recoveryAttemptCount > 0 ? this.snapshot.currentAction : undefined),
      recoveryReasonCode,
    };
    if (areRelayRecoverySnapshotsEqual(this.snapshot, nextSnapshot)) {
      return this.snapshot;
    }
    this.snapshot = nextSnapshot;
    this.emit();
    return this.snapshot;
  }

  resetAfterPrimaryFailover(): RelayRecoverySnapshot {
    this.totalCyclicRecoveryTriggers = 0;
    this.snapshot = {
      ...this.refreshSnapshot(),
      recoveryAttemptCount: 0,
      recoveryReasonCode: undefined,
      currentAction: undefined,
      lastRecoveryAtUnixMs: undefined,
    };
    this.emit();
    return this.snapshot;
  }

  async triggerRecovery(reason: RelayRecoveryReasonCode): Promise<RelayRecoverySnapshot> {
    if (!this.config) {
      return this.snapshot;
    }

    if (this.snapshot.recoveryReasonCode === "recovery_exhausted" && reason !== "manual") {
      return this.refreshSnapshot();
    }

    const refreshed = this.refreshSnapshot();
    const resolvedReason = resolveManualRecoveryReason({
      requestedReason: reason,
      snapshot: refreshed,
      enabledRelayCount: this.config.enabledRelayUrls.length,
    });

    if (this.config.beforeRecovery?.(resolvedReason)) {
      return this.refreshSnapshot();
    }

    if (reason === "manual" && this.snapshot.recoveryReasonCode === "recovery_exhausted") {
      this.totalCyclicRecoveryTriggers = 0;
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

    const previousAttemptCount = resolveAttemptBaseline({
      reason: resolvedReason,
      previousReason: this.snapshot.recoveryReasonCode,
      previousAttemptCount: this.snapshot.recoveryAttemptCount,
    });

    const nextAttempt = getNextRecoveryAttemptCount({
      reason: resolvedReason,
      previousAttemptCount,
    });
    const action = selectRecoveryAction({ reason: resolvedReason, nextAttempt });
    const isCyclicReason = CYCLIC_RECOVERY_REASONS.includes(resolvedReason);
    if (isCyclicReason) {
      this.totalCyclicRecoveryTriggers += 1;
    }
    const isRecoveryExhausted = isCyclicReason
      ? this.totalCyclicRecoveryTriggers > MAX_CYCLIC_RECOVERY_TRIGGERS
      : nextAttempt > MAX_RECOVERY_ATTEMPTS;

    if (isRecoveryExhausted) {
      if (this.config.beforeRecovery?.(resolvedReason)) {
        return this.refreshSnapshot();
      }
      this.snapshot = {
        ...this.snapshot,
        readiness: "offline",
        recoveryAttemptCount: nextAttempt,
        lastRecoveryAtUnixMs: nowUnixMs,
        recoveryReasonCode: "recovery_exhausted",
        currentAction: isCyclicReason ? undefined : action,
      };
      this.emit();
      this.refreshSnapshot();
      return this.snapshot;
    }

    this.snapshot = {
      ...this.snapshot,
      readiness: "recovering",
      recoveryAttemptCount: nextAttempt,
      lastRecoveryAtUnixMs: nowUnixMs,
      recoveryReasonCode: resolvedReason,
      currentAction: action,
    };
    this.emit();

    if (action === "reconnect") {
      // Recovery controller owns transport revival and must bypass passive
      // cooldown/backoff gates when no writable relays remain.
      this.config.pool.reconnectAll({ force: true });
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
    this.totalCyclicRecoveryTriggers = 0;
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
    if (snapshot.recoveryReasonCode === "recovery_exhausted") {
      return;
    }
    const eventFreshnessReferenceUnixMs = snapshot.lastInboundEventAtUnixMs
      ?? snapshot.lastRecoveryAtUnixMs
      ?? snapshot.lastSuccessfulPublishAtUnixMs;
    const watchdogReason = resolveWatchdogRecoveryReason({
      enabledRelayCount: this.config.enabledRelayUrls.length,
      writableRelayCount: snapshot.writableRelayCount,
      fallbackWritableRelayCount: snapshot.fallbackWritableRelayCount,
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
  isCyclicRecoveryReason,
  getNextRecoveryAttemptCount,
  selectRecoveryAction,
  resolveWatchdogRecoveryReason,
  resolveManualRecoveryReason,
  resolveAttemptBaseline,
  MAX_CYCLIC_RECOVERY_TRIGGERS,
};
