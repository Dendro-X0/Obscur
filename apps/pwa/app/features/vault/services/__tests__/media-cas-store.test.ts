/**
 * Media CAS Store Tests
 *
 * Tests content-addressed media storage with re-linking on restore.
 */

import { describe, it, expect } from 'vitest';
import type { CommunityMediaDescriptor } from '@dweb/core/community-media-descriptor-contracts';
import {
  createMediaCASStore,
  addMediaBlob,
  addReference,
  getMediaByHash,
  getMediaForMessage,
  hasMediaLocally,
  getPendingHashes,
  getSourcesForHash,
  updateFetchStatus,
  reportFetchResult,
  removeMessageReferences,
  getOrphanMedia,
  cleanupOrphanMedia,
  getDeduplicationStats,
  mergeMediaCASStores,
  relinkMessagesAfterRestore,
} from '../media-cas-store.js';

describe('Media CAS Store', () => {
  const HASH_A = 'sha256-abc123';
  const HASH_B = 'sha256-def456';
  const MESSAGE_1 = 'msg-001';
  const MESSAGE_2 = 'msg-002';
  const ALICE = 'alice-pubkey';
  const BOB = 'bob-pubkey';

  const createMockBlob = (size = 100): Blob =>
    new Blob(['a'.repeat(size)], { type: 'text/plain' });

  const createMockDescriptor = (url = 'https://example.com/img.jpg', hash = HASH_A): CommunityMediaDescriptor => ({
    mediaDescriptorId: `media-${hash.slice(0, 8)}`,
    communityId: 'community-1',
    sourceLogicalMessageId: 'msg-source-1',
    kind: 'image',
    encryptionSuite: 'obscur-file-aead-v1',
    storageUrl: url,
    encryptedBlobDigestHex: hash,
    encryptedByteLength: 100000,
    encryptedMetadataState: 'available',
    localCacheState: 'cached',
    contentAvailabilityState: 'available',
  });

  describe('Creation', () => {
    it('should create empty store', () => {
      const store = createMediaCASStore();
      expect(store.items.size).toBe(0);
      expect(store.messageIndex.size).toBe(0);
    });

    it('should create with custom config', () => {
      const store = createMediaCASStore({ maxBlobSize: 10 * 1024 * 1024 });
      expect(store.config.maxBlobSize).toBe(10 * 1024 * 1024);
    });
  });

  describe('Adding Media Blobs', () => {
    it('should add media blob to store', () => {
      let store = createMediaCASStore();
      const blob = createMockBlob();
      const descriptor = createMockDescriptor();

      store = addMediaBlob(store, HASH_A, blob, descriptor, ALICE);

      const item = getMediaByHash(store, HASH_A);
      expect(item).not.toBeNull();
      expect(item?.sha256).toBe(HASH_A);
      expect(item?.blob).toBe(blob);
      expect(item?.fetchStatus).toBe('complete');
      expect(item?.verifiedAt).not.toBeNull();
    });

    it('should update sources for existing media', () => {
      let store = createMediaCASStore();
      const blob = createMockBlob();
      const descriptor = createMockDescriptor();

      store = addMediaBlob(store, HASH_A, blob, descriptor, ALICE);
      store = addMediaBlob(store, HASH_A, blob, descriptor, BOB);

      const item = getMediaByHash(store, HASH_A);
      expect(item?.sources.has(ALICE)).toBe(true);
      expect(item?.sources.has(BOB)).toBe(true);
      expect(item?.sources.size).toBe(2);
    });

    it('should keep existing blob when adding from new source', () => {
      let store = createMediaCASStore();
      const blobA = createMockBlob(100);
      const blobB = createMockBlob(200);
      const descriptor = createMockDescriptor();

      store = addMediaBlob(store, HASH_A, blobA, descriptor, ALICE);
      store = addMediaBlob(store, HASH_A, blobB, descriptor, BOB);

      const item = getMediaByHash(store, HASH_A);
      // Should keep the original blob (size 100)
      expect(item?.blob?.size).toBe(100);
    });
  });

  describe('Adding References', () => {
    it('should add reference without existing blob', () => {
      let store = createMediaCASStore();
      const descriptor = createMockDescriptor();

      store = addReference(store, HASH_A, ALICE, descriptor, MESSAGE_1);

      const item = getMediaByHash(store, HASH_A);
      expect(item).not.toBeNull();
      expect(item?.blob).toBeNull();
      expect(item?.fetchStatus).toBe('pending');
      expect(item?.references.has(MESSAGE_1)).toBe(true);
    });

    it('should add reference to existing blob', () => {
      let store = createMediaCASStore();
      const blob = createMockBlob();
      const descriptor = createMockDescriptor();

      store = addMediaBlob(store, HASH_A, blob, descriptor, ALICE);
      store = addReference(store, HASH_A, ALICE, descriptor, MESSAGE_1);

      const item = getMediaByHash(store, HASH_A);
      expect(item?.references.has(MESSAGE_1)).toBe(true);
      expect(item?.blob).not.toBeNull();
    });

    it('should index message to hashes', () => {
      let store = createMediaCASStore();
      const descriptor = createMockDescriptor();

      store = addReference(store, HASH_A, ALICE, descriptor, MESSAGE_1);
      store = addReference(store, HASH_B, ALICE, descriptor, MESSAGE_1);

      const hashes = store.messageIndex.get(MESSAGE_1);
      expect(hashes?.has(HASH_A)).toBe(true);
      expect(hashes?.has(HASH_B)).toBe(true);
      expect(hashes?.size).toBe(2);
    });
  });

  describe('Querying', () => {
    it('should get media by hash', () => {
      let store = createMediaCASStore();
      const blob = createMockBlob();
      const descriptor = createMockDescriptor();

      store = addMediaBlob(store, HASH_A, blob, descriptor, ALICE);

      const item = getMediaByHash(store, HASH_A);
      expect(item?.sha256).toBe(HASH_A);
    });

    it('should return null for unknown hash', () => {
      const store = createMediaCASStore();
      const item = getMediaByHash(store, 'unknown-hash');
      expect(item).toBeNull();
    });

    it('should get media for message', () => {
      let store = createMediaCASStore();
      const blob = createMockBlob();
      const descriptor = createMockDescriptor();

      store = addMediaBlob(store, HASH_A, blob, descriptor, ALICE);
      store = addReference(store, HASH_A, ALICE, descriptor, MESSAGE_1);

      const media = getMediaForMessage(store, MESSAGE_1);
      expect(media.length).toBe(1);
      expect(media[0]?.sha256).toBe(HASH_A);
    });

    it('should check if media exists locally', () => {
      let store = createMediaCASStore();
      const blob = createMockBlob();
      const descriptor = createMockDescriptor();

      store = addMediaBlob(store, HASH_A, blob, descriptor, ALICE);

      expect(hasMediaLocally(store, HASH_A)).toBe(true);
      expect(hasMediaLocally(store, HASH_B)).toBe(false);
    });

    it('should get pending hashes', () => {
      let store = createMediaCASStore();
      const blob = createMockBlob();
      const descriptor = createMockDescriptor();

      store = addMediaBlob(store, HASH_A, blob, descriptor, ALICE);
      store = addReference(store, HASH_B, ALICE, descriptor, MESSAGE_1);

      const pending = getPendingHashes(store);
      expect(pending).toContain(HASH_B);
      expect(pending).not.toContain(HASH_A);
    });

    it('should get sources for hash', () => {
      let store = createMediaCASStore();
      const blob = createMockBlob();
      const descriptor = createMockDescriptor();

      store = addMediaBlob(store, HASH_A, blob, descriptor, ALICE);
      store = addMediaBlob(store, HASH_A, blob, descriptor, BOB);

      const sources = getSourcesForHash(store, HASH_A);
      expect(sources).toContain(ALICE);
      expect(sources).toContain(BOB);
    });
  });

  describe('Fetch Status', () => {
    it('should update fetch status', () => {
      let store = createMediaCASStore();
      const descriptor = createMockDescriptor();

      store = addReference(store, HASH_A, ALICE, descriptor, MESSAGE_1);
      store = updateFetchStatus(store, HASH_A, 'fetching', 50);

      const item = getMediaByHash(store, HASH_A);
      expect(item?.fetchStatus).toBe('fetching');
      expect(item?.fetchProgress).toBe(50);
    });

    it('should report fetch success', () => {
      let store = createMediaCASStore();
      const descriptor = createMockDescriptor();
      const blob = createMockBlob();

      store = addReference(store, HASH_A, ALICE, descriptor, MESSAGE_1);
      store = reportFetchResult(store, HASH_A, true, blob);

      const item = getMediaByHash(store, HASH_A);
      expect(item?.fetchStatus).toBe('complete');
      expect(item?.blob).toBe(blob);
      expect(item?.verifiedAt).not.toBeNull();
    });

    it('should report fetch failure', () => {
      let store = createMediaCASStore();
      const descriptor = createMockDescriptor();

      store = addReference(store, HASH_A, ALICE, descriptor, MESSAGE_1);
      store = reportFetchResult(store, HASH_A, false);

      const item = getMediaByHash(store, HASH_A);
      expect(item?.fetchStatus).toBe('failed');
      expect(item?.blob).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should remove message references', () => {
      let store = createMediaCASStore();
      const blob = createMockBlob();
      const descriptor = createMockDescriptor();

      store = addMediaBlob(store, HASH_A, blob, descriptor, ALICE);
      store = addReference(store, HASH_A, ALICE, descriptor, MESSAGE_1);
      store = removeMessageReferences(store, MESSAGE_1);

      const item = getMediaByHash(store, HASH_A);
      expect(item?.references.has(MESSAGE_1)).toBe(false);
      expect(store.messageIndex.has(MESSAGE_1)).toBe(false);
    });

    it('should get orphan media', () => {
      let store = createMediaCASStore();
      const blob = createMockBlob();
      const descriptor = createMockDescriptor();

      // Add media with reference
      store = addMediaBlob(store, HASH_A, blob, descriptor, ALICE);
      store = addReference(store, HASH_A, ALICE, descriptor, MESSAGE_1);

      // Add media without reference (orphan)
      store = addMediaBlob(store, HASH_B, blob, descriptor, ALICE);

      // Remove reference for first media
      store = removeMessageReferences(store, MESSAGE_1);

      const orphans = getOrphanMedia(store);
      expect(orphans).toContain(HASH_A);
      expect(orphans).toContain(HASH_B);
    });

    it('should cleanup orphan media', () => {
      let store = createMediaCASStore();
      const blob = createMockBlob();
      const descriptor = createMockDescriptor();

      store = addMediaBlob(store, HASH_A, blob, descriptor, ALICE);
      store = cleanupOrphanMedia(store);

      expect(getMediaByHash(store, HASH_A)).toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should provide deduplication stats', () => {
      let store = createMediaCASStore();
      const blob = createMockBlob();
      const descriptor = createMockDescriptor();

      store = addMediaBlob(store, HASH_A, blob, descriptor, ALICE);
      store = addReference(store, HASH_B, BOB, descriptor, MESSAGE_1);
      store = addReference(store, HASH_A, BOB, descriptor, MESSAGE_1);

      const stats = getDeduplicationStats(store);
      expect(stats.totalItems).toBe(2);
      expect(stats.itemsWithBlob).toBe(1);
      expect(stats.itemsPending).toBe(1);
      expect(stats.totalReferences).toBe(2);
    });
  });

  describe('Merging', () => {
    it('should merge stores with different items', () => {
      let local = createMediaCASStore();
      let remote = createMediaCASStore();
      const blob = createMockBlob();
      const descriptor = createMockDescriptor();

      local = addMediaBlob(local, HASH_A, blob, descriptor, ALICE);
      remote = addMediaBlob(remote, HASH_B, blob, descriptor, BOB);

      const merged = mergeMediaCASStores(local, remote);

      expect(getMediaByHash(merged, HASH_A)).not.toBeNull();
      expect(getMediaByHash(merged, HASH_B)).not.toBeNull();
    });

    it('should merge sources for shared items', () => {
      let local = createMediaCASStore();
      let remote = createMediaCASStore();
      const blob = createMockBlob();
      const descriptor = createMockDescriptor();

      local = addMediaBlob(local, HASH_A, blob, descriptor, ALICE);
      remote = addMediaBlob(remote, HASH_A, blob, descriptor, BOB);

      const merged = mergeMediaCASStores(local, remote);

      const item = getMediaByHash(merged, HASH_A);
      expect(item?.sources.has(ALICE)).toBe(true);
      expect(item?.sources.has(BOB)).toBe(true);
    });

    it('should prefer local blob in merge', () => {
      let local = createMediaCASStore();
      let remote = createMediaCASStore();
      const blobA = createMockBlob(100);
      const blobB = createMockBlob(200);
      const descriptor = createMockDescriptor();

      local = addMediaBlob(local, HASH_A, blobA, descriptor, ALICE);
      remote = addMediaBlob(remote, HASH_A, blobB, descriptor, BOB);

      const merged = mergeMediaCASStores(local, remote);
      const item = getMediaByHash(merged, HASH_A);

      // Should keep local blob (size 100)
      expect(item?.blob?.size).toBe(100);
    });
  });

  describe('Restore Re-linking (BLK-001 Fix)', () => {
    it('should re-link message to existing media on restore', () => {
      // Simulate restore scenario:
      // 1. Media exists locally
      // 2. Message arrives (from backup) referencing hash
      // 3. Message gets re-linked to media

      let store = createMediaCASStore();
      const blob = createMockBlob();
      const descriptor = createMockDescriptor();

      // Media already exists (from previous sync)
      store = addMediaBlob(store, HASH_A, blob, descriptor, ALICE);

      // Message arrives from backup referencing hash
      store = relinkMessagesAfterRestore(store, MESSAGE_1, [HASH_A]);

      const media = getMediaForMessage(store, MESSAGE_1);
      expect(media.length).toBe(1);
      expect(media[0]?.blob).not.toBeNull(); // Media is available!
    });

    it('should handle missing media during restore (pending)', () => {
      // Message references hash we don't have yet
      let store = createMediaCASStore();

      store = relinkMessagesAfterRestore(store, MESSAGE_1, [HASH_A]);

      const media = getMediaForMessage(store, MESSAGE_1);
      expect(media.length).toBe(0); // No media item created yet
    });

    it('should deduplicate media across messages', () => {
      // Same media referenced by multiple messages
      let store = createMediaCASStore();
      const blob = createMockBlob();
      const descriptor = createMockDescriptor();

      store = addMediaBlob(store, HASH_A, blob, descriptor, ALICE);
      store = addReference(store, HASH_A, ALICE, descriptor, MESSAGE_1);
      store = addReference(store, HASH_A, ALICE, descriptor, MESSAGE_2);

      const item = getMediaByHash(store, HASH_A);
      expect(item?.references.size).toBe(2);
      expect(item?.references.has(MESSAGE_1)).toBe(true);
      expect(item?.references.has(MESSAGE_2)).toBe(true);

      // Stats should show single item with multiple references
      const stats = getDeduplicationStats(store);
      expect(stats.totalItems).toBe(1);
      expect(stats.totalReferences).toBe(2);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle BLK-001 scenario: media clears on fresh device restore', () => {
      // Before CAS: message would show "media unavailable" after restore
      // After CAS: message auto-links to media by hash

      let store = createMediaCASStore();
      const blob = createMockBlob();
      const descriptor = createMockDescriptor();

      // Simulate: Media was synced before, blob exists
      store = addMediaBlob(store, HASH_A, blob, descriptor, ALICE);

      // Fresh device restore: messages arrive but blob is "gone"
      // Actually in real scenario, blob might not be in backup
      // But we know sources who might have it
      const sources = getSourcesForHash(store, HASH_A);
      expect(sources).toContain(ALICE);

      // Message gets re-linked
      store = relinkMessagesAfterRestore(store, MESSAGE_1, [HASH_A]);
      const media = getMediaForMessage(store, MESSAGE_1);
      expect(media[0]?.sha256).toBe(HASH_A);
    });

    it('should track fetch sources for missing media', () => {
      // Alice references media she has
      let store = createMediaCASStore();
      const descriptor = createMockDescriptor();

      store = addReference(store, HASH_A, ALICE, descriptor, MESSAGE_1);
      store = addReference(store, HASH_A, BOB, descriptor, MESSAGE_1);

      // Both are sources, can fetch from either
      const sources = getSourcesForHash(store, HASH_A);
      expect(sources).toContain(ALICE);
      expect(sources).toContain(BOB);

      // Mark as fetching
      store = updateFetchStatus(store, HASH_A, 'fetching', 25);
      expect(getMediaByHash(store, HASH_A)?.fetchProgress).toBe(25);
    });
  });
});
