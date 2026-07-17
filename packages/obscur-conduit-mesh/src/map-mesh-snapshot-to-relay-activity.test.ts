import { describe, expect, it } from "vitest";
import type { ConduitRuntimeState, MeshSnapshot } from "@obscur/conduit-mesh-contracts";

import {
  mapMeshSnapshotToRelayActivitySnapshot,
  resolvePublishReadyRelayUrls,
} from "./map-mesh-snapshot-to-relay-activity";

const conduit = (
  id: string,
  endpoint: string,
  health: ConduitRuntimeState["health"],
): ConduitRuntimeState => ({
  descriptor: {
    conduitId: id,
    dialect: endpoint.startsWith("ws") ? "nostr_ws" : "team_relay",
    endpoints: [endpoint],
    capabilities: ["publish", "subscribe"],
    networkPolicy: "clearnet",
    trustTier: "user_configured",
    enabled: true,
    priority: 0,
  },
  health,
});

const snapshot = (params: Readonly<{
  readiness: MeshSnapshot["readiness"];
  activeConduits: ReadonlyArray<ConduitRuntimeState>;
  publishReadyCount: number;
  configuredConduitCount?: number;
}>): MeshSnapshot => ({
  scope: { profileId: "p1" },
  phase: params.readiness === "healthy" ? "healthy" : "degraded",
  readiness: params.readiness,
  revision: 1,
  deploymentTier: "minimal_infra",
  configuredConduitCount: params.configuredConduitCount ?? params.activeConduits.length,
  activeConduits: params.activeConduits,
  degradedConduitIds: params.activeConduits
    .filter((entry) => entry.health === "degraded")
    .map((entry) => entry.descriptor.conduitId),
  blockedConduitIds: params.activeConduits
    .filter((entry) => entry.health === "blocked" || entry.health === "offline")
    .map((entry) => entry.descriptor.conduitId),
  scopeReadiness: [{
    messageScope: "dm",
    publishReadyCount: params.publishReadyCount,
    requiredReadyCount: 1,
  }],
  torConfigured: false,
  torReady: false,
  effectiveNetworkPolicy: "clearnet",
  pendingOutboundCount: 0,
  lastEvidenceAtUnixMs: 1_700_000_000_000,
  recoveryAttemptCount: 0,
  updatedAtUnixMs: 1_700_000_000_000,
});

describe("mapMeshSnapshotToRelayActivitySnapshot", () => {
  it("maps all healthy conduits to publish-ready URLs", () => {
    const meshSnapshot = snapshot({
      readiness: "healthy",
      publishReadyCount: 2,
      activeConduits: [
        conduit("a", "wss://relay.a", "healthy"),
        conduit("b", "http://127.0.0.1:8788", "healthy"),
      ],
    });

    const activity = mapMeshSnapshotToRelayActivitySnapshot(meshSnapshot);
    expect(activity.writableRelayCount).toBe(2);
    expect(activity.publishReadyRelayUrls).toEqual([
      "wss://relay.a",
      "http://127.0.0.1:8788",
    ]);
    expect(activity.fallbackRelayUrls).toEqual([]);
    expect(activity.fallbackWritableRelayCount).toBe(0);
    expect(activity.meshReadiness).toBe("healthy");
  });

  it("does not treat degraded conduits as legacy fallback relays", () => {
    const meshSnapshot = snapshot({
      readiness: "degraded",
      publishReadyCount: 1,
      configuredConduitCount: 3,
      activeConduits: [
        conduit("a", "wss://relay.a", "healthy"),
      ],
    });

    const activity = mapMeshSnapshotToRelayActivitySnapshot(meshSnapshot);
    expect(activity.writableRelayCount).toBe(1);
    expect(activity.publishReadyRelayUrls).toEqual(["wss://relay.a"]);
    expect(activity.fallbackRelayUrls).toEqual([]);
    expect(activity.meshReadiness).toBe("degraded");
    expect(activity.coolingDownRelayCount).toBe(0);
  });

  it("returns zero writable when all conduits are offline", () => {
    const meshSnapshot = snapshot({
      readiness: "offline",
      publishReadyCount: 0,
      activeConduits: [
        conduit("a", "http://127.0.0.1:8788", "offline"),
      ],
    });

    const activity = mapMeshSnapshotToRelayActivitySnapshot(meshSnapshot);
    expect(activity.writableRelayCount).toBe(0);
    expect(resolvePublishReadyRelayUrls(meshSnapshot)).toEqual([]);
  });
});
