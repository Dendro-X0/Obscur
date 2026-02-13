"use client";
import { useEnhancedRelayPool, type EnhancedRelayPoolResult } from "./enhanced-relay-pool";
import { getMockPool } from "../../dev-tools/hooks/use-dev-mode";
import { useMemo } from "react";

/**
 * Compatibility hook for useRelayPool
 * Requirement 4.2: Multiple relay support for redundancy
 */
export const useRelayPool = (urls: ReadonlyArray<string>): EnhancedRelayPoolResult => {
    const realPool = useEnhancedRelayPool(urls);

    // Check dev mode in a way that doesn't break SSR or initial hydration
    // Use true as default if we are in dev mode toggle? No, rely on localStorage
    const isDevMode = typeof window !== "undefined" && localStorage.getItem("obscur_dev_mode") === "true";

    if (isDevMode) {
        // We import dynamically or use the singleton from dev-tools
        const mockPool = getMockPool();

        // Map MockPool to EnhancedRelayPoolResult interface
        // eslint-disable-next-line
        return useMemo(() => ({
            connections: mockPool.connections,
            healthMetrics: mockPool.healthMetrics,
            sendToOpen: mockPool.sendToOpen.bind(mockPool),
            publishToRelay: mockPool.publishToRelay.bind(mockPool),
            publishToAll: mockPool.publishToAll.bind(mockPool),
            broadcastEvent: mockPool.publishToAll.bind(mockPool),
            subscribeToMessages: mockPool.subscribeToMessages.bind(mockPool),
            subscribe: mockPool.subscribe.bind(mockPool),
            unsubscribe: mockPool.unsubscribe.bind(mockPool),
            getRelayHealth: mockPool.getRelayHealth.bind(mockPool),
            canConnectToRelay: mockPool.canConnectToRelay.bind(mockPool),
            addTransientRelay: mockPool.addTransientRelay.bind(mockPool),
            removeTransientRelay: mockPool.removeTransientRelay.bind(mockPool),
            isConnected: mockPool.isConnected.bind(mockPool),
            waitForConnection: mockPool.waitForConnection.bind(mockPool),
        }), [mockPool]);
    }

    return realPool;
};
