import { describe, expect, it } from "vitest";

import { isNostrEventWirePayload } from "@obscur/conduit-mesh-contracts";

describe("nostr wire payload helpers", () => {
  it("detects pre-built EVENT wire payloads", () => {
    const payload = JSON.stringify(["EVENT", { id: "abc", kind: 4 }]);
    expect(isNostrEventWirePayload(payload)).toBe(true);
  });

  it("rejects non-event payloads", () => {
    expect(isNostrEventWirePayload("opaque")).toBe(false);
    expect(isNostrEventWirePayload(JSON.stringify(["REQ", "sub-1"]))).toBe(false);
  });
});
