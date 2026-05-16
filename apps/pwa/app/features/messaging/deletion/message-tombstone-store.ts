/**
 * Message Tombstone Store
 *
 * Durable storage for deletion tombstones.
 * Scoped by profile to support multi-profile and restore safety.
 *
 * Rules:
 * - All operations require explicit profileId
 * - Tombstones survive reload, new window, new device restore
 * - Tombstones can exist before their target message arrives
 * - Query operations support tombstone-based filtering
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type {
  MessageTombstone,
  LocalMessageTombstone,
  NetworkMessageTombstone,
  TombstoneId,
  DeleteScope,
} from "./types";

// ---------------------------------------------------------------------------
// Storage Keys
// ---------------------------------------------------------------------------

const TOMBSTONE_STORE_VERSION = 1;
const TOMBSTONE_STORE_KEY = (profileId: string) =>
  `obscur:v${TOMBSTONE_STORE_VERSION}:tombstones:${profileId}`;

// ---------------------------------------------------------------------------
// Tombstone ID Generation
// ---------------------------------------------------------------------------

const fallbackUuid = (): string => (
  `tombstone-${Date.now()}-${Math.random().toString(16).slice(2)}`
);

export function generateTombstoneId(): TombstoneId {
  return typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : fallbackUuid();
}

// ---------------------------------------------------------------------------
// Storage Interface
// ---------------------------------------------------------------------------

interface TombstoneStore {
  tombstones: MessageTombstone[];
  lastUpdatedAt: number;
}

// ---------------------------------------------------------------------------
// Store Operations
// ---------------------------------------------------------------------------

/**
 * Load all tombstones for a profile.
 * Returns empty array if none found or on error.
 */
export async function loadMessageTombstones(
  profileId: string
): Promise<MessageTombstone[]> {
  if (!profileId) {
    console.warn("[tombstone-store] load called without profileId");
    return [];
  }

  try {
    const key = TOMBSTONE_STORE_KEY(profileId);
    const stored = localStorage.getItem(key);

    if (!stored) {
      return [];
    }

    const store: TombstoneStore = JSON.parse(stored);

    // Validate store version
    if (!Array.isArray(store.tombstones)) {
      console.warn("[tombstone-store] invalid store format, resetting");
      return [];
    }

    return store.tombstones;
  } catch (err) {
    console.error("[tombstone-store] load error", err);
    return [];
  }
}

/**
 * Save tombstones for a profile.
 * Replaces entire store atomically.
 */
export async function saveMessageTombstones(
  profileId: string,
  tombstones: MessageTombstone[]
): Promise<void> {
  if (!profileId) {
    throw new Error("[tombstone-store] save called without profileId");
  }

  try {
    const key = TOMBSTONE_STORE_KEY(profileId);
    const store: TombstoneStore = {
      tombstones,
      lastUpdatedAt: Date.now(),
    };

    localStorage.setItem(key, JSON.stringify(store));
  } catch (err) {
    console.error("[tombstone-store] save error", err);
    throw err;
  }
}

/**
 * Upsert a single tombstone.
 * Creates if new, updates if existing tombstoneId found.
 */
export async function upsertMessageTombstone(
  tombstone: MessageTombstone
): Promise<void> {
  const tombstones = await loadMessageTombstones(tombstone.profileId);

  const existingIndex = tombstones.findIndex(
    (t) => t.tombstoneId === tombstone.tombstoneId
  );

  if (existingIndex >= 0) {
    // Update existing
    tombstones[existingIndex] = tombstone;
  } else {
    // Add new
    tombstones.push(tombstone);
  }

  await saveMessageTombstones(tombstone.profileId, tombstones);
}

/**
 * Bulk upsert tombstones.
 * Used during sync/restore.
 */
export async function bulkUpsertMessageTombstones(
  profileId: string,
  newTombstones: MessageTombstone[]
): Promise<void> {
  const existing = await loadMessageTombstones(profileId);

  // Merge: prefer existing if same ID (don't overwrite with older data)
  const merged = [...existing];

  for (const newTomb of newTombstones) {
    const existingIndex = merged.findIndex(
      (t) => t.tombstoneId === newTomb.tombstoneId
    );

    if (existingIndex >= 0) {
      // Keep existing but could merge evidence
      const existing = merged[existingIndex];
      if (newTomb.relayEvidence && !existing.relayEvidence) {
        merged[existingIndex] = {
          ...existing,
          relayEvidence: newTomb.relayEvidence,
        };
      }
    } else {
      merged.push(newTomb);
    }
  }

  await saveMessageTombstones(profileId, merged);
}

