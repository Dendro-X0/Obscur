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
    const requestsInbox = useRequestsInbox({ publicKeyHex: identity.state.publicKeyHex ?? null });
    const {
        hasHydrated,
        createdContacts,
        unreadByConversationId,
        contactOverridesByContactId,
        messagesByConversationId
    } = useMessaging();
    const { createdGroups } = useGroups();

    useEffect(() => {
        if (hasHydrated) {
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
                    isOutgoing: false,
                    introMessage: item.lastMessagePreview,
                    timestampMs: item.lastReceivedAtUnixSeconds * 1000
                }))
            });
        }
    }, [
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
