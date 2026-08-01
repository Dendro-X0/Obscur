"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type {
  EnhancedRelayPoolResult,
  MultiRelayPublishResult,
  PublishResult,
  RelayTransportActivitySnapshot,
} from "./enhanced-relay-pool-types";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { createConduitMeshRelayPoolRuntime } from "@obscur/conduit-mesh";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { createConduitMeshNostrWsClient } from "@/app/features/transport-kernel/conduit-mesh-nostr-ws-client";
import {
  createConduitMeshTorHostPort,
  subscribeConduitMeshTorHostRefresh,
} from "@/app/features/transport-kernel/conduit-mesh-tor-host-port";
import { createConduitMeshSocksFetchHostPort } from "@/app/features/transport-kernel/conduit-mesh-socks-fetch-port";
import type { ConduitMeshNostrConnectionSnapshot } from "@obscur/conduit-mesh";
import type { RelayConnection } from "./relay-connection";
import type { NostrFilter } from "../types/nostr-filter";
import type { MeshInterest } from "@obscur/conduit-mesh-contracts";
import { workspaceRelayUrlsMatch } from "@/app/features/groups/services/workspace-relay-url";
import { relayHealthMonitor } from "./relay-health-monitor";
import { collectRelayHealthMetricsForUrls } from "../services/collect-relay-health-metrics";

const EMPTY_ACTIVITY: RelayTransportActivitySnapshot = {
  writableRelayCount: 0,
  subscribableRelayCount: 0,
  writeBlockedRelayCount: 0,
  coolingDownRelayCount: 0,
  fallbackRelayUrls: [],
  fallbackWritableRelayCount: 0,
  publishReadyRelayUrls: [],
};

/** HTTP mesh dialect — used for URL classification only; readiness comes from mesh probe. */
export const isHttpMeshPoolUrl = (url: string): boolean => {
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
};

const resolveWritableRelayUrls = (
  poolUrls: ReadonlyArray<string>,
  wsConnections: ReadonlyArray<RelayConnection>,
  activitySnapshot: RelayTransportActivitySnapshot,
): ReadonlyArray<string> => {
  const poolSet = new Set(poolUrls);
  const inPool = (url: string): boolean => (
    poolSet.has(url)
    || poolUrls.some((poolUrl) => workspaceRelayUrlsMatch(poolUrl, url))
  );
  const fromProbe = (activitySnapshot.publishReadyRelayUrls ?? []).filter(inPool);
  const fromOpenSockets = wsConnections
    .filter((connection) => connection.status === "open" && inPool(connection.url))
    .map((connection) => connection.url);
  // E3 (minimal): open pool sockets count as writable even when mesh publishReady lags.
  return Array.from(new Set([...fromProbe, ...fromOpenSockets]));
};

const mapConnectionSnapshots = (
  snapshots: ReadonlyArray<ConduitMeshNostrConnectionSnapshot>,
): ReadonlyArray<RelayConnection> => (
  snapshots.map((snapshot) => ({
    url: snapshot.url,
    status: snapshot.status === "open"
      ? "open"
      : snapshot.status === "connecting"
        ? "connecting"
        : snapshot.status === "error"
          ? "error"
          : "closed",
    updatedAtUnixMs: snapshot.updatedAtUnixMs,
    errorMessage: snapshot.errorMessage,
  }))
);

const filtersToMeshInterests = (
  filters: ReadonlyArray<NostrFilter>,
  scopeProfileId: string,
): ReadonlyArray<MeshInterest> => {
  const interests: MeshInterest[] = [];
  for (const filter of filters) {
    if (!filter.kinds?.includes(4) || !filter["#p"]) {
      continue;
    }
    for (const recipientPublicKeyHex of filter["#p"]) {
      interests.push({
        scope: { profileId: scopeProfileId },
        messageScope: "dm",
        audience: { kind: "dm", recipientPublicKeyHex },
      });
    }
  }
  return interests;
};

/**
 * Archived UI harness — relay pool backed by Conduit Mesh (no enhanced-relay-pool orchestrator).
 * Publish uses mesh orchestration with Nostr EVENT passthrough; subscribe uses thin WS client.
 */
