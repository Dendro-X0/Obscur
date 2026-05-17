"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, Send, Users, UserCheck, X, Check } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { toast } from "../../../components/ui/toast";
import { cn } from "../../../lib/cn";
import { useNetwork } from "../../network/providers/network-provider";
import { useMessaging } from "../../messaging/providers/messaging-provider";
import { useRelay } from "../../relays/providers/relay-provider";
import { useIdentity } from "../../auth/hooks/use-identity";
import { MessageQueue } from "../../messaging/lib/message-queue";
import { messageBus } from "../../messaging/services/message-bus";
import type { Message } from "../../messaging/types";
import { GroupService } from "../services/group-service";
import type { GroupMetadata } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { UserAvatar } from "../../profile/components/user-avatar";
import { useResolvedProfileMetadata } from "../../profile/hooks/use-resolved-profile-metadata";
import { toDmConversationId } from "../../messaging/utils/dm-conversation-id";
import { discoveryCache } from "../../search/services/discovery-cache";
import {
    INVITE_CONNECTION_FALLBACK_NAME,
    resolveInviteConnectionDisplayName,
    toInviteConnectionSearchText
} from "./invite-connection-display";

interface InviteConnectionsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: string;
    relayUrl?: string;
    roomKeyHex: string;
    metadata: GroupMetadata;
    currentMemberPubkeys?: ReadonlyArray<string>;
    communityId?: string;
    genesisEventId?: string;
    creatorPubkey?: string;
}

