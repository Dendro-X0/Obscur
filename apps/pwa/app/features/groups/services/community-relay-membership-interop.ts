import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

/** NIP-29 / relay-visible kinds used across Obscur and other clients on the same relay. */
export const RELAY_KIND_GROUP_METADATA = 39000;
/** Member roster snapshot (`p` tags). Used by Obscur ingest as additive seed. */
export const RELAY_KIND_GROUP_MEMBERS = 39002;
/** Obscur + some clients: public join signal (not chat). */
export const RELAY_KIND_RELAY_JOIN = 9021;
/** Obscur + some clients: public leave signal (not chat). */
export const RELAY_KIND_RELAY_LEAVE = 9022;
/**
 * Kind 39001 is overloaded in the wild:
 * - Obscur CRDT gossip (`t: membership-delta`, `d: communityId`)
 * - Some relays/clients emit join-like signals with `h: groupId`
 */
export const RELAY_KIND_MEMBERSHIP_SIGNAL = 39001;

export type RelayMembershipSignalKind =
  | "relay_join"
  | "relay_leave"
  | "roster_seed"
  | "obscur_gossip_delta";

export type RelayMembershipSignal = Readonly<{
  kind: RelayMembershipSignalKind;
  groupId: string;
  createdAtUnixMs: number;
  logicalEventId: string;
  subjectPubkey?: PublicKeyHex;
  rosterMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>;

const normalizeGroupId = (value: string | undefined): string => value?.trim() ?? "";

const readGroupIdFromTags = (tags: ReadonlyArray<ReadonlyArray<string>>): string => {
  const hTag = tags.find((tag) => tag[0] === "h")?.[1];
  if (hTag && hTag.trim().length > 0) {
    return hTag.trim();
  }
  const dTag = tags.find((tag) => tag[0] === "d")?.[1];
  return dTag?.trim() ?? "";
};

const hasTag = (tags: ReadonlyArray<ReadonlyArray<string>>, name: string, value?: string): boolean => (
  tags.some((tag) => tag[0] === name && (value === undefined || tag[1] === value))
);

const toCreatedAtUnixMs = (createdAt: number): number => (
  createdAt < 1_000_000_000_000 ? Math.floor(createdAt * 1000) : Math.floor(createdAt)
);

const readRosterPubkeys = (tags: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<PublicKeyHex> => (
  tags
    .filter((tag) => tag[0] === "p" && typeof tag[1] === "string" && tag[1].trim().length > 0)
    .map((tag) => tag[1].trim() as PublicKeyHex)
);

/**
 * Classify relay-visible membership events from any Nostr client.
 * Returns null when the event is unrelated to membership for this group.
 */
export const classifyRelayMembershipEvent = (
  event: Pick<NostrEvent, "id" | "kind" | "pubkey" | "created_at" | "tags">,
  expectedGroupId: string,
): RelayMembershipSignal | null => {
  const groupId = normalizeGroupId(expectedGroupId);
  if (!groupId) {
    return null;
  }
  const eventGroupId = readGroupIdFromTags(event.tags);
  const createdAtUnixMs = toCreatedAtUnixMs(event.created_at);

  if (event.kind === RELAY_KIND_RELAY_JOIN) {
    if (eventGroupId !== groupId) {
      return null;
    }
    return {
      kind: "relay_join",
      groupId,
      createdAtUnixMs,
      logicalEventId: event.id,
      subjectPubkey: event.pubkey as PublicKeyHex,
    };
  }

  if (event.kind === RELAY_KIND_RELAY_LEAVE) {
    if (eventGroupId !== groupId) {
      return null;
    }
    return {
      kind: "relay_leave",
      groupId,
      createdAtUnixMs,
      logicalEventId: event.id,
      subjectPubkey: event.pubkey as PublicKeyHex,
    };
  }

  if (event.kind === RELAY_KIND_GROUP_MEMBERS) {
    if (eventGroupId !== groupId) {
      return null;
    }
    const rosterMemberPubkeys = readRosterPubkeys(event.tags);
    if (rosterMemberPubkeys.length === 0) {
      return null;
    }
    return {
      kind: "roster_seed",
      groupId,
      createdAtUnixMs,
      logicalEventId: event.id,
      rosterMemberPubkeys,
    };
  }

  if (event.kind === RELAY_KIND_MEMBERSHIP_SIGNAL) {
    if (hasTag(event.tags, "t", "membership-delta")) {
      const gossipGroupId = readGroupIdFromTags(event.tags);
      if (gossipGroupId.length === 0) {
        return null;
      }
      return {
        kind: "obscur_gossip_delta",
        groupId: gossipGroupId,
        createdAtUnixMs,
        logicalEventId: event.id,
        subjectPubkey: event.pubkey as PublicKeyHex,
      };
    }
    if (eventGroupId === groupId) {
      return {
        kind: "relay_join",
        groupId,
        createdAtUnixMs,
        logicalEventId: event.id,
        subjectPubkey: event.pubkey as PublicKeyHex,
      };
    }
    return null;
  }

  return null;
};

/** Kinds to subscribe for cross-client membership convergence (control plane, not chat). */
export const RELAY_MEMBERSHIP_SUBSCRIPTION_KINDS: ReadonlyArray<number> = [
  RELAY_KIND_GROUP_METADATA,
  RELAY_KIND_GROUP_MEMBERS,
  RELAY_KIND_MEMBERSHIP_SIGNAL,
  RELAY_KIND_RELAY_JOIN,
  RELAY_KIND_RELAY_LEAVE,
];
