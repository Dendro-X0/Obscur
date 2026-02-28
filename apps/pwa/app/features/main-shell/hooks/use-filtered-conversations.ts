"use client";

import { useState, useEffect, useMemo } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Conversation, DmConversation, GroupConversation, Message, MessagesByConversationId, ContactOverridesByContactId } from "@/app/features/messaging/types";
import { applyContactOverrides, isVisibleUserMessage } from "@/app/features/messaging/utils/logic";
import { parseCommandMessage } from "@/app/features/messaging/utils/commands";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";

export function useFilteredConversations(
    createdContacts: ReadonlyArray<DmConversation>,
    createdGroups: ReadonlyArray<GroupConversation>,
    contactOverridesByContactId: ContactOverridesByContactId,
    searchQuery: string,
    isPeerAccepted: (params: { publicKeyHex: string }) => boolean,
    myPublicKeyHex: string | null
) {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    const allConversations = useMemo(() => {
        const visibleContacts = createdContacts.filter(c => isPeerAccepted({ publicKeyHex: c.pubkey }));
        const all = [...visibleContacts, ...createdGroups];

        // Deduplicate
        const seenIds = new Set<string>();
        const unique = all.filter(c => {
            if (seenIds.has(c.id)) return false;
            seenIds.add(c.id);
            return true;
        });

        return unique.map(c => applyContactOverrides(c, contactOverridesByContactId));
    }, [createdContacts, createdGroups, contactOverridesByContactId, isPeerAccepted]);

    const [messageSearchResults, setMessageSearchResults] = useState<ReadonlyArray<{ conversationId: string; messageId: string; timestamp: Date; preview: string }>>([]);

    useEffect(() => {
        if (!normalizedSearchQuery || normalizedSearchQuery.length < 2) {
            setMessageSearchResults([]);
            return;
        }

        const debounceId = setTimeout(async () => {
            const results = await chatStateStoreService.searchMessages(normalizedSearchQuery);
            setMessageSearchResults(results.map((r: { conversationId: string; message: any }) => ({
                conversationId: r.conversationId,
                messageId: r.message.id,
                timestamp: new Date(r.message.timestampMs || r.message.created_at * 1000),
                preview: r.message.content
            })));
        }, 300);

        return () => clearTimeout(debounceId);
    }, [normalizedSearchQuery]);

    const filteredConversations = useMemo(() => {
        if (!normalizedSearchQuery) return allConversations;

        return allConversations.filter(c =>
            c.displayName.toLowerCase().includes(normalizedSearchQuery) ||
            (c.kind === "dm" && c.pubkey.toLowerCase().includes(normalizedSearchQuery))
        );
    }, [allConversations, normalizedSearchQuery]);

    return { allConversations, filteredConversations, messageSearchResults };
}
