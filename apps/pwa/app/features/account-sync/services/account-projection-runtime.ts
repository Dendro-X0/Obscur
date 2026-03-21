"use client";

import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { RelayPoolLike } from "@/app/features/relays/lib/nostr-core-relay";
import { logAppEvent } from "@/app/shared/log-app-event";
import { getActiveProfileIdSafe } from "@/app/features/profiles/services/profile-scope";
import type {
  AccountEvent,
  AccountProjectionRuntimeSnapshot,
  BootstrapReport,
  DriftReport,
} from "../account-event-contracts";
import { accountEventStore } from "./account-event-store";
import { replayAccountEvents } from "./account-event-reducer";
import { buildBootstrapAccountEvents } from "./account-event-bootstrap-service";
import { createDriftReport, getLatestDriftReport } from "./account-sync-drift-detector";
import { encryptedAccountBackupService } from "./encrypted-account-backup-service";

type Listener = (snapshot: AccountProjectionRuntimeSnapshot) => void;

const listeners = new Set<Listener>();
const inflightBootstraps = new Map<string, Promise<AccountProjectionRuntimeSnapshot>>();
const REPLAY_COALESCE_DELAY_MS = 35;

type ReplayQueueEntry = {
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
  dirty: boolean;
  deferredReplayCount: number;
  params: Readonly<{ profileId: string; accountPublicKeyHex: PublicKeyHex }>;
  promise: Promise<AccountProjectionRuntimeSnapshot>;
  resolve: (value: AccountProjectionRuntimeSnapshot) => void;
  reject: (reason?: unknown) => void;
};

const replayQueue = new Map<string, ReplayQueueEntry>();

const createDefaultSnapshot = (): AccountProjectionRuntimeSnapshot => ({
  profileId: null,
  accountPublicKeyHex: null,
  projection: null,
  phase: "idle",
  status: "pending",
  accountProjectionReady: false,
  driftStatus: "unknown",
  updatedAtUnixMs: Date.now(),
});

let currentSnapshot: AccountProjectionRuntimeSnapshot = createDefaultSnapshot();

const emit = (): void => {
  listeners.forEach((listener) => listener(currentSnapshot));
};

const setSnapshot = (next: AccountProjectionRuntimeSnapshot): void => {
  currentSnapshot = next;
  emit();
};

const patchSnapshot = (patch: Partial<AccountProjectionRuntimeSnapshot>): void => {
  setSnapshot({
    ...currentSnapshot,
    ...patch,
    updatedAtUnixMs: Date.now(),
  });
};

const makeBootstrapKey = (profileId: string, accountPublicKeyHex: string): string => `${profileId}:${accountPublicKeyHex}`;

const runReplayQueueEntry = async (key: string): Promise<void> => {
  const entry = replayQueue.get(key);
  if (!entry) {
    return;
  }
  if (entry.inFlight) {
    entry.dirty = true;
    return;
  }
  entry.inFlight = true;
  entry.timer = null;
  try {
    const snapshot = await accountProjectionRuntime.replay(entry.params);
    if (entry.dirty) {
      entry.dirty = false;
      entry.inFlight = false;
      entry.deferredReplayCount += 1;
      entry.timer = setTimeout(() => {
        void runReplayQueueEntry(key);
      }, REPLAY_COALESCE_DELAY_MS);
      if (entry.deferredReplayCount === 1 || entry.deferredReplayCount % 10 === 0) {
        logAppEvent({
          name: "account_projection.replay_backpressure_yield",
          level: "warn",
          scope: { feature: "account_sync", action: "projection_replay" },
          context: {
            profileId: entry.params.profileId,
            accountPublicKeyHex: entry.params.accountPublicKeyHex.slice(0, 16),
            deferredReplayCount: entry.deferredReplayCount,
            coalesceDelayMs: REPLAY_COALESCE_DELAY_MS,
          },
        });
      }
      return;
    }
    entry.resolve(snapshot);
    replayQueue.delete(key);
  } catch (error) {
    entry.reject(error);
    replayQueue.delete(key);
  } finally {
    const latest = replayQueue.get(key);
    if (latest === entry) {
      entry.inFlight = false;
    }
  }
};

