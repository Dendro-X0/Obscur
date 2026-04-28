/**
 * CRDT Sync Protocol - Phase 5 Implementation
 *
 * Provides deterministic, conflict-free synchronization of CRDT state
 * across devices and backup/restore operations.
 *
 * Key Properties:
 * - Monotonic: Sync never loses already-merged state
 * - Associative: (A ⊔ B) ⊔ C = A ⊔ (B ⊔ C)
 * - Commutative: A ⊔ B = B ⊔ A
 * - Idempotent: A ⊔ A = A
 *
 * @module CRDTSyncProtocol
 */

import { mergeMembership } from "../../groups/services/community-membership-crdt.js";
import { mergeCallStates } from "../../messaging/services/call-state-crdt.js";
import { mergeMediaCASStores } from "../../vault/services/media-cas-store.js";

/** Sync namespace for scoping different CRDT types */
export type SyncNamespace =
  | "community-membership"
  | "presence-gossip"
  | "media-cas"
  | "call-state"
  | "chat-state"
  | "dm-conversations"
  | (string & {});

/** CRDT type discriminator */
export type CRDTType = "or-set" | "lww-register" | "g-counter" | "lww-element-set";

/** Serialized CRDT wrapper for transport/storage */
export interface SerializedCRDT {
  /** CRDT type */
  type: CRDTType;
  /** Namespace this CRDT belongs to */
  namespace: SyncNamespace;
  /** Entity ID (e.g., communityId, profileId) */
  entityId: string;
  /** Schema version for migration */
  schemaVersion: number;
  /** Serialized state (type-specific) */
  state: unknown;
  /** Metadata about this snapshot */
  metadata: {
    createdAt: number;
    deviceId: string;
    sequenceNumber: number;
  };
}

/** Sync operation result */
export interface SyncResult<T> {
  /** Merged result */
  merged: T;
  /** Whether local state was modified */
  localChanged: boolean;
  /** Whether remote state had new data */
  remoteHadNewData: boolean;
  /** Conflict resolutions applied */
  conflictsResolved: number;
}

/** Sync progress callback */
export type SyncProgressCallback = (progress: {
  phase: "deserialize" | "validate" | "merge" | "persist";
  namespace: SyncNamespace;
  entityId: string;
  percentComplete: number;
}) => void;

/** Sync options */
export interface SyncOptions {
  /** Device ID for this sync operation */
  deviceId: string;
  /** Progress callback */
  onProgress?: SyncProgressCallback;
  /** Validate checksums before merge */
  validateChecksums?: boolean;
  /** Max age for sync (reject older) */
  maxAgeMs?: number;
}

/** Namespace-specific sync handlers */
const syncHandlers: Map<
  SyncNamespace,
  {
    merge: (local: unknown, remote: unknown) => unknown;
    serialize: (state: unknown) => unknown;
    deserialize: (data: unknown) => unknown;
    validate: (state: unknown) => boolean;
  }
> = new Map();

/**
 * Register a sync handler for a namespace.
 */
export const registerSyncHandler = (
  namespace: SyncNamespace,
  handler: {
    merge: (local: unknown, remote: unknown) => unknown;
    serialize: (state: unknown) => unknown;
    deserialize: (data: unknown) => unknown;
    validate: (state: unknown) => boolean;
  }
): void => {
  syncHandlers.set(namespace, handler);
};

/**
 * Create a serialized CRDT snapshot.
 */
export const createSnapshot = <T>(
  type: CRDTType,
  namespace: SyncNamespace,
  entityId: string,
  state: T,
  deviceId: string,
  schemaVersion: number = 1
): SerializedCRDT => {
  const handler = syncHandlers.get(namespace);
  const serializedState = handler?.serialize(state) ?? state;

  return {
    type,
    namespace,
    entityId,
    schemaVersion,
    state: serializedState,
    metadata: {
      createdAt: Date.now(),
      deviceId,
      sequenceNumber: Date.now(), // Simple sequence - can be improved
    },
  };
};

/**
 * Sync two CRDT states deterministically.
 */
