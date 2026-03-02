"use client";

import React from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
    ChevronLeft,
    MessageSquare,
    Ban,
    UserMinus,
    Shield,
    Share2,
    CheckCircle2,
    Plus,
    UserPlus,
    Loader2,
    Clock
} from "lucide-react";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { Button } from "@dweb/ui-kit";
import { Card } from "@dweb/ui-kit";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useProfileMetadata } from "@/app/features/profile/hooks/use-profile-metadata";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { toast } from "@dweb/ui-kit";
import { InviteToGroupDialog } from "./invite-to-group-dialog";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useEnhancedDmController } from "@/app/features/messaging/hooks/use-enhanced-dm-controller";
import type { GroupConversation } from "@/app/features/messaging/types";
import { GroupService } from "@/app/features/groups/services/group-service";
import { roomKeyStore } from "@/app/features/crypto/room-key-store";
import type { GroupMetadata } from "@/app/features/groups/types";
import { MessageQueue } from "@/app/features/messaging/lib/message-queue";
import type { Message, DmConversation } from "@/app/features/messaging/types";
import { messageBus } from "@/app/features/messaging/services/message-bus";
import { ConnectRequestDialog } from "./connect-request-dialog";

export default function ConnectionProfileView() {
    const { pubkey } = useParams();
    const router = useRouter();
    const { t } = useTranslation();
    const { peerTrust, requestsInbox, blocklist } = useNetwork();
    const { createdConnections, setCreatedConnections, setSelectedConversation } = useMessaging();
    const { relayPool } = useRelay();
    const identity = useIdentity();

    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = React.useState(false);
    const [isBlockDialogOpen, setIsBlockDialogOpen] = React.useState(false);
    const [isInviteDialogOpen, setIsInviteDialogOpen] = React.useState(false);
    const [isConnectDialogOpen, setIsConnectDialogOpen] = React.useState(false);

    const myPublicKeyHex = identity.state.publicKeyHex || null;
    const myPrivateKeyHex = identity.state.privateKeyHex || null;

    const dmController = useEnhancedDmController({
        myPublicKeyHex,
        myPrivateKeyHex,
        pool: relayPool,
        blocklist,
        peerTrust,
        requestsInbox
    });

    const pk = Array.isArray(pubkey) ? pubkey[0]! : pubkey!;
    const metadata = useProfileMetadata(pk);

    if (!pk) return null;

    const isTrusted = peerTrust?.state?.acceptedPeers?.includes(pk as PublicKeyHex) ?? false;
    const isBlocked = blocklist?.state?.blockedPublicKeys?.includes(pk as PublicKeyHex) ?? false;
    const requestStatus = requestsInbox.getRequestStatus({ peerPublicKeyHex: pk as PublicKeyHex });
    const isRequestPending = requestStatus?.status === 'pending' && requestStatus.isOutgoing;
    const connection = createdConnections.find(c => c.kind === 'dm' && c.pubkey === pk);

    const resolvedName = metadata?.displayName || connection?.displayName || pk.slice(0, 8);
    const displayHandle = resolvedName ? `@${resolvedName}` : `@${pk.slice(0, 8)}...${pk.slice(-8)}`;

    const handleConnect = async () => {
        setIsConnectDialogOpen(true);
    };


    const confirmConnect = async (introMessage: string) => {
        try {
            const result = await dmController.sendConnectionRequest({
                peerPublicKeyHex: pk as PublicKeyHex,
                introMessage
            });
            if (result.success) {
                setIsConnectDialogOpen(false);
                toast.success(t("network.notifications.requestSent", "Connection request sent to {{name}}", { name: resolvedName }));
            } else {
                toast.error(result.error || t("network.notifications.requestFailed", "Failed to send connection request"));
            }
        } catch (error) {
            console.error("Failed to send connection request:", error);
            toast.error(t("network.notifications.requestFailed", "Failed to send connection request"));
        }
    };

    const handleMessage = () => {
        const myPk = identity.state.publicKeyHex || "";
        const cid = [myPk, pk].sort().join(':');
        const existing = createdConnections.find(c => c.id === cid);

        if (existing) {
            setSelectedConversation(existing);
        } else {
            const newConv: DmConversation = {
                kind: 'dm',
                id: cid,
                pubkey: pk as PublicKeyHex,
                displayName: resolvedName || pk.slice(0, 8),
                lastMessage: '',
                unreadCount: 0,
                lastMessageTime: new Date()
            };
            setCreatedConnections(prev => [...prev, newConv]);
            setSelectedConversation(newConv);
        }
        router.push("/");
    };

    const handleToggleBlock = () => {
        if (isBlocked) {
            blocklist.removeBlocked({ publicKeyHex: pk as PublicKeyHex });
            toast.success(t("network.notifications.unblocked", "User unblocked"));
        } else {
            setIsBlockDialogOpen(true);
        }
    };

    const confirmBlock = () => {
        blocklist.addBlocked({ publicKeyInput: pk });
        setIsBlockDialogOpen(false);
        toast.success(t("network.notifications.blocked", "User blocked"));
    };

    const handleRemoveConnection = () => {
        setIsRemoveDialogOpen(true);
    };

    const confirmRemove = () => {
        peerTrust.unacceptPeer({ publicKeyHex: pk as PublicKeyHex });
        requestsInbox.setStatus({ peerPublicKeyHex: pk as PublicKeyHex, status: 'declined' });
        setIsRemoveDialogOpen(false);
        toast.success(t("network.notifications.removed", "Connection removed"));
        router.push("/network");
    };

    const handleInviteToGroup = async (group: GroupConversation) => {
        if (!myPublicKeyHex || !myPrivateKeyHex) {
            toast.error(t("network.notifications.identityError", "Identity not found"));
            return;
        }

        try {
            const roomKeyHex = await roomKeyStore.getRoomKey(group.groupId);
            if (!roomKeyHex) {
                toast.error(t("network.notifications.noRoomKey", "Missing group secret key"));
                return;
            }

            const groupService = new GroupService(myPublicKeyHex, myPrivateKeyHex as any);
            const metadata: GroupMetadata = {
                id: group.id,
                name: group.displayName,
                about: group.about,
                picture: group.avatar,
                access: group.access,
                memberCount: group.memberCount
            };

            const inviteEvent = await inviteEventBuilder(groupService, group, roomKeyHex, metadata, pk as PublicKeyHex);

            await relayPool.publishToAll(JSON.stringify(["EVENT", inviteEvent]));

            const conversationId = [myPublicKeyHex, pk].sort().join(':');

            // Persist locally for sender visibility
            const inviteMessage: Message = {
                id: inviteEvent.id,
                conversationId,
                kind: 'user',
                content: JSON.stringify({
                    type: "community-invite",
                    groupId: group.groupId,
                    roomKey: roomKeyHex,
                    metadata
                }),
                timestamp: new Date(),
                isOutgoing: true,
                status: 'delivered',
                eventId: inviteEvent.id,
                senderPubkey: myPublicKeyHex as PublicKeyHex,
                recipientPubkey: pk as PublicKeyHex,
            };

            const mq = new MessageQueue(myPublicKeyHex);
            await mq.persistMessage(inviteMessage as any);

            // Notify bus for real-time updates (instead of manual state setter)
            messageBus.emit({ type: 'new_message', conversationId, message: inviteMessage });

            setIsInviteDialogOpen(false);
            toast.success(t("network.notifications.invited", "Invitation sent to {{name}}", { name: resolvedName }));
        } catch (error) {
            console.error("Failed to send invite:", error);
            toast.error(t("network.notifications.inviteFailed", "Failed to send invitation"));
        }
    };

    /**
     * Helper to build the invite event safely.
     */
    const inviteEventBuilder = async (
        service: GroupService,
        group: GroupConversation,
        roomKeyHex: string,
        metadata: GroupMetadata,
        recipient: PublicKeyHex
    ) => {
        return await service.distributeRoomKey({
            recipientPubkey: recipient,
            groupId: group.groupId,
            roomKeyHex,
            metadata
        });
    };

    return (
        <div className="min-h-screen bg-gradient-main text-zinc-900 dark:text-zinc-100">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background/80 dark:bg-zinc-900/40 backdrop-blur-xl border-b border-zinc-200 dark:border-white/5">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                    className="rounded-full"
                >
                    <ChevronLeft className="h-6 w-6" />
                </Button>
                <h1 className="text-sm font-bold uppercase tracking-widest text-zinc-500">
                    {t("network.profileTitle", "Connection Profile")}
                </h1>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <Share2 className="h-5 w-5" />
                </Button>
            </div>

            <main className="max-w-3xl mx-auto p-4 sm:p-6 flex flex-col gap-10 pt-12 pb-32 md:pb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Immersive Profile Hero */}
                <div className="relative group/hero">
                    {/* Background Glows */}
                    <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse pointer-events-none" />
                    <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-emerald-600/10 blur-[120px] rounded-full animate-pulse pointer-events-none delay-1000" />

                    <Card className="relative overflow-hidden bg-[#0C0C0E]/80 backdrop-blur-2xl border-white/[0.03] rounded-[48px] p-10 sm:p-14 shadow-2xl">
                        {/* Blurred Avatar Background */}
                        <div className="absolute inset-0 z-0 opacity-[0.08] pointer-events-none overflow-hidden scale-110">
                            {metadata?.avatarUrl ? (
                                <Image src={metadata.avatarUrl} alt="" fill className="object-cover blur-3xl" unoptimized />
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-zinc-800/20 blur-3xl" />
                            )}
                        </div>

                        <div className="relative z-10 flex flex-col items-center gap-8">
                            {/* Large Avatar with Enhanced Status */}
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                                className="relative p-1.5 rounded-[54px] bg-gradient-to-br from-purple-500/30 to-emerald-500/30 shadow-2xl"
                            >
                                <div className="h-44 w-44 rounded-[48px] border-[6px] border-[#0C0C0E] overflow-hidden bg-[#1A1A1E] relative">
                                    {metadata?.avatarUrl ? (
                                        <Image
                                            src={metadata.avatarUrl}
                                            alt={resolvedName}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-purple-900/40 to-black">
                                            <span className="text-7xl font-black text-white/90">
                                                {resolvedName.slice(0, 1).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {isTrusted && (
                                    <div className="absolute -bottom-2 -right-2 h-12 w-12 rounded-2xl bg-emerald-500 border-[6px] border-[#0C0C0E] flex items-center justify-center shadow-xl">
                                        <CheckCircle2 className="h-6 w-6 text-white" />
                                    </div>
                                )}
                                {isBlocked && (
                                    <div className="absolute -bottom-2 -right-2 h-12 w-12 rounded-2xl bg-red-500 border-[6px] border-[#0C0C0E] flex items-center justify-center shadow-xl">
                                        <Ban className="h-6 w-6 text-white" />
                                    </div>
                                )}
                            </motion.div>

                            {/* Identity Info */}
                            <div className="text-center space-y-4">
                                <motion.h2
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-4xl sm:text-5xl font-black text-white tracking-tight"
                                >
                                    {displayHandle}
                                </motion.h2>

                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="flex items-center justify-center gap-3"
                                >
                                    {isTrusted ? (
                                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-widest">
                                            <Shield className="h-3.5 w-3.5" />
                                            Trusted Connection
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-zinc-500 text-xs font-black uppercase tracking-widest">
                                                Stranger
                                            </div>
                                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                                                Send a message to request a connection
                                            </p>
                                        </div>
                                    )}
                                </motion.div>
                            </div>

                            {/* Premium Action Bar */}
                            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                                <Button
                                    onClick={isTrusted ? handleMessage : handleConnect}
                                    disabled={isRequestPending && !isTrusted}
                                    className="h-16 px-10 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-lg shadow-2xl shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-95 gap-3"
                                >
                                    {isTrusted ? <MessageSquare className="h-6 w-6" /> : (isRequestPending ? <Clock className="h-6 w-6" /> : <UserPlus className="h-6 w-6" />)}
                                    {isTrusted ? t("network.actions.message", "Message") : (isRequestPending ? t("network.actions.pending", "Request Pending") : t("network.actions.connect", "Connect"))}
                                </Button>

                                {isTrusted && (
                                    <Button
                                        onClick={() => setIsInviteDialogOpen(true)}
                                        className="h-16 px-8 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] text-white font-black border border-white/5 backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95 gap-3"
                                    >
                                        <Plus className="h-6 w-6" />
                                        {t("network.actions.invite", "Invite")}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Identity & Discovery Section (Bento Style) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Public Key Card */}
                    <Card className="md:col-span-2 bg-[#0C0C0E]/40 backdrop-blur-xl border-white/[0.03] rounded-[40px] p-8 flex flex-col gap-6 hover:border-purple-500/20 transition-all duration-500 group/key">
                        <div className="flex items-center justify-between">
                            <div className="h-14 w-14 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                <Shield className="h-7 w-7 text-purple-400" />
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-10 px-4 rounded-xl bg-white/[0.03] border border-white/5 text-zinc-400 hover:text-white transition-all gap-2"
                                onClick={() => {
                                    navigator.clipboard.writeText(pk);
                                    toast.success(t("network.notifications.copied", "Public key copied"));
                                }}
                            >
                                <Share2 className="h-4 w-4" />
                                Copy Key
                            </Button>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight">Public Identity</h3>
                            <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.02] font-mono text-sm text-zinc-500 break-all leading-relaxed shadow-inner group-hover:text-zinc-400 transition-colors">
                                {pk}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Refined Danger Zone */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 px-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-600">
                            Management Controls
                        </h3>
                    </div>

                    <Card className="overflow-hidden border-white/[0.03] bg-[#0C0C0E]/40 backdrop-blur-xl rounded-[40px]">
                        <div className="flex flex-col">
                            <button
                                onClick={handleToggleBlock}
                                className="flex items-center justify-between p-8 hover:bg-rose-500/[0.02] transition-colors group/item"
                            >
                                <div className="flex items-center gap-6">
                                    <div className="h-14 w-14 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 group-hover/item:scale-110 transition-transform">
                                        <Ban className="h-6 w-6 text-rose-500" />
                                    </div>
                                    <div className="text-left space-y-1">
                                        <p className="text-xl font-black text-white group-hover/item:text-rose-500 transition-colors">
                                            {isBlocked ? t("network.actions.unblock", "Unblock user") : t("network.actions.block", "Block user")}
                                        </p>
                                        <p className="text-sm text-zinc-500 font-medium">
                                            {isBlocked ? t("network.desc.unblock", "Allow this user to message you again") : t("network.desc.block", "Stop receiving messages from this user")}
                                        </p>
                                    </div>
                                </div>
                            </button>

                            {isTrusted && (
                                <div className="mx-8 h-[1px] bg-white/[0.03]" />
                            )}

                            {isTrusted && (
                                <button
                                    onClick={handleRemoveConnection}
                                    className="flex items-center justify-between p-8 hover:bg-rose-500/[0.02] transition-colors group/item"
                                >
                                    <div className="flex items-center gap-6">
                                        <div className="h-14 w-14 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 group-hover/item:scale-110 transition-transform">
                                            <UserMinus className="h-6 w-6 text-rose-500" />
                                        </div>
                                        <div className="text-left space-y-1">
                                            <p className="text-xl font-black text-white group-hover/item:text-rose-500 transition-colors">
                                                {t("network.actions.remove", "Remove connection")}
                                            </p>
                                            <p className="text-sm text-zinc-500 font-medium">
                                                {t("network.desc.remove", "Remove this user from your trusted network list")}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            )}
                        </div>
                    </Card>
                </div>
            </main>

            <ConfirmDialog
                isOpen={isRemoveDialogOpen}
                onClose={() => setIsRemoveDialogOpen(false)}
                onConfirm={confirmRemove}
                title={t("network.dialogs.removeTitle", "Remove Connection")}
                description={t("network.dialogs.removeDesc", "Are you sure you want to remove this connection from your trusted list?")}
                confirmLabel={t("network.actions.remove", "Remove")}
                variant="danger"
            />

            <ConfirmDialog
                isOpen={isBlockDialogOpen}
                onClose={() => setIsBlockDialogOpen(false)}
                onConfirm={confirmBlock}
                title={t("network.dialogs.blockTitle", "Block User")}
                description={t("network.dialogs.blockDesc", "Are you sure you want to block this user? You will no longer receive their messages?")}
                confirmLabel={t("network.actions.block", "Block")}
                variant="danger"
            />

            <InviteToGroupDialog
                isOpen={isInviteDialogOpen}
                onClose={() => setIsInviteDialogOpen(false)}
                onInvite={handleInviteToGroup}
            />

            <ConnectRequestDialog
                isOpen={isConnectDialogOpen}
                onClose={() => setIsConnectDialogOpen(false)}
                onSend={confirmConnect}
                displayName={resolvedName}
            />
        </div>
    );
}
