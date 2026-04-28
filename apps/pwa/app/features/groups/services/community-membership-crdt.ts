/**
 * Community Membership CRDT Container - Phase 1 Implementation
 * 
 * Replaces snapshot-based membership with OR-Set CRDT for robust
 * distributed membership tracking across devices.
 * 
 * This container provides:
 * - Add-wins semantics (re-joining works after leaving)
 * - Conflict-free merging across device boundaries
 * - Eventual consistency without centralized coordination
 * - Serializable state for persistence and gossip sync
 * 
 * @example
 * ```typescript
 * // Initialize membership container
 * const membership = createCommunityMembership('community-123', 'device-A');
 * 
 * // Alice joins
 * membership = addMember(membership, 'alice-pubkey', 'device-A', clock);
 * 
 * // Bob joins from another device
 * const remoteMembership = addMember(
 *   createCommunityMembership('community-123', 'device-B'),
 *   'bob-pubkey',
 *   'device-B',
 *   clockB
 * );
 * 
 * // Merge: both Alice and Bob are members
 * membership = mergeMembership(membership, remoteMembership);
 * queryMembers(membership); // Set { 'alice-pubkey', 'bob-pubkey' }
 * ```
 */

import type { DeviceId, VectorClock } from '@dweb/crdt/vector-clock';
import {
  createVectorClock,
  incrementClock,
  mergeClocks,
  vectorCompare,
} from '@dweb/crdt/vector-clock';
import type { ORSet } from '@dweb/crdt/or-set';
import {
  createORSet,
  addToORSet,
  removeFromORSet,
  mergeORSets,
  queryORSet,
  hasInORSet,
  compactORSet,
} from '@dweb/crdt/or-set';

/**
 * Feature flag for gradual CRDT rollout.
 * Set via runtime configuration or feature flags service.
 */
export const FEATURE_FLAGS = {
  useCRDTMembership: true,
  logCRDTOperations: true,
  enableGossipSync: false, // Phase 2
} as const;

/**
 * Community membership state using OR-Set CRDT.
 */
export interface CommunityMembership {
  /** Unique community identifier (conversation ID) */
  readonly communityId: string;
  
  /** Local device identifier */
  readonly localDeviceId: DeviceId;
  
  /** Member set with add-wins semantics */
  readonly memberSet: ORSet<string>;
  
  /** Current vector clock for this device */
  readonly vectorClock: VectorClock;
  
  /** Metadata for diagnostics */
  readonly metadata: MembershipMetadata;
}

/**
 * Metadata tracking for membership operations.
 */
export interface MembershipMetadata {
  /** When this container was created */
  readonly createdAt: number;
  
  /** Last operation timestamp */
  readonly lastOperationAt: number;
  
  /** Last modification timestamp (includes merges and delta applies) */
  readonly lastModifiedAt: number;
  
  /** Operation count for this container */
  readonly operationCount: number;
  
  /** Last merge timestamp (if any) */
  readonly lastMergeAt: number | null;
  
  /** Count of merges performed */
  readonly mergeCount: number;
  
  /** Devices seen in merges */
  readonly knownDevices: Set<DeviceId>;
}

/**
 * Member with full metadata (for admin/diagnostic views).
 */
export interface MemberWithMetadata {
  pubkey: string;
  addedAt: VectorClock;
  addedBy: DeviceId;
}

/**
 * Membership change event for reactive updates.
 */
export interface MembershipChangeEvent {
  type: 'added' | 'removed' | 'merged';
  pubkey?: string;
  timestamp: number;
  deviceId: DeviceId;
  previousCount: number;
  newCount: number;
}

/**
 * Create a new community membership container.
 */
export const createCommunityMembership = (
  communityId: string,
  localDeviceId: DeviceId,
  initialClock: VectorClock = createVectorClock(localDeviceId, 0)
): CommunityMembership => ({
  communityId,
  localDeviceId,
  memberSet: createORSet<string>(),
  vectorClock: initialClock,
  metadata: {
    createdAt: Date.now(),
    lastOperationAt: Date.now(),
    lastModifiedAt: Date.now(),
    operationCount: 0,
    lastMergeAt: null,
    mergeCount: 0,
    knownDevices: new Set([localDeviceId]),
  },
});

/**
 * Add a member to the community.
 * Uses add-wins semantics (idempotent, survives concurrent remove).
 */
