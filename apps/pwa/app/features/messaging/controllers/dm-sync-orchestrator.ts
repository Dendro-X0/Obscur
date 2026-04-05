import { loadingStateManager } from "../lib/ui-performance";
import { generateSubscriptionId } from "./relay-utils";
import type { NostrFilter, EnhancedDMControllerState } from "./dm-controller-state";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { MessageQueue } from "../lib/message-queue";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { createBackfillRequest, detectSyncGap, repairTimelineCheckpoint, updateTimelineCheckpoint } from "../lib/sync-checkpoints";
import { incrementReliabilityMetric, markReliabilitySyncCompleted } from "@/app/shared/reliability-observability";
import { deliveryDiagnosticsStore } from "../services/delivery-diagnostics-store";
import { logAppEvent } from "@/app/shared/log-app-event";
import { appendCanonicalSyncCheckpointEvent } from "@/app/features/account-sync/services/account-event-ingest-bridge";

const DM_TIMELINE_KEY = "dm:all";
const MIN_AUTOMATIC_SYNC_INTERVAL_MS = 10_000;
const SYNC_DURATION_LOG_THRESHOLD_MS = 2_000;
const AUTOMATIC_SYNC_REPLAY_OVERLAP_SECONDS = 2 * 60;
const COLD_START_FULL_HISTORY_SINCE_UNIX_SECONDS = 0;
const COLD_START_SYNC_LIMIT = 1_000;
const DEFAULT_SYNC_LIMIT = 100;
const COLD_START_PAGINATION_MAX_PASSES = 5;

const resolveEoseQuorumRequired = (openRelayCount: number): number => {
  if (openRelayCount <= 2) {
    return 1;
  }
  return Math.ceil(openRelayCount / 2);
};

export interface SyncOrchestratorParams {
  myPublicKeyHex: PublicKeyHex | null;
  messageQueue: MessageQueue | null;
  pool: {
    connections: ReadonlyArray<{ url: string; status: string }>;
    sendToOpen: (payload: string) => void;
    subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
  };
  syncStateRef: {
    current: {
      isSyncing: boolean;
      lastSyncAt?: Date;
      conversationTimestamps: Map<string, Date>;
      coldStartPartialCoverageDetected?: boolean;
      coldStartHistoricalBackfillRelayCount?: number | null;
    };
  };
  setState: React.Dispatch<React.SetStateAction<EnhancedDMControllerState>>;
  onIncomingEvent?: (
    event: NostrEvent,
    url: string,
    ingestSource: "relay_live" | "relay_sync",
  ) => Promise<void> | void;
  diagnostics?: Readonly<{
    transportOwnerId: string | null;
    controllerInstanceId: string;
  }>;
}

const isReliabilityCoreEnabled = (): boolean => {
  try {
    return PrivacySettingsService.getSettings().reliabilityCoreV087;
  } catch {
    return true;
  }
};

