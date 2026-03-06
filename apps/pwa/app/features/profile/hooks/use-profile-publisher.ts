import { useCallback, useMemo, useState } from "react";
import type { UnsignedNostrEvent } from "@/app/features/crypto/crypto-service";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { powService } from "@/app/features/crypto/pow-service";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useTranslation } from "react-i18next";

export type PublishProfileParams = Readonly<{
    username: string;
    about?: string;
    avatarUrl?: string; // NIP-05 compliant field name is 'picture', but we map it
    nip05?: string;
    lud16?: string;
    inviteCode?: string;
}>;

type UseProfilePublisherResult = Readonly<{
    publishProfile: (params: PublishProfileParams) => Promise<boolean>;
    isPublishing: boolean;
    isMining: boolean;
    error: string | null;
}>;

/**
 * Hook to handle publishing User Metadata (Kind 0) events to relays.
 * essential for user discovery in the network.
 */
export const useProfilePublisher = (): UseProfilePublisherResult => {
    const { t } = useTranslation();
    const identity = useIdentity();
    const [isPublishing, setIsPublishing] = useState(false);
    const [isMining, setIsMining] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Use shared relay pool
    const { relayPool: pool, enabledRelayUrls } = useRelay();


    const publishProfile = useCallback(async (params: PublishProfileParams): Promise<boolean> => {
        const idState = identity.getIdentitySnapshot();
        const pubkey = identity.state.publicKeyHex || idState.publicKeyHex;
        const privkey = identity.state.privateKeyHex || idState.privateKeyHex;

        if (!pubkey || !privkey) {
            setError(t("identity.error.notUnlocked") || "Identity not unlocked");
            return false;
        }

        if (enabledRelayUrls.length === 0) {
            setError(t("settings.relays.noRelaysTitle") || "No relays connected");
            return false;
        }

        setIsPublishing(true);
        setError(null);

        try {
            const hasRelayConnection = await pool.waitForConnection(5000);
            if (!hasRelayConnection) {
                setError("Relay connection is temporarily unavailable. Please retry in a moment.");
                return false;
            }

            // Construct Kind 0 Event content
            let aboutContent = params.about || "";
            if (params.inviteCode && !aboutContent.includes(params.inviteCode)) {
                if (aboutContent) aboutContent += "\n\n";
                aboutContent += `Find me on Obscur with this code: ${params.inviteCode}`;
            }

            const content = JSON.stringify({
                name: params.username,
                display_name: params.username, // Some clients use one or the other
                about: aboutContent,
                picture: params.avatarUrl || "",
                nip05: params.nip05 || "",
                lud16: params.lud16 || "",
            });

            const tags: string[][] = [];
            if (params.inviteCode) {
                tags.push(["code", params.inviteCode]);
                tags.push(["l", "obscur-invite"]);
            }

            const unsignedEvent: UnsignedNostrEvent = {
                kind: 0,
                content,
                tags,
                created_at: Math.floor(Date.now() / 1000),
                pubkey: pubkey,
            };

            // WP-1/WP-2: Apply Proof of Work (NIP-13)
            // Difficulty 12 provides a solid balance: ~1-3s on mobile, 
            // but enough to stop bulk registrations.
            setIsMining(true);
            const REGISTRATION_DIFFICULTY = 12;
            const minedEvent = await powService.mineEvent(unsignedEvent, REGISTRATION_DIFFICULTY);
            setIsMining(false);

            // Sign event
            const signedEvent = await cryptoService.signEvent(minedEvent as any, privkey);

            // Publish to all connected relays
            const payload = JSON.stringify(["EVENT", signedEvent]);

            const maxAttempts = 4;
            let lastError: string | null = null;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                await pool.waitForConnection(3000);

                if (pool.publishToUrls && enabledRelayUrls.length > 0) {
                    const scopedResult = await pool.publishToUrls(enabledRelayUrls, payload);
                    if (scopedResult.success || scopedResult.successCount > 0) {
                        return true;
                    }
                    lastError = scopedResult.overallError || "Failed to publish profile to enabled relays";
                } else if (pool.publishToAll) {
                    const result = await pool.publishToAll(payload);
                    if (result.success || result.successCount > 0) {
                        return true;
                    }
                    lastError = result.overallError || "Failed to publish to any relay";
                } else {
                    // Best-effort compatibility fallback for generic pools.
                    pool.sendToOpen(payload);
                    return true;
                }

                const transientRelayFailure = !!lastError && (
                    /no relays are currently connected/i.test(lastError) ||
                    /no scoped relays are currently connected/i.test(lastError) ||
                    /relay not connected/i.test(lastError) ||
                    /timeout waiting for ok response/i.test(lastError)
                );
                if (!transientRelayFailure || attempt >= maxAttempts) {
                    break;
                }

                await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
            }

            throw new Error(lastError || "Failed to publish profile");
        } catch (err) {
            console.warn("Failed to publish profile:", err);
            setError(err instanceof Error ? err.message : "Failed to publish profile");
            return false;
        } finally {
            setIsMining(false);
            setIsPublishing(false);
        }
    }, [identity, enabledRelayUrls, pool, t]);

    return useMemo(() => ({
        publishProfile,
        isPublishing,
        isMining,
        error
    }), [publishProfile, isPublishing, isMining, error]);
};
