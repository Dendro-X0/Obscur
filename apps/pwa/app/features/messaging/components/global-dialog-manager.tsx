"use client";

import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/app/components/ui/toast";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useGroups } from "@/app/features/groups/providers/group-provider";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useContacts } from "@/app/features/contacts/providers/contacts-provider";
import { CreateGroupDialog, type GroupCreateInfo } from "@/app/features/groups/components/create-group-dialog";
import { NewChatDialog } from "@/app/features/messaging/components/new-chat-dialog";
import { GroupService } from "@/app/features/groups/services/group-service";
import { SocialGraphService } from "@/app/features/social-graph/services/social-graph-service";
import { ProfileSearchService } from "@/app/features/search/services/profile-search-service";
import type { DmConversation, GroupConversation, PublicKeyHex } from "@/app/features/messaging/types";
import { useEnhancedDmController } from "@/app/features/messaging/hooks/use-enhanced-dm-controller";

export function GlobalDialogManager() {
    const { t } = useTranslation();
    const identity = useIdentity();
    const { peerTrust, blocklist, requestsInbox } = useContacts();
    const { relayPool } = useRelay();

    const {
        isNewChatOpen, setIsNewChatOpen,
        newChatPubkey, setNewChatPubkey,
        newChatDisplayName, setNewChatDisplayName,
        createdContacts, setCreatedContacts,
        setSelectedConversation
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

        const existing = createdContacts.find(c => c.pubkey === targetPubkey);
        if (existing) {
            setSelectedConversation(existing);
        } else {
            const newId = [myPublicKeyHex || '', targetPubkey].sort().join(':');
            const newConv: DmConversation = {
                kind: 'dm',
                id: newId,
                pubkey: targetPubkey as PublicKeyHex,
                displayName: newChatDisplayName || targetPubkey.slice(0, 8),
                lastMessage: '',
                unreadCount: 0,
                lastMessageTime: new Date()
            };
            setCreatedContacts(prev => [...prev, newConv]);
            setSelectedConversation(newConv);
        }
        setIsNewChatOpen(false);
        setNewChatPubkey("");
        setNewChatDisplayName("");
        toast.success(t("messaging.chatCreated", "Conversation started"));
    }, [newChatPubkey, newChatDisplayName, createdContacts, myPublicKeyHex, setSelectedConversation, setCreatedContacts, setIsNewChatOpen, setNewChatPubkey, setNewChatDisplayName, t]);

    const handleCreateGroup = useCallback(async (info: GroupCreateInfo) => {
        if (!myPrivateKeyHex || !myPublicKeyHex) {
            toast.error("Identity not unlocked");
            return;
        }
        setIsCreatingGroup(true);
        try {
            const { groupId, host, name, about, picture } = info;
            const relayUrl = host.startsWith("ws") ? host : `wss://${host}`;

            relayPool.addTransientRelay(relayUrl);
            await relayPool.waitForConnection(3000);

            const groupService = new GroupService(myPublicKeyHex, myPrivateKeyHex);

            const createEvent = await groupService.createGroup({ groupId, relayUrl });
            const createResult = await relayPool.publishToRelay(relayUrl, JSON.stringify(["EVENT", createEvent]));
            if (!createResult.success) {
                throw new Error(`Failed to publish group creation: ${createResult.error}`);
            }

            const metadataEvent = await groupService.updateMetadata({
                groupId,
                metadata: { name, about, picture, access: info.access }
            });
            await relayPool.publishToRelay(relayUrl, JSON.stringify(["EVENT", metadataEvent]));

            const newGroup: GroupConversation = {
                kind: 'group',
                id: `group:${groupId}:${relayUrl}`,
                groupId,
                relayUrl,
                displayName: name,
                memberPubkeys: [myPublicKeyHex],
                lastMessage: 'Group created',
                unreadCount: 0,
                lastMessageTime: new Date()
            };
            setCreatedGroups(prev => [...prev, newGroup]);
            setSelectedConversation(newGroup);
            setIsNewGroupOpen(false);
            toast.success(t("groups.created", "Group created successfully"));
        } catch (error: any) {
            console.error("Group creation failed:", error);
            toast.error(error.message || "Failed to create group");
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
