import { describe, expect, it } from "vitest";
import {
  DEFAULT_STABLE_PRESET,
  HYBRID_PUBLIC_HTTP_PRESET,
  LOCAL_DEV_MESH_PRESET,
  LOCAL_HTTP_MESH_PRESET,
  PRODUCT_BOOT_TRANSPORT_PRESET,
  STANDARD_TRANSPORT_PRESET_IDS,
  TOR_ONION_MESH_PRESET,
  TRANSPORT_PRESET_CATALOG,
  TRANSPORT_PRESET_GROUPS,
  buildRelayRowsFromPreset,
  getTransportPreset,
  getTransportPresetGroupsForDepth,
  getTransportPresetsForGroup,
  isStandardTransportPresetId,
} from "./transport-preset-catalog";

describe("transport-preset-catalog", () => {
  it("lists public and non-Nostr preset packs", () => {
    const ids = TRANSPORT_PRESET_CATALOG.map((p) => p.id);
    expect(ids).toContain("default_stable");
    expect(ids).toContain("local_dev_mesh");
    expect(ids).toContain("local_http_mesh");
    expect(ids).toContain("private_lan_ws");
    expect(ids).toContain("ssh_bastion_forward");
    expect(ids).toContain("hybrid_public_http");
    expect(ids).toContain("tor_onion_mesh");
  });

  it("groups presets with public Nostr and Tor first (prod-first 2026-08)", () => {
    expect(TRANSPORT_PRESET_GROUPS.map((group) => group.category)).toEqual([
      "public_nostr",
      "tor",
      "private_mesh",
      "hybrid_adapters",
    ]);
    const publicPresets = getTransportPresetsForGroup(TRANSPORT_PRESET_GROUPS[0]!);
    expect(publicPresets.map((preset) => preset.id)).toEqual([
      "default_stable",
      "high_redundancy",
      "low_latency",
    ]);
  });

  it("Standard depth exposes four distinct paths", () => {
    expect([...STANDARD_TRANSPORT_PRESET_IDS]).toEqual([
      "default_stable",
      "hybrid_public_http",
      "local_dev_mesh",
      "tor_onion_mesh",
    ]);
    const standardGroups = getTransportPresetGroupsForDepth("standard");
    const standardIds = standardGroups.flatMap((group) => group.presetIds);
    expect(standardIds).toEqual([...STANDARD_TRANSPORT_PRESET_IDS]);
    expect(isStandardTransportPresetId("high_redundancy")).toBe(false);
    expect(getTransportPresetGroupsForDepth("advanced")).toBe(TRANSPORT_PRESET_GROUPS);
  });

  it("product boot preset is Mixed adapters (public + local HTTP mesh)", () => {
    expect(PRODUCT_BOOT_TRANSPORT_PRESET.id).toBe("hybrid_public_http");
    expect(PRODUCT_BOOT_TRANSPORT_PRESET.category).toBe("hybrid_adapters");
    expect(PRODUCT_BOOT_TRANSPORT_PRESET.requiresTor).toBeFalsy();
    expect(PRODUCT_BOOT_TRANSPORT_PRESET.relays.some((url) => url.includes("nos.lol"))).toBe(true);
    expect(PRODUCT_BOOT_TRANSPORT_PRESET.relays.some((url) => url.includes("127.0.0.1:8788"))).toBe(true);
  });

  it("local dev preset points at canonical localhost relay", () => {
    expect(LOCAL_DEV_MESH_PRESET.relays).toEqual(["ws://localhost:7000"]);
    expect(LOCAL_DEV_MESH_PRESET.category).toBe("private_mesh");
  });

  it("local HTTP mesh uses team_relay gateway port", () => {
    expect(LOCAL_HTTP_MESH_PRESET.relays).toEqual(["http://127.0.0.1:8788"]);
    expect(LOCAL_HTTP_MESH_PRESET.category).toBe("private_mesh");
  });

  it("hybrid preset mixes public nostr pool and http mesh", () => {
    expect(HYBRID_PUBLIC_HTTP_PRESET.relays).toEqual([
      "wss://nos.lol",
      "wss://relay.primal.net",
      "wss://relay.damus.io",
      "http://127.0.0.1:8788",
    ]);
    expect(HYBRID_PUBLIC_HTTP_PRESET.transportMode).toBe("redundancy");
  });

  it("default stable uses redundancy so the public pool is active", () => {
    expect(DEFAULT_STABLE_PRESET.transportMode).toBe("redundancy");
  });

  it("E1: public packs demote damus and prefer probe-healthy hosts first", () => {
    expect(DEFAULT_STABLE_PRESET.relays[0]).toBe("wss://nos.lol");
    expect(DEFAULT_STABLE_PRESET.relays.at(-1)).toBe("wss://relay.damus.io");
    const high = getTransportPreset("high_redundancy");
    expect(high?.relays[0]).toBe("wss://nos.lol");
    expect(high?.relays.at(-1)).toBe("wss://relay.damus.io");
    const low = getTransportPreset("low_latency");
    expect(low?.relays[0]).toBe("wss://relay.primal.net");
    expect(low?.relays.at(-1)).toBe("wss://relay.damus.io");
    expect(low?.transportMode).toBe("basic");
  });

  it("tor preset is marked as template and tor-required", () => {
    expect(TOR_ONION_MESH_PRESET.requiresTor).toBe(true);
    expect(TOR_ONION_MESH_PRESET.isUrlTemplate).toBe(true);
    expect(TOR_ONION_MESH_PRESET.relays[0]).toContain(".onion");
  });

  it("SSH bastion pack is a private-mesh template with sshTunnel params (RUST-5d)", () => {
    const preset = getTransportPreset("ssh_bastion_forward");
    expect(preset?.category).toBe("private_mesh");
    expect(preset?.isUrlTemplate).toBe(true);
    expect(preset?.relays).toEqual(["ws://127.0.0.1:19001"]);
    expect(preset?.sshTunnel).toEqual({
      bastionHost: "bastion.example",
      bastionPort: 22,
      bastionUser: "ops",
      remoteHost: "127.0.0.1",
      remotePort: 7000,
      localBindHost: "127.0.0.1",
      localBindPort: 19001,
    });
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
