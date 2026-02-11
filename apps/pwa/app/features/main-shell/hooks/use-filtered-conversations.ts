"use client";

import { useMemo } from "react";
import type { Conversation, DmConversation, GroupConversation, Message, MessagesByConversationId, ContactOverridesByContactId } from "@/app/features/messaging/types";
import { applyContactOverrides, isVisibleUserMessage } from "@/app/features/messaging/utils/logic";
import { parseCommandMessage } from "@/app/features/messaging/utils/commands";

export function useFilteredConversations(
    createdContacts: ReadonlyArray<DmConversation>,
    createdGroups: ReadonlyArray<GroupConversation>,
    contactOverridesByContactId: ContactOverridesByContactId,
    messagesByConversationId: MessagesByConversationId,
    searchQuery: string,
    isPeerAccepted: (params: { publicKeyHex: string }) => boolean
) {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    const allConversations = useMemo(() => {
        const visibleContacts = createdContacts.filter(c => isPeerAccepted({ publicKeyHex: c.pubkey }));
        return [...visibleContacts, ...createdGroups].map(c => applyContactOverrides(c, contactOverridesByContactId));
    }, [createdContacts, createdGroups, contactOverridesByContactId, isPeerAccepted]);

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
