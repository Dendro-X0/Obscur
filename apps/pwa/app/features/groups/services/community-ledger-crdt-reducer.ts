/**
 * Community Ledger CRDT Reducer
 * 
 * This is an enhanced version of the community ledger that uses OR-Set
 * (Observed-Remove Set) semantics for membership tracking.
 * 
 * Key improvement: Member additions from all sources are preserved during merge,
 * preventing the "member list thinning" issue where concurrent syncs would
 * overwrite each other and lose members.
 * 
 * The OR-Set ensures that:
 * - Add wins over remove (a member added on any device stays in the set)
 * - Concurrent joins from different devices all get preserved
 * - The merge of two member lists is the union, not the intersection
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityControlEvent } from "@dweb/core/community-control-event-contracts";
import {
  createORSet,
  addToORSet,
  removeFromORSet,
  mergeORSets,
  queryORSet,
  orSetToArray,
  serializeORSet,
  deserializeORSet,
  type ORSet,
} from "@/app/shared/crdt";

export type CommunityMemberLifecycleStatus = "member" | "left" | "expelled";

/**
 * Individual member state with CRDT metadata
 */
export type CommunityMemberState = Readonly<{
  status: CommunityMemberLifecycleStatus;
  latestStatusTimestamp: number;
  // Track which device/actor made the last change
  lastActor?: string;
}>;

/**
 * Enhanced community ledger state using OR-Set for membership
 */
export type CommunityLedgerCRDTState = Readonly<{
  // OR-Set for membership: tracks all adds and removes
  memberSet: ORSet<PublicKeyHex>;
  // Per-member state (status, timestamps)
  memberStates: Readonly<Record<PublicKeyHex, CommunityMemberState>>;
  // Community-level events
  disbandedAt?: number;
  // Metadata
  version: number;
  lastModifiedAt: number;
}>;

/**
 * Events that can be applied to the community ledger
 */
export type CommunityLedgerCRDTEvent =
  | Readonly<{ type: "MEMBER_JOINED"; pubkey: PublicKeyHex; timestamp: number; actor?: string }>
  | Readonly<{ type: "MEMBER_LEFT"; pubkey: PublicKeyHex; timestamp: number; actor?: string }>
  | Readonly<{ type: "MEMBER_EXPELLED"; pubkey: PublicKeyHex; timestamp: number; actor?: string }>
  | Readonly<{ type: "COMMUNITY_DISBANDED"; timestamp: number; actor?: string }>
  // Merge event: incorporates state from another device/source
  | Readonly<{ type: "MERGE_STATE"; otherState: CommunityLedgerCRDTState; timestamp: number }>;

const INITIAL_MEMBER_TIMESTAMP = 0;

/**
 * Create empty community ledger state
 */
export const createCommunityLedgerCRDTState = (
  initialMembers: ReadonlyArray<PublicKeyHex> = [],
  actor?: string
): CommunityLedgerCRDTState => {
  const now = Date.now();
  let memberSet = createORSet<PublicKeyHex>();
  const memberStates: Record<PublicKeyHex, CommunityMemberState> = {};

  for (const pubkey of initialMembers) {
    memberSet = addToORSet(memberSet, pubkey);
    memberStates[pubkey] = {
      status: "member",
      latestStatusTimestamp: INITIAL_MEMBER_TIMESTAMP,
      lastActor: actor,
    };
  }

  return {
    memberSet,
    memberStates,
    version: 1,
    lastModifiedAt: now,
  };
};

/**
 * Get current active members from the OR-Set
 * This is the key improvement: it queries the set, which preserves
 * all concurrent additions
 */
export const getActiveMembers = (state: CommunityLedgerCRDTState): PublicKeyHex[] => {
  // Filter to only those with "member" status (not left/expelled)
  return orSetToArray(state.memberSet).filter((pubkey) => {
    const memberState = state.memberStates[pubkey];
    return memberState?.status === "member";
  });
};

/**
 * Check if a pubkey is an active member
 */
export const isActiveMember = (
  state: CommunityLedgerCRDTState,
  pubkey: PublicKeyHex
): boolean => {
  const inSet = queryORSet(state.memberSet).has(pubkey);
  const memberState = state.memberStates[pubkey];
  return inSet && memberState?.status === "member";
};

/**
 * Reduce/apply an event to the community ledger
 * 
 * This is the core CRDT operation. Each event is an immutable operation
 * that adds to the set. The OR-Set ensures that:
 * - All adds are preserved (add wins)
 * - Removes are tracked separately
 * - Querying gives you the set of all added-but-not-removed items
 */
