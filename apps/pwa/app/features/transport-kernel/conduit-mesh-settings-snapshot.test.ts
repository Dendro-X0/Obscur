import { describe, expect, it } from "vitest";

import {
  buildConduitMeshSettingsSnapshot,
  resolveConduitMeshPoolOwner,
} from "./conduit-mesh-settings-snapshot";

describe("conduit-mesh-settings-snapshot", () => {
  it("maps ws relay URLs to nostr_ws dialect in settings endpoints", () => {
    const snapshot = buildConduitMeshSettingsSnapshot([
      { url: "wss://relay.example.test", enabled: true },
      { url: "http://127.0.0.1:8788", enabled: false },
    ]);

    expect(snapshot.endpoints[0]?.dialect).toBe("nostr_ws");
    expect(snapshot.endpoints[1]?.dialect).toBe("team_relay");
    expect(snapshot.enabledEndpointCount).toBe(1);
  });

  it("resolves a canonical pool owner id", () => {
    const owner = resolveConduitMeshPoolOwner();
    expect(["conduit_mesh", "transport_kernel_enhanced", "legacy_websocket"]).toContain(owner);
  });
});
