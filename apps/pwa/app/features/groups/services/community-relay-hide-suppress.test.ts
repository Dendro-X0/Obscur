import { describe, expect, it, beforeEach } from "vitest";
import {
  CommunityRelayHideRegistry,
  filterCommunityRelayWireMessage,
  recordCommunityHidePublishPayload,
} from "./community-relay-hide-suppress";
import { SEALED_COMMUNITY_KIND_DELETE } from "./sealed-community-relay-kinds";

describe("community-relay-hide-suppress (D1)", () => {
  let registry: CommunityRelayHideRegistry;

  beforeEach(() => {
    registry = new CommunityRelayHideRegistry();
  });

  it("records kind 5 e-tags and suppresses target EVENT", () => {
    const targetId = "aa".repeat(32);
    const hideEvent = {
      id: "bb".repeat(32),
      kind: SEALED_COMMUNITY_KIND_DELETE,
      tags: [["e", targetId], ["h", "group-1"]],
    };
    const hideWire = JSON.stringify(["EVENT", hideEvent]);
    recordCommunityHidePublishPayload(hideWire, registry);
    expect(registry.isHidden(targetId)).toBe(true);

    const messageEvent = {
      id: targetId,
      kind: 10102,
      pubkey: "cc".repeat(32),
      created_at: 1,
      tags: [["h", "group-1"]],
      content: "{}",
      sig: "dd".repeat(64),
    };
    const messageWire = JSON.stringify(["EVENT", messageEvent, "sub-1"]);
    expect(filterCommunityRelayWireMessage(messageWire, registry)).toBeNull();
  });

  it("forwards non-hidden EVENT and records hide from inbound kind 5", () => {
    const targetId = "ee".repeat(32);
    const messageWire = JSON.stringify(["EVENT", {
      id: targetId,
      kind: 10102,
      tags: [],
    }, "sub"]);
    expect(filterCommunityRelayWireMessage(messageWire, registry)).toBe(messageWire);

    const hideWire = JSON.stringify(["EVENT", {
      id: "ff".repeat(32),
      kind: SEALED_COMMUNITY_KIND_DELETE,
      tags: [["e", targetId]],
    }]);
    expect(filterCommunityRelayWireMessage(hideWire, registry)).toBe(hideWire);
    expect(filterCommunityRelayWireMessage(messageWire, registry)).toBeNull();
  });

  it("passes through non-EVENT frames", () => {
    const okWire = JSON.stringify(["OK", "id", true, ""]);
    expect(filterCommunityRelayWireMessage(okWire, registry)).toBe(okWire);
  });
});