export function InviteConnectionsDialog({
    isOpen,
    onClose,
    groupId,
    relayUrl,
    roomKeyHex,
    metadata,
    currentMemberPubkeys = [],
    communityId,
    genesisEventId,
    creatorPubkey
}: InviteConnectionsDialogProps) {
    const { peerTrust } = useNetwork();
    const { createdConnections } = useMessaging();
    const { relayPool } = useRelay();
    const { state: identityState } = useIdentity();

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPubkeys, setSelectedPubkeys] = useState<Set<string>>(new Set());
    const [isSending, setIsSending] = useState(false);

    const groupService = useRef<GroupService | null>(null);
    const normalizedCurrentMemberPubkeys = React.useMemo(
        () => new Set(currentMemberPubkeys.map((pubkey) => pubkey.toLowerCase())),
        [currentMemberPubkeys]
    );

    const isAlreadyMember = React.useCallback(
        (pubkey: string) => normalizedCurrentMemberPubkeys.has(pubkey.toLowerCase()),
        [normalizedCurrentMemberPubkeys]
    );

    useEffect(() => {
        if (identityState.publicKeyHex && identityState.privateKeyHex) {
            groupService.current = new GroupService(
                identityState.publicKeyHex,
                identityState.privateKeyHex as any
            );
        }
    }, [identityState.publicKeyHex, identityState.privateKeyHex]);

    useEffect(() => {
        setSelectedPubkeys((prev) => {
            const next = new Set(Array.from(prev).filter((pubkey) => !isAlreadyMember(pubkey)));
            return next.size === prev.size ? prev : next;
        });
    }, [isAlreadyMember]);

    const filteredConnections = React.useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        return peerTrust.state.acceptedPeers.flatMap((pk) => {
            const connection = createdConnections.find(c => c.kind === 'dm' && c.pubkey === pk);
            const cachedProfile = discoveryCache.getProfile(pk);
            const metadataDisplayName = cachedProfile?.displayName || cachedProfile?.name;
            const resolvedDisplayName = resolveInviteConnectionDisplayName({
                pubkey: pk,
                connectionDisplayName: connection?.displayName,
                metadataDisplayName
            });
            const searchText = toInviteConnectionSearchText({
                pubkey: pk,
                resolvedDisplayName,
                connectionDisplayName: connection?.displayName,
                metadataDisplayName
            });
            if (normalizedQuery.length > 0 && !searchText.includes(normalizedQuery)) {
                return [];
            }
            return [{
                pubkey: pk,
                connectionDisplayName: connection?.displayName,
                cachedMetadataDisplayName: metadataDisplayName
            }];
        });
    }, [peerTrust.state.acceptedPeers, createdConnections, searchQuery]);

    const handleToggleSelect = (pubkey: string) => {
        if (isAlreadyMember(pubkey)) {
            return;
        }

        setSelectedPubkeys(prev => {
            const next = new Set(prev);
            if (next.has(pubkey)) {
                next.delete(pubkey);
            } else {
                next.add(pubkey);
            }
            return next;
        });
    };

    const handleSendInvites = async () => {
        if (!groupService.current || selectedPubkeys.size === 0) return;
        setIsSending(true);

        try {
            const mq = new MessageQueue(identityState.publicKeyHex!);
            const newMessages: Record<string, Message> = {};

            const promises = Array.from(selectedPubkeys).map(async (pubkey) => {
                const scopedRelayUrl = relayUrl || relayPool.connections.find((c: { url: string }) => c.url)?.url;
                const inviteEvent = await groupService.current!.distributeRoomKey({
                    recipientPubkey: pubkey as PublicKeyHex,
                    groupId,
                    roomKeyHex,
                    metadata,
                    relayUrl: scopedRelayUrl,
                    communityId,
                    genesisEventId,
                    creatorPubkey
                });
                await relayPool.publishToAll(JSON.stringify(["EVENT", inviteEvent]));

                const myPublicKeyHex = identityState.publicKeyHex || '';
                const conversationId = toDmConversationId({ myPublicKeyHex, peerPublicKeyHex: pubkey });
                if (!conversationId) {
                    return;
                }

                const inviteMessage: Message = {
                    id: inviteEvent.id,
                    conversationId,
                    kind: 'user',
                    content: JSON.stringify({
                        type: "community-invite",
                        groupId,
                        metadata,
                        communityId,
                        genesisEventId,
                        creatorPubkey
                    }),
                    timestamp: new Date(),
                    isOutgoing: true,
                    status: 'delivered',
                    eventId: inviteEvent.id,
                    senderPubkey: myPublicKeyHex as PublicKeyHex,
                    recipientPubkey: pubkey as PublicKeyHex,
                };

                await mq.persistMessage(inviteMessage as any);
                newMessages[conversationId] = inviteMessage;
            });

            await Promise.all(promises);

            // Update UI optimistically via message bus
            Object.entries(newMessages).forEach(([convId, msg]) => {
                messageBus.emitNewMessage(convId, msg);
            });

            toast.success(`Invites sent securely to ${selectedPubkeys.size} connections`);
            setSelectedPubkeys(new Set());
            onClose();
        } catch (error) {
            console.error("Failed to send invites:", error);
            toast.error("Failed to distribute room keys. Encryption error.");
        } finally {
            setIsSending(false);
        }
    };

    const handleClose = () => {
        setSearchQuery("");
        setSelectedPubkeys(new Set());
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[140] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm dark:bg-black/72"
            onClick={handleClose}
        >
            <div
                className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-black/10 bg-gradient-card p-0 shadow-[0_24px_80px_rgba(79,70,229,0.22)] dark:border-white/10 dark:shadow-[0_24px_90px_rgba(70,40,190,0.45)]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.18),transparent_54%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.14),transparent_48%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.28),transparent_54%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.2),transparent_48%)]" />
                <div className="p-8 pb-0">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="flex items-center gap-3 text-2xl font-black text-zinc-900 dark:text-zinc-50">
                                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-300/70 bg-indigo-100/80 text-indigo-700 shadow-[0_0_20px_rgba(99,102,241,0.22)] dark:border-indigo-300/45 dark:bg-indigo-500/20 dark:text-indigo-100 dark:shadow-[0_0_28px_rgba(99,102,241,0.45)]">
                                    <Users className="h-5 w-5" />
                                </span>
                                <span>Invite Connections</span>
                            </h2>
                            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-200">
                                Distribute Group Room Key
                            </p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl border border-black/10 bg-white/70 text-zinc-600 hover:border-indigo-300/50 hover:bg-indigo-50 hover:text-indigo-700 dark:border-indigo-300/25 dark:bg-indigo-500/5 dark:text-zinc-300 dark:hover:border-indigo-200/40 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-100" onClick={handleClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="p-8 space-y-6">
                    <div className="group relative">
                        <div className="absolute -inset-[1px] rounded-[24px] bg-gradient-to-r from-indigo-400/35 via-violet-400/25 to-fuchsia-400/30 opacity-80 blur-[1px] transition-opacity group-focus-within:opacity-100 dark:from-indigo-400/60 dark:via-violet-400/45 dark:to-fuchsia-400/50" />
                        <Search className="absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-indigo-600/60 transition-colors group-focus-within:text-indigo-700 dark:text-indigo-200/55 dark:group-focus-within:text-indigo-100" />
                        <Input
                            placeholder="Search your connections..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="relative z-10 h-14 rounded-[24px] !border-black/10 !bg-white/90 pl-12 font-bold !text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_1px_rgba(99,102,241,0.14)] !placeholder:text-zinc-500 focus-visible:!border-indigo-400 focus-visible:!ring-2 focus-visible:!ring-indigo-400/30 focus-visible:!ring-offset-0 dark:!border-indigo-300/25 dark:!bg-zinc-950/90 dark:!text-indigo-50 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(99,102,241,0.18)] dark:!placeholder:text-indigo-200/45 dark:focus-visible:!border-indigo-300 dark:focus-visible:!ring-indigo-300/35"
                        />
                    </div>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredConnections.length === 0 ? (
                            <div className="py-12 flex flex-col items-center justify-center text-center opacity-30">
                                <UserCheck className="h-10 w-10 text-zinc-700 mb-4" />
                                <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">No connections found</p>
                            </div>
                        ) : (
                            filteredConnections.map((connection) => {
                                const alreadyMember = isAlreadyMember(connection.pubkey);
                                return (
                                    <ConnectionRow
                                        key={connection.pubkey}
                                        pubkey={connection.pubkey}
                                        connectionDisplayName={connection.connectionDisplayName}
                                        cachedMetadataDisplayName={connection.cachedMetadataDisplayName}
                                        isSelected={selectedPubkeys.has(connection.pubkey)}
                                        isAlreadyMember={alreadyMember}
                                        onToggle={() => handleToggleSelect(connection.pubkey)}
                                    />
                                );
                            })
                        )}
                    </div>
                </div>

                {selectedPubkeys.size > 0 && (
                    <div className="animate-in slide-in-from-bottom-2 flex items-center justify-between border-t border-black/10 bg-white/70 p-6 dark:border-indigo-300/20 dark:bg-[linear-gradient(180deg,#12121A,#101015)]">
                        <span className="rounded-full border border-indigo-300/60 bg-indigo-100 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-indigo-700 dark:border-indigo-300/35 dark:bg-indigo-500/10 dark:text-indigo-200">
                            {selectedPubkeys.size} Selected
                        </span>
                        <Button
                            onClick={handleSendInvites}
                            disabled={isSending}
                            className="h-12 rounded-[20px] bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-6 font-black text-white shadow-[0_10px_24px_rgba(129,140,248,0.3)] transition-all hover:brightness-110 dark:shadow-[0_12px_30px_rgba(129,140,248,0.4)]"
                        >
                            {isSending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Send className="h-4 w-4 mr-2" />
                            )}
                            Send Invites
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

function ConnectionRow({
    pubkey,
    connectionDisplayName,
    cachedMetadataDisplayName,
    isSelected,
    isAlreadyMember,
    onToggle
}: {
    pubkey: string;
    connectionDisplayName?: string;
    cachedMetadataDisplayName?: string;
    isSelected: boolean;
    isAlreadyMember: boolean;
    onToggle: () => void;
}) {
    const metadata = useResolvedProfileMetadata(pubkey);
    const displayName = resolveInviteConnectionDisplayName({
        pubkey,
        connectionDisplayName,
        metadataDisplayName: metadata?.displayName || cachedMetadataDisplayName
    });
    const hasResolvedName = displayName !== INVITE_CONNECTION_FALLBACK_NAME;

    return (
        <div
            onClick={isAlreadyMember ? undefined : onToggle}
            className={cn(
                "group relative flex items-center justify-between overflow-hidden rounded-[24px] border bg-white/75 p-4 backdrop-blur-sm transition-all dark:bg-[#0E0E10]",
                isAlreadyMember
                    ? "cursor-not-allowed border-emerald-500/30 bg-emerald-500/8 opacity-80"
                    : isSelected
                    ? "border-indigo-400/55 bg-gradient-to-r from-indigo-100/85 via-violet-100/70 to-fuchsia-100/80 shadow-[0_8px_22px_rgba(99,102,241,0.18)] dark:border-indigo-300/70 dark:from-indigo-500/15 dark:via-violet-500/10 dark:to-fuchsia-500/15 dark:shadow-[0_10px_26px_rgba(99,102,241,0.22)]"
                    : "cursor-pointer border-black/10 hover:border-indigo-300/60 hover:bg-indigo-50/70 hover:shadow-[0_6px_16px_rgba(99,102,241,0.14)] dark:border-[#1A1A1E] dark:hover:border-indigo-300/35 dark:hover:bg-[#111115] dark:hover:shadow-[0_6px_20px_rgba(99,102,241,0.16)]"
            )}
        >
            {!isAlreadyMember && (
                <span
                    className={cn(
                        "pointer-events-none absolute inset-y-0 left-0 w-1.5 rounded-r-full bg-gradient-to-b from-indigo-500/80 via-violet-500/75 to-fuchsia-500/80 transition-opacity dark:from-indigo-400/80 dark:via-violet-400/75 dark:to-fuchsia-400/80",
                        isSelected ? "opacity-100" : "opacity-40 group-hover:opacity-80"
                    )}
                />
            )}
            <div className="flex items-center gap-4">
                <UserAvatar pubkey={pubkey} size="md" className="rounded-2xl border border-indigo-200/20 shadow-[0_0_16px_rgba(129,140,248,0.16)]" />
                <div>
                    <p className="text-sm font-black text-zinc-900 dark:text-white">{displayName}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                        {hasResolvedName ? "Trusted connection" : "Unnamed connection"}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-600">Identity hidden</p>
                </div>
            </div>
            {isAlreadyMember ? (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 shadow-[0_0_10px_rgba(16,185,129,0.16)] dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-300 dark:shadow-[0_0_14px_rgba(52,211,153,0.2)]">
                    Already in this community.
                </span>
            ) : (
                <div className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all",
                    isSelected
                        ? "border-indigo-500 bg-gradient-to-br from-indigo-500 to-violet-500 shadow-[0_0_18px_rgba(99,102,241,0.45)]"
                        : "border-zinc-400 group-hover:border-indigo-400 dark:border-zinc-700 dark:group-hover:border-indigo-300/70"
                )}>
                    {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                </div>
            )}
        </div>
    );
}
