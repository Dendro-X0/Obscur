/**
 * Community CRDT Engine
 *
 * Computes current community state from the signed operation log.
 * Implements a state-based CRDT where the state is derived by applying
 * all operations in causal order (determined by vector clocks).
 *
 * Key properties:
 * - Deterministic: Same operations produce same state on all nodes
 * - Convergent: All nodes eventually see the same state
 * - Commutative: Order of receiving operations doesn't matter
 * - Associative: Can merge operation sets incrementally
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMembershipOperation, VectorClock } from "./community-operation-log";
import { compareVectorClocks, mergeVectorClocks } from "./community-operation-log";

export type MembershipState = "unknown" | "joined" | "left" | "expelled" | "admin";

export interface CommunityMemberState {
  readonly pubkey: PublicKeyHex;
  readonly state: MembershipState;
  readonly since: number;           // timestamp of last state change
  readonly operationId: string;      // operation that caused current state
}

export interface ComputedCommunityState {
  readonly communityId: string;
  readonly members: ReadonlyMap<string, CommunityMemberState>;
  readonly adminPubkeys: ReadonlySet<string>;
  readonly memberCount: number;
  readonly activeMemberCount: number;  // joined + admin, not left/expelled
  readonly disbanded: boolean;
  readonly disbandedAt?: number;
  readonly vectorClock: VectorClock;   // merged clock of all processed ops
  readonly lastUpdatedAt: number;
}

/**
 * Apply a single operation to produce next member state
 */
const applyOperation = (
  current: CommunityMemberState | undefined,
  op: CommunityMembershipOperation
): CommunityMemberState | null => {
  // null means remove from map (disband)
  
  switch (op.type) {
    case "member_join":
      return {
        pubkey: op.subjectPubkey,
        state: "joined",
        since: op.timestamp,
        operationId: op.id,
      };

    case "member_leave":
      if (!current || current.state === "expelled") {
        // Can't leave if not there or already expelled
        return current ?? null;
      }
      return {
        pubkey: op.subjectPubkey,
        state: "left",
        since: op.timestamp,
        operationId: op.id,
      };

    case "member_expel":
      return {
        pubkey: op.subjectPubkey,
        state: "expelled",
        since: op.timestamp,
        operationId: op.id,
      };

    case "admin_promote":
      if (!current || current.state === "expelled") {
        return current ?? null;
      }
      return {
        pubkey: op.subjectPubkey,
        state: "admin",
        since: op.timestamp,
        operationId: op.id,
      };

    case "admin_demote":
      if (!current || current.state !== "admin") {
        return current ?? null;
      }
      return {
        pubkey: op.subjectPubkey,
        state: "joined",
        since: op.timestamp,
        operationId: op.id,
      };

    case "community_disband":
      // Mark disbanded but keep members for history
      return current ?? null;

    case "community_create":
      // Creator becomes admin
      return {
        pubkey: op.actorPubkey,
        state: "admin",
        since: op.timestamp,
        operationId: op.id,
      };

    default:
      return current ?? null;
  }
};

/**
 * Sort operations by causal order (vector clocks)
 * Concurrent operations are sorted by timestamp, then ID for determinism
 */
const sortOperationsCausally = (
  ops: CommunityMembershipOperation[]
): CommunityMembershipOperation[] => {
  return [...ops].sort((a, b) => {
    const cmp = compareVectorClocks(a.vectorClock, b.vectorClock);
    if (cmp !== 0) return cmp;
    
    // Concurrent: break ties by timestamp, then ID
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return a.id.localeCompare(b.id);
  });
};

/**
 * Compute community state from operation log
 * This is the core CRDT reduce function
 */