export const addMember = (
  membership: CommunityMembership,
  pubkey: string,
  deviceId: DeviceId = membership.localDeviceId,
  clock?: VectorClock
): CommunityMembership => {
  const newClock = clock ?? incrementClock(membership.vectorClock, deviceId);
  
  const newMemberSet = addToORSet(
    membership.memberSet,
    pubkey,
    deviceId,
    newClock
  );
  
  if (FEATURE_FLAGS.logCRDTOperations) {
    logMembershipOperation('add', membership.communityId, pubkey, deviceId);
  }
  
  return {
    ...membership,
    memberSet: newMemberSet,
    vectorClock: newClock,
    metadata: {
      ...membership.metadata,
      lastOperationAt: Date.now(),
      lastModifiedAt: Date.now(),
      operationCount: membership.metadata.operationCount + 1,
      knownDevices: addToSet(membership.metadata.knownDevices, deviceId),
    },
  };
};

/**
 * Remove a member from the community.
 * In OR-Set, remove is "observed" and add-wins if concurrent.
 */
export const removeMember = (
  membership: CommunityMembership,
  pubkey: string,
  deviceId: DeviceId = membership.localDeviceId
): CommunityMembership => {
  const newMemberSet = removeFromORSet(membership.memberSet, pubkey);
  
  if (FEATURE_FLAGS.logCRDTOperations) {
    logMembershipOperation('remove', membership.communityId, pubkey, deviceId);
  }
  
  return {
    ...membership,
    memberSet: newMemberSet,
    metadata: {
      ...membership.metadata,
      lastOperationAt: Date.now(),
      lastModifiedAt: Date.now(),
      operationCount: membership.metadata.operationCount + 1,
    },
  };
};

/**
 * Merge two membership containers.
 * Commutative and associative (OR-Set properties).
 */
export const mergeMembership = (
  local: CommunityMembership,
  remote: CommunityMembership
): CommunityMembership => {
  // Validate same community
  if (local.communityId !== remote.communityId) {
    throw new MembershipError(
      `Cannot merge memberships from different communities: ${local.communityId} vs ${remote.communityId}`
    );
  }
  
  const mergedSet = mergeORSets(local.memberSet, remote.memberSet);
  const mergedClock = mergeClocks(local.vectorClock, remote.vectorClock);
  
  if (FEATURE_FLAGS.logCRDTOperations) {
    logMembershipMerge(local.communityId, local.localDeviceId, remote.localDeviceId);
  }
  
  return {
    ...local,
    memberSet: mergedSet,
    vectorClock: mergedClock,
    metadata: {
      ...local.metadata,
      lastOperationAt: Date.now(),
      lastModifiedAt: Date.now(),
      lastMergeAt: Date.now(),
      mergeCount: local.metadata.mergeCount + 1,
      knownDevices: unionSets(local.metadata.knownDevices, remote.metadata.knownDevices).add(remote.localDeviceId),
    },
  };
};

/**
 * Query current members (pubkeys only).
 */
export const queryMembers = (membership: CommunityMembership): Set<string> =>
  queryORSet(membership.memberSet);

/**
 * Check if a pubkey is a member.
 */
export const isMember = (membership: CommunityMembership, pubkey: string): boolean =>
  hasInORSet(membership.memberSet, pubkey);

/**
 * Get member count.
 */
export const getMemberCount = (membership: CommunityMembership): number =>
  queryMembers(membership).size;

/**
 * Query members with full metadata.
 */
export const queryMembersWithMetadata = (
  membership: CommunityMembership
): MemberWithMetadata[] => {
  const members: MemberWithMetadata[] = [];

  for (const [tag, item] of membership.memberSet.adds) {
    // Skip tombstoned entries
    if (membership.memberSet.removes.has(tag)) continue;

    members.push({
      pubkey: item.value,
      addedAt: item.addedAt,
      addedBy: item.addedBy,
    });
  }

  return members;
};

/**
 * Compact the membership set to remove tombstones.
 * Call periodically to reclaim memory.
 */
export const compactMembership = (
  membership: CommunityMembership
): CommunityMembership => ({
  ...membership,
  memberSet: compactORSet(membership.memberSet),
});

/**
 * Serialize membership to JSON-serializable format.
 */
export const serializeMembership = (
  membership: CommunityMembership
): SerializedMembership => ({
  communityId: membership.communityId,
  localDeviceId: membership.localDeviceId,
  memberSet: {
    adds: Array.from<[string, { value: string; addedAt: VectorClock; addedBy: DeviceId }]>(membership.memberSet.adds.entries()).map(([tag, item]) => ({
      tag,
      value: item.value,
      addedAt: item.addedAt,
      addedBy: item.addedBy,
    })),
    removes: Array.from(membership.memberSet.removes),
  },
  vectorClock: membership.vectorClock,
  metadata: {
    createdAt: membership.metadata.createdAt,
    lastOperationAt: membership.metadata.lastOperationAt,
    lastModifiedAt: membership.metadata.lastModifiedAt,
    operationCount: membership.metadata.operationCount,
    lastMergeAt: membership.metadata.lastMergeAt,
    mergeCount: membership.metadata.mergeCount,
    knownDevices: Array.from(membership.metadata.knownDevices),
  },
});

