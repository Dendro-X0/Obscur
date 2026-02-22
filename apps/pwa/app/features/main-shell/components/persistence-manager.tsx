"use client";

import { useEffect } from "react";
import { useMessaging } from "../../../features/messaging/providers/messaging-provider";
import { useGroups } from "../../../features/groups/providers/group-provider";
import { useRequestsInbox } from "../../../features/messaging/hooks/use-requests-inbox";
import { useIdentity } from "../../../features/auth/hooks/use-identity";
import {
    savePersistedChatState,
    toPersistedDmConversation,
    toPersistedGroupConversation,
    toPersistedOverridesByContactId,
    toPersistedMessagesByConversationId
} from "../../../features/messaging/utils/persistence";

export function PersistenceManager() {
    const identity = useIdentity();
    const publicKeyHex = (identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null);
    const requestsInbox = useRequestsInbox({ publicKeyHex });
    const {
        hasHydrated,
        createdContacts,
        unreadByConversationId,
        contactOverridesByContactId,
        messagesByConversationId
    } = useMessaging();
    const { createdGroups } = useGroups();

    useEffect(() => {
        if (hasHydrated && publicKeyHex) {
            savePersistedChatState({
                version: 2,
                createdContacts: createdContacts.map(toPersistedDmConversation),
                createdGroups: createdGroups.map(toPersistedGroupConversation),
                unreadByConversationId,
                contactOverridesByContactId: toPersistedOverridesByContactId(contactOverridesByContactId),
                messagesByConversationId: toPersistedMessagesByConversationId(messagesByConversationId),
                connectionRequests: requestsInbox.state.items.map(item => ({
                    id: item.peerPublicKeyHex,
                    status: item.status || 'pending',
                    isOutgoing: item.isOutgoing ?? false,
                    introMessage: item.lastMessagePreview,
                    timestampMs: item.lastReceivedAtUnixSeconds * 1000
                }))
            }, publicKeyHex);
        }
    }, [
        publicKeyHex,
        hasHydrated,
        createdContacts,
        createdGroups,
        unreadByConversationId,
        contactOverridesByContactId,
        messagesByConversationId,
        requestsInbox.state.items
    ]);

    return null;
}
