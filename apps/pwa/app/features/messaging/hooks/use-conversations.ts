"use client";

import { useState, useEffect, useMemo } from "react";
import type { Conversation, DmConversation, GroupConversation, ConnectionOverridesByConnectionId } from "@/app/features/messaging/types";
import { usePeerTrust } from "../../network/hooks/use-peer-trust";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

import { loadPersistedChatState } from "../utils/persistence";

export function useConversations(params: { publicKeyHex: PublicKeyHex | null }) {
    const [createdConnections, setCreatedConnections] = useState<ReadonlyArray<DmConversation>>([]);
    const [createdGroups, setCreatedGroups] = useState<ReadonlyArray<GroupConversation>>([]);
    const [connectionOverridesByConnectionId, setConnectionOverridesByConnectionId] = useState<ConnectionOverridesByConnectionId>({});
    const { isAccepted } = usePeerTrust({ publicKeyHex: params.publicKeyHex });

    useEffect(() => {
        const state = loadPersistedChatState(params.publicKeyHex);
        if (state) {
            // We'll trust the parsing for now, or use a safer approach if needed
            // TODO: properly hydrate from state if this hook is intended to be the source of truth
        }
    }, [params.publicKeyHex]);

    const visibleCreatedConnections = useMemo(() => {
        return createdConnections.filter((c) => isAccepted({ publicKeyHex: c.pubkey }));
    }, [createdConnections, isAccepted]);

    const allConversations: ReadonlyArray<Conversation> = useMemo(() => {
        return [...visibleCreatedConnections, ...createdGroups].map(c => {
            const override = connectionOverridesByConnectionId[c.id];
            if (!override) return c;
            return { ...c, lastMessage: override.lastMessage, lastMessageTime: override.lastMessageTime };
        });
    }, [visibleCreatedConnections, createdGroups, connectionOverridesByConnectionId]);

    return {
        allConversations,
        createdConnections,
        setCreatedConnections,
        createdGroups,
        setCreatedGroups,
        connectionOverridesByConnectionId,
        setConnectionOverridesByConnectionId
    };
}
