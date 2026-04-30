"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    Search,
    UserPlus,
    Loader2,
    X,
    Send,
    Users as InviteIcon,
    RotateCcw
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@dweb/ui-kit";
import { toast } from "../../../components/ui/toast";
import { cn } from "../../../lib/cn";
import { ProfileSearchService, type ProfileSearchResult } from "../../search/services/profile-search-service";
import { useRelay } from "../../relays/providers/relay-provider";
import { useIdentity } from "../../auth/hooks/use-identity";
import { GroupService } from "../services/group-service";
import type { GroupMetadata } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { messageBus } from "../../messaging/services/message-bus";
import { MessageQueue } from "../../messaging/lib/message-queue";
import type { Message } from "../../messaging/types";
import { toDmConversationId } from "../../messaging/utils/dm-conversation-id";

interface InviteMemberDialogProps {
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

export function InviteMemberDialog({
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
}: InviteMemberDialogProps) {
    const { t } = useTranslation();
    const { relayPool: pool } = useRelay();
    const { state: identityState } = useIdentity();

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<ProfileSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [sendingInviteTo, setSendingInviteTo] = useState<string | null>(null);

    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const searchService = useRef<ProfileSearchService | null>(null);
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
        if (pool && identityState.publicKeyHex) {
            searchService.current = new ProfileSearchService(
                pool as any,
                undefined,
                identityState.publicKeyHex
            );
            groupService.current = new GroupService(
                identityState.publicKeyHex,
                identityState.privateKeyHex as any
            );
        }
    }, [pool, identityState.publicKeyHex, identityState.privateKeyHex]);

    const handleSearch = (val: string) => {
        setQuery(val);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (val.length < 3) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        searchTimeoutRef.current = setTimeout(async () => {
            if (!searchService.current) return;
            const searchResults = await searchService.current.searchByName(val);
            setResults(searchResults);
            setIsSearching(false);
        }, 500);
    };

    const handleSendInvite = async (user: ProfileSearchResult) => {
        if (!groupService.current) return;

        if (isAlreadyMember(user.pubkey)) {
            return;
        }

        setSendingInviteTo(user.pubkey);
        try {
            const scopedRelayUrl = relayUrl || pool.connections.find((c: { url: string }) => c.url)?.url;
            const inviteEvent = await groupService.current.distributeRoomKey({
                recipientPubkey: user.pubkey as PublicKeyHex,
                groupId,
                roomKeyHex,
                metadata,
                relayUrl: scopedRelayUrl,
                communityId,
                genesisEventId,
                creatorPubkey
            });
            await pool.publishToAll(JSON.stringify(["EVENT", inviteEvent]));

            // Persist locally for sender visibility
            const messageId = inviteEvent.id;
            const myPublicKeyHex = identityState.publicKeyHex || '';
            const conversationId = toDmConversationId({ myPublicKeyHex, peerPublicKeyHex: user.pubkey });
            if (!conversationId) {
                toast.error("Invite sent, but local message view could not be linked to a valid DM thread.");
                return;
            }

            const inviteMessage: Message = {
                id: messageId,
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
                recipientPubkey: user.pubkey as PublicKeyHex,
            };

            const mq = new MessageQueue(identityState.publicKeyHex!);
            await mq.persistMessage(inviteMessage as any);

            // Update UI optimistically via message bus
            messageBus.emitNewMessage(conversationId, inviteMessage);

            // Show success toast with user feedback
            toast.success(`Invite sent to ${user.displayName || user.name || 'user'}`);

            // Close dialog after successful invite
            onClose();
        } catch (error) {
            console.error("Failed to send invite:", error);
            toast.error("Failed to distribute room key. Encryption error.");
        } finally {
            setSendingInviteTo(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md bg-[#0A0A0B] border border-white/10 p-0 overflow-hidden rounded-[32px] shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="p-8 pb-0">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-white font-black text-2xl flex items-center gap-3">
                                <UserPlus className="h-6 w-6 text-indigo-400" />
                                Secure Propagation
                            </h2>
                            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-2">Distribute Room Key via NIP-17</p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-white hover:bg-white/5" onClick={onClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="p-8 space-y-6">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-600 group-focus-within:text-indigo-400 transition-colors" />
                        <Input
                            placeholder="Identify peer by name or pubkey..."
                            value={query}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-12 h-14 bg-[#0E0E10] border-[#1A1A1E] text-white rounded-2xl font-bold focus:border-indigo-500/50 transition-all shadow-inner"
                        />
                        {isSearching && (
                            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-indigo-500/50" />
                        )}
                    </div>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {results.map((user) => {
                            const alreadyMember = isAlreadyMember(user.pubkey);
                            return (
                                <div
                                    key={user.pubkey}
                                    className={cn(
                                        "flex items-center justify-between p-4 bg-[#0E0E10] border rounded-[24px] transition-all group",
                                        alreadyMember
                                            ? "border-emerald-500/30 bg-emerald-500/5 opacity-80"
                                            : "border-[#1A1A1E] hover:border-indigo-500/30"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-12 w-12 border border-white/5 shadow-lg">
                                            <AvatarImage src={user.picture} />
                                            <AvatarFallback className="font-black bg-zinc-800 text-zinc-400">
                                                {(user.displayName || user.name || "?").slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-white font-black text-sm">{user.displayName || user.name || 'Unknown'}</p>
                                            <p className="text-zinc-600 text-[10px] uppercase tracking-[0.14em] mt-0.5">Identity hidden</p>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => handleSendInvite(user)}
                                        disabled={sendingInviteTo === user.pubkey || alreadyMember}
                                        className={cn(
                                            "h-10 px-5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                                            alreadyMember
                                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 cursor-not-allowed"
                                                : sendingInviteTo === user.pubkey
                                                    ? "bg-zinc-800 text-zinc-500"
                                                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20"
                                        )}
                                    >
                                        {alreadyMember ? (
                                            "Already in this community."
                                        ) : sendingInviteTo === user.pubkey ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <>
                                                <Send className="h-3 w-3 mr-2" />
                                                Send Invite
                                            </>
                                        )}
                                    </Button>
                                </div>
                            );
                        })}

                        {query.length >= 3 && results.length === 0 && !isSearching && (
                            <div className="py-12 flex flex-col items-center justify-center text-center opacity-30">
                                <Search className="h-10 w-10 text-zinc-700 mb-4" />
                                <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">No peers located</p>
                            </div>
                        )}

                        {query.length < 3 && (
                            <div className="py-12 flex flex-col items-center justify-center text-center opacity-20">
                                <InviteIcon className="h-10 w-10 text-zinc-700 mb-4" />
                                <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Search for connections</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
