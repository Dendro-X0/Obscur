import { describe, expect, it } from "vitest";
import { mapMeshSnapshotToRelayActivitySnapshot } from "@obscur/conduit-mesh";
import { deriveRelayRuntimeStatus } from "@/app/features/relays/lib/relay-runtime-status";
import {
  resolveActivePoolRelayUrls,
  type RelayPrimarySelection,
} from "@/app/features/relays/services/relay-primary-selector";
import {
  DEFAULT_STABLE_PRESET,
  HYBRID_PUBLIC_HTTP_PRESET,
  PRODUCT_BOOT_TRANSPORT_PRESET,
} from "@/app/features/transport-kernel/transport-preset-catalog";

const DEFAULT_STABLE_URLS = [...DEFAULT_STABLE_PRESET.relays];

describe("D3 multi-node Default Stable public pool", () => {
  it("boot Mixed adapters keeps Multi-node mode and includes public remotes", () => {
    expect(PRODUCT_BOOT_TRANSPORT_PRESET).toBe(HYBRID_PUBLIC_HTTP_PRESET);
    expect(PRODUCT_BOOT_TRANSPORT_PRESET.transportMode).toBe("redundancy");
    expect(PRODUCT_BOOT_TRANSPORT_PRESET.relays).toEqual([
      "wss://nos.lol",
      "wss://relay.primal.net",
      "wss://relay.damus.io",
      "http://127.0.0.1:8788",
    ]);
    expect(DEFAULT_STABLE_URLS).toEqual([
      "wss://nos.lol",
      "wss://relay.primal.net",
      "wss://relay.damus.io",
    ]);
  });

  it("redundancy dials multiple Default Stable URLs into the active pool", () => {
    const selection: RelayPrimarySelection = {
      primaryUrl: DEFAULT_STABLE_URLS[0]!,
      standbyUrls: DEFAULT_STABLE_URLS.slice(1),
      entries: DEFAULT_STABLE_URLS.map((url, index) => ({
        url,
        role: index === 0 ? "primary" : "standby",
      })),
    };
    const pool = resolveActivePoolRelayUrls({
      mode: "redundancy",
      orderedEnabledUrls: DEFAULT_STABLE_URLS,
      selection,
      hints: DEFAULT_STABLE_URLS.map((url) => ({
        url,
        isOpen: true,
        isWritable: true,
      })),
    });
    expect(pool.length).toBeGreaterThanOrEqual(2);
    expect(pool.every((url) => DEFAULT_STABLE_URLS.includes(url))).toBe(true);
  });

  it("P14: one of three Default Stable publish-ready stays degraded (not healthy)", () => {
    const [readyUrl, degradedUrl, blockedUrl] = DEFAULT_STABLE_URLS;
    const activity = mapMeshSnapshotToRelayActivitySnapshot({
      scope: { profileId: "d3-public" },
      phase: "degraded",
      readiness: "degraded",
      revision: 1,
      deploymentTier: "minimal_infra",
      configuredConduitCount: 3,
      activeConduits: [{
        descriptor: {
          conduitId: `relay-pool-0-${readyUrl}`,
          dialect: "nostr_ws",
          endpoints: [readyUrl!],
          capabilities: ["publish", "subscribe"],
          networkPolicy: "clearnet",
          trustTier: "user_configured",
          enabled: true,
          priority: 0,
        },
        health: "healthy",
      }],
      degradedConduitIds: [`relay-pool-1-${degradedUrl}`],
      blockedConduitIds: [`relay-pool-2-${blockedUrl}`],
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

    expect(activity.writableRelayCount).toBe(1);
    expect(activity.publishReadyRelayUrls).toEqual([readyUrl]);

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
