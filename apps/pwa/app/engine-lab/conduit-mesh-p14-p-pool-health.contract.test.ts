import { describe, expect, it } from "vitest";

import { mapMeshSnapshotToRelayActivitySnapshot } from "@obscur/conduit-mesh";
import { deriveRelayRuntimeStatus } from "@/app/features/relays/lib/relay-runtime-status";

describe("conduit-mesh P14-P pool health contract", () => {
  it("maps partial mesh pool to degraded settings status", () => {
    const activity = mapMeshSnapshotToRelayActivitySnapshot({
      scope: { profileId: "p1" },
      phase: "degraded",
      readiness: "degraded",
      revision: 1,
      deploymentTier: "minimal_infra",
      configuredConduitCount: 3,
      activeConduits: [{
        descriptor: {
          conduitId: "relay-pool-0-wss://relay.a",
          dialect: "nostr_ws",
          endpoints: ["wss://relay.a"],
          capabilities: ["publish", "subscribe"],
          networkPolicy: "clearnet",
          trustTier: "user_configured",
          enabled: true,
          priority: 0,
        },
        health: "healthy",
      }],
      degradedConduitIds: ["relay-pool-1-wss://relay.b"],
      blockedConduitIds: ["relay-pool-2-wss://relay.c"],
      scopeReadiness: [{
        messageScope: "dm",
        publishReadyCount: 1,
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

    expect(activity.fallbackRelayUrls).toEqual([]);
    expect(activity.writableRelayCount).toBe(1);

    const badge = deriveRelayRuntimeStatus({
      openCount: 0,
      totalCount: 3,
      writableCount: activity.writableRelayCount,
      subscribableCount: activity.subscribableRelayCount,
      phase: "healthy",
      lastSuccessfulPublishAtUnixMs: activity.lastSuccessfulPublishAtUnixMs,
      meshReadiness: activity.meshReadiness,
      nowUnixMs: 1_700_000_060_000,
    });

    expect(badge.status).toBe("degraded");
  });
});
