"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { useProfilePublisher } from "@/app/features/profile/hooks/use-profile-publisher";
import { generateRandomInviteCode } from "@/app/features/invites/utils/invite-code-format";

import { nip19 } from "nostr-tools";

/**
 * Hook to manage the user's personal invite code
 */
export const useUserInviteCode = (params: {
    publicKeyHex: PublicKeyHex | null;
    privateKeyHex: PrivateKeyHex | null;
}) => {
    const { publicKeyHex, privateKeyHex } = params;
    const { enabledRelayUrls } = useRelay();
    const profile = useProfile();
    const { publishProfile } = useProfilePublisher();

    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);

    // Sync with profile.inviteCode
    useEffect(() => {
        if (!publicKeyHex) return;

        const currentCodeRaw = profile.state.profile.inviteCode;
        const currentCode = currentCodeRaw?.trim().toUpperCase();
        if (!currentCode) {
            const newCode = generateRandomInviteCode();
            profile.setInviteCode({ inviteCode: newCode });
            setInviteCode(newCode);
        } else {
            if (currentCode !== currentCodeRaw) {
                profile.setInviteCode({ inviteCode: currentCode });
            }
            setInviteCode(currentCode);
        }
    }, [publicKeyHex, profile]);

    // Generate nprofile from public key and relays (fallback/legacy info if needed)
    const nprofile = useMemo(() => {
        if (!publicKeyHex) return null;
        try {
            const hints = enabledRelayUrls.slice(0, 3);
            return nip19.nprofileEncode({
                pubkey: publicKeyHex,
                relays: hints
            });
        } catch {
            return null;
        }
    }, [publicKeyHex, enabledRelayUrls]);

    /**
     * Publish the invite code to the network
     */
    const publishCode = useCallback(async (): Promise<boolean> => {
        if (!publicKeyHex || !privateKeyHex || !inviteCode) return false;

        setIsPublishing(true);
        try {
            const success = await publishProfile({
                username: profile.state.profile.username || "Anon",
                about: profile.state.profile.about || "",
                avatarUrl: profile.state.profile.avatarUrl || "",
                nip05: profile.state.profile.nip05 || "",
                inviteCode,
            });
            return success;
        } catch {
            // publishProfile already reports user-facing failure details.
            return false;
        } finally {
            setIsPublishing(false);
        }
    }, [publicKeyHex, privateKeyHex, inviteCode, profile.state.profile.username, profile.state.profile.about, profile.state.profile.avatarUrl, profile.state.profile.nip05, publishProfile]);

    return useMemo(() => ({
        inviteCode,
        publishCode,
        isPublishing,
        nprofile
    }), [inviteCode, publishCode, isPublishing, nprofile]);
};
