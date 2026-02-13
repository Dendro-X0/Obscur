"use client";

import { useMemo } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Conversation, DmConversation, GroupConversation, Message, MessagesByConversationId, ContactOverridesByContactId } from "@/app/features/messaging/types";
import { applyContactOverrides, isVisibleUserMessage } from "@/app/features/messaging/utils/logic";
import { parseCommandMessage } from "@/app/features/messaging/utils/commands";

export function useFilteredConversations(
    createdContacts: ReadonlyArray<DmConversation>,
    createdGroups: ReadonlyArray<GroupConversation>,
    contactOverridesByContactId: ContactOverridesByContactId,
    messagesByConversationId: MessagesByConversationId,
    searchQuery: string,
    isPeerAccepted: (params: { publicKeyHex: string }) => boolean,
    myPublicKeyHex: string | null
) {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    const allConversations = useMemo(() => {
        const conversationsFromMessages: DmConversation[] = [];

        // Derive conversations from message history for accepted peers
        Object.keys(messagesByConversationId).forEach(cid => {
            const parts = cid.split(':');
            if (parts.length === 2 && myPublicKeyHex) { // Likely a DM CID (pubkey:pubkey)
                const peerPubkey = parts[0] === myPublicKeyHex ? parts[1] : parts[0];

                // If accepted and NOT already in createdContacts, add a pseudo-entry
                if (isPeerAccepted({ publicKeyHex: peerPubkey })) {
                    if (!createdContacts.some(c => c.id === cid)) {
                        conversationsFromMessages.push({
                            kind: 'dm',
                            id: cid,
                            pubkey: peerPubkey as PublicKeyHex,
                            displayName: peerPubkey.slice(0, 8),
                            lastMessage: '',
                            unreadCount: 0,
                            lastMessageTime: new Date()
                        });
                    }
                }
            }
        });

        const visibleContacts = createdContacts.filter(c => isPeerAccepted({ publicKeyHex: c.pubkey }));
        const all = [...visibleContacts, ...createdGroups, ...conversationsFromMessages];

        // Deduplicate just in case
        const seenIds = new Set<string>();
        const unique = all.filter(c => {
            if (seenIds.has(c.id)) return false;
            seenIds.add(c.id);
            return true;
        });

        return unique.map(c => applyContactOverrides(c, contactOverridesByContactId));
    }, [createdContacts, createdGroups, contactOverridesByContactId, isPeerAccepted, messagesByConversationId, myPublicKeyHex]);

    const messageSearchResults = useMemo(() => {
        if (!normalizedSearchQuery) return [];

        const results: Array<{ conversationId: string; messageId: string; timestamp: Date; preview: string }> = [];

        allConversations.forEach(conversation => {
            const messages = messagesByConversationId[conversation.id] ?? [];
            messages.filter(m => m.kind === "user" && !m.deletedAt).forEach(m => {
                if (m.content.toLowerCase().includes(normalizedSearchQuery)) {
                    results.push({
                        conversationId: conversation.id,
                        messageId: m.id,
                        timestamp: m.timestamp,
                        preview: m.content
                    });
                }
            });
        });

        return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 12);
    }, [allConversations, messagesByConversationId, normalizedSearchQuery]);

    const filteredConversations = useMemo(() => {
        if (!normalizedSearchQuery) return allConversations;

        const matchedMessageConvIds = new Set(messageSearchResults.map(r => r.conversationId));

        return allConversations.filter(c =>
            c.displayName.toLowerCase().includes(normalizedSearchQuery) ||
            (c.kind === "dm" && c.pubkey.toLowerCase().includes(normalizedSearchQuery)) ||
            matchedMessageConvIds.has(c.id)
        );
    }, [allConversations, messageSearchResults, normalizedSearchQuery]);

    return { allConversations, filteredConversations, messageSearchResults };
}
