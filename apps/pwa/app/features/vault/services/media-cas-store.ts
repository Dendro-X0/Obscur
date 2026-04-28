/**
 * Media Content-Addressed Store (CAS) - Phase 3 Implementation
 *
 * Stores media by content hash (SHA-256) instead of remote URL.
 * This enables automatic re-linking during restore/merge operations.
 *
 * Key properties:
 * - Deduplication: Same media in multiple messages = 1 storage entry
 * - Re-link on restore: Messages can find their media by hash
 * - Reference counting: Track which messages reference each media
 * - Peer discovery: Know which peers have which hashes
 *
 * BLK-001 Fix: Media no longer "clears" from message history after restore
 * because messages link to media by hash, not ephemeral URL.
 *
 * @example
 * ```typescript
 * // Store uploaded media
 * const hash = await computeSha256(blob);
 * store = addMediaBlob(store, hash, blob, descriptor);
 *
 * // Reference from message
 * store = addReference(store, hash, myPubkey, descriptor);
 *
 * // On restore: re-link by hash
 * const media = getMediaByHash(store, hash);
 * if (media?.blob) {
 *   // Media exists locally, message can display it
 * }
 * ```
 */

import type { CommunityMediaDescriptor } from '@dweb/core/community-media-descriptor-contracts';

/** SHA-256 hash as hex string */
export type Sha256 = string;

/** Media item in CAS store */
export interface MediaItem {
  /** Content hash (primary key) */
  sha256: Sha256;
  /** Media metadata */
  descriptor: CommunityMediaDescriptor;
  /** Blob if available locally */
  blob: Blob | null;
  /** Current fetch status */
  fetchStatus: 'pending' | 'fetching' | 'complete' | 'failed';
  /** Who claims to have this media */
  sources: Set<string>; // Pubkeys
  /** Which messages reference this media */
  references: Set<string>; // Message IDs
  /** Fetch progress (0-100) for large files */
  fetchProgress: number;
  /** When this item was created */
  createdAt: number;
  /** When blob was last verified against hash */
  verifiedAt: number | null;
}

/** Media CAS Store state */
export interface MediaCASStore {
  /** All media items keyed by hash */
  items: Map<Sha256, MediaItem>;
  /** Index: messageId -> set of hashes */
  messageIndex: Map<string, Set<Sha256>>;
  /** Configuration */
  config: MediaCASConfig;
}

/** Configuration for media CAS */
export interface MediaCASConfig {
  /** Max size for single blob (default: 50MB) */
  maxBlobSize: number;
  /** TTL for failed fetches before retry (default: 5min) */
  failedFetchRetryMs: number;
  /** Enable automatic verification on store */
  enableVerification: boolean;
}

/** Default configuration */
export const DEFAULT_MEDIA_CAS_CONFIG: MediaCASConfig = {
  maxBlobSize: 50 * 1024 * 1024, // 50MB
  failedFetchRetryMs: 5 * 60 * 1000, // 5min
  enableVerification: true,
};

/** Create empty media CAS store */
export const createMediaCASStore = (
  config: Partial<MediaCASConfig> = {}
): MediaCASStore => ({
  items: new Map(),
  messageIndex: new Map(),
  config: { ...DEFAULT_MEDIA_CAS_CONFIG, ...config },
});

/**
 * Add media blob to store.
 * Creates new item or updates existing with blob.
 */
export const addMediaBlob = (
  store: MediaCASStore,
  sha256: Sha256,
  blob: Blob,
  descriptor: CommunityMediaDescriptor,
  sourcePubkey: string
): MediaCASStore => {
  const existing = store.items.get(sha256);
  const now = Date.now();

  const newItem: MediaItem = {
    sha256,
    descriptor,
    blob: existing?.blob ?? blob, // Keep existing blob if present (deduplication)
    fetchStatus: 'complete',
    sources: new Set([...(existing?.sources ?? []), sourcePubkey]),
    references: new Set(existing?.references ?? []),
    fetchProgress: 100,
    createdAt: existing?.createdAt ?? now,
    verifiedAt: now,
  };

  const newItems = new Map(store.items);
  newItems.set(sha256, newItem);

  return {
    ...store,
    items: newItems,
  };
};

/**
 * Add reference from a message to media hash.
 * Called when processing incoming message with media.
 */