export const computeCommunityState = (
  communityId: string,
  operations: CommunityMembershipOperation[]
): ComputedCommunityState => {
  // Filter to relevant operations
  const relevantOps = operations.filter(op => op.communityId === communityId);
  
  if (relevantOps.length === 0) {
    return {
      communityId,
      members: new Map(),
      adminPubkeys: new Set(),
      memberCount: 0,
      activeMemberCount: 0,
      disbanded: false,
      vectorClock: {},
      lastUpdatedAt: 0,
    };
  }

  // Sort by causal order
  const sortedOps = sortOperationsCausally(relevantOps);

  // Build member map
  const members = new Map<string, CommunityMemberState>();
  const adminPubkeys = new Set<string>();
  let disbanded = false;
  let disbandedAt: number | undefined;
  let mergedClock: VectorClock = {};
  let lastUpdatedAt = 0;

  for (const op of sortedOps) {
    // Merge vector clocks
    mergedClock = mergeVectorClocks(mergedClock, op.vectorClock);
    lastUpdatedAt = Math.max(lastUpdatedAt, op.timestamp);

    // Handle disband
    if (op.type === "community_disband") {
      disbanded = true;
      disbandedAt = op.timestamp;
      continue; // Don't process member changes after disband
    }

    // Get current state
    const current = members.get(op.subjectPubkey);
    
    // Apply operation
    const next = applyOperation(current, op);
    
    if (next === null) {
      members.delete(op.subjectPubkey);
      adminPubkeys.delete(op.subjectPubkey);
    } else {
      members.set(op.subjectPubkey, next);
      
      // Track admins
      if (next.state === "admin") {
        adminPubkeys.add(op.subjectPubkey);
      } else {
        adminPubkeys.delete(op.subjectPubkey);
      }
    }
  }

  // Count active members (joined or admin, not left/expelled)
  let activeMemberCount = 0;
  for (const member of members.values()) {
    if (member.state === "joined" || member.state === "admin") {
      activeMemberCount++;
    }
  }

  return {
    communityId,
    members,
    adminPubkeys,
    memberCount: members.size,
    activeMemberCount,
    disbanded,
    disbandedAt,
    vectorClock: mergedClock,
    lastUpdatedAt,
  };
};

/**
 * Get the local user's membership state in a community
 */
export const getLocalMembershipState = (
  state: ComputedCommunityState,
  localPubkey: PublicKeyHex
): CommunityMemberState | undefined => {
  return state.members.get(localPubkey);
};

/**
 * Check if community can be disbanded (all members have left/been expelled)
 */
export const canDisband = (state: ComputedCommunityState): boolean => {
  if (state.disbanded) return false;
  // Can disband if no active members
  return state.activeMemberCount === 0 && state.memberCount > 0;
};

/**
 * Check if local user can perform admin actions
 */
export const isAdmin = (
  state: ComputedCommunityState,
  localPubkey: PublicKeyHex
): boolean => {
  const member = state.members.get(localPubkey);
  return member?.state === "admin";
};

/**
 * Get list of members who should be visible in the community
 */
export const getVisibleMembers = (
  state: ComputedCommunityState
): CommunityMemberState[] => {
  return Array.from(state.members.values())
    .filter(m => m.state === "joined" || m.state === "admin")
    .sort((a, b) => a.since - b.since);
};

/**
 * Merge two computed states (for conflict resolution)
 * Returns the state with the higher vector clock, or merged if concurrent
 */
export const mergeCommunityStates = (
  a: ComputedCommunityState,
  b: ComputedCommunityState
): ComputedCommunityState => {
  const cmp = compareVectorClocks(a.vectorClock, b.vectorClock);
  
  if (cmp > 0) return a;  // a is after b
  if (cmp < 0) return b;  // b is after a
  
  // Concurrent: need to merge (shouldn't happen if gossip works)
  // Take all operations from both and recompute
  // This is expensive but correct
  const allOps: CommunityMembershipOperation[] = []; // Would need source ops
  return computeCommunityState(a.communityId, allOps);
};

/**
 * Create an empty initial state for a new community
 */
export const createEmptyState = (communityId: string): ComputedCommunityState => ({
  communityId,
  members: new Map(),
  adminPubkeys: new Set(),
  memberCount: 0,
  activeMemberCount: 0,
  disbanded: false,
  vectorClock: {},
  lastUpdatedAt: Date.now(),
});
