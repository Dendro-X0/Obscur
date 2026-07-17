import { describe, expect, it } from "vitest";
import {
  DEFAULT_STABLE_PRESET,
  HYBRID_PUBLIC_HTTP_PRESET,
  LOCAL_DEV_MESH_PRESET,
  LOCAL_HTTP_MESH_PRESET,
  TOR_ONION_MESH_PRESET,
  TRANSPORT_PRESET_CATALOG,
  TRANSPORT_PRESET_GROUPS,
  buildRelayRowsFromPreset,
  getTransportPreset,
  getTransportPresetsForGroup,
} from "./transport-preset-catalog";

describe("transport-preset-catalog", () => {
  it("lists public and non-Nostr preset packs", () => {
    const ids = TRANSPORT_PRESET_CATALOG.map((p) => p.id);
    expect(ids).toContain("default_stable");
    expect(ids).toContain("local_dev_mesh");
    expect(ids).toContain("local_http_mesh");
    expect(ids).toContain("private_lan_ws");
    expect(ids).toContain("hybrid_public_http");
    expect(ids).toContain("tor_onion_mesh");
  });

  it("groups presets by adapter category", () => {
    expect(TRANSPORT_PRESET_GROUPS.map((group) => group.category)).toEqual([
      "public_nostr",
      "private_mesh",
      "hybrid_adapters",
      "tor",
    ]);
    const privatePresets = getTransportPresetsForGroup(TRANSPORT_PRESET_GROUPS[1]!);
    expect(privatePresets.map((preset) => preset.id)).toEqual([
      "local_dev_mesh",
      "local_http_mesh",
      "private_lan_ws",
    ]);
  });

  it("local dev preset points at canonical localhost relay", () => {
    expect(LOCAL_DEV_MESH_PRESET.relays).toEqual(["ws://localhost:7000"]);
    expect(LOCAL_DEV_MESH_PRESET.category).toBe("private_mesh");
  });

  it("local HTTP mesh uses team_relay gateway port", () => {
    expect(LOCAL_HTTP_MESH_PRESET.relays).toEqual(["http://127.0.0.1:8788"]);
    expect(LOCAL_HTTP_MESH_PRESET.category).toBe("private_mesh");
  });

  it("hybrid preset mixes nostr ws and http mesh", () => {
    expect(HYBRID_PUBLIC_HTTP_PRESET.relays).toEqual([
      "wss://relay.damus.io",
      "http://127.0.0.1:8788",
    ]);
    expect(HYBRID_PUBLIC_HTTP_PRESET.transportMode).toBe("redundancy");
  });

  it("tor preset is marked as template and tor-required", () => {
    expect(TOR_ONION_MESH_PRESET.requiresTor).toBe(true);
    expect(TOR_ONION_MESH_PRESET.isUrlTemplate).toBe(true);
    expect(TOR_ONION_MESH_PRESET.relays[0]).toContain(".onion");
  });

  it("high redundancy enables redundancy transport mode", () => {
    const preset = getTransportPreset("high_redundancy");
    expect(preset?.transportMode).toBe("redundancy");
  });

  it("builds enabled relay rows from preset", () => {
    const rows = buildRelayRowsFromPreset(DEFAULT_STABLE_PRESET);
    expect(rows.length).toBe(3);
    expect(rows.every((row) => row.enabled)).toBe(true);
    expect(rows[0]?.url).toMatch(/^wss:\/\//);
  });
});
