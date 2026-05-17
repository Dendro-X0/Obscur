"use client";

import React from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
    Clock,
    PhoneCall,
} from "lucide-react";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { Button } from "@dweb/ui-kit";
import { Card } from "@dweb/ui-kit";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useResolvedProfileMetadata } from "@/app/features/profile/hooks/use-resolved-profile-metadata";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { toast } from "@dweb/ui-kit";
import { InviteToGroupDialog } from "./invite-to-group-dialog";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useEnhancedDmController } from "@/app/features/messaging/hooks/use-enhanced-dm-controller";
import { useRequestTransport } from "@/app/features/messaging/hooks/use-request-transport";
import { cn } from "@dweb/ui-kit";
import type { DmConversation, GroupConversation } from "@/app/features/messaging/types";
import { GroupService } from "@/app/features/groups/services/group-service";
import { roomKeyStore } from "@/app/features/crypto/room-key-store";
import type { GroupMetadata } from "@/app/features/groups/types";
import { MessageQueue } from "@/app/features/messaging/lib/message-queue";
import type { Message } from "@/app/features/messaging/types";
import { messageBus } from "@/app/features/messaging/services/message-bus";
import { InvitationComposerDialog } from "@/app/features/messaging/components/invitation-composer-dialog";
import { toDmConversationId } from "@/app/features/messaging/utils/dm-conversation-id";
import { createDmConversation } from "@/app/features/messaging/utils/create-dm-conversation";
import { getPublicProfileHref, toAbsoluteAppUrl } from "@/app/features/navigation/public-routes";
import { requestFlowEvidenceStore } from "@/app/features/messaging/services/request-flow-evidence-store";
import { deriveRequestProjection } from "@/app/features/messaging/services/request-status-projection";
import { writePendingVoiceCallRequest } from "@/app/features/messaging/services/realtime-voice-pending-request";
import {
    buildInvitationRequestMessage,
    DEFAULT_INVITATION_INTRO,
    type InvitationComposerValues,
} from "@/app/features/messaging/services/invitation-composer";
import { getDirectInvitationToastCopy } from "@/app/features/messaging/services/invitation-presentation";

const PRIVATE_CONTACT_LABEL = "Unknown contact";
const PRIVATE_CONTACT_HANDLE = "@unknown";

