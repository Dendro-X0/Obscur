import { describe, expect, it } from "vitest";
import { resolveCommunityMembershipHealth } from "./community-membership-health";

const pubkey = "aa".repeat(32) as `${string}`;

describe("resolveCommunityMembershipHealth", () => {
  it("is ready when room key, directory, and relay are healthy", () => {
    const health = resolveCommunityMembershipHealth({
      communityId: "room:ws://localhost:7000",
      localMemberPubkey: pubkey,
      coordinationDirectory: {
        activeMemberPubkeys: [pubkey],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        headSeq: 1,
      },
      roomKeyPresent: true,
      relayTransportReady: true,
      relayActivationSynced: true,
      activationPending: false,
      devCoordinationOnly: false,
    });
    expect(health.ready).toBe(true);
    expect(health.chatEnabled).toBe(true);
    expect(health.blockers).toEqual([]);
  });

  it("records room key as diagnostic only — membership+relay can still be ready", () => {
    const health = resolveCommunityMembershipHealth({
      communityId: "room:ws://localhost:7000",
      localMemberPubkey: pubkey,
      coordinationDirectory: {
        activeMemberPubkeys: [pubkey],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        headSeq: 1,
      },
      roomKeyPresent: false,
      relayTransportReady: true,
      relayActivationSynced: true,
      activationPending: false,
      devCoordinationOnly: false,
    });
    expect(health.ready).toBe(true);
    expect(health.chatEnabled).toBe(true);
    expect(health.blockers).toContain("room_key_missing");
  });

  it("allows coordination-only dev profile when relay is not writable", () => {
    const health = resolveCommunityMembershipHealth({
      communityId: "room:ws://localhost:7000",
      localMemberPubkey: pubkey,
      coordinationDirectory: {
        activeMemberPubkeys: [pubkey],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        headSeq: 1,
      },
      roomKeyPresent: true,
      relayTransportReady: false,
      relayActivationSynced: false,
      activationPending: false,
      devCoordinationOnly: true,
    });
    expect(health.ready).toBe(true);
    expect(health.chatEnabled).toBe(false);
    expect(health.blockers).toContain("relay_not_writable");
  });
});
