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
            className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={handleClose}
        >
            <div
                className="w-full max-w-md bg-[#0A0A0B] border border-white/10 p-0 overflow-hidden rounded-[32px] shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="p-8 pb-0">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-white font-black text-2xl flex items-center gap-3">
                                <Users className="h-6 w-6 text-indigo-400" />
                                Invite Connections
                            </h2>
                            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-2 hover:text-zinc-400 transition-colors">Distribute Group Room Key</p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-white hover:bg-white/5" onClick={handleClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="p-8 space-y-6">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-600 group-focus-within:text-indigo-400 transition-colors" />
                        <Input
                            placeholder="Search your connections..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-12 h-14 bg-[#0E0E10] border-[#1A1A1E] text-white rounded-[24px] font-bold focus:border-indigo-500/50 transition-all shadow-inner"
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
                    <div className="p-6 bg-[#0E0E10] border-t border-[#1A1A1E] flex items-center justify-between animate-in slide-in-from-bottom-2">
                        <span className="text-xs font-black uppercase tracking-widest text-indigo-400 px-2">
                            {selectedPubkeys.size} Selected
                        </span>
                        <Button
                            onClick={handleSendInvites}
                            disabled={isSending}
                            className="h-12 px-6 rounded-[20px] bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-600/20 transition-all"
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
    const keyPreview = `${pubkey.slice(0, 12)}...${pubkey.slice(-8)}`;
    const hasResolvedName = displayName !== `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;

    return (
        <div
            onClick={isAlreadyMember ? undefined : onToggle}
            className={cn(
                "flex items-center justify-between p-4 bg-[#0E0E10] border rounded-[24px] transition-all group backdrop-blur-sm",
                isAlreadyMember
                    ? "border-emerald-500/30 bg-emerald-500/5 cursor-not-allowed opacity-80"
                    : isSelected
                    ? "border-indigo-400/70 bg-indigo-500/10 shadow-lg shadow-indigo-500/20"
                    : "border-[#1A1A1E] hover:border-indigo-500/30 hover:bg-[#111115] cursor-pointer"
            )}
        >
            <div className="flex items-center gap-4">
                <UserAvatar pubkey={pubkey} size="md" className="rounded-2xl border border-white/5" />
                <div>
                    <p className="text-white font-black text-sm">{displayName}</p>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">
                        {hasResolvedName ? "Trusted connection" : "Unnamed connection"}
                    </p>
                    <p className="text-zinc-600 text-[10px] font-mono mt-1">{keyPreview}</p>
                </div>
            </div>
            {isAlreadyMember ? (
                <span className="text-[10px] font-black uppercase tracking-wider rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 px-3 py-1.5">
                    Already in this community.
                </span>
            ) : (
                <div className={cn(
                    "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all",
                    isSelected
                        ? "bg-indigo-500 border-indigo-500"
                        : "border-zinc-700 group-hover:border-zinc-500"
                )}>
                    {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                </div>
            )}
        </div>
    );
}
