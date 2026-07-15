import { describe, expect, it } from "vitest";

import { isNostrEventWirePayload } from "@obscur/conduit-mesh-contracts";

describe("conduit-mesh-nostr-ws-client", () => {
  it("exports a factory for live client wiring", async () => {
    const module = await import("./conduit-mesh-nostr-ws-client");
    expect(typeof module.createConduitMeshNostrWsClient).toBe("function");
  });

  it("documents passthrough contract used by mesh publish path", () => {
    const payload = JSON.stringify(["EVENT", { id: "live-event", kind: 4 }]);
    expect(isNostrEventWirePayload(payload)).toBe(true);
  });
});
