"use client";
import { useEnhancedRelayPool, type EnhancedRelayPoolResult } from "./enhanced-relay-pool";
import { getMockPool } from "../../dev-tools/hooks/use-dev-mode";
import { useMemo } from "react";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

const DEV_MODE_KEY = "obscur_dev_mode";
const getDevModeStorageKey = (): string => getScopedStorageKey(DEV_MODE_KEY);

/**
 * Compatibility hook for useRelayPool
 * Requirement 4.2: Multiple relay support for redundancy
 */
export const useRelayPool = (urls: ReadonlyArray<string>): EnhancedRelayPoolResult => {
    const realPool = useEnhancedRelayPool(urls);

    // Check dev mode in a way that doesn't break SSR or initial hydration
    // Use true as default if we are in dev mode toggle? No, rely on localStorage
    const isDevMode = typeof window !== "undefined"
        && ((localStorage.getItem(getDevModeStorageKey()) ?? localStorage.getItem(DEV_MODE_KEY)) === "true");

    const mockPool = useMemo(() => {
        if (!isDevMode) {
            return null;
        }
        return getMockPool();
    }, [isDevMode]);

    return useMemo((): EnhancedRelayPoolResult => {
        if (!isDevMode || !mockPool) {
            return realPool;
        }
        return {
            connections: mockPool.connections,
            healthMetrics: mockPool.healthMetrics,
            sendToOpen: mockPool.sendToOpen.bind(mockPool),
            publishToUrl: mockPool.publishToRelay.bind(mockPool),
            publishToUrls: async (urls: ReadonlyArray<string>, payload: string) => {
                const unique = Array.from(new Set(urls));
                if (unique.length === 0) {
                    return { success: false, successCount: 0, totalRelays: 0, results: [], overallError: "No scoped relays provided" };
                }
                const results = await Promise.all(unique.map((url) => mockPool.publishToRelay(url, payload)));
                const successCount = results.filter((r) => r.success).length;
                return {
                    success: successCount > 0,
                    successCount,
                    totalRelays: unique.length,
                    results,
                    overallError: successCount > 0 ? undefined : (results[0]?.error ?? "Unknown failure")
                };
            },
            publishToRelay: mockPool.publishToRelay.bind(mockPool),
            publishToAll: mockPool.publishToAll.bind(mockPool),
            broadcastEvent: mockPool.publishToAll.bind(mockPool),
            subscribeToMessages: mockPool.subscribeToMessages.bind(mockPool),
            subscribe: mockPool.subscribe.bind(mockPool),
            unsubscribe: mockPool.unsubscribe.bind(mockPool),
            getRelayHealth: mockPool.getRelayHealth.bind(mockPool),
            getRelayCircuitState: () => "healthy",
            canConnectToRelay: mockPool.canConnectToRelay.bind(mockPool),
            addTransientRelay: mockPool.addTransientRelay.bind(mockPool),
            removeTransientRelay: mockPool.removeTransientRelay.bind(mockPool),
            reconnectRelay: (url: string) => { mockPool.addTransientRelay(url); },
            reconnectAll: () => { },
            resubscribeAll: () => { },
            recycle: async () => { },
            isConnected: mockPool.isConnected.bind(mockPool),
            waitForConnection: mockPool.waitForConnection.bind(mockPool),
            waitForScopedConnection: mockPool.waitForScopedConnection.bind(mockPool),
            getWritableRelaySnapshot: mockPool.getWritableRelaySnapshot.bind(mockPool),
            getTransportActivitySnapshot: () => ({
                lastInboundMessageAtUnixMs: undefined,
                lastInboundEventAtUnixMs: undefined,
                writableRelayCount: mockPool.getWritableRelaySnapshot().writableRelayUrls.length,
                subscribableRelayCount: mockPool.connections.filter((connection: { status: string }) => connection.status === "open").length,
                writeBlockedRelayCount: 0,
                coolingDownRelayCount: 0,
                fallbackRelayUrls: [],
                fallbackWritableRelayCount: 0,
            }),
            getActiveSubscriptionCount: () => 0,
            dispose: () => { },
        };
    }, [isDevMode, mockPool, realPool]);
};