export default function ConnectionProfileView() {
    const { pubkey } = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { t } = useTranslation();
    const { peerTrust, requestsInbox, blocklist, presence } = useNetwork();
    const { createdConnections, setSelectedConversation } = useMessaging();
    const { relayPool } = useRelay();
    const identity = useIdentity();

    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = React.useState(false);
    const [isBlockDialogOpen, setIsBlockDialogOpen] = React.useState(false);
    const [isInviteDialogOpen, setIsInviteDialogOpen] = React.useState(false);
    const [isConnectDialogOpen, setIsConnectDialogOpen] = React.useState(false);
    const [requestIntroText, setRequestIntroText] = React.useState(DEFAULT_INVITATION_INTRO);
    const [requestNoteText, setRequestNoteText] = React.useState("");
    const [requestSecretCode, setRequestSecretCode] = React.useState("");

    const myPublicKeyHex = identity.state.publicKeyHex || null;
    const myPrivateKeyHex = identity.state.privateKeyHex || null;

    const dmController = useEnhancedDmController({
        myPublicKeyHex,
        myPrivateKeyHex,
        pool: relayPool,
        blocklist,
        peerTrust,
        requestsInbox,
        autoSubscribeIncoming: false,
        enableIncomingTransport: false,
        enableAutoQueueProcessing: false,
    });
    const requestTransport = useRequestTransport({
        dmController,
        peerTrust,
        requestsInbox,
    });

    const queryPubkey = searchParams.get("pubkey");
    const pk = (Array.isArray(pubkey) ? pubkey[0] : pubkey) || queryPubkey || "";
    const metadata = useResolvedProfileMetadata(pk);
    const isDeletedContact = metadata?.isDeleted === true;
    const isCurrentAccountProfile = Boolean(myPublicKeyHex && pk && myPublicKeyHex === pk);

    React.useEffect(() => {
        if (!isCurrentAccountProfile) {
            return;
        }
        router.replace("/settings#profile");
    }, [isCurrentAccountProfile, router]);

    if (!pk) return null;
    if (isCurrentAccountProfile) return null;

    const isTrusted = peerTrust?.state?.acceptedPeers?.includes(pk as PublicKeyHex) ?? false;
    const isBlocked = blocklist?.state?.blockedPublicKeys?.includes(pk as PublicKeyHex) ?? false;
    const isPeerOnline = presence.isPeerOnline(pk as PublicKeyHex);
    const requestStatus = requestsInbox.getRequestStatus({ peerPublicKeyHex: pk as PublicKeyHex });
    const requestProjection = deriveRequestProjection({
        requestStatus,
        evidence: requestFlowEvidenceStore.get(pk),
    });
    const connection = createdConnections.find(c => c.kind === 'dm' && c.pubkey === pk);

    const resolvedName = metadata?.displayName || connection?.displayName || PRIVATE_CONTACT_LABEL;
    const displayHandle = resolvedName ? `@${resolvedName}` : PRIVATE_CONTACT_HANDLE;
    const publicProfileUrl = toAbsoluteAppUrl(getPublicProfileHref(pk));

    const handleShareProfile = async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: resolvedName,
                    text: `${resolvedName} on Obscur`,
                    url: publicProfileUrl,
                });
            } else {
                await navigator.clipboard.writeText(publicProfileUrl);
                toast.success(t("network.notifications.copied", "Profile link copied"));
            }
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }
            toast.error(t("network.notifications.shareFailed", "Could not share profile"));
        }
    };

    const handleConnect = () => {
        if (requestProjection.state === "accepted") {
            toast.warning(t("network.notifications.alreadyConnected", "You are already connected to this user."));
            return;
        }
        if (requestProjection.state === "incoming_pending") {
            toast.warning(t("network.notifications.alreadyPending", "This user has already sent you a pending request."));
            return;
        }
        setIsConnectDialogOpen(true);
    };

    const primaryActionLabel = isDeletedContact
        ? t("network.actions.openChat", "Open Chat")
        : isTrusted
        ? t("network.actions.message", "Message")
        : requestProjection.state === "recipient_seen"
            ? t("network.actions.resend", "Resend Invitation")
            : requestProjection.state === "sent_waiting" || requestProjection.state === "retry_available" || requestProjection.state === "rejected"
                    ? t("network.actions.resend", "Resend Invitation")
                    : t("network.actions.connect", "Connect");

    const primaryActionIcon = (isTrusted || isDeletedContact)
        ? <MessageSquare className="h-6 w-6" />
        : <UserPlus className="h-6 w-6" />;

    const connectionStatusTitle = isDeletedContact
        ? "Account removed"
        : isTrusted
        ? (isPeerOnline ? "Trusted connection - online" : "Trusted connection - offline")
        : requestProjection.state === "recipient_seen"
            ? "Recipient saw prior invitation"
            : requestProjection.state === "sent_waiting"
                ? "Sent, awaiting confirmation"
                : requestProjection.state === "retry_available"
                    ? "Retry available"
                    : isBlocked
                        ? "Blocked"
                        : "Not connected yet";

    const connectionStatusBody = isDeletedContact
        ? "This contact deleted their account. You can still browse local chat history, but new messages and calls cannot be delivered."
        : isTrusted
        ? (isPeerOnline
            ? "This trusted contact is currently online."
            : "This trusted contact is currently offline. You can still message and invite them.")
        : requestProjection.state === "recipient_seen"
            ? "A prior invitation reached the recipient side. You can send a fresh invitation if the connection did not continue."
            : requestProjection.state === "sent_waiting"
                ? "Obscur published your invitation, but there is no proof the recipient has seen it yet."
                : requestProjection.state === "retry_available"
                    ? "No recipient evidence arrived in time. You can resend the invitation."
                    : isBlocked
                        ? "This profile is blocked on this device."
                        : "You can review their public profile and send an invitation when you are ready.";


    const handleInvitationDialogSubmit = async (values: InvitationComposerValues): Promise<boolean> => {
        setRequestIntroText(values.intro);
        setRequestNoteText(values.note);
        setRequestSecretCode(values.secretCode);

        try {
            const result = await requestTransport.sendRequest({
                peerPublicKeyHex: pk as PublicKeyHex,
                introMessage: buildInvitationRequestMessage(values)
            });

            if (result.status === "ok") {
                toast.success(getDirectInvitationToastCopy("ok").message);
                return true;
            }

            if (result.status === "partial") {
                toast.warning(getDirectInvitationToastCopy("partial", {
                    relaySuccessCount: result.relaySuccessCount,
                    relayTotal: result.relayTotal,
                }).message);
                return true;
            }

            if (result.status === "queued") {
                toast.warning(getDirectInvitationToastCopy("queued", {
                    message: result.message,
                }).message);
                return true;
            }

            toast.error(getDirectInvitationToastCopy(result.status, {
                message: result.message || t("network.notifications.requestFailed", "Failed to send connection request"),
            }).message);
            return false;
        } catch (error) {
            console.error("Failed to send connection request:", error);
            const message = error instanceof Error
                ? error.message
                : t("network.notifications.requestFailed", "Failed to send connection request");
            toast.error(getDirectInvitationToastCopy("failed", { message }).message);
            return false;
        }
    };

    const openChatWithProfile = (): DmConversation | null => {
        const myPk = identity.state.publicKeyHex || "";
        const cid = toDmConversationId({ myPublicKeyHex: myPk, peerPublicKeyHex: pk });
        if (!cid) {
            toast.error("Invalid conversation identity for this profile.");
            return null;
        }
        const existing = createdConnections.find(c => c.id === cid);

        if (existing) {
            setSelectedConversation(existing);
            return existing;
        } else {
            const newConv = createDmConversation({
                myPublicKeyHex: myPk,
                peerPublicKeyHex: pk as PublicKeyHex,
                displayName: resolvedName || PRIVATE_CONTACT_LABEL,
            });
            if (!newConv) {
                toast.error("Invalid conversation identity for this profile.");
                return null;
            }
            setSelectedConversation(newConv);
            return newConv;
        }
    };

    const handleMessage = () => {
        const opened = openChatWithProfile();
        if (!opened) {
            return;
        }
        router.push("/");
    };

    const handleVoiceCall = () => {
        if (isDeletedContact) {
            toast.warning("This account has been removed. Voice calls are unavailable.");
            return;
        }
        if (!isTrusted) {
            toast.warning(t("network.notifications.alreadyPending", "You can place a voice call after a trusted connection is established."));
            return;
        }
        const opened = openChatWithProfile();
        if (!opened || opened.kind !== "dm") {
            return;
        }
        writePendingVoiceCallRequest({
            peerPubkey: opened.pubkey,
            requestedAtUnixMs: Date.now(),
        });
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
        requestsInbox.remove({ peerPublicKeyHex: pk as PublicKeyHex });
        setIsRemoveDialogOpen(false);
        toast.success(t("network.notifications.removed", "Connection removed"));
        router.push("/network");
    };

    const handleInviteToGroup = async (group: GroupConversation) => {
        if (isDeletedContact) {
            toast.warning("This account has been removed. Group invitations are unavailable.");
            return;
        }
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

            const conversationId = toDmConversationId({ myPublicKeyHex, peerPublicKeyHex: pk });
            if (!conversationId) {
                toast.error("Cannot send invite due to invalid identity state.");
                return;
            }

            // Persist locally for sender visibility
            const inviteMessage: Message = {
                id: inviteEvent.id,
                conversationId,
                kind: 'user',
                content: JSON.stringify({
                    type: "community-invite",
                    groupId: group.groupId,
                    roomKey: roomKeyHex,
                    metadata,
                    relayUrl: group.relayUrl,
                    communityId: group.communityId,
                    genesisEventId: group.genesisEventId,
                    creatorPubkey: group.creatorPubkey
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
            metadata,
            relayUrl: group.relayUrl,
            communityId: group.communityId,
            genesisEventId: group.genesisEventId,
            creatorPubkey: group.creatorPubkey
        });
    };

    return (
        <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.12),_transparent_34%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,1))] text-zinc-900 dark:bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.14),_transparent_36%),linear-gradient(180deg,rgba(3,7,18,0.96),rgba(3,7,18,1))] dark:text-zinc-100">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200/70 bg-background/80 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/60">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                    className="rounded-full"
                >
                    <ChevronLeft className="h-6 w-6" />
                </Button>
                <h1 className="text-sm font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    {t("network.profileTitle", "Public Profile")}
                </h1>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={handleShareProfile}>
                    <Share2 className="h-5 w-5" />
                </Button>
            </div>

            <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-4 pb-32 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 sm:p-6 md:pb-10">
                <div className="relative group/hero">
                    <div className="pointer-events-none absolute -left-[10%] -top-[18%] h-[42%] w-[42%] rounded-full bg-indigo-600/10 blur-[120px]" />
                    <div className="pointer-events-none absolute -bottom-[16%] -right-[8%] h-[36%] w-[36%] rounded-full bg-cyan-500/10 blur-[120px]" />

                    <Card className="relative overflow-hidden rounded-[40px] border border-zinc-200/70 bg-white/88 p-8 shadow-[0_30px_100px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#07101f]/88 sm:p-10">
                        <div className="absolute inset-0 z-0 scale-110 overflow-hidden opacity-[0.08] pointer-events-none">
                            {metadata?.avatarUrl ? (
                                <Image src={metadata.avatarUrl} alt="" fill className="object-cover blur-3xl" unoptimized />
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-cyan-500/10 blur-3xl" />
                            )}
                        </div>

                        <div className="relative z-10 flex flex-col items-center gap-8">
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                                className="relative rounded-[42px] bg-gradient-to-br from-indigo-500/25 to-cyan-500/20 p-1.5 shadow-2xl"
                            >
                                <div className="relative h-36 w-36 overflow-hidden rounded-[36px] border-[5px] border-white bg-slate-100 dark:border-[#07101f] dark:bg-[#101827] sm:h-40 sm:w-40">
                                    {metadata?.avatarUrl ? (
                                        <Image
                                            src={metadata.avatarUrl}
                                            alt={resolvedName}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500/20 to-cyan-500/10 dark:from-indigo-900/40 dark:to-black">
                                            <span className="text-6xl font-black text-zinc-900/80 dark:text-white/90">
                                                {resolvedName.slice(0, 1).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {isTrusted && (
                                    <div className="absolute -bottom-2 -right-2 flex h-11 w-11 items-center justify-center rounded-2xl border-[5px] border-white bg-emerald-500 shadow-xl dark:border-[#07101f]">
                                        <CheckCircle2 className="h-6 w-6 text-white" />
                                    </div>
                                )}
                                {isBlocked && (
                                    <div className="absolute -bottom-2 -right-2 flex h-11 w-11 items-center justify-center rounded-2xl border-[5px] border-white bg-red-500 shadow-xl dark:border-[#07101f]">
                                        <Ban className="h-6 w-6 text-white" />
                                    </div>
                                )}
                            </motion.div>

                            <div className="space-y-4 text-center">
                                <motion.h2
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-3xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-5xl"
                                >
                                    {resolvedName}
                                </motion.h2>
                                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{displayHandle}</p>
                                {metadata?.about ? (
                                    <p className="mx-auto max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                                        {metadata.about}
                                    </p>
                                ) : (
                                    <p className="mx-auto max-w-xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                                        This is a public contact profile. You can review their public information before deciding whether to connect.
                                    </p>
                                )}

                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="flex flex-wrap items-center justify-center gap-3"
                                >
                                    {isDeletedContact ? (
                                        <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
                                            <UserMinus className="h-3.5 w-3.5" />
                                            Account Removed
                                        </div>
                                    ) : null}
                                    {isTrusted ? (
                                        <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300">
                                            <Shield className="h-3.5 w-3.5" />
                                            Trusted Connection
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="flex items-center gap-2 rounded-full border border-zinc-200/70 bg-zinc-950/[0.03] px-4 py-1.5 text-xs font-black uppercase tracking-widest text-zinc-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400">
                                                Stranger
                                            </div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                                                Public profile only until a connection is accepted
                                            </p>
                                        </div>
                                    )}
                                    {metadata?.nip05 && (
                                        <div className="rounded-full border border-zinc-200/70 bg-white/70 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-zinc-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
                                            {metadata.nip05}
                                        </div>
                                    )}
                                </motion.div>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                                <Button
                                    onClick={(isTrusted || isDeletedContact) ? handleMessage : handleConnect}
                                    disabled={!isDeletedContact && !isTrusted && (requestProjection.state === "accepted" || requestProjection.state === "incoming_pending")}
                                    className="h-14 gap-3 rounded-2xl bg-indigo-600 px-8 text-base font-black text-white shadow-[0_18px_40px_rgba(79,70,229,0.26)] transition-all hover:scale-[1.02] hover:bg-indigo-500 active:scale-95"
                                >
                                    {primaryActionIcon}
                                    {primaryActionLabel}
                                </Button>

                                {isTrusted && !isDeletedContact && (
                                    <Button
                                        onClick={handleVoiceCall}
                                        className="h-14 gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/12 px-8 font-black text-emerald-700 backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-emerald-500/18 active:scale-95 dark:text-emerald-200"
                                    >
                                        <PhoneCall className="h-6 w-6" />
                                        {t("messaging.voiceCall", "Voice Call")}
                                    </Button>
                                )}

                                {isTrusted && !isDeletedContact && (
                                    <Button
                                        onClick={() => setIsInviteDialogOpen(true)}
                                        className="h-14 gap-3 rounded-2xl border border-zinc-200/70 bg-white/70 px-8 font-black text-zinc-900 backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-white active:scale-95 dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:hover:bg-white/[0.08]"
                                    >
                                        <Plus className="h-6 w-6" />
                                        {t("network.actions.invite", "Invite")}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="md:col-span-2 flex flex-col gap-6 rounded-[32px] border border-zinc-200/70 bg-white/88 p-8 backdrop-blur-xl transition-all duration-500 group/key dark:border-white/10 dark:bg-[#07101f]/88">
                        <div className="flex items-center justify-between">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10">
                                <Shield className="h-7 w-7 text-indigo-500 dark:text-indigo-300" />
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-10 gap-2 rounded-xl border border-zinc-200/70 bg-zinc-950/[0.03] px-4 text-zinc-500 transition-all hover:text-zinc-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400 dark:hover:text-white"
                                onClick={() => {
                                    navigator.clipboard.writeText(publicProfileUrl);
                                    toast.success(t("network.notifications.copied", "Profile link copied"));
                                }}
                            >
                                <Share2 className="h-4 w-4" />
                                Copy Link
                            </Button>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black uppercase tracking-tight text-zinc-950 dark:text-white">Public Identity</h3>
                            <div className="rounded-2xl border border-zinc-200/70 bg-slate-50 p-4 font-mono text-sm leading-relaxed text-zinc-600 shadow-inner transition-colors group-hover:text-zinc-700 dark:border-white/10 dark:bg-black/30 dark:text-zinc-400">
                                {pk}
                            </div>
                        </div>
                    </Card>

                    {metadata?.nip05 ? (
                        <Card className="rounded-[32px] border border-zinc-200/70 bg-white/88 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-[#07101f]/88">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">NIP-05</p>
                            <p className="mt-3 break-all text-base font-semibold text-zinc-900 dark:text-white">{metadata.nip05}</p>
                        </Card>
                    ) : null}

                    <Card className="rounded-[32px] border border-zinc-200/70 bg-white/88 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-[#07101f]/88">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Connection Status</p>
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-zinc-950/[0.03] px-3 py-1 dark:border-white/10 dark:bg-white/[0.04]">
                            <span className={cn("h-2 w-2 rounded-full", isPeerOnline ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600")} />
                            <span className={cn("text-[10px] font-black uppercase tracking-widest", isPeerOnline ? "text-emerald-600 dark:text-emerald-300" : "text-zinc-500 dark:text-zinc-400")}>
                                {isPeerOnline ? "Online now" : "Offline"}
                            </span>
                        </div>
                        <p className="mt-3 text-base font-semibold text-zinc-900 dark:text-white">
                            {connectionStatusTitle}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                            {connectionStatusBody}
                        </p>
                    </Card>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center gap-3 px-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-500">
                            Management Controls
                        </h3>
                    </div>

                    <Card className="overflow-hidden rounded-[32px] border border-zinc-200/70 bg-white/88 backdrop-blur-xl dark:border-white/10 dark:bg-[#07101f]/88">
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
                                        <p className="text-xl font-black text-zinc-900 transition-colors group-hover/item:text-rose-500 dark:text-white">
                                            {isBlocked ? t("network.actions.unblock", "Unblock user") : t("network.actions.block", "Block user")}
                                        </p>
                                        <p className="text-sm text-zinc-500 font-medium">
                                            {isBlocked ? t("network.desc.unblock", "Allow this user to message you again") : t("network.desc.block", "Stop receiving messages from this user")}
                                        </p>
                                    </div>
                                </div>
                            </button>

                            {isTrusted && (
                                <div className="mx-8 h-[1px] bg-zinc-200/70 dark:bg-white/[0.06]" />
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
                                            <p className="text-xl font-black text-zinc-900 transition-colors group-hover/item:text-rose-500 dark:text-white">
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

            <InvitationComposerDialog
                isOpen={isConnectDialogOpen}
                recipientName={resolvedName}
                recipientPubkey={pk}
                submitLabel="Send Invitation"
                deliveryHint="Obscur will only mark this invitation as delivered after relay evidence comes back."
                defaults={{
                    intro: requestIntroText,
                    note: requestNoteText,
                    secretCode: requestSecretCode,
                }}
                onClose={() => setIsConnectDialogOpen(false)}
                onSubmit={handleInvitationDialogSubmit}
            />
        </div>
    );
}
