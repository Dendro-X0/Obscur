import { useCallback, useMemo, useState } from "react";
import type { UnsignedNostrEvent } from "@/app/features/crypto/crypto-service";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { useRelayPool } from "@/app/features/relays/hooks/use-relay-pool";
import { useTranslation } from "react-i18next";

export type PublishProfileParams = Readonly<{
    username: string;
    about?: string;
    avatarUrl?: string; // NIP-05 compliant field name is 'picture', but we map it
    nip05?: string;
    lud16?: string;
}>;

type UseProfilePublisherResult = Readonly<{
    publishProfile: (params: PublishProfileParams) => Promise<boolean>;
    isPublishing: boolean;
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
    const [error, setError] = useState<string | null>(null);

    // Get enabled relays
    const relayList = useRelayList({ publicKeyHex: identity.state.publicKeyHex ?? null });
    const enabledRelayUrls = useMemo(() => {
        return relayList.state.relays
            .filter((r) => r.enabled)
            .map((r) => r.url);
    }, [relayList.state.relays]);

    // Use relay pool to publish
    const pool = useRelayPool(enabledRelayUrls);

    const publishProfile = useCallback(async (params: PublishProfileParams): Promise<boolean> => {
        if (!identity.state.publicKeyHex || !identity.state.privateKeyHex) {
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
            // Wait for at least one relay to be connected (max 15s)
            let attempts = 0;
            const maxAttempts = 30;
            while (attempts < maxAttempts) {
                const openCount = pool.connections.filter(c => c.status === "open").length;
                if (openCount > 0) break;
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
            }

            // Construct Kind 0 Event content
            const content = JSON.stringify({
                name: params.username,
                display_name: params.username, // Some clients use one or the other
                about: params.about || "",
                picture: params.avatarUrl || "",
                nip05: params.nip05 || "",
                lud16: params.lud16 || "",
            });

            const unsignedEvent: UnsignedNostrEvent = {
                kind: 0,
                content,
                tags: [],
                created_at: Math.floor(Date.now() / 1000),
                pubkey: identity.state.publicKeyHex,
            };

            // Sign event
            const signedEvent = await cryptoService.signEvent(unsignedEvent, identity.state.privateKeyHex);

            // Publish to all connected relays
            const payload = JSON.stringify(["EVENT", signedEvent]);

            // Use publishToAll if available, otherwise manual iteration
            if (pool.publishToAll) {
                const result = await pool.publishToAll(payload);
                if (!result.success && result.successCount === 0) {
                    throw new Error(result.overallError || "Failed to publish to any relay");
                }
            } else {
                // Fallback if generic pool doesn't have publishToAll (though enhanced one does)
                pool.sendToOpen(payload);
            }

            return true;
        } catch (err) {
            console.error("Failed to publish profile:", err);
            setError(err instanceof Error ? err.message : "Failed to publish profile");
            return false;
        } finally {
            setIsPublishing(false);
        }
    }, [identity.state.publicKeyHex, identity.state.privateKeyHex, enabledRelayUrls, pool, t]);

    return {
        publishProfile,
        isPublishing,
        error
    };
};