const queueReplay = (params: Readonly<{ profileId: string; accountPublicKeyHex: PublicKeyHex }>): Promise<AccountProjectionRuntimeSnapshot> => {
  const key = makeBootstrapKey(params.profileId, params.accountPublicKeyHex);
  const existing = replayQueue.get(key);
  if (existing) {
    existing.params = params;
    if (existing.inFlight) {
      existing.dirty = true;
    } else {
      if (existing.timer) {
        clearTimeout(existing.timer);
      }
      existing.timer = setTimeout(() => {
        void runReplayQueueEntry(key);
      }, REPLAY_COALESCE_DELAY_MS);
    }
    return existing.promise;
  }

  let resolvePromise!: (value: AccountProjectionRuntimeSnapshot) => void;
  let rejectPromise!: (reason?: unknown) => void;
  const promise = new Promise<AccountProjectionRuntimeSnapshot>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const entry: ReplayQueueEntry = {
    timer: setTimeout(() => {
      void runReplayQueueEntry(key);
    }, REPLAY_COALESCE_DELAY_MS),
    inFlight: false,
    dirty: false,
    deferredReplayCount: 0,
    params,
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
  replayQueue.set(key, entry);
  return promise;
};

const hasBootstrapMarker = (
  events: ReadonlyArray<Readonly<{ sequence: number; event: AccountEvent }>>
): boolean => events.some((entry) => entry.event.type === "BOOTSTRAP_IMPORT_APPLIED");

const sanitizeMessagePreview = (value: string): string => {
  // Keep full plaintext payload for deterministic timeline replay.
  // Conversation preview clipping is applied by projection reducers/UI.
  return value.replace(/\s+/g, " ").trim();
};

const mapDriftStatus = (report: DriftReport | null): AccountProjectionRuntimeSnapshot["driftStatus"] => {
  if (!report) {
    return "unknown";
  }
  return report.criticalDriftCount > 0 || report.nonCriticalDriftCount > 0
    ? "drifted"
    : "clean";
};

type ContactEventType =
  | "CONTACT_REQUEST_RECEIVED"
  | "CONTACT_REQUEST_SENT"
  | "CONTACT_ACCEPTED"
  | "CONTACT_DECLINED"
  | "CONTACT_CANCELED"
  | "CONTACT_REMOVED";

export const accountProjectionRuntime = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): AccountProjectionRuntimeSnapshot {
    return currentSnapshot;
  },
  reset(): void {
    replayQueue.forEach((entry) => {
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      entry.reject(new Error("Projection runtime reset"));
    });
    replayQueue.clear();
    setSnapshot(createDefaultSnapshot());
  },
  async appendCanonicalEvents(params: Readonly<{
    profileId: string;
    accountPublicKeyHex: PublicKeyHex;
    events: ReadonlyArray<AccountEvent>;
  }>): Promise<void> {
    if (params.events.length === 0) {
      return;
    }
    const appendResult = await accountEventStore.appendAccountEvents({
      profileId: params.profileId,
      accountPublicKeyHex: params.accountPublicKeyHex,
      events: params.events,
    });
    logAppEvent({
      name: "account_projection.append_events",
      level: "info",
      scope: { feature: "account_sync", action: "projection_ingest" },
      context: {
        profileId: params.profileId,
        accountPublicKeyHex: params.accountPublicKeyHex.slice(0, 16),
        acceptedCount: appendResult.appendedCount,
        dedupeCount: appendResult.dedupeCount,
      },
    });
    if (appendResult.appendedCount <= 0) {
      // Dedupe-only append should not churn runtime ownership by forcing a
      // replay that cannot change projection state.
      return;
    }
    if (
      currentSnapshot.profileId === params.profileId
      && currentSnapshot.accountPublicKeyHex === params.accountPublicKeyHex
    ) {
      await queueReplay({
        profileId: params.profileId,
        accountPublicKeyHex: params.accountPublicKeyHex,
      });
    }
  },
  async replay(params: Readonly<{
    profileId: string;
    accountPublicKeyHex: PublicKeyHex;
  }>): Promise<AccountProjectionRuntimeSnapshot> {
    patchSnapshot({
      profileId: params.profileId,
      accountPublicKeyHex: params.accountPublicKeyHex,
      phase: "replaying_event_log",
      status: "pending",
      accountProjectionReady: false,
      lastError: undefined,
    });
    const startedAtUnixMs = Date.now();
    const events = await accountEventStore.loadEvents({
      profileId: params.profileId,
      accountPublicKeyHex: params.accountPublicKeyHex,
    });
    const projection = replayAccountEvents(events);
    const driftReport = projection
      ? createDriftReport({
        publicKeyHex: params.accountPublicKeyHex,
        projection,
      })
      : null;
    const readySnapshot: AccountProjectionRuntimeSnapshot = {
      profileId: params.profileId,
      accountPublicKeyHex: params.accountPublicKeyHex,
      projection,
      phase: "ready",
      status: "ready",
      accountProjectionReady: true,
      driftStatus: mapDriftStatus(driftReport),
      driftReport: driftReport ?? undefined,
      updatedAtUnixMs: Date.now(),
    };
    setSnapshot(readySnapshot);
    logAppEvent({
      name: "account_projection.replay_complete",
      level: "info",
      scope: { feature: "account_sync", action: "projection_replay" },
      context: {
        profileId: params.profileId,
        accountPublicKeyHex: params.accountPublicKeyHex.slice(0, 16),
        eventCount: events.length,
        replayDurationMs: Date.now() - startedAtUnixMs,
        driftStatus: readySnapshot.driftStatus,
      },
    });
    return readySnapshot;
  },
  async bootstrapAndReplay(params: Readonly<{
    profileId?: string;
    accountPublicKeyHex: PublicKeyHex;
    privateKeyHex: PrivateKeyHex;
    pool: RelayPoolLike & Readonly<{
      sendToOpen: (payload: string) => void;
      subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
    }>;
  }>): Promise<AccountProjectionRuntimeSnapshot> {
    const profileId = params.profileId ?? getActiveProfileIdSafe();
    const bootstrapKey = makeBootstrapKey(profileId, params.accountPublicKeyHex);
    const existing = inflightBootstraps.get(bootstrapKey);
    if (existing) {
      return existing;
    }
    const run = (async () => {
      patchSnapshot({
        profileId,
        accountPublicKeyHex: params.accountPublicKeyHex,
        phase: "bootstrapping",
        status: "pending",
        accountProjectionReady: false,
        lastError: undefined,
      });
      try {
        const existingEvents = await accountEventStore.loadEvents({
          profileId,
          accountPublicKeyHex: params.accountPublicKeyHex,
        });
        let bootstrapReport: BootstrapReport | undefined;
        if (!hasBootstrapMarker(existingEvents)) {
          const backupResult = await encryptedAccountBackupService.fetchLatestEncryptedAccountBackupPayload({
            publicKeyHex: params.accountPublicKeyHex,
            privateKeyHex: params.privateKeyHex,
            pool: params.pool,
          });
          const bootstrapEvents = await buildBootstrapAccountEvents({
            profileId,
            accountPublicKeyHex: params.accountPublicKeyHex,
            backupPayload: backupResult.payload,
          });
          const appendResult = await accountEventStore.appendAccountEvents({
            profileId,
            accountPublicKeyHex: params.accountPublicKeyHex,
            events: bootstrapEvents.events,
          });
          bootstrapReport = {
            sourceCounts: bootstrapEvents.sourceCounts,
            dedupeCount: appendResult.dedupeCount,
            importApplied: appendResult.appendedCount > 0,
          };
          logAppEvent({
            name: "account_projection.bootstrap_import",
            level: "info",
            scope: { feature: "account_sync", action: "bootstrap_import" },
            context: {
              profileId,
              accountPublicKeyHex: params.accountPublicKeyHex.slice(0, 16),
              hasBackupPayload: Boolean(backupResult.payload),
              appendedCount: appendResult.appendedCount,
              dedupeCount: appendResult.dedupeCount,
            },
          });
        }
        const replaySnapshot = await this.replay({
          profileId,
          accountPublicKeyHex: params.accountPublicKeyHex,
        });
        const next = {
          ...replaySnapshot,
          bootstrapReport: bootstrapReport ?? replaySnapshot.bootstrapReport,
          driftReport: replaySnapshot.driftReport ?? getLatestDriftReport() ?? undefined,
          driftStatus: replaySnapshot.driftStatus,
        };
        setSnapshot(next);
        return next;
      } catch (error) {
        const degradedSnapshot: AccountProjectionRuntimeSnapshot = {
          ...createDefaultSnapshot(),
          profileId,
          accountPublicKeyHex: params.accountPublicKeyHex,
          phase: "degraded",
          status: "degraded",
          accountProjectionReady: false,
          driftStatus: "unknown",
          lastError: error instanceof Error ? error.message : String(error),
          updatedAtUnixMs: Date.now(),
        };
        setSnapshot(degradedSnapshot);
        logAppEvent({
          name: "account_projection.bootstrap_failed",
          level: "error",
          scope: { feature: "account_sync", action: "bootstrap_import" },
          context: {
            profileId,
            accountPublicKeyHex: params.accountPublicKeyHex.slice(0, 16),
            reason: degradedSnapshot.lastError ?? null,
          },
        });
        return degradedSnapshot;
      } finally {
        inflightBootstraps.delete(bootstrapKey);
      }
    })();
    inflightBootstraps.set(bootstrapKey, run);
    return run;
  },
  createContactEvent(params: Readonly<{
    type: ContactEventType;
    profileId: string;
    accountPublicKeyHex: PublicKeyHex;
    peerPublicKeyHex: PublicKeyHex;
    direction: "incoming" | "outgoing" | "unknown";
    requestEventId?: string;
    idempotencySuffix: string;
    source?: AccountEvent["source"];
  }>): AccountEvent {
    const common = {
      profileId: params.profileId,
      accountPublicKeyHex: params.accountPublicKeyHex,
      peerPublicKeyHex: params.peerPublicKeyHex,
      direction: params.direction,
      source: params.source ?? "legacy_bridge",
      observedAtUnixMs: Date.now(),
      eventId: `${params.type}:${params.idempotencySuffix}`,
      idempotencyKey: `${params.type}:${params.accountPublicKeyHex}:${params.peerPublicKeyHex}:${params.idempotencySuffix}`,
    } as const;

    if (params.type === "CONTACT_REMOVED") {
      return {
        ...common,
        type: "CONTACT_REMOVED",
      };
    }

    return {
      ...common,
      type: params.type,
      requestEventId: params.requestEventId,
    };
  },
  createDmEvent(params: Readonly<{
    type: "DM_RECEIVED" | "DM_SENT_CONFIRMED";
    profileId: string;
    accountPublicKeyHex: PublicKeyHex;
    peerPublicKeyHex: PublicKeyHex;
    conversationId: string;
    messageId: string;
    eventCreatedAtUnixSeconds: number;
    plaintextPreview: string;
    idempotencySuffix: string;
    source?: AccountEvent["source"];
  }>): AccountEvent {
    return {
      type: params.type,
      profileId: params.profileId,
      accountPublicKeyHex: params.accountPublicKeyHex,
      peerPublicKeyHex: params.peerPublicKeyHex,
      conversationId: params.conversationId,
      messageId: params.messageId,
      eventCreatedAtUnixSeconds: params.eventCreatedAtUnixSeconds,
      plaintextPreview: sanitizeMessagePreview(params.plaintextPreview),
      source: params.source ?? "legacy_bridge",
      observedAtUnixMs: Date.now(),
      eventId: `${params.type}:${params.messageId}`,
      idempotencyKey: `${params.type}:${params.accountPublicKeyHex}:${params.messageId}:${params.idempotencySuffix}`,
    };
  },
  createSyncCheckpointEvent(params: Readonly<{
    profileId: string;
    accountPublicKeyHex: PublicKeyHex;
    timelineKey: string;
    lastProcessedAtUnixSeconds: number;
    idempotencySuffix: string;
    source?: AccountEvent["source"];
  }>): AccountEvent {
    return {
      type: "SYNC_CHECKPOINT_ADVANCED",
      profileId: params.profileId,
      accountPublicKeyHex: params.accountPublicKeyHex,
      timelineKey: params.timelineKey,
      lastProcessedAtUnixSeconds: params.lastProcessedAtUnixSeconds,
      source: params.source ?? "legacy_bridge",
      observedAtUnixMs: Date.now(),
      eventId: `SYNC_CHECKPOINT_ADVANCED:${params.timelineKey}:${params.idempotencySuffix}`,
      idempotencyKey: `SYNC_CHECKPOINT_ADVANCED:${params.accountPublicKeyHex}:${params.timelineKey}:${params.idempotencySuffix}`,
    };
  },
  createDecryptFailedEvent(params: Readonly<{
    profileId: string;
    accountPublicKeyHex: PublicKeyHex;
    peerPublicKeyHex: PublicKeyHex;
    messageId: string;
    reason: string;
    idempotencySuffix: string;
    source?: AccountEvent["source"];
  }>): AccountEvent {
    return {
      type: "DM_DECRYPT_FAILED_QUARANTINED",
      profileId: params.profileId,
      accountPublicKeyHex: params.accountPublicKeyHex,
      peerPublicKeyHex: params.peerPublicKeyHex,
      messageId: params.messageId,
      reason: params.reason,
      source: params.source ?? "legacy_bridge",
      observedAtUnixMs: Date.now(),
      eventId: `DM_DECRYPT_FAILED_QUARANTINED:${params.messageId}`,
      idempotencyKey: `DM_DECRYPT_FAILED_QUARANTINED:${params.accountPublicKeyHex}:${params.messageId}:${params.idempotencySuffix}`,
    };
  },
};
