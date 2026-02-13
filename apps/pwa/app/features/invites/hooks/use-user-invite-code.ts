"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { useProfile } from "@/app/features/profile/hooks/use-profile";

import { nip19 } from "nostr-tools";

const generateRandomCode = (): string => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No O, 0, I, 1
    let result = "";
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `OBSCUR-${result}`;
};

/**
 * Hook to manage the user's personal invite code
 */
export const useUserInviteCode = (params: {
    publicKeyHex: PublicKeyHex | null;
    privateKeyHex: PrivateKeyHex | null;
}) => {
    const { publicKeyHex, privateKeyHex } = params;
    const { relayPool: pool, enabledRelayUrls } = useRelay();
    const profile = useProfile();

    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);

    // Sync with profile.inviteCode
    useEffect(() => {
        if (!publicKeyHex) return;

        const currentCode = profile.state.profile.inviteCode;
        if (!currentCode) {
            const newCode = generateRandomCode();
            profile.setInviteCode({ inviteCode: newCode });
            setInviteCode(newCode);
        } else {
            setInviteCode(currentCode);
        }
    }, [publicKeyHex, profile.state.profile.inviteCode, profile.setInviteCode]);

    // Generate nprofile from public key and relays (fallback/legacy info if needed)
    const nprofile = useMemo(() => {
        if (!publicKeyHex) return null;
        try {
            const hints = enabledRelayUrls.slice(0, 3);
            return nip19.nprofileEncode({
                pubkey: publicKeyHex,
                relays: hints
            });
        } catch (err) {
            return null;
        }
    }, [publicKeyHex, enabledRelayUrls]);

    /**
     * Publish the invite code to the network
     */
    const publishCode = useCallback(async (): Promise<void> => {
        if (!publicKeyHex || !privateKeyHex || !inviteCode) return;

        setIsPublishing(true);
        try {
            // Include invite code in Kind 0 metadata
            // Some clients might use 'name', but we also use a custom tag for our resolver
            const content = JSON.stringify({
                name: profile.state.profile.username || "Anon",
                display_name: profile.state.profile.username || "Anon",
                about: `Find me on Obscur with this code: ${inviteCode}`,
                picture: profile.state.profile.avatarUrl
            });

            const event = await cryptoService.signEvent({
                kind: 0,
                content,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ["code", inviteCode],
                    ["l", "obscur-invite"]
                ],
                pubkey: publicKeyHex
            }, privateKeyHex);

            pool.sendToOpen(JSON.stringify(["EVENT", event]));
            console.log("Published invite code to relays:", inviteCode);
        } catch (err) {
            console.error("Failed to publish invite code:", err);
        } finally {
            setIsPublishing(false);
        }
    }, [publicKeyHex, privateKeyHex, inviteCode, pool, profile.state.profile.username, profile.state.profile.avatarUrl]);

    return {
        inviteCode,
        publishCode,
        isPublishing,
        nprofile // Still return nprofile for legacy/alternative use
    };
};
