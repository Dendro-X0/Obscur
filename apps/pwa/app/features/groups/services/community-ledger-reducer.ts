import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityControlEvent } from "@dweb/core/community-control-event-contracts";
import type { GroupMembershipStatus } from "../types";

export type CommunityMemberLifecycleStatus = "member" | "left" | "expelled";

export type CommunityMemberLedger = Readonly<{
  status: CommunityMemberLifecycleStatus;
  latestStatusTimestamp: number;
}>;

export type CommunityLedgerState = Readonly<{
  members: Readonly<Record<PublicKeyHex, CommunityMemberLedger>>;
  disbandedAt?: number;
}>;

export type CommunityLedgerEvent =
  | Readonly<{ type: "MEMBER_JOINED"; pubkey: PublicKeyHex; timestamp: number }>
  | Readonly<{ type: "MEMBER_LEFT"; pubkey: PublicKeyHex; timestamp: number }>
  | Readonly<{ type: "MEMBER_EXPELLED"; pubkey: PublicKeyHex; timestamp: number }>
  | Readonly<{ type: "COMMUNITY_DISBANDED"; timestamp: number }>;

const INITIAL_MEMBER_TIMESTAMP = 0;

export const createCommunityLedgerState = (initialMembers: ReadonlyArray<PublicKeyHex> = []): CommunityLedgerState => {
  if (initialMembers.length === 0) return { members: {} };
  const members: Record<PublicKeyHex, CommunityMemberLedger> = {} as Record<PublicKeyHex, CommunityMemberLedger>;
  for (const pubkey of initialMembers) {
    members[pubkey] = { status: "member", latestStatusTimestamp: INITIAL_MEMBER_TIMESTAMP };
  }
  return { members };
};

export const reduceCommunityLedger = (
  current: CommunityLedgerState,
  event: CommunityLedgerEvent
): CommunityLedgerState => {
  if (current.disbandedAt !== undefined && event.type !== "COMMUNITY_DISBANDED") return current;

  if (event.type === "COMMUNITY_DISBANDED") {
    if (current.disbandedAt !== undefined && event.timestamp <= current.disbandedAt) return current;
    return { ...current, disbandedAt: event.timestamp };
  }

  const existing = current.members[event.pubkey];
  if (existing && event.timestamp < existing.latestStatusTimestamp) {
    return current;
  }

  const nextStatus: CommunityMemberLifecycleStatus =
    event.type === "MEMBER_JOINED" ? "member" :
      event.type === "MEMBER_LEFT" ? "left" : "expelled";

  if (existing && existing.status === nextStatus && existing.latestStatusTimestamp === event.timestamp) {
    return current;
  }

  return {
    ...current,
    members: {
      ...current.members,
      [event.pubkey]: {
        status: nextStatus,
        latestStatusTimestamp: event.timestamp
      }
    }
  };
};

export const toCommunityLedgerEventFromControlEvent = (
  event: CommunityControlEvent,
): CommunityLedgerEvent | null => {
  switch (event.eventType) {
    case "COMMUNITY_MEMBER_JOINED":
      return {
        type: "MEMBER_JOINED",
        pubkey: event.subjectPublicKeyHex,
        timestamp: event.createdAtUnixMs,
      };
    case "COMMUNITY_MEMBER_LEFT":
      return {
        type: "MEMBER_LEFT",
        pubkey: event.subjectPublicKeyHex,
        timestamp: event.createdAtUnixMs,
      };
    case "COMMUNITY_MEMBER_EXPELLED":
      return {
        type: "MEMBER_EXPELLED",
        pubkey: event.subjectPublicKeyHex,
        timestamp: event.createdAtUnixMs,
      };
    case "COMMUNITY_DISBANDED":
      return {
        type: "COMMUNITY_DISBANDED",
        timestamp: event.createdAtUnixMs,
      };
    default:
      return null;
  }
};

const selectMembersByStatus = (
  state: CommunityLedgerState,
  status: CommunityMemberLifecycleStatus
): ReadonlyArray<PublicKeyHex> => {
  const result: PublicKeyHex[] = [];
  const entries = Object.entries(state.members) as Array<[PublicKeyHex, CommunityMemberLedger]>;
  for (const [pubkey, member] of entries) {
    if (member.status === status) result.push(pubkey);
  }
  return result;
};

export const selectActiveMembers = (state: CommunityLedgerState): ReadonlyArray<PublicKeyHex> => {
  if (state.disbandedAt !== undefined) return [];
  return selectMembersByStatus(state, "member");
};

export const selectLeftMembers = (state: CommunityLedgerState): ReadonlyArray<PublicKeyHex> => {
  return selectMembersByStatus(state, "left");
};

export const selectExpelledMembers = (state: CommunityLedgerState): ReadonlyArray<PublicKeyHex> => {
  return selectMembersByStatus(state, "expelled");
};

export const selectMembershipStatus = (
  state: CommunityLedgerState,
  myPublicKeyHex: PublicKeyHex | null
): GroupMembershipStatus => {
  if (!myPublicKeyHex) return "unknown";
  if (state.disbandedAt !== undefined) return "not_member";
  const mine = state.members[myPublicKeyHex];
  if (!mine) return "unknown";
  return mine.status === "member" ? "member" : "not_member";
};
