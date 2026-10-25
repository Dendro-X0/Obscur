"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type {
  EnhancedRelayPoolResult,
  MultiRelayPublishResult,
  PublishResult,
  RelayTransportActivitySnapshot,
} from "./enhanced-relay-pool-types";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { createConduitMeshRelayPoolRuntime } from "@obscur/conduit-mesh/conduit-mesh-relay-pool-runtime";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { createConduitMeshNostrWsClient } from "@/app/features/transport-kernel/conduit-mesh-nostr-ws-client";
import {
  createConduitMeshTorHostPort,
  subscribeConduitMeshTorHostRefresh,
} from "@/app/features/transport-kernel/conduit-mesh-tor-host-port";
import { createConduitMeshSocksFetchHostPort } from "@/app/features/transport-kernel/conduit-mesh-socks-fetch-port";
import type { ConduitMeshNostrConnectionSnapshot } from "@obscur/conduit-mesh/conduit-mesh-nostr-subscription-port";
import type { RelayConnection } from "./relay-connection";
import type { NostrFilter } from "../types/nostr-filter";
import type { MeshInterest } from "@obscur/conduit-mesh-contracts/envelope";
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

/** Sync P-evidence overlay — React state alone lags getTransportActivitySnapshot readers. */
export const resolveLastSuccessfulPublishAtUnixMs = (params: Readonly<{
  stampedAtUnixMs?: number;
  activityLastSuccessfulPublishAtUnixMs?: number;
}>): number | undefined => (
  params.stampedAtUnixMs ?? params.activityLastSuccessfulPublishAtUnixMs
);

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
/**
 * Slice 2: one nostr WS client per JS realm so multi-mount pools do not each
 * open NativeRelay to nos/primal/damus. Tests call createConduitMeshNostrWsClient()
 * directly (isolated).
 */
let sharedProductNostrClient: ReturnType<typeof createConduitMeshNostrWsClient> | null = null;

const getSharedProductNostrClient = (): ReturnType<typeof createConduitMeshNostrWsClient> => {
  if (!sharedProductNostrClient) {
    sharedProductNostrClient = createConduitMeshNostrWsClient();
  }
  return sharedProductNostrClient;
};

