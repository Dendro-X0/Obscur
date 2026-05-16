/**
 * Canonical owner: local DM visibility (delete-for-me + mandatory read gate).
 *
 * Replaces ad-hoc wiring across hydrate, projection, tombstones, and account-sync restore.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { TombstoneRecord } from "@dweb/db";
import {
  dbDeleteMessage,
  dbDeleteMessages,
  dbInsertTombstone,
  isTauri,
} from "@dweb/db";
import { messagingDB } from "@dweb/storage/indexed-db";
import { accountEventStore } from "@/app/features/account-sync/services/account-event-store";
import { accountProjectionRuntime } from "@/app/features/account-sync/services/account-projection-runtime";
import type { AccountEvent } from "@/app/features/account-sync/account-event-contracts";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { getResolvedStoragePorts } from "@/app/features/profiles/services/default-storage-ports";
import {
  flushMessageDeleteTombstonesToNativeStore,
  hydrateMessageDeleteTombstonesFromSqlite,
  isMessageDeleteSuppressed,
} from "../services/message-delete-tombstone-store";
import { chatStateStoreService } from "../services/chat-state-store";
import { collectMessageIdentityAliases } from "../services/message-identity-alias-contract";
import { logAppEvent } from "@/app/shared/log-app-event";
import type {
  ExecuteLocalDmDeleteForMeParams,
  LocalDmVisibilityPort,
  LocalDmVisibilityScope,
  MessageLikeWithIdentity,
  PersistLocalDmSuppressionParams,
} from "./contract";

const inflightEnsure = new Map<string, Promise<void>>();
const suppressedByProfile = new Map<string, ReadonlySet<string>>();

const normalizeIds = (ids: ReadonlyArray<string>): ReadonlyArray<string> => {
  const out = new Set<string>();
  ids.forEach((value) => {
    const normalized = value.trim();
    if (normalized.length > 0) {
      out.add(normalized);
    }
  });
  return Array.from(out);
};

const refreshSuppressedCache = (profileId: string, nowMs: number = Date.now()): ReadonlySet<string> => {
  const ids = getResolvedStoragePorts().messageDeleteTombstones.loadSuppressedMessageDeleteIds(nowMs, profileId);
  const set = new Set(ids);
  suppressedByProfile.set(profileId, set);
  return set;
};

const isDmTimelineEvent = (
  event: AccountEvent,
): event is Extract<AccountEvent, { type: "DM_RECEIVED" | "DM_SENT_CONFIRMED" }> => (
  event.type === "DM_RECEIVED" || event.type === "DM_SENT_CONFIRMED"
);

const purgeIndexedDbMessageIdentities = async (deleteIds: ReadonlyArray<string>): Promise<void> => {
  if (deleteIds.length === 0) {
    return;
  }
  await Promise.all(deleteIds.map((deleteId) => (
    messagingDB.delete("messages", deleteId).catch(() => undefined)
  )));
};

const reconcileEventLog = async (params: Readonly<{
  profileId: string;
  accountPublicKeyHex: PublicKeyHex;
  extraMessageIds?: ReadonlyArray<string>;
  replayProjection?: boolean;
}>): Promise<Readonly<{ redactedCount: number; removedEventsAppended: number }>> => {
  const nowMs = Date.now();
  const explicitMessageIds = new Set(refreshSuppressedCache(params.profileId, nowMs));
  (params.extraMessageIds ?? []).forEach((id) => {
    const normalized = id.trim();
    if (normalized.length > 0) {
      explicitMessageIds.add(normalized);
    }
  });

  if (explicitMessageIds.size === 0) {
    return { redactedCount: 0, removedEventsAppended: 0 };
  }

  const loaded = await accountEventStore.loadEvents({
    profileId: params.profileId,
    accountPublicKeyHex: params.accountPublicKeyHex,
  });

  const conversationIdByMessageId = new Map<string, string>();
  const redactIds = new Set<string>(explicitMessageIds);
  loaded.forEach(({ event }) => {
    if (!isDmTimelineEvent(event)) {
      return;
    }
    conversationIdByMessageId.set(event.messageId, event.conversationId);
    const messageId = event.messageId.trim();
    if (explicitMessageIds.has(messageId) || isMessageDeleteSuppressed(messageId, nowMs, params.profileId)) {
      redactIds.add(messageId);
    }
  });

  const { redactedCount } = await accountEventStore.redactDmTimelineEvents({
    profileId: params.profileId,
    accountPublicKeyHex: params.accountPublicKeyHex,
    messageIds: Array.from(redactIds),
  });

  const existingRemovedIds = new Set(
    loaded
      .filter((entry) => entry.event.type === "DM_REMOVED_LOCALLY")
      .map((entry) => (entry.event as Extract<AccountEvent, { type: "DM_REMOVED_LOCALLY" }>).messageId),
  );

  const removalEvents = Array.from(redactIds)
    .filter((messageId) => !existingRemovedIds.has(messageId))
    .map((messageId) => (
      accountProjectionRuntime.createDmRemovedEvent({
        profileId: params.profileId,
        accountPublicKeyHex: params.accountPublicKeyHex,
        messageId,
        conversationId: conversationIdByMessageId.get(messageId) ?? "",
        observedAtUnixMs: nowMs,
        idempotencySuffix: `local_dm_visibility:${messageId}`,
        source: "legacy_bridge",
      })
    ));

  let removedEventsAppended = 0;
  if (removalEvents.length > 0) {
    const appendResult = await accountEventStore.appendAccountEvents({
      profileId: params.profileId,
      accountPublicKeyHex: params.accountPublicKeyHex,
      events: removalEvents,
    });
    removedEventsAppended = appendResult.appendedCount;
  }

  if (redactedCount > 0 || removedEventsAppended > 0) {
    logAppEvent({
      name: "messaging.local_dm_visibility.reconciled",
      level: "info",
      scope: { feature: "messaging", action: "local_dm_visibility" },
      context: {
        profileId: params.profileId,
        redactedCount,
        removedEventsAppended,
        suppressionIdCount: explicitMessageIds.size,
      },
    });
  }

  if (params.replayProjection ?? true) {
    await accountProjectionRuntime.replay({
      profileId: params.profileId,
      accountPublicKeyHex: params.accountPublicKeyHex,
    });
  }

  const redactedIdentityIds = Array.from(redactIds);
  await purgeIndexedDbMessageIdentities(redactedIdentityIds);

  if (isTauri() && redactedIdentityIds.length > 0) {
    await persistNativeSqliteDeletes(params.profileId, redactedIdentityIds, nowMs);
  }

  return { redactedCount, removedEventsAppended };
};

const persistNativeSqliteDeletes = async (
  profileId: string,
  deleteIds: ReadonlyArray<string>,
  deletedAtUnixMs: number,
): Promise<void> => {
  if (deleteIds.length === 0) {
    return;
  }
  try {
    await dbDeleteMessages(deleteIds as string[], profileId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("db_delete_messages")) {
      await Promise.all(deleteIds.map((deleteId) => (
        dbDeleteMessage(deleteId, profileId).catch(() => undefined)
      )));
    }
  }
  await Promise.all(deleteIds.map((deleteId) => {
    const rec: TombstoneRecord = {
      event_id: deleteId,
      profile_id: profileId,
      deleted_at: deletedAtUnixMs,
      deleted_by: "",
    };
    return dbInsertTombstone(rec).catch(() => undefined);
  }));
};

const persistDurableStores = async (params: Readonly<{
  conversationId: string;
  messageIdentityIds: ReadonlyArray<string>;
  profileId: string;
  deletedAtUnixMs: number;
}>): Promise<ReadonlyArray<string>> => {
  const deleteIds = normalizeIds(params.messageIdentityIds);
  if (deleteIds.length === 0) {
    return deleteIds;
  }

  const tombstones = getResolvedStoragePorts().messageDeleteTombstones;
  if (isTauri()) {
    await tombstones.hydrateMessageDeleteTombstonesFromSqlite(params.profileId);
  }

  deleteIds.forEach((deleteId) => {
    tombstones.suppressMessageDeleteTombstone(deleteId, params.deletedAtUnixMs, params.profileId);
  });
  refreshSuppressedCache(params.profileId, params.deletedAtUnixMs);

  // Web + desktop: drop materialized rows so hydrate cannot resurrect deleted history.
  await purgeIndexedDbMessageIdentities(deleteIds);

  if (isTauri()) {
    await flushMessageDeleteTombstonesToNativeStore(params.profileId);
    await persistNativeSqliteDeletes(params.profileId, deleteIds, params.deletedAtUnixMs);
  }

  chatStateStoreService.removeMessageIdentitiesFromAllActiveScopes(
    params.conversationId,
    deleteIds as string[],
  );

  return deleteIds;
};

const runEnsureReady = async (scope: LocalDmVisibilityScope): Promise<void> => {
  const profileId = scope.profileId.trim();
  if (!profileId) {
    return;
  }

  await hydrateMessageDeleteTombstonesFromSqlite(profileId).catch(() => {});
  if (!isTauri()) {
    await getResolvedStoragePorts().messageDeleteTombstones
      .mergeMessageDeleteTombstonesFromIndexedDb(profileId)
      .catch(() => {});
  }
  refreshSuppressedCache(profileId);

  if (scope.accountPublicKeyHex) {
    await reconcileEventLog({
      profileId,
      accountPublicKeyHex: scope.accountPublicKeyHex,
      replayProjection: false,
    });
  }
};

export const localDmVisibilityOwner: LocalDmVisibilityPort = {
  async ensureReady(scope: LocalDmVisibilityScope): Promise<void> {
    const profileId = scope.profileId?.trim();
    if (!profileId) {
      return;
    }
    const existing = inflightEnsure.get(profileId);
    if (existing) {
      await existing;
      return;
    }
    const run = runEnsureReady(scope);
    inflightEnsure.set(profileId, run);
    try {
      await run;
    } finally {
      inflightEnsure.delete(profileId);
    }
  },

  getSuppressedIdentityIds(profileId: string): ReadonlySet<string> {
    const normalized = profileId.trim();
    if (!normalized) {
      return new Set();
    }
    return suppressedByProfile.get(normalized)
      ?? refreshSuppressedCache(normalized);
  },

  filterVisibleMessages<T extends MessageLikeWithIdentity>(
    messages: ReadonlyArray<T>,
    profileId: string,
  ): ReadonlyArray<T> {
    const suppressed = localDmVisibilityOwner.getSuppressedIdentityIds(profileId);
    if (suppressed.size === 0) {
      return messages;
    }
    const nowMs = Date.now();
    return messages.filter((message) => {
      const aliases = collectMessageIdentityAliases(message);
      if (aliases.some((alias) => suppressed.has(alias))) {
        return false;
      }
      return !aliases.some((alias) => isMessageDeleteSuppressed(alias, nowMs, profileId));
    });
  },

  reconcileAccountEventLog: reconcileEventLog,

  async persistSuppressionStores(params: PersistLocalDmSuppressionParams): Promise<ReadonlyArray<string>> {
    const profileId = params.profileId?.trim() || getResolvedProfileId() || "";
    if (!profileId) {
      return normalizeIds(params.messageIdentityIds);
    }
    return persistDurableStores({
      conversationId: params.conversationId,
      messageIdentityIds: params.messageIdentityIds,
      profileId,
      deletedAtUnixMs: params.deletedAtUnixMs ?? Date.now(),
    });
  },

  async executeDeleteForMe(
    params: ExecuteLocalDmDeleteForMeParams & Readonly<{
      replayProjection?: boolean;
      skipEventLogReconcile?: boolean;
    }>,
  ): Promise<ReadonlyArray<string>> {
    const profileId = params.profileId?.trim() || getResolvedProfileId() || "";
    const observedAtUnixMs = params.observedAtUnixMs ?? Date.now();

    if (!profileId) {
      return normalizeIds(params.messageIdentityIds);
    }

    const deleteIds = await persistDurableStores({
      conversationId: params.conversationId,
      messageIdentityIds: params.messageIdentityIds,
      profileId,
      deletedAtUnixMs: observedAtUnixMs,
    });

    if (deleteIds.length === 0) {
      return deleteIds;
    }

    if (params.skipEventLogReconcile) {
      return deleteIds;
    }

    try {
      await localDmVisibilityOwner.reconcileAccountEventLog({
        profileId,
        accountPublicKeyHex: params.accountPublicKeyHex,
        extraMessageIds: deleteIds,
        replayProjection: params.replayProjection ?? true,
      });
    } catch (error) {
      logAppEvent({
        name: "messaging.local_dm_visibility.delete_failed",
        level: "warn",
        scope: { feature: "messaging", action: "delete_for_me" },
        context: {
          conversationIdHint: params.conversationId.slice(0, 32),
          deleteTargetCount: deleteIds.length,
          reason: error instanceof Error ? error.message : String(error),
        },
      });
    }

    return deleteIds;
  },
};
