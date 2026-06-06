import { describe, expect, it } from "vitest";
import { buildTeamRelayMembershipUnsignedEvent } from "./community-team-relay-wire";
import { RELAY_KIND_RELAY_JOIN, RELAY_KIND_RELAY_LEAVE } from "./community-relay-membership-interop";

const SUBJECT = "aa".repeat(32);

describe("buildTeamRelayMembershipUnsignedEvent", () => {
  it("maps join semantic event to NIP-29 join kind", () => {
    const unsigned = buildTeamRelayMembershipUnsignedEvent({
      type: "COMMUNITY_MEMBER_JOINED",
      communityId: "group-1",
      subjectPublicKeyHex: SUBJECT,
      actorPublicKeyHex: SUBJECT,
      createdAtUnixMs: 1500,
      logicalEventId: "evt-1",
      source: "team_relay",
    });
    expect(unsigned?.kind).toBe(RELAY_KIND_RELAY_JOIN);
    expect(unsigned?.pubkey).toBe(SUBJECT);
    expect(unsigned?.tags).toEqual([["h", "group-1"]]);
    expect(unsigned?.created_at).toBe(1);
  });

  it("maps leave semantic event to NIP-29 leave kind", () => {
    const unsigned = buildTeamRelayMembershipUnsignedEvent({
      type: "COMMUNITY_MEMBER_LEFT",
      communityId: "group-1",
      subjectPublicKeyHex: SUBJECT,
      actorPublicKeyHex: SUBJECT,
      createdAtUnixMs: 2000,
      logicalEventId: "evt-2",
      source: "team_relay",
    });
    expect(unsigned?.kind).toBe(RELAY_KIND_RELAY_LEAVE);
  });

  it("returns null for directory hint events", () => {
    const unsigned = buildTeamRelayMembershipUnsignedEvent({
      type: "COMMUNITY_DIRECTORY_HINT",
      communityId: "group-1",
      pubkeys: [SUBJECT],
      confidence: "hint",
      source: "team_relay",
    });
    expect(unsigned).toBeNull();
  });
});