export const syncMissedMessages = async (
  params: SyncOrchestratorParams,
  since?: Date
): Promise<void> => {
  const { myPublicKeyHex, messageQueue, pool, syncStateRef, setState, onIncomingEvent, diagnostics } = params;

  if (!myPublicKeyHex || !messageQueue) {
    console.warn("Cannot sync: identity or message queue not available");
    return;
  }

  if (syncStateRef.current.isSyncing) {
    console.log("Sync already in progress, skipping");
    return;
  }

  if (!since && syncStateRef.current.lastSyncAt) {
    const elapsedSinceLastSyncMs = Date.now() - syncStateRef.current.lastSyncAt.getTime();
    if (elapsedSinceLastSyncMs < MIN_AUTOMATIC_SYNC_INTERVAL_MS) {
      console.log("Skipping sync: last sync completed too recently", {
        elapsedSinceLastSyncMs,
        minIntervalMs: MIN_AUTOMATIC_SYNC_INTERVAL_MS,
      });
      return;
    }
  }

  const hasOpenRelay = pool.connections.some((connection) => connection.status === "open");
  if (!hasOpenRelay) {
    console.warn("Cannot sync: no open relay connections");
    return;
  }

  try {
    const syncStartedAtUnixMs = Date.now();
    const isInitialAutomaticSync = !since && !syncStateRef.current.lastSyncAt;
    syncStateRef.current.isSyncing = true;

    loadingStateManager.setLoading("messageSync", {
      isLoading: true,
      progress: 0,
      message: "Syncing messages...",
    });

    setState((prev) => ({
      ...prev,
      syncProgress: {
        total: 0,
        completed: 0,
        errors: 0,
      },
    }));

    let syncTimestamp: number;
    let hasConversationTimestamps = false;
    if (since) {
      syncTimestamp = Math.floor(since.getTime() / 1000);
    } else {
      let mostRecentTimestamp: Date | null = null;
      for (const lastTimestamp of syncStateRef.current.conversationTimestamps.values()) {
        if (!mostRecentTimestamp || lastTimestamp > mostRecentTimestamp) {
          mostRecentTimestamp = lastTimestamp;
        }
      }
      hasConversationTimestamps = mostRecentTimestamp !== null;

      if (mostRecentTimestamp) {
        syncTimestamp = Math.floor(mostRecentTimestamp.getTime() / 1000);
      } else {
        syncTimestamp = COLD_START_FULL_HISTORY_SINCE_UNIX_SECONDS;
      }
    }

    const isColdStartSync = !since && !syncStateRef.current.lastSyncAt && !hasConversationTimestamps;
    const replayOverlapSeconds = (since || isColdStartSync) ? 0 : AUTOMATIC_SYNC_REPLAY_OVERLAP_SECONDS;
    let targetSince = replayOverlapSeconds > 0
      ? Math.max(0, syncTimestamp - replayOverlapSeconds)
      : syncTimestamp;
    let syncLimit = isColdStartSync ? COLD_START_SYNC_LIMIT : DEFAULT_SYNC_LIMIT;

    if (isReliabilityCoreEnabled()) {
      const repair = repairTimelineCheckpoint(DM_TIMELINE_KEY, syncTimestamp);
      targetSince = repair.repairedSinceUnixSeconds;
      if (repair.result === "repaired") {
        incrementReliabilityMetric("sync_checkpoint_repaired");
      }
      if (replayOverlapSeconds > 0) {
        targetSince = Math.max(0, targetSince - replayOverlapSeconds);
      }
      const gap = detectSyncGap(DM_TIMELINE_KEY, targetSince);
      if (gap) {
        incrementReliabilityMetric("sync_gap_detected");
        const backfillRequest = createBackfillRequest(DM_TIMELINE_KEY, targetSince, gap);
        targetSince = backfillRequest.sinceUnixSeconds;
        syncLimit = backfillRequest.limit;
        incrementReliabilityMetric("sync_backfill_requested");
      }
    }

    console.log("Starting message sync from timestamp:", new Date(syncTimestamp * 1000), diagnostics ?? null);
    logAppEvent({
      name: "messaging.transport.sync_start",
      level: "info",
      scope: { feature: "messaging", action: "sync_dm" },
      context: {
        sinceUnixSeconds: syncTimestamp,
        targetSinceUnixSeconds: targetSince,
        replayOverlapSeconds,
        isColdStartSync,
        syncLimit,
        transportOwnerId: diagnostics?.transportOwnerId ?? "none",
        controllerInstanceId: diagnostics?.controllerInstanceId ?? "none",
      },
    });

    const openRelayUrls = pool.connections
      .filter((connection) => connection.status === "open")
      .map((connection) => connection.url);
    const openRelayCount = openRelayUrls.length;
    const configuredRelayCount = pool.connections.length;
    const startedAsPartialColdStart = isColdStartSync && configuredRelayCount > openRelayCount;
    const eoseQuorumRequired = resolveEoseQuorumRequired(openRelayUrls.length);

    let totalSyncedCount = 0;
    let totalErrorCount = 0;
    let aggregateMaxSeenCreatedAtUnixSeconds: number | undefined;
    let passCount = 0;
    let finalized = false;

    const updateSyncProgress = (syncedCount: number, errorCount: number): void => {
      const progress = syncedCount + errorCount > 0
        ? (syncedCount / (syncedCount + errorCount)) * 100
        : 0;
      loadingStateManager.updateProgress("messageSync", progress, `Synced ${syncedCount} messages...`);
      setState((prev) => {
        if (!prev.syncProgress) {
          return prev;
        }
        return {
          ...prev,
          syncProgress: {
            total: syncedCount + errorCount,
            completed: syncedCount,
            errors: errorCount,
          },
        };
      });
    };

    const finalizeSync = (finalParams: Readonly<{
      status: "completed" | "timed_out" | "failed";
      reason?: string;
      shouldAdvanceCheckpoint: boolean;
      lastPassEoseRelayCount: number;
      timedOutWithEvents: boolean;
    }>): void => {
      if (finalized) {
        return;
      }
      finalized = true;

      syncStateRef.current.isSyncing = false;
      syncStateRef.current.lastSyncAt = new Date();
      if (finalParams.status !== "failed") {
        if (isColdStartSync) {
          syncStateRef.current.coldStartPartialCoverageDetected = startedAsPartialColdStart;
          syncStateRef.current.coldStartHistoricalBackfillRelayCount = startedAsPartialColdStart
            ? openRelayCount
            : null;
        } else {
          const replayingFromEpoch = Boolean(since) && Math.floor(since.getTime() / 1000) <= COLD_START_FULL_HISTORY_SINCE_UNIX_SECONDS;
          if (replayingFromEpoch && syncStateRef.current.coldStartPartialCoverageDetected) {
            const previousBackfillRelayCount = typeof syncStateRef.current.coldStartHistoricalBackfillRelayCount === "number"
              ? syncStateRef.current.coldStartHistoricalBackfillRelayCount
              : 0;
            syncStateRef.current.coldStartHistoricalBackfillRelayCount = Math.max(previousBackfillRelayCount, openRelayCount);
            if (openRelayCount >= configuredRelayCount) {
              syncStateRef.current.coldStartPartialCoverageDetected = false;
              syncStateRef.current.coldStartHistoricalBackfillRelayCount = null;
            }
          }
        }
      }

      let checkpointUpdatedToUnixSeconds: number | undefined;
      const hasEventEvidenceFrontier = typeof aggregateMaxSeenCreatedAtUnixSeconds === "number";
      const shouldAdvanceCheckpointFromEvidence = finalParams.status === "timed_out" && hasEventEvidenceFrontier;
      const shouldAdvanceCheckpoint = finalParams.shouldAdvanceCheckpoint || shouldAdvanceCheckpointFromEvidence;

      if (isReliabilityCoreEnabled() && shouldAdvanceCheckpoint) {
        checkpointUpdatedToUnixSeconds = typeof aggregateMaxSeenCreatedAtUnixSeconds === "number"
          ? Math.max(syncTimestamp, aggregateMaxSeenCreatedAtUnixSeconds)
          : syncTimestamp;
        updateTimelineCheckpoint(DM_TIMELINE_KEY, checkpointUpdatedToUnixSeconds);
        void appendCanonicalSyncCheckpointEvent({
          accountPublicKeyHex: myPublicKeyHex,
          timelineKey: DM_TIMELINE_KEY,
          lastProcessedAtUnixSeconds: checkpointUpdatedToUnixSeconds,
          idempotencySuffix: `${syncTimestamp}:${checkpointUpdatedToUnixSeconds}:${passCount}`,
          source: "relay_sync",
        });
        if (shouldAdvanceCheckpointFromEvidence) {
          incrementReliabilityMetric("sync_checkpoint_repaired");
        }
      }
      markReliabilitySyncCompleted();

      loadingStateManager.complete("messageSync");
      setState((prev) => ({
        ...prev,
        syncProgress: undefined,
      }));

      const completedAtUnixMs = Date.now();
      const syncDurationMs = completedAtUnixMs - syncStartedAtUnixMs;
      const shouldLogTiming = isInitialAutomaticSync
        || finalParams.status !== "completed"
        || totalSyncedCount > 0
        || syncDurationMs >= SYNC_DURATION_LOG_THRESHOLD_MS;
      if (shouldLogTiming) {
        logAppEvent({
          name: "messaging.transport.sync_timing",
          level: finalParams.status === "completed" ? "info" : "warn",
          scope: { feature: "messaging", action: "sync_dm" },
          context: {
            status: finalParams.status,
            reason: finalParams.reason ?? null,
            isInitialAutomaticSync,
            syncDurationMs,
            firstEventDelayMs: null,
            firstEoseDelayMs: null,
            syncedCount: totalSyncedCount,
            errorCount: totalErrorCount,
            openRelayCount: openRelayUrls.length,
            eoseRelayCount: finalParams.lastPassEoseRelayCount,
            eoseQuorumRequired,
            timedOutWithEvents: finalParams.timedOutWithEvents,
            isColdStartSync,
            syncLimit,
            paginationPassCount: passCount,
            sinceUnixSeconds: syncTimestamp,
            targetSinceUnixSeconds: targetSince,
            transportOwnerId: diagnostics?.transportOwnerId ?? "none",
            controllerInstanceId: diagnostics?.controllerInstanceId ?? "none",
          },
        });
      }

      console.log(`Sync completed: ${totalSyncedCount} messages synced, ${totalErrorCount} errors`, diagnostics ?? null);
      logAppEvent({
        name: "messaging.transport.sync_complete",
        level: finalParams.status === "completed" ? "info" : "warn",
        scope: { feature: "messaging", action: "sync_dm" },
        context: {
          status: finalParams.status,
          syncedCount: totalSyncedCount,
          errorCount: totalErrorCount,
          paginationPassCount: passCount,
          transportOwnerId: diagnostics?.transportOwnerId ?? "none",
          controllerInstanceId: diagnostics?.controllerInstanceId ?? "none",
        },
      });
    };

    const startSyncPass = (untilUnixSeconds?: number): void => {
      if (finalized) {
        return;
      }

      const syncSubId = generateSubscriptionId();
      passCount += 1;
      const passStartedAtUnixMs = Date.now();

      const syncFilters: ReadonlyArray<NostrFilter> = [
        {
          kinds: [4, 1059],
          "#p": [myPublicKeyHex],
          since: targetSince,
          limit: syncLimit,
          ...(typeof untilUnixSeconds === "number" ? { until: untilUnixSeconds } : {}),
        },
        {
          // Backfill self-authored kind-4 messages for cross-device sent history.
          kinds: [4],
          authors: [myPublicKeyHex],
          since: targetSince,
          limit: syncLimit,
          ...(typeof untilUnixSeconds === "number" ? { until: untilUnixSeconds } : {}),
        },
      ];

      let passSyncedCount = 0;
      let passErrorCount = 0;
      let passCompleted = false;
      const seenEventIds = new Set<string>();
      const eoseRelayUrls = new Set<string>();
      let passMaxSeenCreatedAtUnixSeconds: number | undefined;
      let passMinSeenCreatedAtUnixSeconds: number | undefined;
      let firstEventSeenAtUnixMs: number | undefined;
      let firstEoseSeenAtUnixMs: number | undefined;
      const syncTimeoutRef: { current?: ReturnType<typeof setTimeout> } = {};
      const progressIntervalRef: { current?: ReturnType<typeof setInterval> } = {};
      const unsubscribeRef: { current?: () => void } = {};

      const completePass = (passParams: Readonly<{
        status: "completed" | "timed_out" | "failed";
        reason?: string;
        shouldAdvanceCheckpoint: boolean;
      }>): void => {
        if (passCompleted) {
          return;
        }
        passCompleted = true;

        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
        unsubscribeRef.current?.();
        pool.sendToOpen(JSON.stringify(["CLOSE", syncSubId]));

        totalSyncedCount += passSyncedCount;
        totalErrorCount += passErrorCount;
        if (typeof passMaxSeenCreatedAtUnixSeconds === "number") {
          aggregateMaxSeenCreatedAtUnixSeconds = Math.max(
            aggregateMaxSeenCreatedAtUnixSeconds ?? 0,
            passMaxSeenCreatedAtUnixSeconds,
          );
        }

        const passDurationMs = Date.now() - passStartedAtUnixMs;
        const passFirstEventDelayMs = typeof firstEventSeenAtUnixMs === "number"
          ? firstEventSeenAtUnixMs - passStartedAtUnixMs
          : null;
        const passFirstEoseDelayMs = typeof firstEoseSeenAtUnixMs === "number"
          ? firstEoseSeenAtUnixMs - passStartedAtUnixMs
          : null;
        const timedOutWithEvents = passParams.status === "timed_out" && passSyncedCount > 0;

        deliveryDiagnosticsStore.completeSync({
          status: passParams.status,
          reason: passParams.reason,
          checkpointUpdatedToUnixSeconds: undefined,
        });

        logAppEvent({
          name: "messaging.transport.sync_pass_complete",
          level: passParams.status === "completed" ? "info" : "warn",
          scope: { feature: "messaging", action: "sync_dm" },
          context: {
            passNumber: passCount,
            status: passParams.status,
            reason: passParams.reason ?? null,
            syncedCount: passSyncedCount,
            errorCount: passErrorCount,
            syncDurationMs: passDurationMs,
            firstEventDelayMs: passFirstEventDelayMs,
            firstEoseDelayMs: passFirstEoseDelayMs,
            untilUnixSeconds: untilUnixSeconds ?? null,
            targetSinceUnixSeconds: targetSince,
            transportOwnerId: diagnostics?.transportOwnerId ?? "none",
            controllerInstanceId: diagnostics?.controllerInstanceId ?? "none",
          },
        });

        const minSeenCreatedAtUnixSeconds = passMinSeenCreatedAtUnixSeconds;
        const shouldPaginateColdStart = (
          isColdStartSync
          && passParams.status === "completed"
          && passSyncedCount >= syncLimit
          && typeof minSeenCreatedAtUnixSeconds === "number"
          && passCount < COLD_START_PAGINATION_MAX_PASSES
          && minSeenCreatedAtUnixSeconds > (targetSince + 1)
        );

        if (shouldPaginateColdStart) {
          const nextUntilUnixSeconds = Math.max(targetSince + 1, minSeenCreatedAtUnixSeconds - 1);
          logAppEvent({
            name: "messaging.transport.sync_pagination_pass",
            level: "info",
            scope: { feature: "messaging", action: "sync_dm" },
            context: {
              passNumber: passCount + 1,
              previousUntilUnixSeconds: untilUnixSeconds ?? null,
              nextUntilUnixSeconds,
              targetSinceUnixSeconds: targetSince,
              lastPassSyncedCount: passSyncedCount,
              syncLimit,
              transportOwnerId: diagnostics?.transportOwnerId ?? "none",
              controllerInstanceId: diagnostics?.controllerInstanceId ?? "none",
            },
          });
          startSyncPass(nextUntilUnixSeconds);
          return;
        }

        finalizeSync({
          status: passParams.status,
          reason: passParams.reason,
          shouldAdvanceCheckpoint: passParams.shouldAdvanceCheckpoint,
          lastPassEoseRelayCount: eoseRelayUrls.size,
          timedOutWithEvents,
        });
      };

      deliveryDiagnosticsStore.startSync({
        subId: syncSubId,
        sinceUnixSeconds: targetSince,
        openRelayUrls,
      });

      pool.sendToOpen(JSON.stringify(["REQ", syncSubId, ...syncFilters]));

      unsubscribeRef.current = pool.subscribeToMessages(({ url, message }) => {
        try {
          const parsed = JSON.parse(message);
          if (!Array.isArray(parsed) || parsed.length < 2) {
            return;
          }
          if (parsed[0] === "EVENT" && parsed[1] === syncSubId && parsed[2] && typeof parsed[2] === "object") {
            const event = parsed[2] as { id?: string; created_at?: number };
            if (typeof event.id === "string" && !seenEventIds.has(event.id)) {
              seenEventIds.add(event.id);
              passSyncedCount += 1;
              if (typeof firstEventSeenAtUnixMs !== "number") {
                firstEventSeenAtUnixMs = Date.now();
              }
              if (typeof event.created_at === "number") {
                passMaxSeenCreatedAtUnixSeconds = Math.max(passMaxSeenCreatedAtUnixSeconds ?? 0, event.created_at);
                passMinSeenCreatedAtUnixSeconds = Math.min(passMinSeenCreatedAtUnixSeconds ?? event.created_at, event.created_at);
              }
              deliveryDiagnosticsStore.markSyncEvent({
                id: event.id,
                created_at: typeof event.created_at === "number" ? event.created_at : targetSince,
              });
              updateSyncProgress(totalSyncedCount + passSyncedCount, totalErrorCount + passErrorCount);
              if (typeof onIncomingEvent === "function") {
                void onIncomingEvent(parsed[2], url, "relay_sync");
              }
            }
            return;
          }
          if (parsed[0] === "EOSE" && parsed[1] === syncSubId) {
            if (typeof firstEoseSeenAtUnixMs !== "number") {
              firstEoseSeenAtUnixMs = Date.now();
            }
            eoseRelayUrls.add(url);
            deliveryDiagnosticsStore.markSyncEose(url);
            if (eoseRelayUrls.size >= eoseQuorumRequired) {
              completePass({
                status: "completed",
                reason: eoseRelayUrls.size < openRelayUrls.length ? "eose_quorum_reached" : undefined,
                shouldAdvanceCheckpoint: true,
              });
            }
          }
        } catch (error) {
          passErrorCount += 1;
          updateSyncProgress(totalSyncedCount + passSyncedCount, totalErrorCount + passErrorCount);
          completePass({
            status: "failed",
            reason: error instanceof Error ? error.message : String(error),
            shouldAdvanceCheckpoint: false,
          });
        }
      });

      syncTimeoutRef.current = setTimeout(() => {
        completePass({
          status: "timed_out",
          reason: "Sync timed out before all relays reached EOSE.",
          shouldAdvanceCheckpoint: false,
        });
      }, 10_000);

      progressIntervalRef.current = setInterval(() => {
        updateSyncProgress(totalSyncedCount + passSyncedCount, totalErrorCount + passErrorCount);
      }, 500);
    };

    startSyncPass(isColdStartSync ? Math.floor(Date.now() / 1000) : undefined);
  } catch (error) {
    console.error("Failed to sync missed messages:", error);
    syncStateRef.current.isSyncing = false;
    loadingStateManager.complete("messageSync");

    setState((prev) => ({
      ...prev,
      syncProgress: undefined,
    }));
    deliveryDiagnosticsStore.completeSync({
      status: "failed",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
};
