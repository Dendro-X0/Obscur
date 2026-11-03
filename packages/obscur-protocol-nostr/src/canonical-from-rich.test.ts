import { describe, expect, it } from "vitest";
import {
  mapRichConversationToCanonical,
  mapRichMessageToCanonical,
} from "./canonical-from-rich";

describe("canonical-from-rich (P7)", () => {
  it("maps rich message to canonical", () => {
    expect(mapRichMessageToCanonical({
      id: "m1",
      content: "hi",
      timestamp: new Date(1000),
      isOutgoing: true,
      status: "queued",
    }, "c1")).toEqual({
      id: "m1",
      conversationId: "c1",
      body: "hi",
      sentAtUnixMs: 1000,
      direction: "out",
      status: "sending",
    });
  });

  it("maps rich conversation to canonical", () => {
    expect(mapRichConversationToCanonical({
      id: "c1",
      displayName: "Ops",
    })).toEqual({ id: "c1", title: "Ops" });
  });
});
