import { describe, expect, it } from "vitest";
import { mapSealedControlPayloadToSemanticCommunityEvent } from "./map-sealed-control-payload";

describe("mapSealedControlPayloadToSemanticCommunityEvent", () => {
  const base = {
    communityId: "group-alpha",
    actorPublicKeyHex: "b".repeat(64),
    logicalEventId: "evt-leave-1",
    createdAtUnixMs: 1_700_000_000,
    innerPayload: { type: "leave", created_at: 1_700_000_100 },
  } as const;

  it("maps sealed leave to COMMUNITY_MEMBER_LEFT", () => {
    const semantic = mapSealedControlPayloadToSemanticCommunityEvent(base);
    expect(semantic).toEqual({
      type: "COMMUNITY_MEMBER_LEFT",
      communityId: "group-alpha",
      subjectPublicKeyHex: base.actorPublicKeyHex,
      actorPublicKeyHex: base.actorPublicKeyHex,
      createdAtUnixMs: 1_700_000_100,
      logicalEventId: "evt-leave-1",
      source: "nostr",
    });
  });

  it("maps join and membership_restate to COMMUNITY_MEMBER_JOINED", () => {
    const join = mapSealedControlPayloadToSemanticCommunityEvent({
      ...base,
      innerPayload: { type: "join" },
    });
    expect(join?.type).toBe("COMMUNITY_MEMBER_JOINED");
    expect(join?.logicalEventId).toBe("evt-leave-1");

    const restate = mapSealedControlPayloadToSemanticCommunityEvent({
      ...base,
      innerPayload: { type: "membership_restate" },
    });
    expect(restate?.type).toBe("COMMUNITY_MEMBER_JOINED");
    expect(restate?.logicalEventId).toBe("restate:evt-leave-1");
  });

  it("returns null for non-membership control types", () => {
    expect(mapSealedControlPayloadToSemanticCommunityEvent({
      ...base,
      innerPayload: { type: "vote-kick", target: "c".repeat(64) },
    })).toBeNull();
  });
});
