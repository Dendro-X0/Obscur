"use client";

import { useState, useCallback } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useRelay } from "../../relays/providers/relay-provider";
import { isValidInviteCode } from "./invite-parser";

export type ResolvedInvite = {
    publicKeyHex: PublicKeyHex;
    displayName?: string;
    avatar?: string;
    about?: string;
};

export const useInviteResolver = (params: { myPublicKeyHex: PublicKeyHex | null }) => {
    const { myPublicKeyHex } = params;
    const { relayPool: pool } = useRelay();


    const [isResolving, setIsResolving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resolveCode = useCallback(async (code: string): Promise<ResolvedInvite | null> => {
        if (!isValidInviteCode(code)) {
            setError("Invalid invite code format");
            return null;
        }

        setIsResolving(true);
        setError(null);

        return new Promise((resolve) => {
            let found: ResolvedInvite | null = null;
            let subId: string | null = null;

            const onEvent = (event: any) => {
                try {
                    if (event.kind === 0) {
                        const content = JSON.parse(event.content);
                        // Double check this event actually belongs to the code
                        // We check tags first (reliable for Obscur PWA), then name/displayName
                        const hasCodeTag = event.tags?.some((t: any) => t[0] === 'code' && t[1]?.toUpperCase() === code);
                        const namesMatch = content.name === code || content.display_name === code;

                        if (hasCodeTag || namesMatch) {
                            console.log(`[InviteResolver] Found user for code ${code}: ${event.pubkey}`);
                            found = {
                                publicKeyHex: event.pubkey as PublicKeyHex,
                                displayName: content.display_name || content.name,
                                avatar: content.picture || content.avatar,
                                about: content.about
                            };
                            if (subId) pool.unsubscribe(subId);
                            setIsResolving(false);
                            resolve(found);
                        }
                    }
                } catch (e) {
                    console.warn("[InviteResolver] Error parsing profile:", e);
                }
            };

            // Strategy 1: Search by custom #code tag (Primary)
            // Strategy 2: NIP-50 Keyword search (Secondary)
            const filters = [
                { kinds: [0], "#code": [code], limit: 1 },
                { kinds: [0], search: code, limit: 3 }
            ];

            console.log(`[InviteResolver] Subscribing with dual search filters for: ${code}`);
            subId = pool.subscribe(filters, onEvent);

            // Timeout after 7 seconds (allow more time for dual relay search)
            setTimeout(() => {
                if (!found) {
                    if (subId) pool.unsubscribe(subId);
                    setError("Could not find user with this code");
                    setIsResolving(false);
                    resolve(null);
                }
            }, 7000);
        });
    }, [pool]);

    return {
        resolveCode,
        isResolving,
        error
    };
};
