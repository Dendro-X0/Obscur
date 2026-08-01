import { describe, expect, it } from "vitest";
import {
  DEFAULT_STABLE_PRESET,
  HYBRID_PUBLIC_HTTP_PRESET,
  LOCAL_DEV_MESH_PRESET,
  LOCAL_HTTP_MESH_PRESET,
  PRODUCT_BOOT_TRANSPORT_PRESET,
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
    expect(ids).toContain("ssh_bastion_forward");
    expect(ids).toContain("hybrid_public_http");
    expect(ids).toContain("tor_onion_mesh");
  });

  it("groups presets by adapter category with private mesh first (RUST-2)", () => {
    expect(TRANSPORT_PRESET_GROUPS.map((group) => group.category)).toEqual([
      "private_mesh",
      "public_nostr",
      "hybrid_adapters",
      "tor",
    ]);
    const privatePresets = getTransportPresetsForGroup(TRANSPORT_PRESET_GROUPS[0]!);
    expect(privatePresets.map((preset) => preset.id)).toEqual([
      "local_dev_mesh",
      "local_http_mesh",
      "private_lan_ws",
      "ssh_bastion_forward",
    ]);
  });

  it("product boot preset is local_dev_mesh not public Nostr", () => {
    expect(PRODUCT_BOOT_TRANSPORT_PRESET.id).toBe("local_dev_mesh");
    expect(PRODUCT_BOOT_TRANSPORT_PRESET.category).toBe("private_mesh");
    expect(PRODUCT_BOOT_TRANSPORT_PRESET.relays.every((url) => !url.includes("damus"))).toBe(true);
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
