import { describe, expect, it } from "vitest";
import { mapRustMeshSnapshotToTransportSnapshot } from "./map-rust-mesh-snapshot-to-transport-snapshot";
import type { RustMeshSnapshot } from "./map-rust-mesh-snapshot-to-transport-snapshot";

const baseMesh = (overrides: Partial<RustMeshSnapshot> = {}): RustMeshSnapshot => ({
  profileId: "p1",
  revision: 3,
  phase: "healthy",
  readiness: "healthy",
  enabledEndpointUrls: ["ws://127.0.0.1:7000"],
  activeConduitIds: ["local"],
  writableConduitCount: 1,
  subscribableConduitCount: 1,
  blockedConduitCount: 0,
  pendingOutboundCount: 0,
  meshSchedulerOwnsFailover: true,
  updatedAtUnixMs: 1_700_000_000_000,
  ...overrides,
});

describe("mapRustMeshSnapshotToTransportSnapshot", () => {
  it("maps healthy local mesh to TransportSnapshot", () => {
    const snap = mapRustMeshSnapshotToTransportSnapshot({
      mesh: baseMesh(),
      scope: { profileId: "p1", windowLabel: "main" },
    });
    expect(snap.phase).toBe("healthy");
    expect(snap.revision).toBe(3);
    expect(snap.enabledRelayUrls).toEqual(["ws://127.0.0.1:7000"]);
    expect(snap.recovery.readiness).toBe("healthy");
    expect(snap.recovery.writableRelayCount).toBe(1);
    expect(snap.recovery.lastFailureReason).toBeUndefined();
    expect(snap.meshSchedulerOwnsFailover).toBe(true);
  });

  it("preserves tor_unreachable failure reason", () => {
    const snap = mapRustMeshSnapshotToTransportSnapshot({
      mesh: baseMesh({
        phase: "offline",
        readiness: "offline",
        writableConduitCount: 0,
        lastFailureReason: "tor_unreachable",
        enabledEndpointUrls: [],
      }),
      scope: { profileId: "p1" },
    });
    expect(snap.phase).toBe("offline");
    expect(snap.recovery.lastFailureReason).toBe("tor_unreachable");
  });
});
