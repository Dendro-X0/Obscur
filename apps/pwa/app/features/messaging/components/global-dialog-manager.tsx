"use client";

import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useGroups } from "@/app/features/groups/providers/group-provider";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useRelayPoolRef } from "@/app/features/relays/hooks/use-relay-pool-ref";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import {
    CreateGroupDialog,
    type CommunityCreateWaitPhase,
    type GroupCreateInfo,
} from "@/app/features/groups/components/create-group-dialog";
import { resolveInitialStewardPubkeysForCreate } from "@/app/features/groups/services/community-steward-policy";
import {
    isManagedWorkspaceRelayGateBlocking,
    resolveManagedWorkspaceRelayGate,
} from "@/app/features/groups/services/community-mode-contract";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { NewChatDialog } from "@/app/features/messaging/components/new-chat-dialog";
import { GroupService } from "@/app/features/groups/services/group-service";
import { cryptoService } from "../../crypto/crypto-service";
import { roomKeyStore } from "../../crypto/room-key-store";
import { useProfileSearchServiceRef } from "@/app/features/search/hooks/use-profile-search-service-ref";
import type { GroupConversation, PublicKeyHex } from "@/app/features/messaging/types";
import { useEnhancedDmController } from "@/app/features/messaging/hooks/use-enhanced-dm-controller";
import { useRequestTransport } from "@/app/features/messaging/hooks/use-request-transport";
import { toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { deriveCommunityId } from "@/app/features/groups/utils/community-identity";
import { toDmConversationId } from "@/app/features/messaging/utils/dm-conversation-id";
import { createDmConversation } from "@/app/features/messaging/utils/create-dm-conversation";
import { upsertDmConversationInList } from "@/app/features/messaging/utils/dm-conversation-list-merge";
import { logAppEvent } from "@/app/shared/log-app-event";
import { describeCoordinationFetchError } from "@/app/features/groups/services/community-coordination-fetch";
import { resolveUserFacingErrorMessage } from "@/app/features/relays/services/relay-publish-user-copy";
import { dispatchGroupInviteReceived } from "@/app/features/profiles/services/profile-bus-dispatch";
import { assessWorkspaceCommunityTrustAsync } from "@/app/features/groups/services/community-trust-policy";
import {
    ensureWorkspaceMembershipSyncMode,
    publishWorkspaceMemberJoin,
} from "@/app/features/groups/services/community-workspace-membership";
import { hasWritableCommunityRelayTransport } from "@/app/features/groups/services/community-relay-transport";
import { isCoordinationOnlyWorkspaceDevMode } from "@/app/features/groups/services/community-dev-flags";
import { LOCAL_DEV_RELAY_URL } from "@/app/features/relays/hooks/use-relay-list";

const RELAY_PUBLISH_TIMEOUT_MS = 12_000;

const publishCommunityEventWithTimeout = async (
    relayPool: {
        publishToUrls?: (urls: ReadonlyArray<string>, payload: string) => Promise<unknown>;
        publishToUrl?: (url: string, payload: string) => Promise<unknown>;
        publishToRelay?: (url: string, payload: string) => Promise<unknown>;
        publishToAll?: (payload: string) => Promise<unknown>;
    },
    relayUrl: string,
    payload: string,
): Promise<void> => {
    const publishPromise = (async (): Promise<void> => {
        if (typeof relayPool.publishToUrls === "function") {
            await relayPool.publishToUrls([relayUrl], payload);
            return;
        }
        if (typeof relayPool.publishToUrl === "function") {
            await relayPool.publishToUrl(relayUrl, payload);
            return;
        }
        if (typeof relayPool.publishToRelay === "function") {
            await relayPool.publishToRelay(relayUrl, payload);
            return;
        }
        if (typeof relayPool.publishToAll === "function") {
            await relayPool.publishToAll(payload);
        }
    })();
    const timeoutPromise = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("relay_publish_timeout")), RELAY_PUBLISH_TIMEOUT_MS);
    });
    await Promise.race([publishPromise, timeoutPromise]);
};

const DEFAULT_DM_DISPLAY_NAME = "Unknown contact";

