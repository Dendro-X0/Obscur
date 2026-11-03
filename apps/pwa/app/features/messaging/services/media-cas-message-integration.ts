/**
 * Media CAS Message Integration - Phase 3 Runtime Integration
 *
 * Integrates Media CAS Store with incoming message processing.
 * Fixes BLK-001 by ensuring media is stored content-addressed and
 * messages are linked by hash, not ephemeral URLs.
 *
 * @module MediaCASMessageIntegration
 */

import type { CommunityMediaDescriptor, CommunityMediaKind } from "@dweb/core/community-media-descriptor-contracts";
import type { Attachment, AttachmentKind, PersistedChatState } from "@/app/features/messaging/types";
import { extractCasContentHashFromUrl } from "@/app/features/vault/services/cas-media-recovery";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
  createMediaCASStore,
  addMediaBlob,
  addReference,
  getMediaForMessage,
  mergeMediaCASStores,
  type MediaCASStore,
  type MediaItem,
} from "@/app/features/vault/services/media-cas-store";
import { planInboundMediaWrite } from "@/app/features/storage/services/inbound-media-quarantine";
import { persistInboundMediaQuarantineBytes } from "@/app/features/storage/services/inbound-media-quarantine-persist";
import { shouldAllowInboundMediaPreview } from "@/app/features/storage/services/inbound-media-preview";

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
    const updatedStore = addReference(
      store,
      hash,
      sourcePubkey,
      attachment.descriptor,
      messageId,
    );

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
  blob: Blob,
  options?: Readonly<{ fileName?: string | null }>,
): void => {
  const store = getMediaStoreForProfile(profileId);

  // Get existing to preserve descriptor
  const existing = store.items.get(sha256Hash);

  if (!existing?.descriptor) {
    console.warn("Cannot update media blob: no existing descriptor for hash", sha256Hash.slice(0, 16));
    return;
  }

  // P2-S S2: policy + quarantine path — never system-open; deny preview when policy fails.
  const plan = planInboundMediaWrite({
    profileId,
    sha256: sha256Hash,
    mimeType: blob.type || undefined,
    fileName: options?.fileName,
    byteLength: blob.size,
  });
  const descriptor = {
    ...existing.descriptor,
    contentAvailabilityState: plan.contentAvailabilityState,
    localCacheState: "cached" as const,
  };
  if (!plan.allowPreview) {
    logAppEvent({
      name: "vault.inbound_media_quarantined",
      level: "info",
      scope: { feature: "vault", action: "inbound_media_quarantined" },
      context: {
        profileId,
        sha256Prefix: sha256Hash.slice(0, 16),
        quarantineRelativePath: plan.quarantineRelativePath,
        policyReason: plan.policy.ok ? null : plan.policy.reason,
      },
    });
  }

  // P2-S S2b: durable AppData write under quarantine path (no shell open).
  const readBlobBytes = async (): Promise<Uint8Array> => {
    if (typeof blob.arrayBuffer === "function") {
      return new Uint8Array(await blob.arrayBuffer());
    }
    // jsdom / older runtimes — Response stream fallback.
    return new Uint8Array(await new Response(blob).arrayBuffer());
  };
  void readBlobBytes()
    .then((bytes) => persistInboundMediaQuarantineBytes({
      profileId,
      plan,
      bytes,
    }))
    .then((result) => {
      if (result.status === "written" || result.status === "skipped_non_native") {
        return;
      }
      logAppEvent({
        name: "vault.inbound_media_quarantine_persist_failed",
        level: "warn",
        scope: { feature: "vault", action: "inbound_media_quarantine_persist" },
        context: {
          profileId,
          sha256Prefix: sha256Hash.slice(0, 16),
          status: result.status,
          reason: "reason" in result ? result.reason : null,
        },
      });
    })
    .catch((error: unknown) => {
      logAppEvent({
        name: "vault.inbound_media_quarantine_persist_failed",
        level: "warn",
        scope: { feature: "vault", action: "inbound_media_quarantine_persist" },
        context: {
          profileId,
          sha256Prefix: sha256Hash.slice(0, 16),
          error: error instanceof Error ? error.message : String(error),
        },
      });
    });

  const updatedStore = addMediaBlob(
    store,
    sha256Hash,
    blob,
    descriptor,
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
  // P2-S S3: never hand previewable blobs for quarantined / policy-denied items.
  return getMediaForMessage(store, messageId).map((item) => {
    if (!item.blob) {
      return item;
    }
    const allow = shouldAllowInboundMediaPreview({
      contentAvailabilityState: item.descriptor.contentAvailabilityState,
      mimeType: item.blob.type || undefined,
      byteLength: item.blob.size,
    });
    if (allow) {
      return item;
    }
    return { ...item, blob: null };
  });
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

const toCommunityMediaKind = (kind: AttachmentKind): CommunityMediaKind => {
  if (kind === "voice_note") {
    return "audio";
  }
  if (kind === "image" || kind === "video" || kind === "audio" || kind === "file") {
    return kind;
  }
  return "file";
};

export const descriptorFromPersistedAttachment = (
  messageId: string,
  attachment: Attachment,
  contentHash: string,
): CommunityMediaDescriptor => ({
  mediaDescriptorId: `${messageId}:${contentHash.slice(0, 16)}`,
  communityId: "dm-restore",
  sourceLogicalMessageId: messageId,
  kind: toCommunityMediaKind(attachment.kind),
  encryptionSuite: "obscur-file-aead-v1",
  storageUrl: attachment.url,
  encryptedBlobDigestHex: contentHash,
  encryptedMetadataState: "unknown",
  localCacheState: "uncached",
  contentAvailabilityState: "available",
});

export type RestoreMediaRelinkMessage = Readonly<{
  id: string;
  content: string;
  tags: ReadonlyArray<ReadonlyArray<string>>;
  attachments?: ReadonlyArray<Attachment>;
}>;

/**
 * Re-link messages to media after restore (BLK-001 / MED-001).
 * Call after account restore to reconnect messages to media by hash.
 */
export const relinkMediaAfterRestore = (
  profileId: string,
  sourcePubkey: string,
  messages: ReadonlyArray<RestoreMediaRelinkMessage>,
): void => {
  const store = getMediaStoreForProfile(profileId);

  const messageRefs: Array<{
    messageId: string;
    hash: string;
    descriptor: CommunityMediaDescriptor;
  }> = [];

  for (const message of messages) {
    const extracted = extractMediaFromMessage(
      message.id,
      message.content,
      message.tags,
    );

    for (const attachment of extracted.attachments) {
      messageRefs.push({
        messageId: message.id,
        hash: attachment.descriptor.encryptedBlobDigestHex,
        descriptor: attachment.descriptor,
      });
    }

    for (const attachment of message.attachments ?? []) {
      const hash = extractCasContentHashFromUrl(attachment.url);
      if (!hash) {
        continue;
      }
      messageRefs.push({
        messageId: message.id,
        hash,
        descriptor: descriptorFromPersistedAttachment(message.id, attachment, hash),
      });
    }
  }

  let updatedStore = store;
  for (const ref of messageRefs) {
    updatedStore = addReference(
      updatedStore,
      ref.hash,
      sourcePubkey,
      ref.descriptor,
      ref.messageId,
    );
  }
  mediaStores.set(profileId, updatedStore);

  const pendingCount = getPendingMediaHashes(profileId).length;
  logAppEvent({
    name: "vault.media_cas_restore_relink",
    level: "info",
    scope: { feature: "vault", action: "media_cas_restore_relink" },
    context: {
      profileId,
      relinkedRefCount: messageRefs.length,
      pendingHashCount: pendingCount,
    },
  });
};

/**
 * MED-001: rebuild CAS message index from restored persisted chat state.
 */
export const relinkChatStateMediaAfterRestore = (
  profileId: string,
  sourcePubkey: string,
  chatState: PersistedChatState,
): void => {
  const messages: RestoreMediaRelinkMessage[] = [];
  for (const timeline of Object.values(chatState.messagesByConversationId)) {
    for (const message of timeline) {
      messages.push({
        id: message.id,
        content: message.content,
        tags: [],
        attachments: message.attachments,
      });
    }
  }
  relinkMediaAfterRestore(profileId, sourcePubkey, messages);
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
