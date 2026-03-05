"use client";

import { useState, useEffect, useMemo } from "react";
import type { Conversation, DmConversation, GroupConversation, ConnectionOverridesByConnectionId } from "@/app/features/messaging/types";
import { usePeerTrust } from "../../network/hooks/use-peer-trust";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

import { loadPersistedChatState } from "../utils/persistence";
import { connectionStore } from "../../invites/utils/connection-store";

export function useConversations(params: { publicKeyHex: PublicKeyHex | null }) {
    const [createdConnections, setCreatedConnections] = useState<ReadonlyArray<DmConversation>>([]);
    const [createdGroups, setCreatedGroups] = useState<ReadonlyArray<GroupConversation>>([]);
    const [connectionOverridesByConnectionId, setConnectionOverridesByConnectionId] = useState<ConnectionOverridesByConnectionId>({});
    const { isAccepted } = usePeerTrust({ publicKeyHex: params.publicKeyHex });

    useEffect(() => {
        const hydrate = async () => {
            const connections = await connectionStore.getAllConnections();
            setCreatedConnections(connections.map(c => ({
                kind: "dm",
                id: c.id,
                pubkey: c.publicKey,
                displayName: c.displayName,
                avatar: c.avatar,
                trustLevel: c.trustLevel,
                lastMessage: "", // Default empty
                unreadCount: 0,
                lastMessageTime: c.addedAt
            })));

            const groups = await connectionStore.getAllGroups();
            setCreatedGroups(groups.map(g => ({
                kind: "group",
                id: g.id,
                displayName: g.name,
                groupId: g.id,
                relayUrl: "", // Need to store this in ConnectionGroup later if needed
                memberPubkeys: [], // ConnectionGroup doesn't directly store member pubkeys yet
                lastMessage: "",
                unreadCount: 0,
                lastMessageTime: g.createdAt,
                access: "invite-only",
                memberCount: 0,
                adminPubkeys: [],
                avatar: undefined
            })));

            const state = loadPersistedChatState(params.publicKeyHex);
            if (state) {
                // TODO: Sync state with connectionStore if needed
            }
        };

        if (params.publicKeyHex) {
            void hydrate();
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
