"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useRelayList } from "../hooks/use-relay-list";
import { useRelayPool } from "../hooks/use-relay-pool";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import type { RelayStatusSummary } from "@/app/features/messaging/types";

interface RelayContextType {
    relayList: ReturnType<typeof useRelayList>;
    relayPool: ReturnType<typeof useRelayPool>;
    relayStatus: RelayStatusSummary;
    enabledRelayUrls: ReadonlyArray<string>;
}

const RelayContext = createContext<RelayContextType | null>(null);

export const RelayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const identity = useIdentity();
    const publicKeyHex = identity.state.publicKeyHex ?? null;

    const relayList = useRelayList({ publicKeyHex });

    const enabledRelayUrls = useMemo(() => {
        return relayList.state.relays
            .filter(relay => relay.enabled)
            .map(relay => relay.url);
    }, [relayList.state.relays]);

    const relayPool = useRelayPool(enabledRelayUrls);

    const relayStatus = useMemo<RelayStatusSummary>(() => {
        const total = relayPool.connections.length;
        let openCount = 0;
        let errorCount = 0;
        relayPool.connections.forEach(conn => {
            if (conn.status === "open") openCount++;
            if (conn.status === "error") errorCount++;
        });
        return { total, openCount, errorCount };
    }, [relayPool.connections]);

    const value = useMemo(() => ({
        relayList,
        relayPool,
        relayStatus,
        enabledRelayUrls
    }), [relayList, relayPool, relayStatus, enabledRelayUrls]);

    return <RelayContext.Provider value={value}>{children}</RelayContext.Provider>;
};

export const useRelay = () => {
    const context = useContext(RelayContext);
    if (!context) {
        throw new Error("useRelay must be used within a RelayProvider");
    }
    return context;
};
