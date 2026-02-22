"use client";

import React, { useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { ShieldCheck, Users, PartyPopper, Clock, XCircle, X } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/app/components/ui/avatar";
import { useTranslation } from "react-i18next";
import { toast } from "@/app/components/ui/toast";
import { roomKeyStore } from "@/app/features/crypto/room-key-store";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/app/components/ui/dialog";
import { cn } from "@/app/lib/cn";
import type { Message, SendDirectMessageParams, SendDirectMessageResult } from "@/app/features/messaging/types";

export interface InvitePayload {
    type: "community-invite";
    groupId: string;
    roomKey: string;
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
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // Calculate status by scanning for response DMs that reply to this message
    const response = message ? messages.find((m) => {
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

            const relayUrl = invite.relayUrl || "wss://relay.obscur.sh";
            const newGroup = {
                kind: 'group',
                id: `group:${invite.groupId}:${relayUrl}`,
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
                access: invite.metadata.access || "private",
                memberCount: 2,
                avatar: invite.metadata.picture
            };

            window.dispatchEvent(new CustomEvent('obscur:group-invite', { detail: newGroup }));

            await onSendDirectMessage({
                recipientPubkey: message.senderPubkey || "",
                content: JSON.stringify({
                    type: "community-invite-response",
                    status: "accepted",
                    groupId: invite.groupId
                }),
                replyTo: message.id
            });

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
            // Sender cancels the invite by sending a response back to the intended recipient
            // Since it's an outgoing message, the recipient is message.recipientPubkey
            await onSendDirectMessage({
                recipientPubkey: message.recipientPubkey || "",
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
    // SENDER VIEW (Outgoing)
    // ----------------------------------------------------------------------
    if (isOutgoing) {
        // In outgoing messages, the outer bubble is inverted:
        // Light theme: dark grey bubble (`bg-zinc-900 text-white`)
        // Dark theme: light grey bubble (`bg-zinc-100 text-zinc-900`)
        // Thus, we use transparent backgrounds to adapt gracefully.
        return (
            <div className="flex flex-col gap-2 max-w-[280px] sm:max-w-[320px]">
                <div className="text-[11px] font-medium leading-relaxed opacity-90 pb-1">
                    {t("groups.youInvited", "You invited them to join")} <span className="font-bold">{invite.metadata.name}</span>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/10 dark:bg-black/5 border border-white/20 dark:border-black/10 transition-colors">
                    <Avatar className="h-10 w-10 min-w-10 rounded-xl shadow-sm border border-white/20 dark:border-black/10">
                        <AvatarImage src={invite.metadata.picture} alt={invite.metadata.name} />
                        <AvatarFallback className="bg-purple-100 dark:bg-purple-200 text-purple-700 font-bold">
                            {invite.metadata.name?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-black truncate text-current">
                            {invite.metadata.name}
                        </h4>

                        {/* Status Display */}
                        {status === 'pending' && (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest opacity-80 mt-1">
                                <Clock className="h-3 w-3" />
                                {t("groups.pending", "Pending")}
                            </div>
                        )}
                        {status === 'accepted' && (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#4ade80] dark:text-[#16a34a] mt-1">
                                <PartyPopper className="h-3 w-3" />
                                {t("groups.accepted", "Accepted")}
                            </div>
                        )}
                        {status === 'declined' && (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-rose-400 dark:text-rose-600 mt-1">
                                <XCircle className="h-3 w-3" />
                                {t("groups.declined", "Declined")}
                            </div>
                        )}
                        {status === 'canceled' && (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">
                                <X className="h-3 w-3" />
                                {t("groups.canceled", "Canceled")}
                            </div>
                        )}
                    </div>
                </div>

                {status === 'pending' && (
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={isProcessing}
                        onClick={handleCancel}
                        className="h-8 mt-1 rounded-xl text-[10px] uppercase font-black tracking-widest bg-white/10 dark:bg-black/5 hover:bg-white/20 dark:hover:bg-black/10 text-current transition-colors"
                    >
                        {isProcessing ? t("common.processing", "Processing...") : t("common.cancelInvite", "Cancel Invitation")}
                    </Button>
                )}
            </div>
        );
    }

    // ----------------------------------------------------------------------
    // RECIPIENT VIEW (Incoming)
    // ----------------------------------------------------------------------
    // In incoming messages, the outer bubble matches the theme reasonably well:
    // Light theme: white bubble (`bg-white text-zinc-900`)
    // Dark theme: dark grey bubble (`bg-zinc-900 text-zinc-100`)

    if (status === 'accepted') {
        return (
            <Card className="p-4 border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 max-w-[320px] rounded-[24px]">
                <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                    <PartyPopper className="h-5 w-5" />
                    <span className="text-xs font-bold uppercase tracking-widest">{t("groups.joinedSuccess", "Invitation Accepted")}</span>
                </div>
            </Card>
        );
    }

    if (status === 'declined') {
        return (
            <Card className="p-4 border-zinc-500/20 bg-zinc-500/5 dark:bg-zinc-500/10 max-w-[320px] rounded-[24px]">
                <div className="flex items-center gap-3 text-zinc-500">
                    <ShieldCheck className="h-5 w-5 opacity-50" />
                    <span className="text-xs font-bold uppercase tracking-widest">{t("groups.declined", "Invitation Declined")}</span>
                </div>
            </Card>
        );
    }

    if (status === 'canceled') {
        return (
            <Card className="p-4 border-zinc-500/20 bg-zinc-500/5 dark:bg-zinc-500/10 max-w-[320px] rounded-[24px] opacity-70">
                <div className="flex items-center gap-3 text-zinc-500">
                    <X className="h-5 w-5 opacity-50" />
                    <span className="text-xs font-bold uppercase tracking-widest">{t("groups.canceled", "Invitation Canceled")}</span>
                </div>
            </Card>
        );
    }

    return (
        <>
            <div
                onClick={() => setIsDetailsOpen(true)}
                className={cn(
                    "overflow-hidden border border-black/5 dark:border-white/5 bg-zinc-50 dark:bg-white/5 max-w-[320px] shadow-sm cursor-pointer transition-all hover:border-purple-500/50 hover:bg-zinc-100 dark:hover:bg-white/10 group/invite rounded-[32px]",
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
                            <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-50 truncate group-hover/invite:text-purple-600 dark:group-hover/invite:text-purple-400">
                                {invite.metadata.name}
                            </h4>
                            <p className="text-[10px] text-zinc-500 line-clamp-2 mt-0.5 leading-relaxed">
                                {invite.metadata.about || t("groups.privateInviteDesc", "You've been invited to join this private encrypted community.")}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/5 dark:bg-white/5 text-[9px] font-black uppercase tracking-widest text-zinc-500">
                            <ShieldCheck className="h-3 w-3" />
                            {t("groups.encrypted", "Encrypted")}
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/5 dark:bg-white/5 text-[9px] font-black uppercase tracking-widest text-zinc-500">
                            <Users className="h-3 w-3" />
                            {t("groups.private", "Private")}
                        </div>
                        {invite.metadata.memberCount !== undefined && (
                            <div className="ml-auto text-[9px] font-bold text-zinc-400">
                                {invite.metadata.memberCount} {t("groups.members", "members")}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 pt-1">
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
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

