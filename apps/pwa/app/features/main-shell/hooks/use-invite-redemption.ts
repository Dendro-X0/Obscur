"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { logAppEvent } from "@/app/shared/log-app-event";
import { toast } from "@dweb/ui-kit";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import type { RequestTransportOutcome } from "@/app/features/messaging/services/request-transport-service";
import { getCoordinationBaseUrl } from "@/app/features/groups/services/community-membership-sync-mode";
import { probeCoordinationHealth } from "@/app/features/groups/services/community-coordination-health";
import {
    formatInviteRelayRejectionSummary,
    partitionInviteRelayHints,
} from "@/app/features/groups/services/community-invite-redemption-policy";
import { ensureWorkspaceMembershipSyncMode } from "@/app/features/groups/services/community-workspace-membership";

// Constants (moved from MainShell)
const INVITE_REQUEST_SENT_PREFIX = "obscur.invites.request_sent.v1";

export type InviteRedemptionStatus = "idle" | "needs_unlock" | "redeeming" | "success" | "invalid" | "expired" | "server_down" | "error";

export interface InviteRedemptionState {
    status: InviteRedemptionStatus;
    token: string | null;
    message: string | null;
}

type InviteRequestTransport = Readonly<{
    sendRequest: (params: Readonly<{
        peerPublicKeyHex: PublicKeyHex;
        introMessage?: string;
    }>) => Promise<RequestTransportOutcome>;
}>;

const getInviteRequestSentKey = (params: { redeemerPubkeyHex: string; inviteId: string }): string => (
    getScopedStorageKey(`${INVITE_REQUEST_SENT_PREFIX}.${params.redeemerPubkeyHex}.${params.inviteId}`, getResolvedProfileId())
);

const wasInviteRequestSent = (params: { redeemerPubkeyHex: string; inviteId: string }): boolean => {
    if (typeof window === "undefined") return false;
    try {
        return window.localStorage.getItem(getInviteRequestSentKey(params)) === "1";
    } catch {
        return false;
    }
};

const markInviteRequestSent = (params: { redeemerPubkeyHex: string; inviteId: string }): void => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(getInviteRequestSentKey(params), "1");
    } catch {
        return;
    }
};

const classifyInviteRedeemError = (message: string): InviteRedemptionStatus => {
    const normalized = message.toLowerCase();
    if (normalized.includes("coordination_not_configured") || normalized.includes("network") || normalized.includes("failed to fetch") || normalized.includes("timeout")) {
        return "server_down";
    }
    if (normalized.includes("expired")) {
        return "expired";
    }
    if (normalized.includes("invalid") || normalized.includes("not_found") || normalized.includes("already_redeemed")) {
        return "invalid";
    }
    return "error";
};

