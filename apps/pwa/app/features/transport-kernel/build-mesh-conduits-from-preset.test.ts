import { describe, expect, it, vi } from "vitest";

import { applyRustMeshConfigureFromPreset } from "./apply-rust-mesh-configure";
import { buildMeshConduitsFromPreset, maxRedundancyForPreset } from "./build-mesh-conduits-from-preset";
import {
  DEFAULT_STABLE_PRESET,
  LOCAL_DEV_MESH_PRESET,
  LOCAL_HTTP_MESH_PRESET,
  SSH_BASTION_FORWARD_PRESET,
  TOR_ONION_MESH_PRESET,
} from "./transport-preset-catalog";

describe("buildMeshConduitsFromPreset", () => {
  it("maps local_dev_mesh to nostr_ws clearnet conduits", () => {
    const conduits = buildMeshConduitsFromPreset(LOCAL_DEV_MESH_PRESET);
    expect(conduits).toHaveLength(1);
    expect(conduits[0]?.dialect).toBe("nostr_ws");
    expect(conduits[0]?.endpoints[0]).toContain("7000");
    expect(conduits[0]?.networkPolicy).toBe("clearnet");
    expect(conduits[0]?.trustTier).toBe("user_configured");
    expect(maxRedundancyForPreset(LOCAL_DEV_MESH_PRESET)).toBe(1);
  });

  it("maps public stable pack to public_untrusted nostr_ws", () => {
    const conduits = buildMeshConduitsFromPreset(DEFAULT_STABLE_PRESET);
    expect(conduits).toHaveLength(3);
    expect(conduits.every((c) => c.dialect === "nostr_ws")).toBe(true);
    expect(conduits.every((c) => c.trustTier === "public_untrusted")).toBe(true);
    expect(maxRedundancyForPreset(DEFAULT_STABLE_PRESET)).toBe(3);
  });

  it("maps HTTP mesh to custom dialect", () => {
    const conduits = buildMeshConduitsFromPreset(LOCAL_HTTP_MESH_PRESET);
    expect(conduits[0]?.dialect).toBe("custom");
    expect(conduits[0]?.capabilities).toContain("pull");
  });

  it("marks tor onion pack as tor_required", () => {
    const conduits = buildMeshConduitsFromPreset(TOR_ONION_MESH_PRESET);
    expect(conduits[0]?.networkPolicy).toBe("tor_required");
    expect(conduits[0]?.underlay).toBe("tor_socks");
  });

  it("maps SSH bastion pack to ssh_tunnel underlay + params (RUST-5d)", () => {
    const conduits = buildMeshConduitsFromPreset(SSH_BASTION_FORWARD_PRESET);
    expect(conduits).toHaveLength(1);
    expect(conduits[0]?.underlay).toBe("ssh_tunnel");
    expect(conduits[0]?.endpoints).toEqual(["ws://127.0.0.1:19001"]);
    expect(conduits[0]?.sshTunnel).toMatchObject({
      bastionHost: "bastion.example",
      bastionUser: "ops",
      localBindPort: 19001,
      remotePort: 7000,
    });
    expect(conduits[0]?.dialect).toBe("nostr_ws");
  });
});

describe("applyRustMeshConfigureFromPreset", () => {
  it("no-ops without Tauri host when host not injected", async () => {
    const result = await applyRustMeshConfigureFromPreset({
      profileId: "p1",
      preset: LOCAL_DEV_MESH_PRESET,
    });
    expect(result.attempted).toBe(false);
    expect(result.errorMessage).toBe("host_unavailable");
  });

  it("invokes configureMeshConduits with descriptor payload", async () => {
    const invoke = vi.fn(async () => ({
      ok: true,
      data: { revision: 1, meshSchedulerOwnsFailover: true },
    }));
    const result = await applyRustMeshConfigureFromPreset({
      profileId: "profile-a",
      preset: LOCAL_DEV_MESH_PRESET,
      torReady: false,
      host: {
        invoke,
        getSnapshot: async () => ({
          engine: "transport",
          scope: { profileId: "profile-a" },
          phase: "ready",
          revision: 0,
        }),
        subscribe: () => () => {},
      },
    });
    expect(result.attempted).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.meshSchedulerOwnsFailover).toBe(true);
    expect(invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        engine: "transport",
        method: "configureMeshConduits",
        scope: { profileId: "profile-a" },
        payload: expect.objectContaining({
          connect: true,
          maxRedundancy: 1,
          conduits: expect.arrayContaining([
            expect.objectContaining({
              dialect: "nostr_ws",
              enabled: true,
            }),
          ]),
        }),
      }),
    );
  });
});
