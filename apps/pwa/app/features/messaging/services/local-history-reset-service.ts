"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { messagingDB } from "@dweb/storage/indexed-db";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { getActiveProfileIdSafe } from "@/app/features/profiles/services/profile-scope";
import { accountProjectionRuntime } from "@/app/features/account-sync/services/account-projection-runtime";
import { accountSyncStatusStore } from "@/app/features/account-sync/services/account-sync-status-store";
import {
  encryptedAccountBackupServiceInternals,
} from "@/app/features/account-sync/services/encrypted-account-backup-service";
import {
  accountEventStoreInternals,
} from "@/app/features/account-sync/services/account-event-store";
import { openMessageDb } from "@/app/features/messaging/lib/open-message-db";
import { purgeLocalMediaCache } from "@/app/features/vault/services/local-media-store";

type LocalHistoryResetDependencies = Readonly<{
  purgeLocalMediaCache: () => Promise<void>;
  clearMessagingStores: () => Promise<number>;
  clearLegacyMessageQueueStores: () => Promise<number>;
  clearAccountEventLogStore: () => Promise<number>;
  resetProjectionRuntime: () => void;
  resetSyncStatusSnapshot: (publicKeyHex: PublicKeyHex | null) => void;
  resetBackupEventOrdering: () => void;
}>;

export type LocalHistoryResetReport = Readonly<{
  profileId: string;
  publicKeyHex: PublicKeyHex | null;
  removedLocalStorageKeyCount: number;
  clearedIndexedDbStoreCount: number;
  warnings: ReadonlyArray<string>;
}>;

const GLOBAL_STORAGE_KEYS = new Set<string>([
  "dweb.nostr.pwa.chatState",
  "obscur.account_sync.drift_report.v1",
  "obscur-pending-voice-call-request",
]);

const GLOBAL_STORAGE_PREFIXES: ReadonlyArray<string> = [
  "obscur.account_sync.recovery_snapshot.v1.",
  "obscur:groups:join-request-pending:v1",
];

const SCOPED_STORAGE_BASE_KEYS = new Set<string>([
  "dweb.nostr.pwa.chatState",
  "obscur.account_sync.status.v1",
  "obscur.discovery.contact_request_outbox.v1",
  "obscur.messaging.failed_incoming_events.v1",
  "obscur.messaging.message_delete_tombstones.v1",
  "obscur.messaging.peer_relay_evidence.v1",
  "obscur.messaging.request_event_tombstones.v1",
  "obscur.messaging.request_flow_evidence.v1",
  "obscur.messaging.sync_checkpoints.v1",
  "obscur.vault.local_media_index",
]);

const SCOPED_STORAGE_PREFIXES: ReadonlyArray<string> = [
  "dweb.nostr.pwa.chatState.v2.",
  "dweb.nostr.pwa.last-seen.",
  "obscur-last-chat-",
  "obscur.group.membership_ledger.v1.",
  "obscur.group.tombstones.v1.",
  "obscur.transport_queue.v1.",
];

const LEGACY_PUBLIC_KEY_PREFIXES: ReadonlyArray<string> = [
  "dweb.nostr.pwa.chatState.v2.",
  "dweb.nostr.pwa.last-seen.",
  "obscur.account_sync.recovery_snapshot.v1.",
  "obscur.group.membership_ledger.v1.",
  "obscur.group.tombstones.v1.",
];

