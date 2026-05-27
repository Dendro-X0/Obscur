import { describe, expect, it } from "vitest";
import { mapCoordinationDeltaToSemanticCommunityEvent } from "./map-coordination-delta";

describe("mapCoordinationDeltaToSemanticCommunityEvent", () => {
  it("maps leave delta to COMMUNITY_MEMBER_LEFT", () => {
    const semantic = mapCoordinationDeltaToSemanticCommunityEvent({
      communityId: "g1",
      seq: 3,
      action: "leave",
      subjectPubkey: "a".repeat(64),
      actorPubkey: "a".repeat(64),
      createdAtUnixMs: 1000,
    });
    expect(semantic?.type).toBe("COMMUNITY_MEMBER_LEFT");
    expect(semantic?.source).toBe("obscur_coordination");
    expect(semantic?.logicalEventId).toBe("coord:g1:3");
  });
});