/**
 * Remove a tombstone by ID.
 * Rarely needed (undo?), but supported for completeness.
 */
export async function removeMessageTombstone(
  profileId: string,
  tombstoneId: TombstoneId
): Promise<void> {
  const tombstones = await loadMessageTombstones(profileId);
  const filtered = tombstones.filter((t) => t.tombstoneId !== tombstoneId);

  if (filtered.length !== tombstones.length) {
    await saveMessageTombstones(profileId, filtered);
  }
}

/**
 * Clear all tombstones for a profile.
 * Used during account wipe/reset.
 */
export async function clearMessageTombstones(profileId: string): Promise<void> {
  if (!profileId) {
    throw new Error("[tombstone-store] clear called without profileId");
  }

  try {
    const key = TOMBSTONE_STORE_KEY(profileId);
    localStorage.removeItem(key);
  } catch (err) {
    console.error("[tombstone-store] clear error", err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Query Operations
// ---------------------------------------------------------------------------

/**
 * Find tombstones matching a specific conversation.
 */
export async function findTombstonesForConversation(
  profileId: string,
  conversationId: string
): Promise<MessageTombstone[]> {
  const tombstones = await loadMessageTombstones(profileId);
  return tombstones.filter((t) => t.conversationId === conversationId);
}

/**
 * Find tombstones targeting specific message IDs.
 */
export async function findTombstonesForMessageIds(
  profileId: string,
  messageIds: string[]
): Promise<MessageTombstone[]> {
  const tombstones = await loadMessageTombstones(profileId);
  return tombstones.filter((t) =>
    t.targetMessageIdentityIds.some((id) => messageIds.includes(id))
  );
}

/**
 * Check if a message is tombstoned (hidden) in a given context.
 *
 * A message is tombstoned if:
 * - Any tombstone matches its identity IDs
 * - Tombstone scope is "local" (always applies)
 * - Tombstone scope is "network" (applies to all in conversation)
 */
export async function isMessageTombstoned(
  profileId: string,
  messageIdentityIds: string[],
  conversationId: string
): Promise<boolean> {
  const tombstones = await loadMessageTombstones(profileId);

  for (const tomb of tombstones) {
    // Must be in same conversation
    if (tomb.conversationId !== conversationId) {
      continue;
    }

    // Check identity overlap
    const matches = tomb.targetMessageIdentityIds.some((id) =>
      messageIdentityIds.includes(id)
    );

    if (matches) {
      return true;
    }
  }

  return false;
}

/**
 * Get all local tombstones (Delete for Me).
 */
export async function getLocalTombstones(
  profileId: string
): Promise<LocalMessageTombstone[]> {
  const tombstones = await loadMessageTombstones(profileId);
  return tombstones.filter((t): t is LocalMessageTombstone =>
    t.scope === "local"
  );
}

/**
 * Get all network tombstones (Delete for Everyone).
 */
export async function getNetworkTombstones(
  profileId: string
): Promise<NetworkMessageTombstone[]> {
  const tombstones = await loadMessageTombstones(profileId);
  return tombstones.filter((t): t is NetworkMessageTombstone =>
    t.scope === "network"
  );
}

/**
 * Find tombstone by command event ID.
 * Used to prevent duplicate processing of network deletes.
 */
export async function findTombstoneByCommandEventId(
  profileId: string,
  commandEventId: string
): Promise<NetworkMessageTombstone | null> {
  const tombstones = await loadMessageTombstones(profileId);
  const found = tombstones.find(
    (t): t is NetworkMessageTombstone =>
      t.scope === "network" && t.commandEventId === commandEventId
  );
  return found || null;
}

// ---------------------------------------------------------------------------
// Sync/Export Support
// ---------------------------------------------------------------------------

/**
 * Export tombstones for account backup/sync.
 */
export async function exportTombstonesForSync(
  profileId: string
): Promise<MessageTombstone[]> {
  // Export all tombstones - both local and network
  // Local tombstones are important for "delete for me" to survive sync
  return loadMessageTombstones(profileId);
}

/**
 * Import tombstones from account backup/sync.
 */
export async function importTombstonesFromSync(
  profileId: string,
  importedTombstones: MessageTombstone[]
): Promise<void> {
  // Validate imported data
  const valid = importedTombstones.filter((t) => {
    if (!t.tombstoneId || !t.profileId || !t.conversationId) {
      console.warn("[tombstone-store] skipping invalid tombstone", t);
      return false;
    }
    // Ensure profileId matches
    if (t.profileId !== profileId) {
      console.warn("[tombstone-store] skipping tombstone for wrong profile");
      return false;
    }
    return true;
  });

  await bulkUpsertMessageTombstones(profileId, valid);
}
