import type { StoragePorts } from "@/app/features/profiles/types/storage-ports";
import {
  clearMessageDeleteTombstones,
  hydrateMessageDeleteTombstonesFromSqlite,
  isMessageDeleteSuppressed,
  liftMessageDeleteSuppression,
  loadMessageDeleteTombstoneEntries,
  loadSuppressedMessageDeleteIds,
  mergeMessageDeleteTombstonesFromIndexedDb,
  replaceMessageDeleteTombstones,
  suppressMessageDeleteTombstone,
} from "@/app/features/messaging/services/message-delete-tombstone-store";
import { getProfileRuntimeScope } from "./profile-runtime-scope";

/** Default Phase 2 storage ports (production): module-backed tombstone persistence. */
export const DEFAULT_STORAGE_PORTS: StoragePorts = {
  messageDeleteTombstones: {
    suppressMessageDeleteTombstone,
    loadMessageDeleteTombstoneEntries,
    loadSuppressedMessageDeleteIds,
    replaceMessageDeleteTombstones,
    isMessageDeleteSuppressed,
    clearMessageDeleteTombstones,
    liftMessageDeleteSuppression,
    mergeMessageDeleteTombstonesFromIndexedDb,
    hydrateMessageDeleteTombstonesFromSqlite,
  },
};

/** Merge tombstone port methods over defaults; tests may stub individual methods. */
export function mergeStoragePorts(override?: Partial<StoragePorts>): StoragePorts {
  const tomb = override?.messageDeleteTombstones;
  if (!tomb) {
    return DEFAULT_STORAGE_PORTS;
  }
  return {
    messageDeleteTombstones: {
      ...DEFAULT_STORAGE_PORTS.messageDeleteTombstones,
      ...tomb,
    },
  };
}

/**
 * @deprecated Prefer `getResolvedClientGateway()` for feature code.
 * Tombstone port assembly only — still used by `buildAppClientGateway` and tests.
 */
export function getResolvedStoragePorts(): StoragePorts {
  return getProfileRuntimeScope()?.storagePorts ?? DEFAULT_STORAGE_PORTS;
}