/**
 * Serialized membership structure.
 */
export interface SerializedMembership {
  communityId: string;
  localDeviceId: DeviceId;
  memberSet: {
    adds: Array<{
      tag: string;
      value: string;
      addedAt: VectorClock;
      addedBy: DeviceId;
    }>;
    removes: string[];
  };
  vectorClock: VectorClock;
  metadata: {
    createdAt: number;
    lastOperationAt: number;
    lastModifiedAt: number;
    operationCount: number;
    lastMergeAt: number | null;
    mergeCount: number;
    knownDevices: DeviceId[];
  };
}

/**
 * Deserialize membership from JSON.
 */
export const deserializeMembership = (
  data: SerializedMembership
): CommunityMembership => ({
  communityId: data.communityId,
  localDeviceId: data.localDeviceId,
  memberSet: {
    adds: new Map(
      data.memberSet.adds.map(({ tag, value, addedAt, addedBy }) => [
        tag,
        { value, addedAt, addedBy },
      ])
    ),
    removes: new Set(data.memberSet.removes),
  },
  vectorClock: data.vectorClock,
  metadata: {
    createdAt: data.metadata.createdAt,
    lastOperationAt: data.metadata.lastOperationAt,
    lastModifiedAt: data.metadata.lastModifiedAt,
    operationCount: data.metadata.operationCount,
    lastMergeAt: data.metadata.lastMergeAt,
    mergeCount: data.metadata.mergeCount,
    knownDevices: new Set(data.metadata.knownDevices),
  },
});

/**
 * Check if membership needs compaction.
 * Returns true if tombstone ratio exceeds threshold.
 */
export const needsCompaction = (
  membership: CommunityMembership,
  threshold: number = 0.5
): boolean => {
  const addsCount = membership.memberSet.adds.size;
  const removesCount = membership.memberSet.removes.size;
  
  if (addsCount === 0) return false;
  
  return removesCount / addsCount > threshold;
};

/**
 * Get membership diagnostics.
 */
export const getMembershipDiagnostics = (
  membership: CommunityMembership
): MembershipDiagnostics => ({
  communityId: membership.communityId,
  memberCount: getMemberCount(membership),
  addsCount: membership.memberSet.adds.size,
  removesCount: membership.memberSet.removes.size,
  tombstoneRatio: membership.memberSet.adds.size > 0
    ? membership.memberSet.removes.size / membership.memberSet.adds.size
    : 0,
  vectorClockSize: Object.keys(membership.vectorClock).length,
  knownDevices: membership.metadata.knownDevices.size,
  operationCount: membership.metadata.operationCount,
  mergeCount: membership.metadata.mergeCount,
  lastOperationAt: membership.metadata.lastOperationAt,
  lastMergeAt: membership.metadata.lastMergeAt,
  needsCompaction: needsCompaction(membership),
});

/**
 * Membership diagnostics for debugging.
 */
export interface MembershipDiagnostics {
  communityId: string;
  memberCount: number;
  addsCount: number;
  removesCount: number;
  tombstoneRatio: number;
  vectorClockSize: number;
  knownDevices: number;
  operationCount: number;
  mergeCount: number;
  lastOperationAt: number;
  lastMergeAt: number | null;
  needsCompaction: boolean;
}

/**
 * Custom error for membership operations.
 */
export class MembershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MembershipError';
  }
}

/**
 * Compare two membership containers.
 * Returns -1 if a has fewer members, 1 if more, 0 if equal.
 */
export const compareMembership = (
  a: CommunityMembership,
  b: CommunityMembership
): -1 | 0 | 1 => {
  const aCount = getMemberCount(a);
  const bCount = getMemberCount(b);
  
  if (aCount < bCount) return -1;
  if (aCount > bCount) return 1;
  
  // Equal count - compare vector clocks
  const vcCmp = vectorCompare(a.vectorClock, b.vectorClock);
  if (vcCmp === -1) return -1;
  if (vcCmp === 1) return 1;
  
  return 0;
};

/**
 * Create membership from legacy member list.
 * Used for migration from old snapshot format.
 */
export const migrateFromLegacy = (
  communityId: string,
  deviceId: DeviceId,
  legacyMembers: string[],
  clock: VectorClock = createVectorClock(deviceId, 1)
): CommunityMembership => {
  let membership = createCommunityMembership(communityId, deviceId, clock);
  
  for (const pubkey of legacyMembers) {
    membership = addMember(membership, pubkey, deviceId, clock);
    // Increment clock for each member to preserve order
    clock = incrementClock(clock, deviceId);
  }
  
  return membership;
};

