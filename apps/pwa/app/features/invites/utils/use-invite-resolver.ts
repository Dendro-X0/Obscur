"use client";

import { useState, useCallback } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useRelayPool } from "../../relays/hooks/use-relay-pool";
import { useRelayList } from "../../relays/hooks/use-relay-list";
import { isValidInviteCode } from "./invite-parser";

export type ResolvedInvite = {
    publicKeyHex: PublicKeyHex;
    displayName?: string;
    avatar?: string;
    about?: string;
};

export const useInviteResolver = (params: { myPublicKeyHex: PublicKeyHex | null }) => {
    const { myPublicKeyHex } = params;
    const relayList = useRelayList({ publicKeyHex: myPublicKeyHex });
    const pool = useRelayPool(relayList.state.relays.filter(r => r.enabled).map(r => r.url));

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
            const subscriptionId = Math.random().toString(36).substring(2, 10);
            let found: ResolvedInvite | null = null;

            const handleMessage = (msgParams: { url: string; message: string }) => {
                try {
                    const data = JSON.parse(msgParams.message);
                    if (data[0] === "EVENT" && data[1] === subscriptionId) {
                        const event = data[2];
                        if (event.kind === 0) {
                            const content = JSON.parse(event.content);
                            // Verify this event actually belongs to the code
                            // Standard search by 'name' as established in use-user-invite-code.ts
                            if (content.name === code || content.display_name === code) {
                                found = {
                                    publicKeyHex: event.pubkey as PublicKeyHex,
                                    displayName: content.display_name || content.name,
                                    avatar: content.picture || content.avatar,
                                    about: content.about
                                };
                                cleanup();
                                resolve(found);
                            }
                        }
                    }
                } catch {
                    // Ignore parse errors
                }
            };

            const cleanup = pool.subscribeToMessages(handleMessage);

            // Send REQ for Kind 0 with the code in search or name
            // Some relays support 'search' filter, others we might need to be more specific
            // Since use-user-invite-code puts it in 'name' and 'display_name', we can't easily filter by that in standard REQ unless we use 'search' or 'authors' (which we don't know)
            // However, it also adds a [["code", inviteCode]] tag.
            const filter = {
                kinds: [0],
                "#code": [code], // Use the custom tag we added
                limit: 1
            };

            pool.sendToOpen(JSON.stringify(["REQ", subscriptionId, filter]));

            // Timeout after 5 seconds
            setTimeout(() => {
                if (!found) {
                    cleanup();
                    setError("Could not find user with this code");
                    setIsResolving(false);
                    resolve(null);
                }
            }, 5000);
        });
    }, [pool]);

    return {
        resolveCode,
        isResolving,
        error
    };
};
