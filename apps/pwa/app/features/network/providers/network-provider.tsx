"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { usePeerTrust } from "../hooks/use-peer-trust";
import { useRequestsInbox } from "@/app/features/messaging/hooks/use-requests-inbox";
import { useBlocklist } from "../hooks/use-blocklist";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { runIdentityIntegrityMigrationV085 } from "../services/identity-integrity-migration";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useRealtimePresence } from "../hooks/use-realtime-presence";

interface NetworkContextType {
    identity: ReturnType<typeof useIdentity>;
    peerTrust: ReturnType<typeof usePeerTrust>;
    requestsInbox: ReturnType<typeof useRequestsInbox>;
    blocklist: ReturnType<typeof useBlocklist>;
    presence: ReturnType<typeof useRealtimePresence>;
}

const NetworkContext = createContext<NetworkContextType | null>(null);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const identity = useIdentity();
    const { state } = identity;
    const publicKeyHex = (state.publicKeyHex ?? state.stored?.publicKeyHex ?? null) as PublicKeyHex | null;
    const privateKeyHex = (state.privateKeyHex ?? null) as PrivateKeyHex | null;
    const duplicateLockKeyRef = useRef<PublicKeyHex | null>(null);
    const { relayPool } = useRelay();

    const peerTrust = usePeerTrust({ publicKeyHex });
    const requestsInbox = useRequestsInbox({ publicKeyHex });
    const blocklist = useBlocklist({ publicKeyHex });
    const handleDuplicateSessionConflict = useCallback((record: Readonly<{
        sessionId: string;
        startedAtMs: number;
    }>) => {
        if (!publicKeyHex) {
            return;
        }
        if (duplicateLockKeyRef.current === publicKeyHex) {
            return;
        }
        duplicateLockKeyRef.current = publicKeyHex;
        logRuntimeEvent(
            "identity.session_conflict.detected",
            "actionable",
            [
                "A different active session is already online for this identity. Locking current session.",
                {
                    publicKeyHex,
                    incomingSessionId: record.sessionId,
                    incomingStartedAtMs: record.startedAtMs,
                },
            ],
        );
        identity.lockIdentity();
    }, [identity, publicKeyHex]);

    const presence = useRealtimePresence({
        publicKeyHex,
        privateKeyHex,
        acceptedPeers: peerTrust.state.acceptedPeers,
        relayPool,
        onDuplicateSessionConflict: handleDuplicateSessionConflict,
    });

    useEffect(() => {
        duplicateLockKeyRef.current = null;
    }, [publicKeyHex]);

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
        blocklist,
        presence,
    }), [identity, peerTrust, requestsInbox, blocklist, presence]);

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
