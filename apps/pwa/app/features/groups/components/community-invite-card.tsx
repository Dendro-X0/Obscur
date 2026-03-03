"use client";

import React, { useState } from "react";
import { Card } from "@dweb/ui-kit";
import { Button } from "@dweb/ui-kit";
import { ShieldCheck, Users, PartyPopper, Clock, XCircle, X } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@dweb/ui-kit";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
import { roomKeyStore } from "@/app/features/crypto/room-key-store";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useGroups } from "@/app/features/groups/providers/group-provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@dweb/ui-kit";
import { cn } from "@dweb/ui-kit";
import type { GroupConversation, Message, SendDirectMessageParams, SendDirectMessageResult } from "@/app/features/messaging/types";
import type { GroupAccessMode } from "../types";
import { toGroupConversationId } from "../utils/group-conversation-id";
import { deriveCommunityId } from "../utils/community-identity";

export interface InvitePayload {
    type: "community-invite";
    groupId: string;
    roomKey: string;
    communityId?: string;
    genesisEventId?: string;
    creatorPubkey?: string;
    metadata: {
        id: string;
        name: string;
        about?: string;
        picture?: string;
        access?: string;
        memberCount?: number;
    };
    relayUrl?: string; // Optional but recommended
}

interface CommunityInviteCardProps {
    invite: InvitePayload;
    isOutgoing: boolean;
    message?: Message;
    messages?: ReadonlyArray<Message>;
    onSendDirectMessage?: (params: SendDirectMessageParams) => Promise<SendDirectMessageResult>;
}

