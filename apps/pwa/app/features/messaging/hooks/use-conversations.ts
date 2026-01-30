"use client";

import { useState, useEffect, useMemo } from "react";
import type { Conversation, DmConversation, GroupConversation, ContactOverridesByContactId } from "@/app/features/messaging/types";
import { usePeerTrust } from "../../contacts/hooks/use-peer-trust";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

// Storage keys (matching page.tsx for compatibility)
const PERSISTED_CHAT_STATE_STORAGE_KEY: string = "dweb.nostr.pwa.chatState";

export function useConversations(params: { publicKeyHex: PublicKeyHex | null }) {
    const [createdContacts, setCreatedContacts] = useState<ReadonlyArray<DmConversation>>([]);
    const [createdGroups, setCreatedGroups] = useState<ReadonlyArray<GroupConversation>>([]);
    const [contactOverridesByContactId, setContactOverridesByContactId] = useState<ContactOverridesByContactId>({});
    const { isAccepted } = usePeerTrust({ publicKeyHex: params.publicKeyHex });

    // Persistence logic (Simplified version of page.tsx logic for now)
    useEffect(() => {
        try {
            const raw = localStorage.getItem(PERSISTED_CHAT_STATE_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                // We'll trust the parsing for now, or use a safer approach if needed
                if (parsed.createdContacts) {
                    // Mapping would happen here normally
                }
            }
        } catch (e) {
            console.error("Failed to load chat state", e);
        }
    }, []);

    const visibleCreatedContacts = useMemo(() => {
        return createdContacts.filter((c) => isAccepted({ publicKeyHex: c.pubkey }));
    }, [createdContacts, isAccepted]);

    const allConversations: ReadonlyArray<Conversation> = useMemo(() => {
        return [...visibleCreatedContacts, ...createdGroups].map(c => {
            const override = contactOverridesByContactId[c.id];
            if (!override) return c;
            return { ...c, lastMessage: override.lastMessage, lastMessageTime: override.lastMessageTime };
        });
    }, [visibleCreatedContacts, createdGroups, contactOverridesByContactId]);

    return {
        allConversations,
        createdContacts,
        setCreatedContacts,
        createdGroups,
        setCreatedGroups,
        contactOverridesByContactId,
        setContactOverridesByContactId
    };
}