export const addReference = (
  store: MediaCASStore,
  sha256: Sha256,
  sourcePubkey: string,
  descriptor: CommunityMediaDescriptor,
  messageId?: string
): MediaCASStore => {
  const existing = store.items.get(sha256);
  const now = Date.now();

  // Create item if doesn't exist (pending fetch)
  const newItem: MediaItem = existing
    ? {
        ...existing,
        sources: new Set([...existing.sources, sourcePubkey]),
        references: messageId
          ? new Set([...existing.references, messageId])
          : existing.references,
      }
    : {
        sha256,
        descriptor,
        blob: null,
        fetchStatus: 'pending',
        sources: new Set([sourcePubkey]),
        references: messageId ? new Set([messageId]) : new Set(),
        fetchProgress: 0,
        createdAt: now,
        verifiedAt: null,
      };

  const newItems = new Map(store.items);
  newItems.set(sha256, newItem);

  // Update message index
  const newMessageIndex = new Map(store.messageIndex);
  if (messageId) {
    const hashes = newMessageIndex.get(messageId) ?? new Set();
    newMessageIndex.set(messageId, new Set([...hashes, sha256]));
  }

  return {
    ...store,
    items: newItems,
    messageIndex: newMessageIndex,
  };
};

/**
 * Get media by hash.
 */
export const getMediaByHash = (
  store: MediaCASStore,
  sha256: Sha256
): MediaItem | null => {
  return store.items.get(sha256) ?? null;
};

/**
 * Get all media for a message.
 */
export const getMediaForMessage = (
  store: MediaCASStore,
  messageId: string
): MediaItem[] => {
  const hashes = store.messageIndex.get(messageId);
  if (!hashes) return [];

  return Array.from(hashes)
    .map((hash) => store.items.get(hash))
    .filter((item): item is MediaItem => item !== undefined);
};

/**
 * Check if media exists locally (has blob).
 */
export const hasMediaLocally = (
  store: MediaCASStore,
  sha256: Sha256
): boolean => {
  const item = store.items.get(sha256);
  return item?.blob !== null && item?.fetchStatus === 'complete';
};

/**
 * Get all hashes that need fetching (pending status, no blob).
 */
export const getPendingHashes = (store: MediaCASStore): Sha256[] => {
  const pending: Sha256[] = [];

  for (const [hash, item] of store.items) {
    if (item.fetchStatus === 'pending' && !item.blob) {
      pending.push(hash);
    }
  }

  return pending;
};

/**
 * Get sources (peers) who have a specific hash.
 */
export const getSourcesForHash = (
  store: MediaCASStore,
  sha256: Sha256
): string[] => {
  const item = store.items.get(sha256);
  return item ? Array.from(item.sources) : [];
};

/**
 * Update fetch status and progress.
 */
export const updateFetchStatus = (
  store: MediaCASStore,
  sha256: Sha256,
  status: MediaItem['fetchStatus'],
  progress?: number,
  blob?: Blob
): MediaCASStore => {
  const existing = store.items.get(sha256);
  if (!existing) return store;

  const newItem: MediaItem = {
    ...existing,
    fetchStatus: status,
    fetchProgress: progress ?? existing.fetchProgress,
    blob: blob ?? existing.blob,
    verifiedAt: blob ? Date.now() : existing.verifiedAt,
  };

  const newItems = new Map(store.items);
  newItems.set(sha256, newItem);

  return {
    ...store,
    items: newItems,
  };
};

/**
 * Report fetch result (success or failure).
 */
export const reportFetchResult = (
  store: MediaCASStore,
  sha256: Sha256,
  success: boolean,
  blob?: Blob
): MediaCASStore => {
  if (success && blob) {
    return updateFetchStatus(store, sha256, 'complete', 100, blob);
  } else {
    return updateFetchStatus(store, sha256, 'failed', 0);
  }
};

/**
 * Remove a message's references (cleanup when message deleted).
 */
export const removeMessageReferences = (
  store: MediaCASStore,
  messageId: string
): MediaCASStore => {
  const hashes = store.messageIndex.get(messageId);
  if (!hashes) return store;

  const newItems = new Map(store.items);

  for (const hash of hashes) {
    const item = newItems.get(hash);
    if (item) {
      const newReferences = new Set(item.references);
      newReferences.delete(messageId);

      newItems.set(hash, {
        ...item,
        references: newReferences,
      });
    }
  }

  const newMessageIndex = new Map(store.messageIndex);
  newMessageIndex.delete(messageId);

  return {
    ...store,
    items: newItems,
    messageIndex: newMessageIndex,
  };
};

/**
 * Get orphan media (no references) for cleanup.
 */
export const getOrphanMedia = (store: MediaCASStore): Sha256[] => {
  const orphans: Sha256[] = [];

  for (const [hash, item] of store.items) {
    if (item.references.size === 0) {
      orphans.push(hash);
    }
  }

  return orphans;
};

/**
 * Clean up orphan media items.
 */
export const cleanupOrphanMedia = (store: MediaCASStore): MediaCASStore => {
  const orphans = getOrphanMedia(store);
  if (orphans.length === 0) return store;

  const newItems = new Map(store.items);

  for (const hash of orphans) {
    newItems.delete(hash);
  }

  return {
    ...store,
    items: newItems,
  };
};

/**
 * Get deduplication statistics.
 */
