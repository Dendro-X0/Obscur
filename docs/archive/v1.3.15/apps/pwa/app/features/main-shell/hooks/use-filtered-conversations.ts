"use client";

import { useMemo } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { DmConversation, GroupConversation, ConnectionOverridesByConnectionId } from "@/app/features/messaging/types";
import { applyConnectionOverrides } from "@/app/features/messaging/utils/logic";

export function useFilteredConversations(
    createdConnections: ReadonlyArray<DmConversation>,
    createdGroups: ReadonlyArray<GroupConversation>,
    connectionOverridesByConnectionId: ConnectionOverridesByConnectionId,
    searchQuery: string,
    isPeerAccepted: (params: { publicKeyHex: string }) => boolean,
    myPublicKeyHex: string | null
) {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    const allConversations = useMemo(() => {
        const visibleConnections = createdConnections.filter(c => {
            if (myPublicKeyHex && c.pubkey === myPublicKeyHex) {
                return false;
            }
            return isPeerAccepted({ publicKeyHex: c.pubkey });
        });
        const all = [...visibleConnections, ...createdGroups];

        // Deduplicate
        const seenIds = new Set<string>();
        const unique = all.filter(c => {
            if (seenIds.has(c.id)) return false;
            seenIds.add(c.id);
            return true;
        });

        return unique.map(c => applyConnectionOverrides(c, connectionOverridesByConnectionId));
    }, [createdConnections, createdGroups, connectionOverridesByConnectionId, isPeerAccepted, myPublicKeyHex]);

    const filteredConversations = useMemo(() => {
        if (!normalizedSearchQuery) return allConversations;

        return allConversations.filter(c =>
            c.displayName.toLowerCase().includes(normalizedSearchQuery) ||
            (c.kind === "dm" && c.pubkey.toLowerCase().includes(normalizedSearchQuery))
        );
    }, [allConversations, normalizedSearchQuery]);

    return { allConversations, filteredConversations };
}