// ============================================================================
// Delta State for Gossip Protocol (Phase 2)
// ============================================================================

/**
 * Membership delta for efficient synchronization.
 * Contains only changes since a known vector clock.
 */
export interface MembershipDelta {
  /** Adds since the reference clock */
  adds: Array<{ pubkey: string; deviceId: DeviceId; clock: VectorClock }>;
  /** Removes since the reference clock */
  removes: Array<{ pubkey: string; deviceId: DeviceId; clock: VectorClock }>;
  /** Reference clock (what the recipient already has) */
  sinceClock: VectorClock;
  /** Sender's current clock */
  senderClock: VectorClock;
}

/**
 * Create a delta containing changes since the given clock.
 */
export function createMembershipDelta(
  membership: CommunityMembership,
  sinceClock: VectorClock
): MembershipDelta {
  const adds: Array<{ pubkey: string; deviceId: string; clock: VectorClock }> = [];
  const removes: Array<{ pubkey: string; deviceId: string; clock: VectorClock }> = [];
  
  // Find adds that are newer than sinceClock
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const [tag, item] of membership.memberSet.adds) {
    const itemClock = item.addedAt;
    // Check if this add is newer than what recipient has
    if (vectorCompare(itemClock, sinceClock) > 0) {
      adds.push({
        pubkey: item.value,
        deviceId: item.addedBy,
        clock: itemClock,
      });
    }
  }
  
  // OR-Set tombstones currently do not retain per-remove clocks, so delta gossip
  // carries add operations only until the remove contract is upgraded.
  
  return {
    adds,
    removes,
    sinceClock,
    senderClock: membership.vectorClock,
  };
}

/**
 * Apply a delta to membership.
 */
export function applyMembershipDelta(
  membership: CommunityMembership,
  delta: MembershipDelta
): CommunityMembership {
  let updated = membership;
  
  // Apply adds
  for (const add of delta.adds) {
    updated = addMember(updated, add.pubkey, add.deviceId, add.clock);
  }
  
  // Apply removes
  for (const remove of delta.removes) {
    updated = removeMember(updated, remove.pubkey, remove.deviceId);
  }
  
  // Merge vector clocks and return new object
  return {
    ...updated,
    vectorClock: mergeClocks(updated.vectorClock, delta.senderClock),
    metadata: {
      ...updated.metadata,
      lastModifiedAt: Date.now(),
      operationCount: updated.metadata.operationCount + delta.adds.length + delta.removes.length,
    },
  };
}

/**
 * Get the current vector clock of a membership.
 */
export function getMembershipClock(membership: CommunityMembership): VectorClock {
  return membership.vectorClock;
}

/**
 * Check if there are any deltas for a specific device since a clock.
 */
export function hasDeltaForDevice(
  membership: CommunityMembership,
  deviceId: DeviceId,
  sinceClock: VectorClock
): boolean {
  const delta = createMembershipDelta(membership, sinceClock);
  return delta.adds.some(a => a.deviceId === deviceId) || 
         delta.removes.some(r => r.deviceId === deviceId);
}

// ============================================================================
// Private helpers
// ============================================================================

function addToSet<T>(set: Set<T>, value: T): Set<T> {
  const newSet = new Set(set);
  newSet.add(value);
  return newSet;
}

function unionSets<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a, ...b]);
}

function logMembershipOperation(
  type: 'add' | 'remove',
  communityId: string,
  pubkey: string,
  deviceId: DeviceId
): void {
  // Use application's logging system if available
  // Fall back to console in development
  const prefix = `[CRDT-Membership:${communityId}]`;
  const maskedPubkey = pubkey.slice(0, 8) + '...';
  
  if (typeof window !== 'undefined' && (window as unknown as { obscurAppEvents?: unknown }).obscurAppEvents) {
    // Use app's event system
    console.log(`${prefix} ${type}: ${maskedPubkey} by ${deviceId.slice(0, 8)}...`);
  } else {
    console.log(`${prefix} ${type}: ${maskedPubkey} by ${deviceId.slice(0, 8)}...`);
  }
}

function logMembershipMerge(
  communityId: string,
  localDevice: DeviceId,
  remoteDevice: DeviceId
): void {
  const prefix = `[CRDT-Membership:${communityId}]`;
  console.log(
    `${prefix} merge: ${localDevice.slice(0, 8)}... ← ${remoteDevice.slice(0, 8)}...`
  );
}
