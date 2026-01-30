"use client";

import { useMemo, useState, useEffect } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { useRelayPool } from "@/app/features/relays/hooks/use-relay-pool";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { cryptoService } from "@/app/features/crypto/crypto-service";

import { nip19 } from "nostr-tools";

const INVITE_CODE_KEY = "obscur.user.invite_code.v2";

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

    // Generate nprofile from public key and relays
    const nprofile = useMemo(() => {
        if (!publicKeyHex) return null;
        try {
            // Take top 3 relays as hints
            const hints = enabledRelayUrls.slice(0, 3);
            return nip19.nprofileEncode({
                pubkey: publicKeyHex,
                relays: hints
            });
        } catch (err) {
            console.error("Failed to encode nprofile:", err);
            return null;
        }
    }, [publicKeyHex, enabledRelayUrls]);

    // Load or set invite code
    useEffect(() => {
        if (nprofile) {
            setInviteCode(nprofile);
        }
    }, [nprofile]);

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
