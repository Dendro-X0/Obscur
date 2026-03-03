"use client";

import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useGroups } from "@/app/features/groups/providers/group-provider";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { CreateGroupDialog, type GroupCreateInfo } from "@/app/features/groups/components/create-group-dialog";
import { NewChatDialog } from "@/app/features/messaging/components/new-chat-dialog";
import { GroupService } from "@/app/features/groups/services/group-service";
import { cryptoService } from "../../crypto/crypto-service";
import { roomKeyStore } from "../../crypto/room-key-store";
import { SocialGraphService } from "@/app/features/social-graph/services/social-graph-service";
import { ProfileSearchService } from "@/app/features/search/services/profile-search-service";
import type { DmConversation, GroupConversation, PublicKeyHex } from "@/app/features/messaging/types";
import { useEnhancedDmController } from "@/app/features/messaging/hooks/use-enhanced-dm-controller";
import { toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { deriveCommunityId } from "@/app/features/groups/utils/community-identity";

export function GlobalDialogManager() {
    const { t } = useTranslation();
    const identity = useIdentity();
    const { peerTrust, blocklist, requestsInbox } = useNetwork();
    const { relayPool } = useRelay();

    const {
        isNewChatOpen, setIsNewChatOpen,
        newChatPubkey, setNewChatPubkey,
        newChatDisplayName, setNewChatDisplayName,
        createdConnections, setCreatedConnections,
        setSelectedConversation,
        unhideConversation
    } = useMessaging();

    const {
        isNewGroupOpen, setIsNewGroupOpen,
        isCreatingGroup, setIsCreatingGroup,
        setCreatedGroups
    } = useGroups();

    const myPublicKeyHex = identity.state.publicKeyHex || null;
    const myPrivateKeyHex = identity.state.privateKeyHex || null;

    const dmController = useEnhancedDmController({
        myPublicKeyHex, myPrivateKeyHex, pool: relayPool, blocklist, peerTrust, requestsInbox
    });

    const socialGraph = React.useMemo(() => new SocialGraphService(relayPool), [relayPool]);
    const profileSearch = React.useMemo(() => new ProfileSearchService(relayPool, socialGraph, myPublicKeyHex || undefined), [relayPool, socialGraph, myPublicKeyHex]);

    const handleCreateChat = useCallback((explicitPubkey?: string) => {
        const targetPubkey = explicitPubkey || newChatPubkey;
        if (!targetPubkey) return;

        if (myPublicKeyHex && !peerTrust.isAccepted({ publicKeyHex: targetPubkey as PublicKeyHex })) {
            requestsInbox.setStatus({
                peerPublicKeyHex: targetPubkey as PublicKeyHex,
                status: 'pending',
                isOutgoing: true
            });
        }

        const existing = createdConnections.find(c => c.pubkey === targetPubkey);
        const newId = [myPublicKeyHex || '', targetPubkey].sort().join(':');

        unhideConversation(newId); // Ensure it is unhidden if previously hidden

        if (existing) {
            setSelectedConversation(existing);
        } else {
            const newConv: DmConversation = {
                kind: 'dm',
                id: newId,
                pubkey: targetPubkey as PublicKeyHex,
                displayName: newChatDisplayName || targetPubkey.slice(0, 8),
                lastMessage: '',
                unreadCount: 0,
                lastMessageTime: new Date()
            };
            setCreatedConnections(prev => [...prev, newConv]);
            setSelectedConversation(newConv);
        }
        setIsNewChatOpen(false);
        setNewChatPubkey("");
        setNewChatDisplayName("");
        toast.success(t("messaging.chatCreated", "Conversation started"));
    }, [newChatPubkey, newChatDisplayName, createdConnections, myPublicKeyHex, setSelectedConversation, setCreatedConnections, setIsNewChatOpen, setNewChatPubkey, setNewChatDisplayName, t, unhideConversation, requestsInbox, peerTrust]);

    const handleCreateGroup = useCallback(async (info: GroupCreateInfo) => {
        if (!myPrivateKeyHex || !myPublicKeyHex) {
            toast.error("Identity not unlocked");
            return;
        }
        setIsCreatingGroup(true);
        try {
            const { groupId, host, name, about, avatar, access } = info;
            const relayUrl = host.startsWith("ws") ? host : `wss://${host}`;
            const creatorPubkey = myPublicKeyHex;

            // 1. Generate and store Room Key (Essential for ALL Sealed Communities)
            const roomKeyHex = await cryptoService.generateRoomKey();
            await roomKeyStore.saveRoomKey(groupId, roomKeyHex);

            const metadata = {
                id: groupId,
                name,
                about,
                picture: avatar,
                access
            } as const;

            const groupService = new GroupService(myPublicKeyHex, myPrivateKeyHex);
            const createdEvent = await groupService.sendSealedCommunityCreated({
                groupId,
                roomKeyHex,
                metadata
            });

            const createdPayload = JSON.stringify(["EVENT", createdEvent]);
            if (typeof relayPool.publishToUrls === "function") {
                await relayPool.publishToUrls([relayUrl], createdPayload);
            } else if (typeof relayPool.publishToUrl === "function") {
                await relayPool.publishToUrl(relayUrl, createdPayload);
            } else if (typeof relayPool.publishToRelay === "function") {
                await relayPool.publishToRelay(relayUrl, createdPayload);
            } else {
                await relayPool.publishToAll(createdPayload);
            }

            const genesisEventId = createdEvent.id;
            const communityId = deriveCommunityId({ groupId, relayUrl, genesisEventId, creatorPubkey });

            // 2. Discoverability (Kind 39000 Hint)
            // If not invite-only, we publish a hint so others know where to look.
            if (access !== "invite-only") {
                // We publish the metadata as a public Kind 39000 but WITHOUT the room key.
                // In the future (Phase 4), we might include a Room Key for "open" groups.
                // For now, this just marks the community's presence on the relay.
                const metadataEvent = await groupService.hideMessage({ // Reusing logic for now or adding a specific one
                    groupId,
                    eventId: "manifest",
                    reason: JSON.stringify({ name, about, picture: avatar, access })
                });
                // Note: We need a proper metadata state event in GroupService. 
                // Since I removed the NIP-29 ones, I'll just skip this for Phase 1 as it's secondary.
            }

            const newGroup: GroupConversation = {
                kind: 'group',
                id: toGroupConversationId({ groupId, relayUrl, communityId }),
                communityId,
                genesisEventId,
                creatorPubkey,
                groupId,
                relayUrl,
                displayName: name,
                memberPubkeys: [myPublicKeyHex],
                lastMessage: 'Sealed community created locally',
                unreadCount: 0,
                lastMessageTime: new Date(),
                access,
                memberCount: 1,
                adminPubkeys: [myPublicKeyHex],
                avatar
            };

            setCreatedGroups(prev => [...prev, newGroup]);
            setSelectedConversation(newGroup);
            setIsNewGroupOpen(false);
            toast.success(t("groups.created", "Sealed Community created successfully"));
        } catch (error: any) {
            console.error("Community creation failed:", error);
            toast.error(error.message || "Failed to create community");
        } finally {
            setIsCreatingGroup(false);
        }
    }, [myPrivateKeyHex, myPublicKeyHex, relayPool, setCreatedGroups, setSelectedConversation, setIsNewGroupOpen, setIsCreatingGroup, t]);

    return (
        <>
            <NewChatDialog
                isOpen={isNewChatOpen}
                onClose={() => setIsNewChatOpen(false)}
                pubkey={newChatPubkey}
                setPubkey={setNewChatPubkey}
                displayName={newChatDisplayName}
                setDisplayName={setNewChatDisplayName}
                onCreate={handleCreateChat}
                verifyRecipient={dmController.verifyRecipient}
                searchProfiles={(query) => profileSearch.searchByName(query)}
                isAccepted={(pk) => peerTrust.isAccepted({ publicKeyHex: pk })}
                sendConnectionRequest={dmController.sendConnectionRequest}
            />
            <CreateGroupDialog
                isOpen={isNewGroupOpen}
                onClose={() => setIsNewGroupOpen(false)}
                onCreate={handleCreateGroup}
                isCreating={isCreatingGroup}
            />
        </>
    );
}
