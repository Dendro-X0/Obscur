"use client";

import { useMemo, useState } from "react";
import type { Conversation, DmConversation, GroupConversation, ConnectionOverridesByConnectionId } from "@/app/features/messaging/types";
import { usePeerTrust } from "../../network/hooks/use-peer-trust";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

/**
 * Legacy hook — conversation lists are owned by `MessagingProvider` (projection /
 * sqlite / persisted chat state). Do not hydrate from global `connectionStore`.
 */
export function useConversations(params: { publicKeyHex: PublicKeyHex | null }) {
    const [createdConnections] = useState<ReadonlyArray<DmConversation>>([]);
    const [createdGroups] = useState<ReadonlyArray<GroupConversation>>([]);
    const [connectionOverridesByConnectionId, setConnectionOverridesByConnectionId] = useState<ConnectionOverridesByConnectionId>({});
    const { isAccepted } = usePeerTrust({ publicKeyHex: params.publicKeyHex });

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
        setCreatedConnections: () => undefined,
        createdGroups,
        setCreatedGroups: () => undefined,
        connectionOverridesByConnectionId,
        setConnectionOverridesByConnectionId
    };
}
