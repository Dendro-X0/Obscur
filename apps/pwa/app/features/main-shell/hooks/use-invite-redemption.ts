"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { logAppEvent } from "@/app/shared/log-app-event";
import { toast } from "@/app/components/ui/toast";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { PublicKeyHex } from "@dweb/crypto/public-key-hex";

// Constants (moved from MainShell)
const INVITE_REQUEST_SENT_PREFIX = "obscur.invites.request_sent.v1";

export type InviteRedemptionStatus = "idle" | "needs_unlock" | "redeeming" | "success" | "invalid" | "expired" | "server_down" | "error";

export interface InviteRedemptionState {
    status: InviteRedemptionStatus;
    token: string | null;
    message: string | null;
}

const getInviteRequestSentKey = (params: { redeemerPubkeyHex: string; inviteId: string }): string => {
    return `${INVITE_REQUEST_SENT_PREFIX}.${params.redeemerPubkeyHex}.${params.inviteId}`;
};

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

// Internal API Call (stubbed or imported)
async function redeemInviteToken(params: { token: string; redeemerPubkey: string }) {
    const CoordinationBaseUrl = (process.env.NEXT_PUBLIC_COORDINATION_URL ?? "").trim().replace(/\/+$/, "");
    if (!CoordinationBaseUrl) {
        throw new Error("COORDINATION_NOT_CONFIGURED");
    }
    const response = await fetch(`${CoordinationBaseUrl}/api/v1/invites/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error);
    return data.data;
}

export function useInviteRedemption(dmController: any) {
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
            redeemed.relays.forEach((url: string) => relayList.addRelay({ url }));

            logAppEvent({
                name: "invites.inviteToken.redeemed",
                level: "info",
                scope: { feature: "invites", action: "redeem" },
                context: { relaysCount: redeemed.relays.length }
            });

            setInviteRedemption({ status: "success", token, message: null });

            const parsed = parsePublicKeyInput(redeemed.inviterPubkey);
            if (parsed.ok) {
                if (!wasInviteRequestSent({ redeemerPubkeyHex: myPk, inviteId: redeemed.inviteId })) {
                    try {
                        const sent = await dmController.sendConnectionRequest({ peerPublicKeyHex: parsed.publicKeyHex as PublicKeyHex });
                        if (sent.success) {
                            markInviteRequestSent({ redeemerPubkeyHex: myPk, inviteId: redeemed.inviteId });
                            toast.success("Connection request sent.");
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
    }, [identity.state.publicKeyHex, dmController, relayList, router, setNewChatPubkey, setNewChatDisplayName, setIsNewChatOpen]);

    // Status Notification Effect
    useEffect(() => {
        if (lastInviteStatusRef.current === inviteRedemption.status) return;
        lastInviteStatusRef.current = inviteRedemption.status;

        if (inviteRedemption.status === "idle") return;

        switch (inviteRedemption.status) {
            case "needs_unlock": toast.info("Unlock to redeem invite."); break;
            case "redeeming": toast.info("Redeeming invite..."); break;
            case "success": toast.success("Invite redeemed."); break;
            case "expired": toast.error("Invite is expired."); break;
            case "invalid": toast.error("Invite is invalid."); break;
            case "server_down": toast.error("Invite server unavailable."); break;
            case "error": toast.error(inviteRedemption.message || "Invite failed."); break;
        }
    }, [inviteRedemption.status, inviteRedemption.message]);

    return { inviteRedemption, handleRedeemInvite };
}
