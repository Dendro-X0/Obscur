import { describe, expect, it } from "vitest";
import { mapSealedMembershipSemanticEvent } from "./community-membership-semantic-ingress";

describe("community-membership-semantic-ingress", () => {
  it("maps sealed leave through transport-nostr adapter", () => {
    const actor = "a".repeat(64);
    const semantic = mapSealedMembershipSemanticEvent({
      communityId: "group-1",
      actorPublicKeyHex: actor,
      logicalEventId: "evt-1",
      createdAtUnixMs: 100,
      innerPayload: { type: "leave", created_at: 200 },
    });
    expect(semantic?.type).toBe("COMMUNITY_MEMBER_LEFT");
    expect(semantic?.createdAtUnixMs).toBe(200);
  });
});
