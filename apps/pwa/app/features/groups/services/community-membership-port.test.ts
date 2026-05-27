import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { communityMembershipPortOwner } from "./community-membership-port-owner";

const actor = "a".repeat(64) as PublicKeyHex;
const peer = "b".repeat(64) as PublicKeyHex;

const scope = {
  groupId: "group-1",
  communityId: "group-1",
  relayUrl: "wss://nos.lol",
  myPublicKeyHex: actor,
} as const;

describe("community-membership-port-owner", () => {
  it("COMMUNITY_MEMBER_LEFT adds subject to terminal left set", () => {
    const event = communityMembershipPortOwner.createMembershipControlEvent(scope, {
      eventType: "COMMUNITY_MEMBER_LEFT",
      logicalEventId: "evt-1",
      createdAtUnixMs: 200,
      subjectPublicKeyHex: peer,
    });
    const result = communityMembershipPortOwner.applyMembershipControlEvent({
      event,
      prev: { leftMembers: [], expelledMembers: [], membershipStatus: "member" },
      myPublicKeyHex: actor,
      communityMessages: [],
    });
    expect(result.suppressed).toBe(false);
    expect(result.statePatch?.leftMembers).toEqual([peer]);
    expect(result.crdtRemoveMember).toBe(peer);
  });

  it("suppresses stale leave when newer chat participation exists (MEM-002)", () => {
    const event = communityMembershipPortOwner.createMembershipControlEvent(scope, {
      eventType: "COMMUNITY_MEMBER_LEFT",
      logicalEventId: "evt-2",
      createdAtUnixMs: 100,
      subjectPublicKeyHex: peer,
    });
    const result = communityMembershipPortOwner.applyMembershipControlEvent({
      event,
      prev: { leftMembers: [], expelledMembers: [], membershipStatus: "member" },
      myPublicKeyHex: actor,
      communityMessages: [{ pubkey: peer, created_at: 200 }],
    });
    expect(result.suppressed).toBe(true);
  });

  it("COMMUNITY_MEMBER_JOINED removes subject from terminal sets", () => {
    const event = communityMembershipPortOwner.createMembershipControlEvent(scope, {
      eventType: "COMMUNITY_MEMBER_JOINED",
      logicalEventId: "evt-3",
      createdAtUnixMs: 300,
      subjectPublicKeyHex: peer,
    });
    const result = communityMembershipPortOwner.applyMembershipControlEvent({
      event,
      prev: { leftMembers: [peer], expelledMembers: [peer], membershipStatus: "member" },
      myPublicKeyHex: actor,
      communityMessages: [],
    });
    expect(result.statePatch?.leftMembers).toEqual([]);
    expect(result.statePatch?.expelledMembers).toEqual([]);
    expect(result.crdtAddMember).toBe(peer);
  });

  it("applySemanticMemberEvent maps sealed leave to control apply", () => {
    const outcome = communityMembershipPortOwner.applySemanticMemberEvent({
      semantic: {
        type: "COMMUNITY_MEMBER_LEFT",
        communityId: "group-1",
        subjectPublicKeyHex: peer,
        actorPublicKeyHex: peer,
        createdAtUnixMs: 500,
        logicalEventId: "evt-leave",
        source: "nostr",
      },
      scope,
      prev: { leftMembers: [], expelledMembers: [], membershipStatus: "member" },
      myPublicKeyHex: actor,
      communityMessages: [],
    });
    expect(outcome.event?.eventType).toBe("COMMUNITY_MEMBER_LEFT");
    expect(outcome.deferKey).toBe("leave:evt-leave");
    expect(outcome.apply.statePatch?.leftMembers).toEqual([peer]);
  });
});