export const useConduitMeshRelayPool = (
  urls: ReadonlyArray<string>,
): EnhancedRelayPoolResult => {
  const profileId = getResolvedProfileId() ?? "default";
  const urlsKey = urls.join("|");

  const [nostrClient] = useState(() => createConduitMeshNostrWsClient());
  const [torHost] = useState(() => createConduitMeshTorHostPort());
  const [socksHost] = useState(() => createConduitMeshSocksFetchHostPort());
  const [runtime] = useState(() => createConduitMeshRelayPoolRuntime({
    profileId,
    fetch: globalThis.fetch?.bind(globalThis),
    socksFetch: socksHost.socksFetch,
    nostrWire: nostrClient,
    getTorState: () => torHost.getTorState(),
    bridgeInboundWire: (relayUrl, wireMessage) => {
      nostrClient.deliverInboundMessage(relayUrl, wireMessage);
    },
  }));

  const connectionSnapshots = useSyncExternalStore(
    nostrClient.subscribeConnections,
    nostrClient.getConnectionSnapshots,
    () => [],
  );

  const [activitySnapshot, setActivitySnapshot] = useState(EMPTY_ACTIVITY);
  const [healthMetricsTick, setHealthMetricsTick] = useState(0);

  useEffect(() => {
    nostrClient.setRelayUrls(urlsKey ? urlsKey.split("|") : []);
  }, [nostrClient, urlsKey]);

  useEffect(() => (
    relayHealthMonitor.subscribe(() => {
      setHealthMetricsTick((tick) => tick + 1);
    })
  ), []);

  useEffect(() => {
    void runtime.configureUrls(urlsKey ? urlsKey.split("|") : []).then(async () => {
      setActivitySnapshot(await runtime.getTransportActivitySnapshot());
    });
  }, [runtime, urlsKey]);

  useEffect(() => {
    const unsubscribeEvidence = runtime.mesh.subscribeEvidence(() => {
      void runtime.getTransportActivitySnapshot().then(setActivitySnapshot);
    });
    const unsubscribeTor = subscribeConduitMeshTorHostRefresh(() => {
      void runtime.getTransportActivitySnapshot().then(setActivitySnapshot);
    });
    return () => {
      unsubscribeEvidence();
      unsubscribeTor();
      runtime.dispose();
      nostrClient.dispose();
    };
  }, [runtime, nostrClient]);

  const connections = useMemo(
    () => mapConnectionSnapshots(connectionSnapshots),
    [connectionSnapshots],
  );

  const poolUrls = useMemo(
    () => (urlsKey ? urlsKey.split("|") : []),
    [urlsKey],
  );

  const writableRelayUrls = useMemo(
    () => resolveWritableRelayUrls(poolUrls, connections, activitySnapshot),
    [poolUrls, connections, activitySnapshot],
  );

  const hasWritableRelay = activitySnapshot.writableRelayCount > 0 || writableRelayUrls.length > 0;

  const healthMetricUrls = useMemo(() => (
    Array.from(new Set([
      ...poolUrls,
      ...connections.map((connection) => connection.url),
    ]))
  ), [poolUrls, connections]);

  const healthMetrics = useMemo(() => (
    collectRelayHealthMetricsForUrls(healthMetricUrls)
  ), [healthMetricUrls, healthMetricsTick]);

  return useMemo((): EnhancedRelayPoolResult => ({
    connections,
    healthMetrics,
    sendToOpen: (payload) => {
      nostrClient.sendToOpen(payload);
    },
    publishToUrl: async (url, payload) => {
      const result = await runtime.publishToUrls([url], payload);
      const first = result.results[0];
      return {
        success: first?.success ?? false,
        relayUrl: url,
        error: first?.error,
      };
    },
    publishToUrls: async (targetUrls, payload) => {
      const result = await runtime.publishToUrls(targetUrls, payload);
      return {
        success: result.success,
        successCount: result.successCount,
        totalRelays: result.totalRelays,
        metQuorum: result.metQuorum,
        quorumRequired: result.quorumRequired,
        results: result.results.map((r) => ({
          success: r.success,
          relayUrl: r.relayUrl,
          error: r.error,
        })),
        failures: result.results.filter((r) => !r.success).map((r) => ({
          success: false,
          relayUrl: r.relayUrl,
          error: r.error,
        })),
      };
    },
    publishToRelay: async (url, payload) => {
      const result = await runtime.publishToUrls([url], payload);
      const first = result.results[0];
      return {
        success: first?.success ?? false,
        relayUrl: url,
        error: first?.error,
      };
    },
    publishToAll: async (payload) => {
      const result = await runtime.publishToUrls([], payload);
      return {
        success: result.success,
        successCount: result.successCount,
        totalRelays: result.totalRelays,
        metQuorum: result.metQuorum,
        quorumRequired: result.quorumRequired,
        results: result.results.map((r) => ({
          success: r.success,
          relayUrl: r.relayUrl,
          error: r.error,
        })),
      };
    },
    broadcastEvent: async (payload): Promise<MultiRelayPublishResult> => {
      const result = await runtime.publishToUrls([], payload);
      return {
        success: result.success,
        successCount: result.successCount,
        totalRelays: result.totalRelays,
        metQuorum: result.metQuorum,
        quorumRequired: result.quorumRequired,
        results: result.results.map((r) => ({
          success: r.success,
          relayUrl: r.relayUrl,
          error: r.error,
        })),
      };
    },
    subscribeToMessages: (handler) => nostrClient.subscribeToMessages(handler),
    subscribe: (filters: ReadonlyArray<NostrFilter>, onEvent: (event: NostrEvent, url: string) => void) => {
      const subscriptionId = nostrClient.subscribe(
        filters,
        onEvent as (event: Record<string, unknown>, relayUrl: string) => void,
      );
      const interests = filtersToMeshInterests(filters, profileId);
      if (interests.length > 0) {
        runtime.registerInboundInterests(interests);
      }
      return subscriptionId;
    },
    unsubscribe: (subscriptionId) => {
      nostrClient.unsubscribe(subscriptionId);
    },
    getRelayHealth: (url) => relayHealthMonitor.getMetrics(url),
    getRelayCircuitState: () => "healthy",
    canConnectToRelay: (url) => relayHealthMonitor.canConnect(url),
    addTransientRelay: () => {},
    removeTransientRelay: () => {},
    reconnectRelay: () => {},
    reconnectAll: () => {
      void runtime.configureUrls(poolUrls).then(async () => {
        setActivitySnapshot(await runtime.getTransportActivitySnapshot());
      });
    },
    resubscribeAll: () => {},
    recycle: async () => {},
    isConnected: () => hasWritableRelay,
    waitForConnection: async (timeoutMs) => {
      if (hasWritableRelay) {
        return true;
      }
      return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          unsubscribe();
          resolve(false);
        }, timeoutMs);
        const unsubscribe = nostrClient.subscribeConnections(() => {
          if (nostrClient.getConnectionSnapshots().some((entry) => entry.status === "open")) {
            clearTimeout(timeoutId);
            unsubscribe();
            resolve(true);
          }
        });
      });
    },
    waitForScopedConnection: async (relayUrls, timeoutMs) => {
      const normalized = relayUrls.map((url) => url.trim()).filter(Boolean);
      const hasScoped = (): boolean => {
        const readyUrls = new Set(writableRelayUrls);
        return normalized.some((url) => readyUrls.has(url));
      };
      if (hasScoped()) {
        return true;
      }
      return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          unsubscribe();
          resolve(false);
        }, timeoutMs);
        const unsubscribe = nostrClient.subscribeConnections(() => {
          if (hasScoped()) {
            clearTimeout(timeoutId);
            unsubscribe();
            resolve(true);
          }
        });
      });
    },
    getWritableRelaySnapshot: () => ({
      atUnixMs: Date.now(),
      configuredRelayUrls: poolUrls,
      writableRelayUrls,
      totalRelayCount: poolUrls.length,
      openRelayCount: writableRelayUrls.length,
    }),
    getTransportActivitySnapshot: () => activitySnapshot,
    getActiveSubscriptionCount: () => 0,
    dispose: () => {
      runtime.dispose();
      nostrClient.dispose();
    },
  }), [runtime, nostrClient, activitySnapshot, connections, poolUrls, writableRelayUrls, hasWritableRelay, healthMetrics]);
};