export const CommunityInviteCard = ({
    invite,
    isOutgoing,
    message,
    messages = [],
    onSendDirectMessage
}: CommunityInviteCardProps) => {
    const { t } = useTranslation();
    const { state: identityState } = useIdentity();
    const { relayPool } = useRelay();
    const { addGroup } = useGroups();
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // Calculate status by scanning for response DMs that reply to this message
    // Use reverse to ensure we get the latest response if there are multiple
    const response = message ? [...messages].reverse().find((m) => {
        if (!m.replyTo || m.replyTo.messageId !== message.id) return false;
        try {
            const parsed = JSON.parse(m.content);
            return parsed.type === "community-invite-response";
        } catch (e) {
            return false;
        }
    }) : null;

    let status: 'pending' | 'accepted' | 'declined' | 'canceled' = 'pending';
    if (response) {
        try {
            const parsed = JSON.parse(response.content);
            if (["accepted", "declined", "canceled"].includes(parsed.status)) {
                status = parsed.status;
            }
        } catch (e) {
            // fallback to pending
        }
    }

    const handleAccept = async () => {
        if (!message || !onSendDirectMessage) return;
        try {
            setIsProcessing(true);
            await roomKeyStore.saveRoomKey(invite.groupId, invite.roomKey);

            // Prefer the relay URL embedded in the invite. Fall back to the first
            // open relay in the pool rather than a hardcoded address.
            const fallbackRelay = relayPool.connections.find((c: { url: string }) => c.url)?.url ?? "";
            const relayUrl = invite.relayUrl || fallbackRelay;
            const creatorPubkey = invite.creatorPubkey ?? message.senderPubkey;
            const genesisEventId = invite.genesisEventId ?? message.eventId ?? message.id;
            const communityId = deriveCommunityId({
                existingCommunityId: invite.communityId,
                groupId: invite.groupId,
                relayUrl,
                genesisEventId,
                creatorPubkey
            });
            const accessMode: GroupAccessMode =
                invite.metadata.access === "discoverable"
                    ? "discoverable"
                    : invite.metadata.access === "invite-only" || invite.metadata.access === "private"
                        ? "invite-only"
                        : "open";

            const newGroup: GroupConversation = {
                kind: 'group',
                id: toGroupConversationId({ groupId: invite.groupId, relayUrl, communityId }),
                communityId,
                creatorPubkey,
                genesisEventId,
                groupId: invite.groupId,
                relayUrl: relayUrl,
                displayName: invite.metadata.name || "Private Group",
                memberPubkeys: [
                    identityState.publicKeyHex || "",
                    message.senderPubkey || ""
                ].filter(Boolean) as string[],
                adminPubkeys: [message.senderPubkey || ""],
                lastMessage: t("groups.joined", "Joined private encrypted group"),
                unreadCount: 1,
                lastMessageTime: new Date(),
                access: accessMode,
                memberCount: 2,
                avatar: invite.metadata.picture
            };

            addGroup(newGroup, { allowRevive: true });

            await onSendDirectMessage({
                recipientPubkey: message.senderPubkey || "",
                content: JSON.stringify({
                    type: "community-invite-response",
                    status: "accepted",
                    groupId: invite.groupId
                }),
                replyTo: message.id
            });

            try {
                // Also broadcast a 'join' event to the sealed community to notify existing members
                const GroupServiceModule = await import("../services/group-service");
                const groupService = new GroupServiceModule.GroupService(
                    identityState.publicKeyHex!,
                    identityState.privateKeyHex!
                );
                const signedEvent = await groupService.sendSealedJoin({
                    groupId: invite.groupId,
                    roomKeyHex: invite.roomKey
                });
                const payload = JSON.stringify(["EVENT", signedEvent]);
                const targetRelay = relayUrl.trim();
                if (targetRelay.length > 0 && typeof relayPool.publishToUrls === "function") {
                    await relayPool.publishToUrls([targetRelay], payload);
                } else if (targetRelay.length > 0 && typeof relayPool.publishToUrl === "function") {
                    await relayPool.publishToUrl(targetRelay, payload);
                } else {
                    await relayPool.publishToAll(payload);
                }
            } catch (e) {
                console.error("Failed to broadcast join event to community:", e);
            }

            toast.success(t("groups.inviteAccepted", "You have joined {{name}}", { name: invite.metadata.name }));
        } catch (error) {
            console.error("Failed to accept invite:", error);
            toast.error(t("groups.inviteError", "Failed to join group. Secret key error."));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDecline = async () => {
        if (!message || !onSendDirectMessage) return;
        try {
            setIsProcessing(true);
            await onSendDirectMessage({
                recipientPubkey: message.senderPubkey || "",
                content: JSON.stringify({
                    type: "community-invite-response",
                    status: "declined",
                    groupId: invite.groupId
                }),
                replyTo: message.id
            });
            toast.info(t("groups.inviteDeclined", "You declined the invitation to {{name}}", { name: invite.metadata.name }));
        } catch (error) {
            console.error("Failed to decline invite:", error);
            toast.error(t("groups.declineError", "Failed to send decline response."));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancel = async () => {
        if (!message || !onSendDirectMessage) return;
        try {
            setIsProcessing(true);

            // For older messages that might lack recipientPubkey, infer it from conversationId
            let targetPubkey = message.recipientPubkey;
            if (!targetPubkey && message.conversationId && message.senderPubkey) {
                const parts = message.conversationId.split(':');
                targetPubkey = parts.find(p => p !== message.senderPubkey) as any;
            }

            // Sender cancels the invite by sending a response back to the intended recipient
            // Since it's an outgoing message, the recipient is message.recipientPubkey
            await onSendDirectMessage({
                recipientPubkey: targetPubkey || "",
                content: JSON.stringify({
                    type: "community-invite-response",
                    status: "canceled",
                    groupId: invite.groupId
                }),
                replyTo: message.id
            });
            toast.success(t("groups.inviteCanceled", "Invitation canceled successfully"));
        } catch (error) {
            console.error("Failed to cancel invite:", error);
            toast.error(t("groups.cancelError", "Failed to cancel invitation."));
        } finally {
            setIsProcessing(false);
        }
    };

    // ----------------------------------------------------------------------
    // UNIFIED VIEW (Single Card Style)
    // ----------------------------------------------------------------------
    return (
        <>
            <div
                onClick={() => setIsDetailsOpen(true)}
                className={cn(
                    "overflow-hidden border border-black/5 dark:border-white/5 bg-zinc-50 dark:bg-white/5 max-w-[320px] shadow-sm cursor-pointer transition-all hover:border-purple-500/50 hover:bg-zinc-100 dark:hover:bg-white/10 group/invite rounded-[32px]",
                    isOutgoing && "bg-white/10 dark:bg-black/5 border-white/20 dark:border-black/10", // Secondary style for when inside an outgoing bubble
                    isDetailsOpen && "ring-2 ring-purple-500/30 border-purple-500/50"
                )}
            >
                <div className="p-4 flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12 min-w-12 rounded-xl border border-black/5 dark:border-white/10 shadow-sm group-hover/invite:scale-105 transition-transform">
                            <AvatarImage src={invite.metadata.picture} alt={invite.metadata.name} />
                            <AvatarFallback className="bg-purple-100 text-purple-600 font-bold">
                                {invite.metadata.name?.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <h4 className={cn(
                                "text-sm font-black truncate group-hover/invite:text-purple-600 dark:group-hover/invite:text-purple-400",
                                isOutgoing ? "text-current" : "text-zinc-900 dark:text-zinc-50"
                            )}>
                                {invite.metadata.name}
                            </h4>
                            <p className={cn(
                                "text-[10px] line-clamp-2 mt-0.5 leading-relaxed",
                                isOutgoing ? "opacity-70 text-current" : "text-zinc-500"
                            )}>
                                {invite.metadata.about || t("groups.privateInviteDesc", "You've been invited to join this private encrypted community.")}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                            isOutgoing ? "bg-white/10 dark:bg-black/10 text-current" : "bg-black/5 dark:bg-white/5 text-zinc-500"
                        )}>
                            <ShieldCheck className="h-3 w-3" />
                            {t("groups.encrypted", "Encrypted")}
                        </div>
                        <div className={cn(
                            "flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                            isOutgoing ? "bg-white/10 dark:bg-black/10 text-current" : "bg-black/5 dark:bg-white/5 text-zinc-500"
                        )}>
                            <Users className="h-3 w-3" />
                            {t("groups.private", "Private")}
                        </div>
                        {invite.metadata.memberCount !== undefined && (
                            <div className={cn(
                                "ml-auto text-[9px] font-bold",
                                isOutgoing ? "opacity-60 text-current" : "text-zinc-400"
                            )}>
                                {invite.metadata.memberCount} {t("groups.members", "members")}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 pt-1">
                        {status === 'pending' ? (
                            isOutgoing ? (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest opacity-80">
                                        <Clock className="h-3 w-3" />
                                        {t("groups.pending", "Pending Response")}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={isProcessing}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCancel();
                                        }}
                                        className="h-9 rounded-xl text-[10px] uppercase font-black tracking-widest bg-white/10 dark:bg-black/5 hover:bg-white/20 dark:hover:bg-black/10 text-current transition-colors"
                                    >
                                        {isProcessing ? t("common.processing", "Processing...") : t("common.cancelInvite", "Cancel Invitation")}
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <Button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleAccept();
                                        }}
                                        disabled={isProcessing}
                                        className="flex-1 h-10 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-600/20 transition-all hover:scale-[1.02] active:scale-95"
                                    >
                                        {isProcessing ? t("common.processing", "Processing...") : t("common.accept", "Accept")}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="flex-1 h-10 font-bold rounded-xl text-zinc-500 hover:bg-zinc-200 dark:hover:bg-white/5 transition-all active:scale-95"
                                        disabled={isProcessing}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDecline();
                                        }}
                                    >
                                        {t("common.decline", "Decline")}
                                    </Button>
                                </div>
                            )
                        ) : (
                            <div className={cn(
                                "flex items-center gap-2 py-2.5 px-4 rounded-2xl border transition-all duration-300",
                                status === 'accepted'
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                    : status === 'declined'
                                        ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                                        : "bg-zinc-500/10 border-zinc-500/20 text-zinc-500"
                            )}>
                                {status === 'accepted' ? (
                                    <PartyPopper className="h-4 w-4 animate-bounce" />
                                ) : status === 'declined' ? (
                                    <XCircle className="h-4 w-4" />
                                ) : (
                                    <X className="h-4 w-4" />
                                )}
                                <span className="text-[10px] font-black uppercase tracking-[0.15em]">
                                    {status === 'accepted' ? t("groups.acceptedTitle", "Invitation Accepted") :
                                        status === 'declined' ? t("groups.declinedTitle", "Invitation Declined") :
                                            t("groups.canceledTitle", "Invitation Canceled")}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-900 border-zinc-200 dark:border-white/10 rounded-[32px] overflow-hidden p-0">
                    <div className="relative h-32 bg-gradient-to-br from-purple-600 to-indigo-700">
                        <DialogHeader className="p-0">
                            <div className="absolute -bottom-12 left-8 p-1 bg-white dark:bg-zinc-900 rounded-[24px]">
                                <Avatar className="h-24 w-24 rounded-[20px] shadow-2xl border-2 border-white dark:border-zinc-800">
                                    <AvatarImage src={invite.metadata.picture} />
                                    <AvatarFallback className="bg-purple-100 text-purple-600 text-2xl font-black">
                                        {invite.metadata.name?.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                        </DialogHeader>
                    </div>

                    <div className="pt-16 pb-8 px-8 space-y-6">
                        <div>
                            <DialogTitle className="text-2xl font-black text-zinc-900 dark:text-white">
                                {invite.metadata.name}
                            </DialogTitle>
                            <DialogDescription className="text-zinc-500 font-bold text-xs uppercase tracking-widest mt-1">
                                {invite.metadata.access || "Private"} Community • {invite.metadata.memberCount || 0} Members
                            </DialogDescription>
                        </div>

                        <div className="space-y-2">
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">About this community</h5>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium bg-zinc-50 dark:bg-white/5 p-4 rounded-2xl border border-zinc-100 dark:border-white/5">
                                {invite.metadata.about || "No description provided for this group."}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 text-center">
                                <ShieldCheck className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">End-to-End</span>
                                <p className="text-xs font-bold text-zinc-900 dark:text-white">Encrypted</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 text-center">
                                <Users className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</span>
                                <p className="text-xs font-bold text-zinc-900 dark:text-white">Invitation Only</p>
                            </div>
                        </div>

                        {status === 'pending' && (
                            <div className="flex gap-3 pt-2">
                                <Button
                                    onClick={() => {
                                        handleAccept();
                                        setIsDetailsOpen(false);
                                    }}
                                    disabled={isProcessing}
                                    className="flex-1 h-14 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl shadow-xl shadow-purple-600/20"
                                >
                                    {isProcessing ? t("common.processing", "Processing...") : t("common.accept", "Accept Invitation")}
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="flex-1 h-14 font-black rounded-2xl text-zinc-500 hover:bg-zinc-200 dark:hover:bg-white/5"
                                    disabled={isProcessing}
                                    onClick={() => {
                                        handleDecline();
                                        setIsDetailsOpen(false);
                                    }}
                                >
                                    {t("common.decline", "Decline")}
                                </Button>
                            </div>
                        )}

                        {status !== 'pending' && (
                            <div className={cn(
                                "p-4 rounded-2xl border text-center font-black uppercase tracking-widest text-xs",
                                status === 'accepted' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-zinc-500/10 border-zinc-500/20 text-zinc-500"
                            )}>
                                {status === 'accepted' ? t("groups.alreadyJoined", "You are a member") : t("groups.inviteClosed", "Invitation Closed")}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

