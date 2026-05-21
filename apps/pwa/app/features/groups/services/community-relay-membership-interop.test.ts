import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  classifyRelayMembershipEvent,
  RELAY_KIND_GROUP_MEMBERS,
  RELAY_KIND_MEMBERSHIP_SIGNAL,
  RELAY_KIND_RELAY_JOIN,
  RELAY_KIND_RELAY_LEAVE,
} from "./community-relay-membership-interop";

const GROUP_ID = "test-group-id";
const PK_A = "a".repeat(64) as PublicKeyHex;
const PK_B = "b".repeat(64) as PublicKeyHex;

describe("community-relay-membership-interop", () => {
  it("classifies Obscur relay join (9021) from foreign clients", () => {
    const signal = classifyRelayMembershipEvent({
      id: "join-1",
      kind: RELAY_KIND_RELAY_JOIN,
      pubkey: PK_B,
      created_at: 1_700_000_000,
      tags: [["h", GROUP_ID]],
    }, GROUP_ID);
    expect(signal).toEqual({
      kind: "relay_join",
      groupId: GROUP_ID,
      createdAtUnixMs: 1_700_000_000_000,
      logicalEventId: "join-1",
      subjectPubkey: PK_B,
    });
  });

  it("classifies relay leave (9022)", () => {
    const signal = classifyRelayMembershipEvent({
      id: "leave-1",
      kind: RELAY_KIND_RELAY_LEAVE,
      pubkey: PK_B,
      created_at: 1_700_000_010,
      tags: [["h", GROUP_ID]],
    }, GROUP_ID);
    expect(signal?.kind).toBe("relay_leave");
    expect(signal?.subjectPubkey).toBe(PK_B);
  });

  it("classifies member roster snapshot (39002)", () => {
    const signal = classifyRelayMembershipEvent({
      id: "roster-1",
      kind: RELAY_KIND_GROUP_MEMBERS,
      pubkey: PK_A,
      created_at: 1_700_000_020,
      tags: [["h", GROUP_ID], ["p", PK_A], ["p", PK_B]],
    }, GROUP_ID);
    expect(signal?.kind).toBe("roster_seed");
    expect(signal?.rosterMemberPubkeys).toEqual([PK_A, PK_B]);
  });

  it("ignores Obscur CRDT gossip on kind 39001", () => {
    const signal = classifyRelayMembershipEvent({
      id: "gossip-1",
      kind: RELAY_KIND_MEMBERSHIP_SIGNAL,
      pubkey: PK_A,
      created_at: 1_700_000_030,
      tags: [["d", "community-abc"], ["t", "membership-delta"]],
    }, GROUP_ID);
    expect(signal?.kind).toBe("obscur_gossip_delta");
  });

  it("classifies alternate-client join on kind 39001 with h tag", () => {
    const signal = classifyRelayMembershipEvent({
      id: "alt-join-1",
      kind: RELAY_KIND_MEMBERSHIP_SIGNAL,
      pubkey: PK_B,
      created_at: 1_700_000_040,
      tags: [["h", GROUP_ID]],
    }, GROUP_ID);
    expect(signal?.kind).toBe("relay_join");
    expect(signal?.subjectPubkey).toBe(PK_B);
  });

  it("returns null for unrelated group id", () => {
    const signal = classifyRelayMembershipEvent({
      id: "join-other",
      kind: RELAY_KIND_RELAY_JOIN,
      pubkey: PK_B,
      created_at: 1_700_000_000,
      tags: [["h", "other-group"]],
    }, GROUP_ID);
    expect(signal).toBeNull();
  });
});
