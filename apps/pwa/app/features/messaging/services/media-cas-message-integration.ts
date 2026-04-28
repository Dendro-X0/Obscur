/**
 * Media CAS Message Integration - Phase 3 Runtime Integration
 *
 * Integrates Media CAS Store with incoming message processing.
 * Fixes BLK-001 by ensuring media is stored content-addressed and
 * messages are linked by hash, not ephemeral URLs.
 *
 * @module MediaCASMessageIntegration
 */

import type { CommunityMediaDescriptor } from "@dweb/core/community-media-descriptor-contracts";
import {
  createMediaCASStore,
  addMediaBlob,
  addReference,
  getMediaForMessage,
  mergeMediaCASStores,
  type MediaCASStore,
  type MediaItem,
} from "../../vault/services/media-cas-store.js";

/** Media attachment found in message */
export interface MessageMediaAttachment {
  /** Message ID that references this media */
  messageId: string;
  /** Media descriptor from message */
  descriptor: CommunityMediaDescriptor;
  /** Optional: blob if already downloaded */
  blob?: Blob;
}

/** Media extraction result */
export interface ExtractedMedia {
  /** All media attachments found */
  attachments: MessageMediaAttachment[];
  /** Whether any media was found */
  hasMedia: boolean;
}

/** Global media store singleton - scoped by profile */
const mediaStores = new Map<string, MediaCASStore>();

/**
 * Get or create media CAS store for profile.
 * One store per profile for deduplication across all conversations.
 */
export const getMediaStoreForProfile = (
  profileId: string,
  config?: { maxBlobSize?: number }
): MediaCASStore => {
  const existing = mediaStores.get(profileId);
  if (existing) return existing;

  const newStore = createMediaCASStore({
    maxBlobSize: config?.maxBlobSize ?? 50 * 1024 * 1024, // 50MB default
  });

  mediaStores.set(profileId, newStore);
  return newStore;
};

/**
 * Clear media store for profile (e.g., on logout).
 */
export const clearMediaStoreForProfile = (profileId: string): void => {
  mediaStores.delete(profileId);
};

/**
 * Extract media descriptors from message content.
 * Parses message content for media references.
 */
export const extractMediaFromMessage = (
  messageId: string,
  content: string,
  tags: ReadonlyArray<ReadonlyArray<string>>
): ExtractedMedia => {
  const attachments: MessageMediaAttachment[] = [];

  // Check for media descriptors in tags (NIP-XX style)
  for (const tag of tags) {
    if (tag[0] === "media" && tag[1]) {
      try {
        const descriptor = JSON.parse(tag[1]) as CommunityMediaDescriptor;
        if (isValidMediaDescriptor(descriptor)) {
          attachments.push({
            messageId,
            descriptor,
          });
        }
      } catch {
        // Invalid media tag, skip
      }
    }
  }

  // Check for media references in content (JSON-encoded descriptors)
  try {
    const parsed = JSON.parse(content);
    if (parsed.media && Array.isArray(parsed.media)) {
      for (const media of parsed.media) {
        if (isValidMediaDescriptor(media)) {
          attachments.push({
            messageId,
            descriptor: media,
          });
        }
      }
    }
  } catch {
    // Not JSON content, skip
  }

  return {
    attachments,
    hasMedia: attachments.length > 0,
  };
};

/**
 * Validate media descriptor has required fields.
 */
const isValidMediaDescriptor = (
  descriptor: unknown
): descriptor is CommunityMediaDescriptor => {
  if (!descriptor || typeof descriptor !== "object") return false;
  const d = descriptor as Record<string, unknown>;
  return (
    typeof d.mediaDescriptorId === "string" &&
    typeof d.communityId === "string" &&
    typeof d.encryptedBlobDigestHex === "string" &&
    typeof d.storageUrl === "string" &&
    d.kind !== undefined
  );
};

/**
 * Process media from incoming message.
 * Called during message ingestion to extract and index media.
 */
export const processIncomingMessageMedia = (
  profileId: string,
  messageId: string,
  content: string,
  tags: ReadonlyArray<ReadonlyArray<string>>,
  sourcePubkey: string
): void => {
  const store = getMediaStoreForProfile(profileId);
  const extracted = extractMediaFromMessage(messageId, content, tags);

  if (!extracted.hasMedia) return;

  for (const attachment of extracted.attachments) {
    const hash = attachment.descriptor.encryptedBlobDigestHex;

    // Add reference - creates pending entry if blob not yet available
    const updatedStore = addReference(store, hash, messageId, attachment.descriptor);

    // Add source for P2P fetching (no blob yet, just source tracking)
    if (!updatedStore.items.has(hash)) {
      // Create pending entry with undefined blob
      const item: MediaItem = {
        sha256: hash,
        descriptor: attachment.descriptor,
        blob: null,
        fetchStatus: "pending",
        sources: new Set([sourcePubkey]),
        references: new Set([messageId]),
        fetchProgress: 0,
        createdAt: Date.now(),
        verifiedAt: Date.now(),
      };
      updatedStore.items.set(hash, item);
    } else {
      // Just add source to existing
      const item = updatedStore.items.get(hash)!;
      const newSources = new Set(item.sources);
      newSources.add(sourcePubkey);
      updatedStore.items.set(hash, { ...item, sources: newSources });
    }

    mediaStores.set(profileId, updatedStore);

    // Log diagnostic (console for now)
    console.log(`[MediaCAS] Indexed media ${hash.slice(0, 16)} for message ${messageId.slice(0, 16)}`);
  }
};

