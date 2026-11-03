import { describe, expect, it } from "vitest";
import {
  mapPrivateDcConversationToRich,
  mapPrivateDcMessageToRich,
} from "./private-dc-rich-map";
import { PRIVATE_DC_CAPABILITIES } from "./private-dc-capabilities";

describe("private-dc rich map + capabilities (P4h)", () => {
  it("advertises DM-only capabilities", () => {
    expect(PRIVATE_DC_CAPABILITIES).toEqual({
      dms: true,
      groups: false,
      reactions: false,
      media: false,
    });
  });

  it("maps conversation with id in pubkey slot", () => {
    expect(mapPrivateDcConversationToRich({ id: "ops", title: "Ops" })).toMatchObject({
      kind: "dm",
      id: "ops",
      displayName: "Ops",
      pubkey: "ops",
    });
  });

  it("maps message direction and status", () => {
    expect(mapPrivateDcMessageToRich({
      id: "m1",
      conversationId: "ops",
      body: "hi",
      sentAtUnixMs: 1000,
      direction: "out",
      status: "sent",
    })).toMatchObject({
      id: "m1",
      content: "hi",
      isOutgoing: true,
      status: "delivered",
      conversationId: "ops",
      eventId: "m1",
    });
  });
});
