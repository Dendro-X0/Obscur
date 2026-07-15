import { describe, expect, it } from "vitest";

import {
  OBSCUR_MESH_DM_WIRE_V1,
  decodeMeshNativeDmWire,
  encodeMeshNativeDmWire,
  isMeshNativeDmWirePayload,
  meshNativeDmWireToNostrEventWire,
  nostrEventWireToMeshNativeDmWire,
} from "./mesh-dm-wire";
import { isNostrEventWirePayload } from "./nostr-wire-payload";

const sampleEvent = {
  id: "c11-event",
  kind: 4,
  pubkey: "aa".repeat(32),
  created_at: 1_700_003_100,
  tags: [["p", "bb".repeat(32)]],
  content: "encrypted",
  sig: "sig",
} as const;

describe("mesh-native DM wire codec", () => {
  it("roundtrips native wire to Nostr EVENT wire", () => {
    const nostrWire = JSON.stringify(["EVENT", sampleEvent]);
    const nativeWire = nostrEventWireToMeshNativeDmWire(nostrWire);

    expect(isMeshNativeDmWirePayload(nativeWire)).toBe(true);
    expect(isNostrEventWirePayload(nativeWire)).toBe(false);
    expect(meshNativeDmWireToNostrEventWire(nativeWire)).toBe(nostrWire);
  });

  it("encode/decode preserves event object", () => {
    const nativeWire = encodeMeshNativeDmWire(sampleEvent);
    const decoded = decodeMeshNativeDmWire(nativeWire);

    expect(decoded.contractVersion).toBe(OBSCUR_MESH_DM_WIRE_V1);
    expect(decoded.event).toEqual(sampleEvent);
  });

  it("rejects invalid contract version", () => {
    const payload = JSON.stringify({ contractVersion: "wrong", event: sampleEvent });
    expect(isMeshNativeDmWirePayload(payload)).toBe(false);
    expect(() => decodeMeshNativeDmWire(payload)).toThrow("invalid_mesh_native_dm_wire");
  });
});