export const reduceCommunityLedgerCRDT = (
  current: CommunityLedgerCRDTState,
  event: CommunityLedgerCRDTEvent
): CommunityLedgerCRDTState => {
  // Community disbanded - no more changes except disband updates
  if (current.disbandedAt !== undefined && event.type !== "COMMUNITY_DISBANDED") {
    return current;
  }

  const now = Date.now();

  switch (event.type) {
    case "COMMUNITY_DISBANDED": {
      if (current.disbandedAt !== undefined && event.timestamp <= current.disbandedAt) {
        return current;
      }
      return {
        ...current,
        disbandedAt: event.timestamp,
        lastModifiedAt: now,
        version: current.version + 1,
      };
    }

    case "MEMBER_JOINED": {
      // OR-Set: Add the member (preserves concurrent adds)
      const newMemberSet = addToORSet(current.memberSet, event.pubkey);
      
      // Update member state if this is newer
      const existingState = current.memberStates[event.pubkey];
      if (existingState && event.timestamp < existingState.latestStatusTimestamp) {
        // This event is older, just update the set but not the state
        return {
          ...current,
          memberSet: newMemberSet,
          lastModifiedAt: now,
        };
      }

      return {
        ...current,
        memberSet: newMemberSet,
        memberStates: {
          ...current.memberStates,
          [event.pubkey]: {
            status: "member",
            latestStatusTimestamp: event.timestamp,
            lastActor: event.actor,
          },
        },
        lastModifiedAt: now,
        version: current.version + 1,
      };
    }

    case "MEMBER_LEFT":
    case "MEMBER_EXPELLED": {
      // OR-Set: Add to removes set (but keeps in adds)
      const newMemberSet = removeFromORSet(current.memberSet, event.pubkey);

      // Update member state
      const existingState = current.memberStates[event.pubkey];
      if (existingState && event.timestamp < existingState.latestStatusTimestamp) {
        return {
          ...current,
          memberSet: newMemberSet,
          lastModifiedAt: now,
        };
      }

      return {
        ...current,
        memberSet: newMemberSet,
        memberStates: {
          ...current.memberStates,
          [event.pubkey]: {
            status: event.type === "MEMBER_LEFT" ? "left" : "expelled",
            latestStatusTimestamp: event.timestamp,
            lastActor: event.actor,
          },
        },
        lastModifiedAt: now,
        version: current.version + 1,
      };
    }

    case "MERGE_STATE": {
      // Merge two CRDT states - this is the key operation!
      // OR-Set merge: union of adds, union of removes
      const mergedMemberSet = mergeORSets(current.memberSet, event.otherState.memberSet);

      // Merge member states: LWW (Last Write Wins) per member
      const mergedMemberStates: Record<PublicKeyHex, CommunityMemberState> = {
        ...current.memberStates,
      };

      for (const [pubkey, otherState] of Object.entries(event.otherState.memberStates)) {
        const existingState = mergedMemberStates[pubkey];
        if (!existingState || otherState.latestStatusTimestamp > existingState.latestStatusTimestamp) {
          mergedMemberStates[pubkey] = otherState;
        }
      }

      // DisbandedAt: take the earlier one (once disbanded, always disbanded)
      const mergedDisbandedAt =
        current.disbandedAt !== undefined && event.otherState.disbandedAt !== undefined
          ? Math.min(current.disbandedAt, event.otherState.disbandedAt)
          : current.disbandedAt ?? event.otherState.disbandedAt;

      return {
        memberSet: mergedMemberSet,
        memberStates: mergedMemberStates,
        disbandedAt: mergedDisbandedAt,
        lastModifiedAt: now,
        version: current.version + 1,
      };
    }

    default:
      return current;
  }
};

/**
 * Convert from legacy CommunityControlEvent to CRDT event
 */
export const toCommunityLedgerCRDTEventFromControlEvent = (
  event: CommunityControlEvent,
  actor?: string
): CommunityLedgerCRDTEvent | null => {
  switch (event.eventType) {
    case "COMMUNITY_MEMBER_JOINED":
      return {
        type: "MEMBER_JOINED",
        pubkey: event.subjectPublicKeyHex,
        timestamp: event.createdAtUnixMs,
        actor,
      };
    case "COMMUNITY_MEMBER_LEFT":
      return {
        type: "MEMBER_LEFT",
        pubkey: event.subjectPublicKeyHex,
        timestamp: event.createdAtUnixMs,
        actor,
      };
    case "COMMUNITY_MEMBER_EXPELLED":
      return {
        type: "MEMBER_EXPELLED",
        pubkey: event.subjectPublicKeyHex,
        timestamp: event.createdAtUnixMs,
        actor,
      };
    case "COMMUNITY_DISBANDED":
      return {
        type: "COMMUNITY_DISBANDED",
        timestamp: event.createdAtUnixMs,
        actor,
      };
    default:
      return null;
  }
};

/**
 * Serialize CRDT state for storage/transmission
 */
export const serializeCommunityLedgerCRDT = (
  state: CommunityLedgerCRDTState
): string => {
  return JSON.stringify({
    memberSet: serializeORSet(state.memberSet),
    memberStates: state.memberStates,
    disbandedAt: state.disbandedAt,
    version: state.version,
    lastModifiedAt: state.lastModifiedAt,
  });
};

/**
 * Deserialize CRDT state from storage/transmission
 */
export const deserializeCommunityLedgerCRDT = (
  json: string
): CommunityLedgerCRDTState | null => {
  try {
    const parsed = JSON.parse(json);
    return {
      memberSet: deserializeORSet(parsed.memberSet),
      memberStates: parsed.memberStates,
      disbandedAt: parsed.disbandedAt,
      version: parsed.version,
      lastModifiedAt: parsed.lastModifiedAt,
    };
  } catch {
    return null;
  }
};

/**
 * Migration: Convert legacy state to CRDT state
 */
export const migrateLegacyToCRDT = (
  legacyMembers: ReadonlyArray<PublicKeyHex>,
  actor?: string
): CommunityLedgerCRDTState => {
  return createCommunityLedgerCRDTState(legacyMembers, actor);
};
