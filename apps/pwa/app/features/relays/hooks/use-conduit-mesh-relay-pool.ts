"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  EnhancedRelayPoolResult,
  MultiRelayPublishResult,
  PublishResult,
  RelayTransportActivitySnapshot,
} from "./enhanced-relay-pool-types";
import { createConduitMeshRelayPoolRuntime } from "@obscur/conduit-mesh";

const EMPTY_ACTIVITY: RelayTransportActivitySnapshot = {
  writableRelayCount: 0,
  subscribableRelayCount: 0,
  writeBlockedRelayCount: 0,
  coolingDownRelayCount: 0,
  fallbackRelayUrls: [],
  fallbackWritableRelayCount: 0,
};

/**
 * Archived UI harness — relay pool backed by Conduit Mesh (no enhanced-relay-pool orchestrator).
 * Nostr REQ/subscribe remain unwired; publish uses mesh envelope transport.
 */
export const useConduitMeshRelayPool = (
  urls: ReadonlyArray<string>,
  profileId = "default",
): EnhancedRelayPoolResult => {
  const [runtime] = useState(() => createConduitMeshRelayPoolRuntime({ profileId }));
  const [activitySnapshot, setActivitySnapshot] = useState(EMPTY_ACTIVITY);
  const urlsKey = urls.join("|");

  useEffect(() => {
    void runtime.configureUrls(urlsKey ? urlsKey.split("|") : []).then(async () => {
      setActivitySnapshot(await runtime.getTransportActivitySnapshot());
    });
  }, [runtime, urlsKey]);

  useEffect(() => {
    const unsubscribe = runtime.mesh.subscribeEvidence(() => {
      void runtime.getTransportActivitySnapshot().then(setActivitySnapshot);
    });
    return () => {
      unsubscribe();
      runtime.dispose();
    };
  }, [runtime]);

  return useMemo((): EnhancedRelayPoolResult => ({
    connections: [],
    healthMetrics: [],
    sendToOpen: () => {},
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
    subscribeToMessages: () => () => {},
    subscribe: () => "conduit-mesh-unwired",
    unsubscribe: () => {},
    getRelayHealth: () => undefined,
    getRelayCircuitState: () => "healthy",
    canConnectToRelay: () => true,
    addTransientRelay: () => {},
    removeTransientRelay: () => {},
    reconnectRelay: () => {},
    reconnectAll: () => {},
    resubscribeAll: () => {},
    recycle: async () => {},
    isConnected: () => activitySnapshot.writableRelayCount > 0,
    waitForConnection: async () => runtime.isConnected(),
    waitForScopedConnection: async () => runtime.isConnected(),
    getWritableRelaySnapshot: () => ({
      atUnixMs: Date.now(),
      configuredRelayUrls: urls,
      writableRelayUrls: urls.slice(0, activitySnapshot.writableRelayCount),
      totalRelayCount: urls.length,
      openRelayCount: activitySnapshot.writableRelayCount,
    }),
    getTransportActivitySnapshot: () => activitySnapshot,
    getActiveSubscriptionCount: () => 0,
    dispose: () => runtime.dispose(),
  }), [runtime, activitySnapshot, urls]);
};