const clearObjectStore = async (db: IDBDatabase, storeName: string): Promise<void> => (
  new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Failed to clear object store: ${storeName}`));
  })
);

const clearMessagingStores = async (): Promise<number> => {
  const stores: ReadonlyArray<string> = ["messages", "conversations", "chatState"];
  let cleared = 0;
  for (const storeName of stores) {
    try {
      await messagingDB.clear(storeName);
      cleared += 1;
    } catch {
      // Best-effort per store.
    }
  }
  return cleared;
};

const clearLegacyMessageQueueStores = async (): Promise<number> => {
  const db = await openMessageDb();
  let cleared = 0;
  try {
    const stores: ReadonlyArray<string> = ["messages", "conversations", "queue"];
    for (const storeName of stores) {
      if (!db.objectStoreNames.contains(storeName)) {
        continue;
      }
      await clearObjectStore(db, storeName);
      cleared += 1;
    }
  } finally {
    db.close();
  }
  return cleared;
};

const clearAccountEventLogStore = async (): Promise<number> => {
  const db = await accountEventStoreInternals.openDb();
  try {
    if (!db.objectStoreNames.contains(accountEventStoreInternals.EVENTS_STORE)) {
      return 0;
    }
    await clearObjectStore(db, accountEventStoreInternals.EVENTS_STORE);
    return 1;
  } finally {
    db.close();
  }
};

const defaultDependencies: LocalHistoryResetDependencies = {
  purgeLocalMediaCache,
  clearMessagingStores,
  clearLegacyMessageQueueStores,
  clearAccountEventLogStore,
  resetProjectionRuntime: () => {
    accountProjectionRuntime.reset();
  },
  resetSyncStatusSnapshot: (publicKeyHex) => {
    accountSyncStatusStore.resetSnapshot(publicKeyHex);
  },
  resetBackupEventOrdering: () => {
    encryptedAccountBackupServiceInternals.resetBackupEventOrderingState();
  },
};

const shouldRemoveLocalHistoryStorageKey = (params: Readonly<{
  key: string;
  profileId: string;
  publicKeyHex: PublicKeyHex | null;
}>): boolean => {
  if (GLOBAL_STORAGE_KEYS.has(params.key)) {
    return true;
  }
  if (GLOBAL_STORAGE_PREFIXES.some((prefix) => params.key.startsWith(prefix))) {
    return true;
  }

  const scopedSuffix = `::${params.profileId}`;
  if (params.key.endsWith(scopedSuffix)) {
    const baseKey = params.key.slice(0, params.key.length - scopedSuffix.length);
    if (SCOPED_STORAGE_BASE_KEYS.has(baseKey)) {
      return true;
    }
    if (SCOPED_STORAGE_PREFIXES.some((prefix) => baseKey.startsWith(prefix))) {
      return true;
    }
  }

  if (!params.publicKeyHex) {
    return false;
  }
  return LEGACY_PUBLIC_KEY_PREFIXES.some((prefix) => params.key === `${prefix}${params.publicKeyHex}`);
};

const removeLocalHistoryStorageKeys = (params: Readonly<{
  profileId: string;
  publicKeyHex: PublicKeyHex | null;
}>): number => {
  if (typeof window === "undefined") {
    return 0;
  }
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    keys.push(key);
  }
  let removed = 0;
  keys.forEach((key) => {
    if (!shouldRemoveLocalHistoryStorageKey({ key, profileId: params.profileId, publicKeyHex: params.publicKeyHex })) {
      return;
    }
    window.localStorage.removeItem(key);
    removed += 1;
  });
  return removed;
};

export const resetLocalHistoryKeepingIdentity = async (
  params?: Readonly<{
    profileId?: string;
    publicKeyHex?: string | PublicKeyHex | null;
  }>,
  dependencies: LocalHistoryResetDependencies = defaultDependencies
): Promise<LocalHistoryResetReport> => {
  const profileId = params?.profileId?.trim() || getActiveProfileIdSafe();
  const normalizedPublicKeyHex = normalizePublicKeyHex(params?.publicKeyHex ?? undefined);
  const publicKeyHex = normalizedPublicKeyHex ?? null;
  const warnings: string[] = [];

  const removedLocalStorageKeyCount = removeLocalHistoryStorageKeys({
    profileId,
    publicKeyHex,
  });

  try {
    await dependencies.purgeLocalMediaCache();
  } catch (error) {
    warnings.push(`Local media purge failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const [messagingStoreCount, legacyQueueStoreCount, accountEventStoreCount] = await Promise.all([
    dependencies.clearMessagingStores().catch((error) => {
      warnings.push(`Messaging DB cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }),
    dependencies.clearLegacyMessageQueueStores().catch((error) => {
      warnings.push(`Legacy message queue cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }),
    dependencies.clearAccountEventLogStore().catch((error) => {
      warnings.push(`Account event log cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }),
  ]);

  try {
    dependencies.resetProjectionRuntime();
  } catch (error) {
    warnings.push(`Projection runtime reset failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    dependencies.resetBackupEventOrdering();
  } catch (error) {
    warnings.push(`Backup ordering reset failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    dependencies.resetSyncStatusSnapshot(publicKeyHex);
  } catch (error) {
    warnings.push(`Sync status reset failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    profileId,
    publicKeyHex,
    removedLocalStorageKeyCount,
    clearedIndexedDbStoreCount: messagingStoreCount + legacyQueueStoreCount + accountEventStoreCount,
    warnings,
  };
};

export const localHistoryResetServiceInternals = {
  GLOBAL_STORAGE_KEYS,
  GLOBAL_STORAGE_PREFIXES,
  SCOPED_STORAGE_BASE_KEYS,
  SCOPED_STORAGE_PREFIXES,
  LEGACY_PUBLIC_KEY_PREFIXES,
  shouldRemoveLocalHistoryStorageKey,
  removeLocalHistoryStorageKeys,
  clearObjectStore,
  clearMessagingStores,
  clearLegacyMessageQueueStores,
  clearAccountEventLogStore,
};

