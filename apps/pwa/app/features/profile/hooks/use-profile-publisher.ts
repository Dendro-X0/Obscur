import { useCallback, useMemo, useRef, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { UnsignedNostrEvent } from "@/app/features/crypto/crypto-service";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { powService } from "@/app/features/crypto/pow-service";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { getV090RolloutPolicy } from "@/app/features/settings/services/v090-rollout-policy";
import { protocolCoreAdapter } from "@/app/features/runtime/protocol-core-adapter";
import { publishViaRelayCore } from "@/app/features/relays/lib/nostr-core-relay";
import { GLOBAL_DISCOVERY_RELAY_URLS, mergeRelaySets } from "@/app/features/relays/services/discovery-relay-set";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import { seedProfileMetadataCache } from "./use-profile-metadata";
import { encryptedAccountBackupService } from "@/app/features/account-sync/services/encrypted-account-backup-service";
import { accountSyncStatusStore } from "@/app/features/account-sync/services/account-sync-status-store";

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
    getLastReportSnapshot: () => ProfilePublishReport | null;
    isPublishing: boolean;
    isMining: boolean;
    error: string | null;
    phase: ProfilePublishPhase;
    lastReport: ProfilePublishReport | null;
}>;

export type ProfilePublishPhase =
    | "idle"
    | "waiting_relays"
    | "preparing"
    | "mining"
    | "signing"
    | "publishing"
    | "success"
    | "error";

export type ProfilePublishReport = Readonly<{
    phase: ProfilePublishPhase;
    deliveryStatus?: "sent_quorum" | "sent_partial" | "queued" | "failed";
    successCount?: number;
    totalRelays?: number;
    attempts?: number;
    message?: string;
    updatedAtIso: string;
}>;

const PUBLISH_ATTEMPT_TIMEOUT_MS = 9_000;

const withTimeout = async <T>(
    operation: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
        return await Promise.race([
            operation,
            new Promise<T>((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error(timeoutMessage));
                }, timeoutMs);
            })
        ]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
};

const isDegradedFailure = (message: string): boolean => (
    /no relays are currently connected/i.test(message) ||
    /no scoped relays are currently connected/i.test(message) ||
    /no writable relays available/i.test(message) ||
    /relay not connected/i.test(message) ||
    /timeout waiting for ok response/i.test(message) ||
    /timed out while publishing profile/i.test(message)
);

const isPartialRelaySuccess = (successCount?: number, totalRelays?: number): boolean => {
    if (typeof successCount !== "number" || typeof totalRelays !== "number") {
        return false;
    }
    return successCount > 0 && successCount < totalRelays;
};

const toDeliveryStatus = (status: "ok" | "partial" | "queued" | "failed"): ProfilePublishReport["deliveryStatus"] => {
    if (status === "ok") return "sent_quorum";
    if (status === "partial") return "sent_partial";
    if (status === "queued") return "queued";
    return "failed";
};

const normalizeInviteCode = (inviteCode: string | undefined): string | undefined => {
    const normalized = inviteCode?.trim().toUpperCase();
    return normalized && normalized.length > 0 ? normalized : undefined;
};

const syncPublishedProfileCaches = (pubkey: string, params: PublishProfileParams): void => {
    const normalizedInviteCode = normalizeInviteCode(params.inviteCode);
    discoveryCache.upsertProfile({
        pubkey,
        name: params.username.trim() || undefined,
        displayName: params.username.trim() || undefined,
        about: params.about?.trim() || undefined,
        picture: params.avatarUrl?.trim() || undefined,
        nip05: params.nip05?.trim() || undefined,
        inviteCode: normalizedInviteCode,
    });
    seedProfileMetadataCache({
        pubkey: pubkey as any,
        displayName: params.username.trim() || undefined,
        avatarUrl: params.avatarUrl?.trim() || undefined,
        about: params.about?.trim() || undefined,
        nip05: params.nip05?.trim() || undefined,
    });
};

const refreshEncryptedAccountBackup = (
    pubkey: string,
    privkey: string,
    pool: ReturnType<typeof useRelay>["relayPool"],
    enabledRelayUrls: ReadonlyArray<string>
): void => {
    void encryptedAccountBackupService.publishEncryptedAccountBackup({
        publicKeyHex: pubkey as PublicKeyHex,
        privateKeyHex: privkey as PrivateKeyHex,
        pool,
        scopedRelayUrls: enabledRelayUrls,
    }).catch(() => {
        // Best-effort backup refresh after canonical profile save.
    });
};

