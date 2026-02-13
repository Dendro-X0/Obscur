"use client";

import { useEffect, useState, useMemo } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useRelay } from "../../relays/providers/relay-provider";
import { contactStore } from "../../invites/utils/contact-store";
import type { NostrEvent } from "@dweb/nostr/nostr-event";

export interface ProfileMetadata {
    pubkey: PublicKeyHex;
    displayName?: string;
    avatarUrl?: string;
    nip05?: string;
    about?: string;
}

const metadataCache = new Map<string, ProfileMetadata>();

/**
 * Hook to resolve and subscribe to user metadata (Kind 0)
 */
export const useProfileMetadata = (pubkey: string | null): ProfileMetadata | null => {
    const { relayPool: pool } = useRelay();
    const [metadata, setMetadata] = useState<ProfileMetadata | null>(() => {
        if (!pubkey) return null;
        return metadataCache.get(pubkey) || null;
    });

    useEffect(() => {
        if (!pubkey || !pool) return;

        // 1. Check cache
        const cached = metadataCache.get(pubkey);
        if (cached) {
            queueMicrotask(() => {
                setMetadata(cached);
            });
            return;
        }

        // 2. Check persistent store
        const loadFromStore = async () => {
            try {
                const contact = await contactStore.getContactByPublicKey(pubkey);
                if (contact && (contact.displayName || contact.avatar)) {
                    const fromStore: ProfileMetadata = {
                        pubkey: pubkey as PublicKeyHex,
                        displayName: contact.displayName,
                        avatarUrl: contact.avatar,
                    };
                    metadataCache.set(pubkey, fromStore);
                    queueMicrotask(() => {
                        setMetadata(fromStore);
                    });
                }
            } catch (e) {
                console.warn("[ProfileMetadata] Error loading from store:", e);
            }
        };

        void loadFromStore();

        // 3. Subscribe to Kind 0
        const subId = pool.subscribe(
            [{ kinds: [0], authors: [pubkey], limit: 1 }],
            (event: NostrEvent) => {
                try {
                    const content = JSON.parse(event.content);
                    const freshMetadata: ProfileMetadata = {
                        pubkey: event.pubkey as PublicKeyHex,
                        displayName: content.display_name || content.name,
                        avatarUrl: content.picture,
                        nip05: content.nip05,
                        about: content.about,
                    };
                    metadataCache.set(pubkey, freshMetadata);
                    setMetadata(freshMetadata);

                    // Update persistent store if desired (maybe later)
                } catch (e) {
                    console.warn("Failed to parse metadata content", e);
                }
            }
        );

        return () => {
            if (subId) pool.unsubscribe(subId);
        };
    }, [pubkey, pool]);

    return metadata;
};