export const syncCRDTs = <T>(
  local: T,
  remote: SerializedCRDT,
  options: SyncOptions
): SyncResult<T> => {
  const handler = syncHandlers.get(remote.namespace);

  if (!handler) {
    throw new Error(`No sync handler registered for namespace: ${remote.namespace}`);
  }

  // Progress: deserialize
  options.onProgress?.({
    phase: "deserialize",
    namespace: remote.namespace,
    entityId: remote.entityId,
    percentComplete: 25,
  });

  // Deserialize remote state
  const remoteState = handler.deserialize(remote.state);

  // Progress: validate
  options.onProgress?.({
    phase: "validate",
    namespace: remote.namespace,
    entityId: remote.entityId,
    percentComplete: 50,
  });

  // Validate
  if (!handler.validate(remoteState)) {
    throw new Error(`Invalid CRDT state for ${remote.namespace}/${remote.entityId}`);
  }

  // Check max age
  if (options.maxAgeMs) {
    const age = Date.now() - remote.metadata.createdAt;
    if (age > options.maxAgeMs) {
      throw new Error(`CRDT snapshot too old: ${age}ms > ${options.maxAgeMs}ms`);
    }
  }

  // Progress: merge
  options.onProgress?.({
    phase: "merge",
    namespace: remote.namespace,
    entityId: remote.entityId,
    percentComplete: 75,
  });

  // Merge
  const merged = handler.merge(local, remoteState) as T;

  // Check if changed
  const localChanged = JSON.stringify(local) !== JSON.stringify(merged);
  const remoteHadNewData = JSON.stringify(remoteState) !== JSON.stringify(merged);

  // Progress: persist (caller handles actual persistence)
  options.onProgress?.({
    phase: "persist",
    namespace: remote.namespace,
    entityId: remote.entityId,
    percentComplete: 100,
  });

  return {
    merged,
    localChanged,
    remoteHadNewData,
    conflictsResolved: localChanged ? 1 : 0,
  };
};

/**
 * Batch sync multiple CRDTs.
 */
export const batchSync = <T extends Record<string, unknown>>(
  localStates: T,
  remoteSnapshots: SerializedCRDT[],
  options: SyncOptions
): { results: Map<string, SyncResult<unknown>>; allSucceeded: boolean } => {
  const results = new Map<string, SyncResult<unknown>>();
  let allSucceeded = true;

  for (const snapshot of remoteSnapshots) {
    const key = `${snapshot.namespace}:${snapshot.entityId}`;
    const local = localStates[key];

    try {
      const result = syncCRDTs(local, snapshot, options);
      results.set(key, result);
    } catch (err) {
      console.error(`[Sync] Failed to sync ${key}:`, err);
      allSucceeded = false;
    }
  }

  return { results, allSucceeded };
};

/**
 * Create incremental sync delta from local to remote.
 * Returns only the data remote is missing.
 */
export const createSyncDelta = <T>(
  local: T,
  remoteCheckpoint: unknown,
  namespace: SyncNamespace,
  entityId: string,
  deviceId: string
): SerializedCRDT | null => {
  // This is a placeholder for delta sync
  // Full implementation would compare vector clocks / state hashes
  // and only return missing elements

  // For now, return full snapshot (inefficient but correct)
  return createSnapshot(
    "or-set", // Default - actual type should be passed
    namespace,
    entityId,
    local,
    deviceId
  );
};

/**
 * Validate a sync snapshot before applying.
 */
export const validateSnapshot = (snapshot: unknown): snapshot is SerializedCRDT => {
  if (!snapshot || typeof snapshot !== "object") return false;

  const s = snapshot as Record<string, unknown>;

  return (
    typeof s.type === "string" &&
    typeof s.namespace === "string" &&
    typeof s.entityId === "string" &&
    typeof s.schemaVersion === "number" &&
    s.state !== undefined &&
    typeof s.metadata === "object" &&
    s.metadata !== null
  );
};

/**
 * Compute sync checksum for integrity verification.
 */
export const computeChecksum = (snapshot: SerializedCRDT): string => {
  // Simple checksum - in production use crypto hash
  const data = JSON.stringify({
    type: snapshot.type,
    namespace: snapshot.namespace,
    entityId: snapshot.entityId,
    state: snapshot.state,
  });

  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return hash.toString(16);
};

// Register default handlers for known namespaces

// Community Membership (OR-Set)
registerSyncHandler("community-membership", {
  merge: (local, remote) => mergeMembership(local as never, remote as never),
  serialize: (state) => state,
  deserialize: (data) => data,
  validate: (state) => Boolean(
      state &&
      typeof state === "object" &&
      "members" in state &&
      "adds" in state &&
      "removes" in state
    ),
});

// Media CAS (Custom merge)
registerSyncHandler("media-cas", {
  merge: (local, remote) => mergeMediaCASStores(local as never, remote as never),
  serialize: (state) => state,
  deserialize: (data) => data,
  validate: (state) => Boolean(state && typeof state === "object" && "items" in state),
});

// Call State (LWW-Register map)
registerSyncHandler("call-state", {
  merge: (local, remote) => mergeCallStates(local as never, remote as never, Date.now()),
  serialize: (state) => state,
  deserialize: (data) => data,
  validate: (state) => Boolean(state && typeof state === "object" && "calls" in state),
});

/**
 * Get sync statistics for debugging.
 */
export const getSyncStats = (): {
  registeredNamespaces: SyncNamespace[];
  handlerCount: number;
} => {
  return {
    registeredNamespaces: Array.from(syncHandlers.keys()),
    handlerCount: syncHandlers.size,
  };
};