export const useConduitMeshRelayPool = (
  urls: ReadonlyArray<string>,
): EnhancedRelayPoolResult => {
  const profileId = getResolvedProfileId() ?? "default";
  const urlsKey = urls.join("|");

  const [nostrClient] = useState(() => getSharedProductNostrClient());
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
  /** Synchronous P-evidence — survives until React commits activitySnapshot stamp. */
  const publishEvidenceRef = useRef<{ lastSuccessfulPublishAtUnixMs?: number }>({});

  useEffect(() => {
    nostrClient.setRelayUrls(urlsKey ? urlsKey.split("|") : []);
  }, [nostrClient, urlsKey]);

  useEffect(() => (
    relayHealthMonitor.subscribe(() => {
      setHealthMetricsTick((tick) => tick + 1);
    })
  ), []);

  const mergeActivitySnapshot = useCallback(async () => {
    const next = await runtime.getTransportActivitySnapshot();
    setActivitySnapshot((previous) => ({
      ...next,
      // Preserve passthrough P-evidence stamp — mesh ledger refresh must not wipe it.
      lastSuccessfulPublishAtUnixMs: resolveLastSuccessfulPublishAtUnixMs({
        stampedAtUnixMs: publishEvidenceRef.current.lastSuccessfulPublishAtUnixMs
          ?? previous.lastSuccessfulPublishAtUnixMs,
        activityLastSuccessfulPublishAtUnixMs: next.lastSuccessfulPublishAtUnixMs,
      }),
    }));
  }, [runtime]);

  useEffect(() => {
    void runtime.configureUrls(urlsKey ? urlsKey.split("|") : []).then(() => {
      void mergeActivitySnapshot();
    });
  }, [runtime, urlsKey, mergeActivitySnapshot]);

  useEffect(() => {
    const unsubscribeEvidence = runtime.mesh.subscribeEvidence(() => {
      void mergeActivitySnapshot();
    });
    const unsubscribeTor = subscribeConduitMeshTorHostRefresh(() => {
      void mergeActivitySnapshot();
    });
    return () => {
      unsubscribeEvidence();
      unsubscribeTor();
      // Do not dispose useState-owned runtime/nostrClient here.
      // React Strict Mode remount reuses the same instances; dispose() would
      // permanently yield client_disposed on every Soft L3 / DM publish.
      // Intentional teardown remains on pool.dispose().
    };
  }, [runtime, nostrClient, mergeActivitySnapshot]);

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
      // Passthrough Nostr EVENT publish does not write mesh evidence ledger — stamp
      // P-evidence so supervisor Soft L3 / Relays UI see lastSuccessfulPublishAtUnixMs.
      if (result.success) {
        const stampedAt = Date.now();
        publishEvidenceRef.current.lastSuccessfulPublishAtUnixMs = stampedAt;
        const next = await runtime.getTransportActivitySnapshot();
        setActivitySnapshot({
          ...next,
          lastSuccessfulPublishAtUnixMs: stampedAt,
        });
      } else {
        void mergeActivitySnapshot();
      }
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
      if (result.success) {
        publishEvidenceRef.current.lastSuccessfulPublishAtUnixMs = Date.now();
      }
      return {
        success: first?.success ?? false,
        relayUrl: url,
        error: first?.error,
      };
    },
    publishToAll: async (payload) => {
      const result = await runtime.publishToUrls([], payload);
      if (result.success) {
        const stampedAt = Date.now();
        publishEvidenceRef.current.lastSuccessfulPublishAtUnixMs = stampedAt;
        setActivitySnapshot((previous) => ({
          ...previous,
          lastSuccessfulPublishAtUnixMs: stampedAt,
        }));
      }
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
      if (result.success) {
        publishEvidenceRef.current.lastSuccessfulPublishAtUnixMs = Date.now();
      }
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
    reconnectRelay: (url) => {
      const target = url.trim();
      if (!target) {
        return;
      }
      // setRelayUrls re-dials closed/error only — do not tear down open sockets.
      nostrClient.setRelayUrls(Array.from(new Set([...poolUrls, target])));
    },
    reconnectAll: () => {
      // Dial missing/closed URLs without forceReconnectAll (that cancels Rust OK waiters).
      if (poolUrls.length > 0) {
        nostrClient.setRelayUrls(poolUrls);
      }
      void runtime.configureUrls(poolUrls).then(() => {
        void mergeActivitySnapshot();
      });
    },
    resubscribeAll: () => {
      nostrClient.resubscribeAll();
    },
    recycle: async () => {},
    isConnected: () => hasWritableRelay,
    waitForConnection: async (timeoutMs) => {
      const hasOpenSocket = (): boolean => (
        nostrClient.getConnectionSnapshots().some((entry) => entry.status === "open")
        || connections.some((connection) => connection.status === "open")
      );
      if (hasOpenSocket()) {
        return true;
      }
      return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          unsubscribe();
          resolve(hasOpenSocket());
        }, timeoutMs);
        const unsubscribe = nostrClient.subscribeConnections(() => {
          if (hasOpenSocket()) {
            clearTimeout(timeoutId);
            unsubscribe();
            resolve(true);
          }
        });
      });
    },
    waitForScopedConnection: async (relayUrls, timeoutMs) => {
      const normalized = relayUrls.map((url) => url.trim()).filter(Boolean);
      const hasScopedOpen = (): boolean => {
        const openUrls = [
          ...nostrClient.getConnectionSnapshots()
            .filter((entry) => entry.status === "open")
            .map((entry) => entry.url),
          ...connections
            .filter((connection) => connection.status === "open")
            .map((connection) => connection.url),
        ];
        return normalized.some((target) => (
          openUrls.some((open) => workspaceRelayUrlsMatch(open, target))
        ));
      };
      if (hasScopedOpen()) {
        return true;
      }
      return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          unsubscribe();
          resolve(hasScopedOpen());
        }, timeoutMs);
        const unsubscribe = nostrClient.subscribeConnections(() => {
          if (hasScopedOpen()) {
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
      // Honest open count — do not mirror probe-writable length as open sockets.
      openRelayCount: connections.filter((connection) => connection.status === "open").length,
    }),
    getTransportActivitySnapshot: () => ({
      ...activitySnapshot,
      lastSuccessfulPublishAtUnixMs: resolveLastSuccessfulPublishAtUnixMs({
        stampedAtUnixMs: publishEvidenceRef.current.lastSuccessfulPublishAtUnixMs,
        activityLastSuccessfulPublishAtUnixMs: activitySnapshot.lastSuccessfulPublishAtUnixMs,
      }),
      // Overlay open-socket honesty — mesh publishReady/subscribable can lag behind WS open.
      writableRelayCount: Math.max(activitySnapshot.writableRelayCount, writableRelayUrls.length),
      subscribableRelayCount: Math.max(
        activitySnapshot.subscribableRelayCount,
        writableRelayUrls.length,
      ),
      publishReadyRelayUrls: Array.from(new Set([
        ...(activitySnapshot.publishReadyRelayUrls ?? []),
        ...writableRelayUrls,
      ])),
    }),
    getActiveSubscriptionCount: () => 0,
    dispose: () => {
      runtime.dispose();
      // Shared product nostr client stays alive for sibling pool mounts (Slice 2).
      // Isolated teardown: createConduitMeshNostrWsClient() outside this hook.
    },
  }), [runtime, nostrClient, activitySnapshot, connections, poolUrls, writableRelayUrls, hasWritableRelay, healthMetrics, mergeActivitySnapshot]);
};
