import { describe, expect, it } from "vitest";
import { MATRIX_LAB_CAPABILITIES } from "./matrix-capabilities";
import {
  mapMatrixRoomToRichConversation,
  mapMatrixTimelineToCanonical,
  mapMatrixTimelineToRichMessage,
} from "./matrix-rich-map";

describe("matrix rich map + capabilities (C3)", () => {
  it("advertises lab DM+groups surface", () => {
    expect(MATRIX_LAB_CAPABILITIES).toEqual({
      dms: true,
      groups: true,
      reactions: false,
      media: false,
    });
  });

  it("maps room with roomId in pubkey slot", () => {
    expect(mapMatrixRoomToRichConversation({
      roomId: "!abc:hs",
      title: "Alice",
      lastMessagePreview: "hi",
      lastMessageAtUnixMs: 1000,
    })).toMatchObject({
      kind: "dm",
      id: "!abc:hs",
      displayName: "Alice",
      pubkey: "!abc:hs",
      lastMessage: "hi",
    });
  });

  it("maps timeline to rich and canonical", () => {
    const entry = {
      eventId: "e1",
      roomId: "!abc:hs",
      body: "yo",
      sentAtUnixMs: 2000,
      senderUserId: "@me:hs",
    };
    expect(mapMatrixTimelineToRichMessage(entry, "@me:hs")).toMatchObject({
      id: "e1",
      isOutgoing: true,
      content: "yo",
    });
    expect(mapMatrixTimelineToCanonical(entry, "@other:hs")).toMatchObject({
      id: "e1",
      direction: "in",
      status: "delivered",
    });
  });
});