/**
 * Update media blob when downloaded.
 */
export const updateMediaBlob = (
  profileId: string,
  sha256Hash: string,
  blob: Blob
): void => {
  const store = getMediaStoreForProfile(profileId);

  // Get existing to preserve descriptor
  const existing = store.items.get(sha256Hash);

  if (!existing?.descriptor) {
    console.warn("Cannot update media blob: no existing descriptor for hash", sha256Hash.slice(0, 16));
    return;
  }

  const updatedStore = addMediaBlob(
    store,
    sha256Hash,
    blob,
    existing.descriptor,
    "local" // Local source
  );

  mediaStores.set(profileId, updatedStore);
};

/**
 * Get media for message display.
 * Used by UI to retrieve media blobs for rendering.
 */
export const getMessageMedia = (
  profileId: string,
  messageId: string
): MediaItem[] => {
  const store = getMediaStoreForProfile(profileId);
  return getMediaForMessage(store, messageId);
};

/**
 * Check if media is available locally.
 */
export const isMediaAvailableLocally = (
  profileId: string,
  sha256Hash: string
): boolean => {
  const store = getMediaStoreForProfile(profileId);
  const item = store.items.get(sha256Hash);
  return item?.blob !== undefined && item.fetchStatus === "complete";
};

/**
 * Get pending media hashes that need fetching.
 */
export const getPendingMediaHashes = (
  profileId: string
): string[] => {
  const store = getMediaStoreForProfile(profileId);
  return Array.from(store.items.values())
    .filter(item => item.fetchStatus === "pending" || item.fetchStatus === "failed")
    .map(item => item.sha256);
};

/**
 * Get sources for a media hash (for P2P fetching).
 */
export const getMediaSources = (
  profileId: string,
  sha256Hash: string
): string[] => {
  const store = getMediaStoreForProfile(profileId);
  const item = store.items.get(sha256Hash);
  return item ? Array.from(item.sources) : [];
};

/**
 * Re-link messages to media after restore (BLK-001 fix).
 * Call after account restore to reconnect messages to media by hash.
 */
export const relinkMediaAfterRestore = (
  profileId: string,
  messages: Array<{ id: string; content: string; tags: ReadonlyArray<ReadonlyArray<string>> }>
): void => {
  const store = getMediaStoreForProfile(profileId);

  // Extract all media references from messages
  const messageRefs: Array<{
    messageId: string;
    hash: string;
    descriptor: CommunityMediaDescriptor;
  }> = [];

  for (const message of messages) {
    const extracted = extractMediaFromMessage(
      message.id,
      message.content,
      message.tags
    );

    for (const attachment of extracted.attachments) {
      messageRefs.push({
        messageId: message.id,
        hash: attachment.descriptor.encryptedBlobDigestHex,
        descriptor: attachment.descriptor,
      });
    }
  }

  // Re-link messages to media (each ref independently)
  let updatedStore = store;
  for (const ref of messageRefs) {
    updatedStore = addReference(updatedStore, ref.hash, ref.messageId, ref.descriptor);
  }
  mediaStores.set(profileId, updatedStore);

  // Log BLK-001 fix metrics
  const pendingCount = getPendingMediaHashes(profileId).length;
  console.log(`[BLK-001] Re-linked ${messageRefs.length} media refs, ${pendingCount} pending`);
};

/**
 * Merge media stores during sync/restore.
 */
export const mergeProfileMediaStores = (
  profileId: string,
  remoteStore: MediaCASStore
): void => {
  const localStore = getMediaStoreForProfile(profileId);
  const merged = mergeMediaCASStores(localStore, remoteStore);
  mediaStores.set(profileId, merged);
};

/**
 * Export media store for backup.
 */
export const exportMediaStoreForBackup = (
  profileId: string
): MediaCASStore => {
  return getMediaStoreForProfile(profileId);
};

/**
 * Get media diagnostics.
 */
export const getMediaDiagnostics = (
  profileId: string
): {
  totalItems: number;
  pendingItems: number;
  completeItems: number;
  deduplicationRatio: number;
  totalReferences: number;
} => {
  const store = getMediaStoreForProfile(profileId);

  let pending = 0;
  let complete = 0;
  let totalRefs = 0;

  for (const item of store.items.values()) {
    if (item.fetchStatus === "complete") complete++;
    else pending++;
    totalRefs += item.references.size;
  }

  const total = store.items.size;
  const dedupRatio = total > 0 ? totalRefs / total : 0;

  return {
    totalItems: total,
    pendingItems: pending,
    completeItems: complete,
    deduplicationRatio: dedupRatio,
    totalReferences: totalRefs,
  };
};