export function GlobalDialogManager() {
    const { t } = useTranslation();
    const identity = useIdentity();
    const { peerTrust, blocklist, requestsInbox } = useNetwork();
    const { relayPool } = useRelay();
    const relayPoolRef = useRelayPoolRef(relayPool);
    const relayList = useRelayList({ publicKeyHex: identity.state.publicKeyHex || null });

    const {
        isNewChatOpen, setIsNewChatOpen,
        newChatPubkey, setNewChatPubkey,
        newChatDisplayName, setNewChatDisplayName,
        createdConnections,
        setCreatedConnections,
        setSelectedConversation,
        unhideConversation
    } = useMessaging();

    const {
        isNewGroupOpen, setIsNewGroupOpen,
        isCreatingGroup, setIsCreatingGroup,
        addGroup
    } = useGroups();

    const myPublicKeyHex = identity.state.publicKeyHex || null;
    const myPrivateKeyHex = identity.state.privateKeyHex || null;
    const [createWaitPhase, setCreateWaitPhase] = useState<CommunityCreateWaitPhase | null>(null);

    const dmController = useEnhancedDmController({
        myPublicKeyHex,
        myPrivateKeyHex,
        pool: relayPool,
        blocklist,
        peerTrust,
        requestsInbox,
        autoSubscribeIncoming: false,
        enableIncomingTransport: false,
    });
    const requestTransport = useRequestTransport({
        dmController,
        peerTrust,
        requestsInbox,
    });

    const { searchByName: searchProfilesByName } = useProfileSearchServiceRef(
        relayPool,
        myPublicKeyHex ?? undefined,
    );

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
        const newId = toDmConversationId({ myPublicKeyHex: myPublicKeyHex || "", peerPublicKeyHex: targetPubkey });
        if (!newId) {
            toast.error("Invalid conversation identity. Please verify the target public key.");
            return;
        }

        unhideConversation(newId); // Ensure it is unhidden if previously hidden

        if (existing) {
            setSelectedConversation(existing);
        } else {
            const newConv = createDmConversation({
                myPublicKeyHex: myPublicKeyHex || "",
                peerPublicKeyHex: targetPubkey as PublicKeyHex,
                displayName: newChatDisplayName || DEFAULT_DM_DISPLAY_NAME,
            });
            if (!newConv) {
                toast.error("Invalid conversation identity. Please verify the target public key.");
                return;
            }
            setCreatedConnections((previous) => upsertDmConversationInList(previous, newConv));
            setSelectedConversation(newConv);
        }
        setIsNewChatOpen(false);
        setNewChatPubkey("");
        setNewChatDisplayName("");
        toast.success(t("messaging.chatCreated", "Conversation started"));
    }, [newChatPubkey, newChatDisplayName, createdConnections, myPublicKeyHex, setCreatedConnections, setSelectedConversation, setIsNewChatOpen, setNewChatPubkey, setNewChatDisplayName, t, unhideConversation, requestsInbox, peerTrust]);

    const handleCreateGroup = useCallback(async (info: GroupCreateInfo) => {
        if (!myPrivateKeyHex || !myPublicKeyHex) {
            toast.error("Identity is locked. Unlock it, then create the community again.");
            return;
        }
        setIsCreatingGroup(true);
        setCreateWaitPhase("local");
        try {
            const { groupId, host, name, about, avatar, access, relayCapabilityTier } = info;
            const relayUrl = (() => {
                const trimmedHost = host.trim();
                if (!trimmedHost && isCoordinationOnlyWorkspaceDevMode()) {
                    return LOCAL_DEV_RELAY_URL;
                }
                return trimmedHost.startsWith("ws") ? trimmedHost : `wss://${trimmedHost}`;
            })();
            const communityMode = "managed_workspace" as const;
            const creatorPubkey = myPublicKeyHex;

            const trust = await assessWorkspaceCommunityTrustAsync({
                communityRelayUrl: relayUrl,
                enabledRelayUrls: relayList.state.relays.map((relay) => relay.url),
            });
            if (!trust.allowed) {
                toast.error(trust.userMessage);
                return;
            }

            const relayTransportReady = hasWritableCommunityRelayTransport(relayUrl);
            ensureWorkspaceMembershipSyncMode();
            if (relayTransportReady) {
                relayList.addRelay({ url: relayUrl });
                const pool = relayPoolRef.current;
                if (typeof pool.addTransientRelay === "function") {
                    pool.addTransientRelay(relayUrl);
                }
            }

            logAppEvent({
                name: "groups.community_creation_mode_selected",
                level: "info",
                scope: { feature: "groups", action: "community_create" },
                context: {
                    publicKeySuffix: myPublicKeyHex.slice(-8),
                    groupId,
                    relayUrl,
                    access,
                    communityMode,
                    relayCapabilityTier,
                },
            });

            // 1. Generate and store Room Key (Essential for ALL Sealed Communities)
            const roomKeyHex = await cryptoService.generateRoomKey();
            await roomKeyStore.saveRoomKey(groupId, roomKeyHex);
            setCreateWaitPhase("relay");

            const stewardPubkeys = resolveInitialStewardPubkeysForCreate({
                communityMode,
                creatorPublicKeyHex: creatorPubkey as PublicKeyHex,
            });
            const metadata = {
                id: groupId,
                name,
                about,
                picture: avatar,
                access,
                communityMode,
                relayCapabilityTier,
                ...(stewardPubkeys.length > 0 ? { stewardPubkeys } : {}),
            } as const;

            const groupService = new GroupService(myPublicKeyHex, myPrivateKeyHex);
            const createdEvent = await groupService.sendSealedCommunityCreated({
                groupId,
                roomKeyHex,
                metadata
            });

            if (relayTransportReady) {
                const createdPayload = JSON.stringify(["EVENT", createdEvent]);
                try {
                    await publishCommunityEventWithTimeout(relayPoolRef.current, relayUrl, createdPayload);
                } catch (error) {
                    logAppEvent({
                        name: "groups.community_creation_relay_publish_failed",
                        level: "warn",
                        scope: { feature: "groups", action: "community_create" },
                        context: {
                            relayUrl,
                            error: error instanceof Error ? error.message : "publish_failed",
                        },
                    });
                    toast.error(t(
                        "groups.relayPublishFailed",
                        "Community saved locally, but relay publish timed out or failed. Check the relay host and try Reconcile membership later.",
                    ));
                }
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
                avatar,
                communityMode,
                relayCapabilityTier,
            };

            addGroup(newGroup, { allowRevive: true });
            dispatchGroupInviteReceived(newGroup);
            setCreateWaitPhase("directory");

            const joinPublish = await publishWorkspaceMemberJoin({
                communityId,
                memberPubkey: myPublicKeyHex as PublicKeyHex,
                actorPubkey: myPublicKeyHex as PublicKeyHex,
                actorPrivateKeyHex: myPrivateKeyHex,
            });
            if (!joinPublish.success) {
                const detail = joinPublish.errorMessage?.trim();
                const coordinationHint = describeCoordinationFetchError(detail);
                toast.error(
                    t(
                        "groups.coordinationJoinPublishFailedDetail",
                        "Community created locally, but coordination membership publish failed. {{hint}} Retry Reconcile membership after coordination is healthy.",
                        { hint: coordinationHint },
                    ),
                );
            }

            if (relayTransportReady) {
                setSelectedConversation(newGroup);
            }
            setIsNewGroupOpen(false);
            toast.success(t("groups.created", "Workspace community created"));
        } catch (error: unknown) {
            console.error("Community creation failed:", error);
            const rawMessage = error instanceof Error ? error.message.trim() : "";
            const fallback = rawMessage === "Failed to fetch"
                ? describeCoordinationFetchError("coordination_unreachable")
                : "Failed to create community. Verify relay host and try again.";
            toast.error(resolveUserFacingErrorMessage(error, fallback));
        } finally {
            setIsCreatingGroup(false);
            setCreateWaitPhase(null);
        }
    }, [
        myPrivateKeyHex,
        myPublicKeyHex,
        relayList.state.relays,
        relayPoolRef,
        addGroup,
        setSelectedConversation,
        setIsNewGroupOpen,
        setIsCreatingGroup,
        t,
    ]);

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
                searchProfiles={searchProfilesByName}
                isAccepted={(pk) => peerTrust.isAccepted({ publicKeyHex: pk })}
                sendConnectionRequest={requestTransport.sendRequest}
            />
            {isNewGroupOpen ? (
                <CreateGroupDialog
                    isOpen
                    onClose={() => setIsNewGroupOpen(false)}
                    onCreate={handleCreateGroup}
                    isCreating={isCreatingGroup}
                    createWaitPhase={createWaitPhase}
                />
            ) : null}
        </>
    );
}
