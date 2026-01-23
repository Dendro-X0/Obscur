"use client";

import { useMemo, useState, useEffect } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { useRelayPool } from "./use-relay-pool";
import { useRelayList } from "./use-relay-list";
import { cryptoService } from "./crypto/crypto-service";

const INVITE_CODE_KEY = "obscur.user.invite_code";

/**
 * Hook to manage the user's personal invite code
 */
export const useUserInviteCode = (params: {
    publicKeyHex: PublicKeyHex | null;
    privateKeyHex: PrivateKeyHex | null;
}) => {
    const { publicKeyHex, privateKeyHex } = params;
    const relayList = useRelayList({ publicKeyHex });
    const enabledRelayUrls = useMemo(() =>
        relayList.state.relays.filter(r => r.enabled).map(r => r.url),
        [relayList.state.relays]
    );
    const pool = useRelayPool(enabledRelayUrls);

    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);

    // Load code from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(INVITE_CODE_KEY);
        if (stored) {
            setInviteCode(stored);
        } else if (publicKeyHex) {
            // Generate a new one if none exists
            const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const code = `OBSCUR-${newCode}`;
            localStorage.setItem(INVITE_CODE_KEY, code);
            setInviteCode(code);
        }
    }, [publicKeyHex]);

    /**
     * Publish the invite code to the network
     */
    const publishCode = async (): Promise<void> => {
        if (!publicKeyHex || !privateKeyHex || !inviteCode) return;

        setIsPublishing(true);
        try {
            // Use NIP-01 Kind 0 (Metadata) to store the code in the 'name' or a custom field
            // Or use a custom Kind 30001 for specifically discovery
            const content = JSON.stringify({
                name: inviteCode, // We'll put it in the name for now so standard clients can find it
                display_name: inviteCode,
                about: "Find me on Obscur with this code!"
            });

            const event = await cryptoService.signEvent({
                kind: 0,
                content,
                created_at: Math.floor(Date.now() / 1000),
                tags: [["code", inviteCode]], // Custom tag for specialized discovery
                pubkey: publicKeyHex
            }, privateKeyHex);

            pool.sendToOpen(JSON.stringify(["EVENT", event]));
            console.log("Published invite code to relays:", inviteCode);
        } catch (err) {
            console.error("Failed to publish invite code:", err);
        } finally {
            setIsPublishing(false);
        }
    };

    return {
        inviteCode,
        publishCode,
        isPublishing
    };
};
