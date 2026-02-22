"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Search, Loader2, Send, Users, UserCheck, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { toast } from "../../../components/ui/toast";
import { cn } from "../../../lib/cn";
import { useContacts } from "../../contacts/providers/contacts-provider";
import { useMessaging } from "../../messaging/providers/messaging-provider";
import { useRelay } from "../../relays/providers/relay-provider";
import { useIdentity } from "../../auth/hooks/use-identity";
import { useGroups } from "../providers/group-provider";
import { MessageQueue } from "../../messaging/lib/message-queue";
import type { Message } from "../../messaging/types";
import { GroupService } from "../services/group-service";
import type { GroupMetadata } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { UserAvatar } from "../../profile/components/user-avatar";
import { useProfileMetadata } from "../../profile/hooks/use-profile-metadata";

interface InviteContactsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: string;
    roomKeyHex: string;
    metadata: GroupMetadata;
}

export function InviteContactsDialog({
    isOpen,
    onClose,
    groupId,
    roomKeyHex,
    metadata
}: InviteContactsDialogProps) {
    const { t } = useTranslation();
    const { peerTrust } = useContacts();
    const { createdContacts, messagesByConversationId, setMessagesByConversationId } = useMessaging();
    const { relayPool } = useRelay();
    const { state: identityState } = useIdentity();
    const { createdGroups } = useGroups();

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPubkeys, setSelectedPubkeys] = useState<Set<string>>(new Set());
    const [isSending, setIsSending] = useState(false);

    const groupService = useRef<GroupService | null>(null);

    useEffect(() => {
        if (identityState.publicKeyHex && identityState.privateKeyHex) {
            groupService.current = new GroupService(
                identityState.publicKeyHex,
                identityState.privateKeyHex as any
            );
        }
    }, [identityState.publicKeyHex, identityState.privateKeyHex]);

    const filteredContacts = React.useMemo(() => {
        return peerTrust.state.acceptedPeers.filter((pk) => {
            const contact = createdContacts.find(c => c.kind === 'dm' && c.pubkey === pk);
            const searchStr = (contact?.displayName || pk).toLowerCase();
            return searchStr.includes(searchQuery.toLowerCase());
        });
    }, [peerTrust.state.acceptedPeers, createdContacts, searchQuery]);

    const handleToggleSelect = (pubkey: string) => {
        if (!selectedPubkeys.has(pubkey)) {
            const group = createdGroups.find(g => g.groupId === groupId);
            if (group?.memberPubkeys.includes(pubkey)) {
                toast.error(t("groups.alreadyMember", "This user is already a member of the group."));
                return;
            }

            const messages = messagesByConversationId[pubkey];
            if (messages) {
                for (let i = messages.length - 1; i >= 0; i--) {
                    const msg = messages[i];
                    if (msg.isOutgoing) {
                        try {
                            const parsed = JSON.parse(msg.content);
                            if (parsed.type === "community-invite" && parsed.groupId === groupId) {
                                toast.error(t("groups.spamWarning", "Please wait for this user's confirmation before sending another invite to avoid spam."));
                                return;
                            }
                        } catch (e) {
                            // ignore parsing errors
                        }
                    }
                }
            }
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
                const inviteEvent = await groupService.current!.distributeRoomKey({
                    recipientPubkey: pubkey as PublicKeyHex,
                    groupId,
                    roomKeyHex,
                    metadata
                });
                await relayPool.publishToAll(JSON.stringify(["EVENT", inviteEvent]));

                const myPublicKeyHex = identityState.publicKeyHex || '';
                const conversationId = [myPublicKeyHex, pubkey].sort().join(':');

                const inviteMessage: Message = {
                    id: inviteEvent.id,
                    conversationId,
                    kind: 'user',
                    content: JSON.stringify({
                        type: "community-invite",
                        groupId,
                        roomKey: roomKeyHex,
                        metadata
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

            // Update UI optimistically
            setMessagesByConversationId(prev => {
                const next = { ...prev };
                Object.entries(newMessages).forEach(([pubkey, msg]) => {
                    next[pubkey] = [...(next[pubkey] ?? []), msg];
                });
                return next;
            });

            toast.success(`Invites sent securely to ${selectedPubkeys.size} contacts`);
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

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md bg-[#0A0A0B] border-white/10 p-0 overflow-hidden rounded-[32px]">
                <DialogHeader className="p-8 pb-0">
                    <DialogTitle className="text-white font-black text-2xl flex items-center gap-3">
                        <Users className="h-6 w-6 text-indigo-400" />
                        Invite Connections
                    </DialogTitle>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-2 hover:text-zinc-400 transition-colors">Distribute Group Room Key</p>
                </DialogHeader>

                <div className="p-8 space-y-6">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-600 group-focus-within:text-indigo-400 transition-colors" />
                        <Input
                            placeholder="Search your contacts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-12 h-14 bg-[#0E0E10] border-[#1A1A1E] text-white rounded-[24px] font-bold focus:border-indigo-500/50 transition-all shadow-inner"
                        />
                    </div>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredContacts.length === 0 ? (
                            <div className="py-12 flex flex-col items-center justify-center text-center opacity-30">
                                <UserCheck className="h-10 w-10 text-zinc-700 mb-4" />
                                <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">No contacts found</p>
                            </div>
                        ) : (
                            filteredContacts.map(pk => (
                                <ContactRow
                                    key={pk}
                                    pubkey={pk}
                                    isSelected={selectedPubkeys.has(pk)}
                                    onToggle={() => handleToggleSelect(pk)}
                                />
                            ))
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
            </DialogContent>
        </Dialog>
    );
}

function ContactRow({ pubkey, isSelected, onToggle }: { pubkey: string, isSelected: boolean, onToggle: () => void }) {
    const { createdContacts } = useMessaging();
    const contact = createdContacts.find(c => c.kind === 'dm' && c.pubkey === pubkey);
    const metadata = useProfileMetadata(pubkey);
    const displayName = contact?.displayName || metadata?.displayName || `${pubkey.slice(0, 8)}...`;

    return (
        <div
            onClick={onToggle}
            className={cn(
                "flex items-center justify-between p-4 bg-[#0E0E10] border rounded-[24px] cursor-pointer transition-all group",
                isSelected
                    ? "border-indigo-500/50 bg-indigo-500/5 shadow-lg shadow-indigo-500/10"
                    : "border-[#1A1A1E] hover:border-indigo-500/30"
            )}
        >
            <div className="flex items-center gap-4">
                <UserAvatar pubkey={pubkey} size="md" className="rounded-2xl border border-white/5" />
                <div>
                    <p className="text-white font-black text-sm">{displayName}</p>
                    <p className="text-zinc-600 text-[10px] font-mono mt-0.5">{pubkey.slice(0, 16)}...</p>
                </div>
            </div>
            <div className={cn(
                "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all",
                isSelected
                    ? "bg-indigo-500 border-indigo-500"
                    : "border-zinc-700 group-hover:border-zinc-500"
            )}>
                {isSelected && <X className="h-3.5 w-3.5 text-white rotate-45" style={{ transform: "rotate(0deg)" }} />}
            </div>
        </div>
    );
}