const mirrorProfileToGlobalDiscoveryRelays = (
    params: Readonly<{
        pool: ReturnType<typeof useRelay>["relayPool"];
        payload: string;
        primaryRelayUrls: ReadonlyArray<string>;
    }>
): void => {
    const scopedRelayUrls = mergeRelaySets(params.primaryRelayUrls, GLOBAL_DISCOVERY_RELAY_URLS);
    for (const relayUrl of GLOBAL_DISCOVERY_RELAY_URLS) {
        params.pool.addTransientRelay?.(relayUrl);
    }
    void publishViaRelayCore({
        pool: params.pool,
        payload: params.payload,
        scopedRelayUrls,
        waitForConnectionMs: 3_500,
    }).catch(() => {
        // Best-effort global mirror for friend-code discoverability.
    });
};

export const profilePublisherInternals = {
    withTimeout,
    isDegradedFailure,
    isPartialRelaySuccess,
    toDeliveryStatus,
};

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
    const [phase, setPhase] = useState<ProfilePublishPhase>("idle");
    const [lastReport, setLastReport] = useState<ProfilePublishReport | null>(null);
    const lastReportRef = useRef<ProfilePublishReport | null>(null);

    const updateLastReport = useCallback((report: ProfilePublishReport): void => {
        lastReportRef.current = report;
        setLastReport(report);
    }, []);

    // Use shared relay pool
    const { relayPool: pool, enabledRelayUrls } = useRelay();


    const publishProfile = useCallback(async (params: PublishProfileParams): Promise<boolean> => {
        const idState = identity.getIdentitySnapshot();
        const pubkey = identity.state.publicKeyHex || idState.publicKeyHex;
        const privkey = identity.state.privateKeyHex || idState.privateKeyHex;

        if (!pubkey || !privkey) {
            setError(t("identity.error.notUnlocked") || "Identity not unlocked");
            setPhase("error");
            setLastReport({
                phase: "error",
                message: t("identity.error.notUnlocked") || "Identity not unlocked",
                updatedAtIso: new Date().toISOString()
            });
            return false;
        }

        if (enabledRelayUrls.length === 0) {
            setError(t("settings.relays.noRelaysTitle") || "No relays connected");
            setPhase("error");
            setLastReport({
                phase: "error",
                message: t("settings.relays.noRelaysTitle") || "No relays connected",
                updatedAtIso: new Date().toISOString()
            });
            return false;
        }

        setIsPublishing(true);
        setError(null);
        setPhase("waiting_relays");
        setLastReport({
            phase: "waiting_relays",
            updatedAtIso: new Date().toISOString()
        });

        try {
            const hasRelayConnection = await pool.waitForConnection(5000);
            if (!hasRelayConnection) {
                setError("Relay connection is temporarily unavailable. Please retry in a moment.");
                setPhase("error");
                setLastReport({
                    phase: "error",
                    message: "Relay connection is temporarily unavailable. Please retry in a moment.",
                    updatedAtIso: new Date().toISOString()
                });
                return false;
            }
            setPhase("preparing");
            setLastReport({
                phase: "preparing",
                updatedAtIso: new Date().toISOString()
            });

            // Construct Kind 0 Event content
            const normalizedInviteCode = normalizeInviteCode(params.inviteCode);
            let aboutContent = params.about || "";
            if (normalizedInviteCode && !aboutContent.includes(normalizedInviteCode)) {
                if (aboutContent) aboutContent += "\n\n";
                aboutContent += `Find me on Obscur with this code: ${normalizedInviteCode}`;
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
            if (normalizedInviteCode) {
                tags.push(["code", normalizedInviteCode]);
                // Use a single-letter tag so relays can index with #i filters.
                tags.push(["i", normalizedInviteCode]);
                tags.push(["l", "obscur-invite"]);
                tags.push(["t", "obscur"]);
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
            setPhase("mining");
            setLastReport({
                phase: "mining",
                updatedAtIso: new Date().toISOString()
            });
            const REGISTRATION_DIFFICULTY = 12;
            const minedEvent = await powService.mineEvent(unsignedEvent, REGISTRATION_DIFFICULTY);
            setIsMining(false);

            // Sign event
            setPhase("signing");
            setLastReport({
                phase: "signing",
                updatedAtIso: new Date().toISOString()
            });
            const signedEvent = await cryptoService.signEvent(minedEvent as any, privkey);

            // Publish to all connected relays
            const payload = JSON.stringify(["EVENT", signedEvent]);
            const rolloutPolicy = getV090RolloutPolicy(PrivacySettingsService.getSettings());

            const maxAttempts = 4;
            let lastError: string | null = null;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    setPhase("publishing");
                    updateLastReport({
                        phase: "publishing",
                        attempts: attempt,
                        updatedAtIso: new Date().toISOString()
                    });
                    await pool.waitForConnection(3000);

                    if (rolloutPolicy.protocolCoreEnabled && enabledRelayUrls.length > 0) {
                        const protocolPublish = await withTimeout(
                            protocolCoreAdapter.publishWithQuorum(payload, enabledRelayUrls),
                            PUBLISH_ATTEMPT_TIMEOUT_MS,
                            "Timed out while publishing profile via protocol core"
                        );
                        if (protocolPublish.ok) {
                            const report = protocolPublish.value;
                            if (report.successCount > 0) {
                                setPhase("success");
                                syncPublishedProfileCaches(pubkey, params);
                                updateLastReport({
                                    phase: "success",
                                    deliveryStatus: report.metQuorum ? "sent_quorum" : "sent_partial",
                                    attempts: attempt,
                                    successCount: report.successCount,
                                    totalRelays: report.totalRelays,
                                    updatedAtIso: new Date().toISOString()
                                });
                                accountSyncStatusStore.setProfileProof({
                                    publicKeyHex: pubkey as PublicKeyHex,
                                    eventId: signedEvent.id,
                                    deliveryStatus: report.metQuorum ? "sent_quorum" : "sent_partial",
                                    successCount: report.successCount,
                                    totalRelays: report.totalRelays,
                                    message: report.metQuorum
                                        ? "Profile published with protocol quorum."
                                        : "Profile published with degraded relay coverage.",
                                });
                                if (isPartialRelaySuccess(report.successCount, report.totalRelays)) {
                                    toast.warning(`Profile saved with degraded relay coverage (${report.successCount}/${report.totalRelays}).`);
                                }
                                mirrorProfileToGlobalDiscoveryRelays({
                                    pool,
                                    payload,
                                    primaryRelayUrls: enabledRelayUrls,
                                });
                                refreshEncryptedAccountBackup(pubkey, privkey, pool, enabledRelayUrls);
                                return true;
                            }
                            lastError = "Protocol publish returned zero relay successes";
                        } else if (protocolPublish.reason !== "unsupported") {
                            lastError = protocolPublish.message || "Protocol publish failed";
                        }
                    }

                    const relayCorePublish = await withTimeout(
                        publishViaRelayCore({
                            pool,
                            payload,
                            scopedRelayUrls: enabledRelayUrls,
                            waitForConnectionMs: 3_000,
                        }),
                        PUBLISH_ATTEMPT_TIMEOUT_MS,
                        "Timed out while publishing profile to relays"
                    );

                    if (relayCorePublish.status === "ok" || relayCorePublish.status === "partial") {
                        const report = relayCorePublish.value;
                        const successCount = report?.successCount ?? 0;
                        const totalRelays = report?.totalRelays ?? enabledRelayUrls.length;
                        if (successCount > 0) {
                            setPhase("success");
                            syncPublishedProfileCaches(pubkey, params);
                            setLastReport({
                                phase: "success",
                                deliveryStatus: toDeliveryStatus(relayCorePublish.status),
                                attempts: attempt,
                                successCount,
                                totalRelays,
                                message: relayCorePublish.message,
                                updatedAtIso: new Date().toISOString()
                            });
                            accountSyncStatusStore.setProfileProof({
                                publicKeyHex: pubkey as PublicKeyHex,
                                eventId: signedEvent.id,
                                deliveryStatus: toDeliveryStatus(relayCorePublish.status) ?? "failed",
                                successCount,
                                totalRelays,
                                message: relayCorePublish.message,
                            });
                            if (relayCorePublish.status === "partial" || isPartialRelaySuccess(successCount, totalRelays)) {
                                toast.warning(`Profile saved with degraded relay coverage (${successCount}/${totalRelays}).`);
                            }
                            mirrorProfileToGlobalDiscoveryRelays({
                                pool,
                                payload,
                                primaryRelayUrls: enabledRelayUrls,
                            });
                            refreshEncryptedAccountBackup(pubkey, privkey, pool, enabledRelayUrls);
                            return true;
                        }
                    }

                    if (relayCorePublish.status !== "unsupported") {
                        const report = relayCorePublish.value;
                        lastError = relayCorePublish.message || "Failed to publish profile to relays";
                        updateLastReport({
                            phase: "publishing",
                            deliveryStatus: toDeliveryStatus(relayCorePublish.status),
                            attempts: attempt,
                            message: lastError,
                            successCount: report?.successCount,
                            totalRelays: report?.totalRelays ?? enabledRelayUrls.length,
                            updatedAtIso: new Date().toISOString()
                        });
                    } else if (pool.publishToAll) {
                        const result = await withTimeout(
                            pool.publishToAll(payload),
                            PUBLISH_ATTEMPT_TIMEOUT_MS,
                            "Timed out while publishing profile to relays"
                        );
                        if (result.success || result.successCount > 0) {
                            setPhase("success");
                            syncPublishedProfileCaches(pubkey, params);
                            updateLastReport({
                                phase: "success",
                                deliveryStatus: result.successCount === result.totalRelays ? "sent_quorum" : "sent_partial",
                                attempts: attempt,
                                successCount: result.successCount,
                                totalRelays: result.totalRelays,
                                updatedAtIso: new Date().toISOString()
                            });
                            accountSyncStatusStore.setProfileProof({
                                publicKeyHex: pubkey as PublicKeyHex,
                                eventId: signedEvent.id,
                                deliveryStatus: result.successCount === result.totalRelays ? "sent_quorum" : "sent_partial",
                                successCount: result.successCount,
                                totalRelays: result.totalRelays,
                                message: result.overallError,
                            });
                            if (isPartialRelaySuccess(result.successCount, result.totalRelays)) {
                                toast.warning(`Profile saved with degraded relay coverage (${result.successCount}/${result.totalRelays}).`);
                            }
                            mirrorProfileToGlobalDiscoveryRelays({
                                pool,
                                payload,
                                primaryRelayUrls: enabledRelayUrls,
                            });
                            refreshEncryptedAccountBackup(pubkey, privkey, pool, enabledRelayUrls);
                            return true;
                        }
                        lastError = result.overallError || "Failed to publish to any relay";
                        updateLastReport({
                            phase: "publishing",
                            deliveryStatus: "failed",
                            attempts: attempt,
                            message: lastError,
                            successCount: result.successCount,
                            totalRelays: result.totalRelays,
                            updatedAtIso: new Date().toISOString()
                        });
                    } else {
                        lastError = "Relay pool does not support evidence-backed profile publish APIs.";
                        updateLastReport({
                            phase: "publishing",
                            deliveryStatus: "failed",
                            attempts: attempt,
                            message: lastError,
                            updatedAtIso: new Date().toISOString()
                        });
                    }
                } catch (attemptError) {
                    lastError = attemptError instanceof Error ? attemptError.message : "Failed to publish profile";
                    updateLastReport({
                        phase: "publishing",
                        deliveryStatus: isDegradedFailure(lastError) ? "queued" : "failed",
                        attempts: attempt,
                        message: lastError,
                        updatedAtIso: new Date().toISOString()
                    });
                }

                const transientRelayFailure = !!lastError && (
                    isDegradedFailure(lastError)
                );
                if (!transientRelayFailure || attempt >= maxAttempts) {
                    break;
                }

                await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
            }

            throw new Error(lastError || "Failed to publish profile");
        } catch (err) {
            console.warn("Failed to publish profile:", err);
            const message = err instanceof Error ? err.message : "Failed to publish profile";
            setError(message);
            setPhase("error");
            updateLastReport({
                phase: "error",
                deliveryStatus: isDegradedFailure(message) ? "queued" : "failed",
                message,
                updatedAtIso: new Date().toISOString()
            });
            accountSyncStatusStore.setProfileProof({
                publicKeyHex: pubkey as PublicKeyHex,
                eventId: undefined,
                deliveryStatus: isDegradedFailure(message) ? "queued" : "failed",
                message,
            });
            if (isDegradedFailure(message)) {
                toast.warning("Relay network is degraded. Profile publish did not fully propagate.");
            }
            return false;
        } finally {
            setIsMining(false);
            setIsPublishing(false);
        }
    }, [identity, enabledRelayUrls, pool, t, updateLastReport]);

    return useMemo(() => ({
        publishProfile,
        getLastReportSnapshot: () => lastReportRef.current,
        isPublishing,
        isMining,
        error,
        phase,
        lastReport
    }), [publishProfile, isPublishing, isMining, error, phase, lastReport]);
};