async function redeemInviteToken(params: Readonly<{ token: string; redeemerPubkey: string }>) {
    const coordinationBaseUrl = getCoordinationBaseUrl();
    if (!coordinationBaseUrl) {
        throw new Error("coordination_not_configured");
    }
    const response = await fetch(`${coordinationBaseUrl}/invites/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            token: params.token,
            redeemerPubkey: params.redeemerPubkey,
        }),
    });
    const data: { ok?: boolean; error?: string; data?: { inviteId: string; inviterPubkey: string; relays: string[] } } =
        await response.json();
    if (!data.ok || !data.data) {
        throw new Error(data.error ?? "coordination_invalid_response");
    }
    return data.data;
}

export function useInviteRedemption(requestTransport: InviteRequestTransport) {
    const router = useRouter();
    const identity = useIdentity();
    const relayList = useRelayList({ publicKeyHex: identity.state.publicKeyHex ?? null });
    const { setNewChatPubkey, setNewChatDisplayName, setIsNewChatOpen } = useMessaging();

    const [inviteRedemption, setInviteRedemption] = useState<InviteRedemptionState>({ status: "idle", token: null, message: null });
    const lastInviteStatusRef = useRef<InviteRedemptionStatus | null>(null);
    const handledInviteCacheRef = useRef<string | null>(null);

    const handleRedeemInvite = useCallback(async (token: string) => {
        if (!token) return;
        if (!identity.state.publicKeyHex) {
            setInviteRedemption({ status: "needs_unlock", token, message: null });
            return;
        }

        const myPk = identity.state.publicKeyHex;
        const cacheKey = `invite:${token}:${myPk}`;
        if (handledInviteCacheRef.current === cacheKey) return;
        handledInviteCacheRef.current = cacheKey;

        setInviteRedemption({ status: "redeeming", token, message: null });
        try {
            const redeemed = await redeemInviteToken({ token, redeemerPubkey: myPk });
            const coordinationHealth = await probeCoordinationHealth({ force: true });
            const relayPartition = partitionInviteRelayHints({
                relayUrls: redeemed.relays,
                coordinationHealthy: coordinationHealth.healthy,
                enabledRelayUrls: relayList.state.relays.map((relay) => relay.url),
            });
            for (const url of [...relayPartition.dmRelayUrls, ...relayPartition.workspaceRelayUrls]) {
                relayList.addRelay({ url });
            }
            const rejectionSummary = formatInviteRelayRejectionSummary(relayPartition.rejected);
            if (rejectionSummary) {
                toast.warning(rejectionSummary);
            }
            ensureWorkspaceMembershipSyncMode();

            logAppEvent({
                name: "invites.inviteToken.redeemed",
                level: "info",
                scope: { feature: "invites", action: "redeem" },
                context: {
                    relaysCount: redeemed.relays.length,
                    dmRelaysAdded: relayPartition.dmRelayUrls.length,
                    workspaceRelaysAdded: relayPartition.workspaceRelayUrls.length,
                    workspaceRelaysRejected: relayPartition.rejected.length,
                },
            });

            setInviteRedemption({ status: "success", token, message: null });

            const parsed = parsePublicKeyInput(redeemed.inviterPubkey);
            if (parsed.ok) {
                if (!wasInviteRequestSent({ redeemerPubkeyHex: myPk, inviteId: redeemed.inviteId })) {
                    try {
                        const outcome = await requestTransport.sendRequest({
                            peerPublicKeyHex: parsed.publicKeyHex as PublicKeyHex
                        });
                        if (outcome.status === "ok") {
                            markInviteRequestSent({ redeemerPubkeyHex: myPk, inviteId: redeemed.inviteId });
                            toast.success("Connection request sent.");
                        } else if (outcome.status === "partial") {
                            markInviteRequestSent({ redeemerPubkeyHex: myPk, inviteId: redeemed.inviteId });
                            toast.warning("Connection request partially delivered.");
                        } else if (outcome.status === "queued") {
                            toast.warning("Connection request queued; retrying.");
                        } else {
                            toast.error(outcome.message || "Failed to send connection request.");
                        }
                    } catch (e) {
                        console.error("Auto request failed", e);
                    }
                }

                queueMicrotask(() => {
                    setNewChatPubkey(parsed.publicKeyHex);
                    setNewChatDisplayName("");
                    setIsNewChatOpen(true);
                    router.replace("/");
                });
            }
        } catch (error: any) {
            const message = error.message || "Invite redeem failed";
            const status = classifyInviteRedeemError(message);
            setInviteRedemption({ status, token, message });
        }
    }, [identity.state.publicKeyHex, relayList, requestTransport, router, setNewChatPubkey, setNewChatDisplayName, setIsNewChatOpen]);

    // Status Notification Effect
    useEffect(() => {
        if (lastInviteStatusRef.current === inviteRedemption.status) return;
        lastInviteStatusRef.current = inviteRedemption.status;

        if (inviteRedemption.status === "idle") return;

        switch (inviteRedemption.status) {
            case "needs_unlock": toast.info("Unlock your identity first, then redeem the invite again."); break;
            case "redeeming": toast.info("Redeeming invite and syncing relay hints..."); break;
            case "success": toast.success("Invite redeemed. Opening chat composer."); break;
            case "expired": toast.error("Invite expired. Ask the sender for a new invite link."); break;
            case "invalid": toast.error("Invalid invite link. Verify the full URL and try again."); break;
            case "server_down": toast.error("Invite service unavailable. Retry in a moment or check your network."); break;
            case "error": toast.error(inviteRedemption.message || "Invite redeem failed. Retry, or open the link again after refresh."); break;
        }
    }, [inviteRedemption.status, inviteRedemption.message]);

    return { inviteRedemption, handleRedeemInvite };
}
