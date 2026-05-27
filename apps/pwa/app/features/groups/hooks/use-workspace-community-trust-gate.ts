"use client";

import { useEffect, useMemo, useState } from "react";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { probeCoordinationHealth } from "../services/community-coordination-health";
import {
    assessWorkspaceCommunityTrust,
    assessWorkspaceCommunityTrustAsync,
    type WorkspaceCommunityTrustAssessment,
} from "../services/community-trust-policy";

const normalizeRelayUrl = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) {
        return "";
    }
    return /^wss?:\/\//i.test(trimmed) ? trimmed : `wss://${trimmed}`;
};

/**
 * Sync trust gate for create/join UI (coordination health from last probe).
 * @see docs/program/community-fork-decision-2026-05.md Path B
 */
export function useWorkspaceCommunityTrustGate(params: Readonly<{
    communityRelayUrl: string | null | undefined;
    active?: boolean;
}>): Readonly<{
    trust: Omit<WorkspaceCommunityTrustAssessment, "coordination"> & Readonly<{ coordinationConfigured: boolean }>;
    coordinationHealthy: boolean | null;
    blocked: boolean;
    refreshCoordinationHealth: () => void;
}> {
    const { state: identityState } = useIdentity();
    const relayList = useRelayList({ publicKeyHex: identityState.publicKeyHex || null });
    const [coordinationHealthy, setCoordinationHealthy] = useState<boolean | null>(null);
    const active = params.active ?? true;
    const relayUrl = params.communityRelayUrl?.trim() ?? "";

    const refreshCoordinationHealth = (): void => {
        void probeCoordinationHealth({ force: true }).then((snapshot) => {
            setCoordinationHealthy(snapshot.healthy);
        });
    };

    useEffect(() => {
        if (!active || !relayUrl) {
            return;
        }
        let cancelled = false;
        void probeCoordinationHealth({ force: true }).then((snapshot) => {
            if (!cancelled) {
                setCoordinationHealthy(snapshot.healthy);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [active, relayUrl]);

    const enabledRelayUrls = useMemo(
        () => relayList.state.relays.map((relay) => relay.url),
        [relayList.state.relays],
    );

    const trust = useMemo(
        () => assessWorkspaceCommunityTrust({
            communityRelayUrl: normalizeRelayUrl(relayUrl),
            enabledRelayUrls,
            coordinationHealthy: coordinationHealthy ?? false,
        }),
        [coordinationHealthy, enabledRelayUrls, relayUrl],
    );

    return {
        trust,
        coordinationHealthy,
        blocked: !trust.allowed,
        refreshCoordinationHealth,
    };
}

/** Async guard before join/create side effects (re-probes coordination). */
export const assertWorkspaceCommunityJoinAllowed = async (params: Readonly<{
    communityRelayUrl: string;
    enabledRelayUrls?: ReadonlyArray<string>;
}>): Promise<WorkspaceCommunityTrustAssessment> => {
    const trust = await assessWorkspaceCommunityTrustAsync({
        communityRelayUrl: normalizeRelayUrl(params.communityRelayUrl),
        enabledRelayUrls: params.enabledRelayUrls,
    });
    return trust;
};