export const getDeduplicationStats = (store: MediaCASStore): {
  totalItems: number;
  itemsWithBlob: number;
  itemsPending: number;
  totalReferences: number;
  orphanItems: number;
  uniqueSources: number;
} => {
  let itemsWithBlob = 0;
  let itemsPending = 0;
  let totalReferences = 0;
  const allSources = new Set<string>();

  for (const item of store.items.values()) {
    if (item.blob) itemsWithBlob++;
    if (item.fetchStatus === 'pending') itemsPending++;
    totalReferences += item.references.size;
    for (const source of item.sources) {
      allSources.add(source);
    }
  }

  return {
    totalItems: store.items.size,
    itemsWithBlob,
    itemsPending,
    totalReferences,
    orphanItems: getOrphanMedia(store).length,
    uniqueSources: allSources.size,
  };
};

/**
 * Merge two CAS stores.
 * Used during restore/merge operations.
 */
export const mergeMediaCASStores = (
  local: MediaCASStore,
  remote: MediaCASStore
): MediaCASStore => {
  const mergedItems = new Map(local.items);

  for (const [hash, remoteItem] of remote.items) {
    const localItem = mergedItems.get(hash);

    if (!localItem) {
      // Remote has item we don't have
      mergedItems.set(hash, remoteItem);
    } else {
      // Both have item: merge references and sources, prefer local blob
      const mergedItem: MediaItem = {
        ...localItem,
        sources: new Set([...localItem.sources, ...remoteItem.sources]),
        references: new Set([...localItem.references, ...remoteItem.references]),
        // Keep local blob if we have it, otherwise use remote blob
        blob: localItem.blob ?? remoteItem.blob,
        fetchStatus: localItem.blob ? 'complete' : remoteItem.fetchStatus,
        fetchProgress: localItem.blob ? 100 : remoteItem.fetchProgress,
      };
      mergedItems.set(hash, mergedItem);
    }
  }

  // Merge message indexes
  const mergedMessageIndex = new Map(local.messageIndex);
  for (const [messageId, remoteHashes] of remote.messageIndex) {
    const localHashes = mergedMessageIndex.get(messageId) ?? new Set();
    mergedMessageIndex.set(
      messageId,
      new Set([...localHashes, ...remoteHashes])
    );
  }

  return {
    items: mergedItems,
    messageIndex: mergedMessageIndex,
    config: local.config,
  };
};

/**
 * Re-link messages to media after restore.
 * Call after merge to connect messages with their media by hash.
 */
export const relinkMessagesAfterRestore = (
  store: MediaCASStore,
  messageId: string,
  referencedHashes: Sha256[]
): MediaCASStore => {
  let newStore = store;

  for (const hash of referencedHashes) {
    const item = store.items.get(hash);
    if (item) {
      // Add message reference to existing media
      const newItem: MediaItem = {
        ...item,
        references: new Set([...item.references, messageId]),
      };

      const newItems = new Map(newStore.items);
      newItems.set(hash, newItem);
      newStore = { ...newStore, items: newItems };
    }
  }

  // Update message index
  const newMessageIndex = new Map(newStore.messageIndex);
  const existingHashes = newMessageIndex.get(messageId) ?? new Set();
  newMessageIndex.set(
    messageId,
    new Set([...existingHashes, ...referencedHashes])
  );

  return {
    ...newStore,
    messageIndex: newMessageIndex,
  };
};

/**
 * Serialize store to JSON (for storage/backup).
 */
export const serializeMediaCASStore = (store: MediaCASStore): object => ({
  items: Array.from(store.items.entries()).map(([hash, item]) => [
    hash,
    {
      sha256: item.sha256,
      descriptor: item.descriptor,
      fetchStatus: item.fetchStatus,
      sources: Array.from(item.sources),
      references: Array.from(item.references),
      fetchProgress: item.fetchProgress,
      createdAt: item.createdAt,
      verifiedAt: item.verifiedAt,
      // Note: blob is not serialized (must be re-fetched or stored separately)
    },
  ]),
  messageIndex: Array.from(store.messageIndex.entries()).map(([msgId, hashes]) => [
    msgId,
    Array.from(hashes),
  ]),
  config: store.config,
});

/**
 * Deserialize store from JSON.
 * Blobs must be re-fetched or loaded separately.
 */
export const deserializeMediaCASStore = (data: {
  items: [Sha256, Omit<MediaItem, 'blob' | 'sources' | 'references'> & { sources: string[]; references: string[] }][];
  messageIndex: [string, Sha256[]][];
  config: MediaCASConfig;
}): MediaCASStore => ({
  items: new Map(
    data.items.map(([hash, item]) => [
      hash,
      {
        ...item,
        blob: null, // Blobs not stored in JSON
        sources: new Set(item.sources),
        references: new Set(item.references),
      } as MediaItem,
    ])
  ),
  messageIndex: new Map(
    data.messageIndex.map(([msgId, hashes]) => [msgId, new Set(hashes)])
  ),
  config: data.config,
});
