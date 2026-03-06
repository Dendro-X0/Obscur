"use client";

import React, { createContext, useContext, useEffect, useMemo } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { usePeerTrust } from "../hooks/use-peer-trust";
import { useRequestsInbox } from "@/app/features/messaging/hooks/use-requests-inbox";
import { useBlocklist } from "../hooks/use-blocklist";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { runIdentityIntegrityMigrationV085 } from "../services/identity-integrity-migration";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";

interface NetworkContextType {
    identity: ReturnType<typeof useIdentity>;
    peerTrust: ReturnType<typeof usePeerTrust>;
    requestsInbox: ReturnType<typeof useRequestsInbox>;
    blocklist: ReturnType<typeof useBlocklist>;
}

const NetworkContext = createContext<NetworkContextType | null>(null);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const identity = useIdentity();
    const { state } = identity;
    const publicKeyHex = (state.publicKeyHex ?? state.stored?.publicKeyHex ?? null) as PublicKeyHex | null;

    const peerTrust = usePeerTrust({ publicKeyHex });
    const requestsInbox = useRequestsInbox({ publicKeyHex });
    const blocklist = useBlocklist({ publicKeyHex });

    useEffect(() => {
        if (!publicKeyHex) return;
        void runIdentityIntegrityMigrationV085(publicKeyHex)
            .then((report) => {
                logRuntimeEvent("identity_integrity.migration_v085.completed", "expected", [report]);
            })
            .catch((error) => {
                logRuntimeEvent(
                    "identity_integrity.migration_v085.failed",
                    "degraded",
                    [error instanceof Error ? error.message : String(error)]
                );
            });
    }, [publicKeyHex]);

    const value = useMemo(() => ({
        identity,
        peerTrust,
        requestsInbox,
        blocklist
    }), [identity, peerTrust, requestsInbox, blocklist]);

    return (
        <NetworkContext.Provider value={value}>
            {children}
        </NetworkContext.Provider>
    );
};

export const useNetwork = () => {
    const context = useContext(NetworkContext);
    if (!context) {
        throw new Error("useNetwork must be used within a NetworkProvider");
    }
    return context;
};
