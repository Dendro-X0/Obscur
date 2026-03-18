"use client";

import type React from "react";
import { Suspense, startTransition, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import AppShell from "@/app/components/app-shell";
import { useRuntimeMessagingTransportOwnerController } from "@/app/features/messaging/providers/runtime-messaging-transport-owner-provider";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { toast } from "@dweb/ui-kit";
import { useTranslation } from "react-i18next";
import { ProfileSearchService } from "../search/services/profile-search-service";
import { SocialGraphService } from "../social-graph/services/social-graph-service";

import type {
  DmConversation,
  GroupConversation,
  Message,
  SendDirectMessageParams,
  SendDirectMessageResult,
} from "@/app/features/messaging/types";

import {
  applyConnectionOverrides,
  extractAttachmentsFromContent
} from "@/app/features/messaging/utils/logic";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";

import {
  subscribeNowMs,
  getNowMsSnapshot,
  getNowMsServerSnapshot
} from "@/app/features/messaging/utils/time";

import { Sidebar } from "@/app/features/messaging/components/sidebar";
import { ChatView } from "@/app/features/messaging/components/chat-view";
import { GroupManagementDialog } from "@/app/features/groups/components/group-management-dialog";
import { useAutoLock } from "@/app/features/settings/hooks/use-auto-lock";
import { useSealedCommunity, type GroupMessageEvent } from "@/app/features/groups/hooks/use-sealed-community";
import { LockScreen } from "@/app/components/lock-screen";
import type { Passphrase } from "@dweb/crypto/passphrase";
import { EmptyConversationView } from "./components/empty-conversation-view";
import { DevPanel } from "../dev-tools/components/dev-panel";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useGroups } from "@/app/features/groups/providers/group-provider";
import { PinLockService } from "@/app/features/auth/services/pin-lock-service";

import { useInviteRedemption } from "./hooks/use-invite-redemption";
import { useDeepLinks } from "./hooks/use-deep-links";
import { useCommandMessages } from "./hooks/use-command-messages";
import { useChatActions } from "./hooks/use-chat-actions";
import { useFilteredConversations } from "./hooks/use-filtered-conversations";
import { useAttachmentHandler } from "./hooks/use-attachment-handler";
import { useDmSync } from "./hooks/use-dm-sync";
import { useChatViewProps } from "./hooks/use-chat-view-props";
import { installChatPerformanceDevTools } from "../messaging/dev/chat-performance-dev-tools";
import { toDmConversationId } from "@/app/features/messaging/utils/dm-conversation-id";
import { createDmConversation } from "@/app/features/messaging/utils/create-dm-conversation";
import { resolveConversationByToken } from "@/app/features/messaging/utils/conversation-target";
import { getIncomingInboxRequests } from "@/app/features/messaging/services/request-inbox-view";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { useRequestTransport } from "@/app/features/messaging/hooks/use-request-transport";
import { configureInviteRequestStateBridge, configureInviteRequestTransportBridge } from "@/app/features/invites/utils/invite-manager";
import type { Connection as LegacyInviteConnection, ConnectionRequest as LegacyInviteRequest } from "@/app/features/invites/utils/types";
import { useAccountSyncSnapshot } from "@/app/features/account-sync/hooks/use-account-sync-snapshot";
import { resolveAccountSyncUiPolicy } from "@/app/features/account-sync/services/account-sync-ui-policy";
import { AppLoadingScreen } from "@/app/components/app-loading-screen";
import { usePeerLastActiveByPeer } from "@/app/features/messaging/hooks/use-peer-last-active-by-peer";

const LAST_PAGE_STORAGE_KEY = "obscur-last-page";
const getLastPageStorageKey = (): string => getScopedStorageKey(LAST_PAGE_STORAGE_KEY);
const DEFAULT_VISIBLE_MESSAGES = 50;
const LOAD_EARLIER_STEP = 50;

function NostrMessengerContent() {
  const { t } = useTranslation();
  const identity = useIdentity();
  const { blocklist, peerTrust, requestsInbox, presence } = useNetwork();

  const myPublicKeyHex = (identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null);
  const myPrivateKeyHex = identity.state.privateKeyHex || null;
  const { isLocked, unlock } = useAutoLock();

  const {
    selectedConversation, setSelectedConversation,
    unreadByConversationId, setUnreadByConversationId,
    lastViewedByConversationId,
    connectionOverridesByConnectionId,
    visibleMessageCountByConversationId, setVisibleMessageCountByConversationId,
    replyTo, setReplyTo,
    pendingAttachments,
    pendingAttachmentPreviewUrls,
    isUploadingAttachment,
    uploadStage,
    attachmentError,
    hasHydrated, sidebarTab, setSidebarTab,
    messageInput, setMessageInput,
    isProcessingMedia, mediaProcessingProgress,
    searchQuery, setSearchQuery,
    isNewChatOpen, setIsNewChatOpen,
    isMediaGalleryOpen, setIsMediaGalleryOpen,
    lightboxIndex, setLightboxIndex,
    flashMessageId,
    pendingScrollTarget, setPendingScrollTarget,
    messageMenu, setMessageMenu,
    reactionPicker, setReactionPicker,
    pinnedChatIds, togglePin,
    hiddenChatIds, hideConversation, deleteConversation, clearHistory, unhideConversation,
    chatsUnreadCount,
    createdConnections, setCreatedConnections
  } = useMessaging();

  const { relayPool, relayStatus } = useRelay();
  const accountSyncSnapshot = useAccountSyncSnapshot();
  const {
    createdGroups, isNewGroupOpen, setIsNewGroupOpen,
    isGroupInfoOpen, setIsGroupInfoOpen, updateGroup,
  } = useGroups();

  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showWelcome] = useState(false);

  useEffect(() => {
    installChatPerformanceDevTools();
  }, []);

  // Refs
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messageMenuRef = useRef<HTMLDivElement | null>(null);
  const reactionPickerRef = useRef<HTMLDivElement | null>(null);

  // No-op - moved to top

  const dmController = useRuntimeMessagingTransportOwnerController();
  const peerLastActiveByPeerPubkey = usePeerLastActiveByPeer(myPublicKeyHex as PublicKeyHex | null);

  useEffect(() => {
    if (!myPublicKeyHex) {
      return;
    }
    setCreatedConnections((prev) => {
      const acceptedPeers = peerTrust.state.acceptedPeers
        .filter((pubkey) => pubkey !== myPublicKeyHex)
        .sort();
      const previousByPubkey = new Map(prev.map((connection) => [connection.pubkey, connection] as const));
      const derivedConnections = acceptedPeers
        .map((pubkey) => {
          const existing = previousByPubkey.get(pubkey);
          const derived = createDmConversation({
            myPublicKeyHex,
            peerPublicKeyHex: pubkey,
            displayName: existing?.displayName || pubkey.slice(0, 8),
          });
          if (!derived) {
            return null;
          }
          return existing ? { ...existing, id: derived.id, pubkey } : derived;
        })
        .filter((connection): connection is DmConversation => connection !== null)
        .sort((left, right) => {
          const byTime = right.lastMessageTime.getTime() - left.lastMessageTime.getTime();
          if (byTime !== 0) {
            return byTime;
          }
          return left.id.localeCompare(right.id);
        });

      if (derivedConnections.length !== prev.length) {
        return derivedConnections;
      }

      for (let index = 0; index < derivedConnections.length; index += 1) {
        const nextConnection = derivedConnections[index];
        const previousConnection = prev[index];
        if (!previousConnection) {
          return derivedConnections;
        }
        if (
          previousConnection.id !== nextConnection.id
          || previousConnection.pubkey !== nextConnection.pubkey
          || previousConnection.displayName !== nextConnection.displayName
          || previousConnection.lastMessage !== nextConnection.lastMessage
          || previousConnection.unreadCount !== nextConnection.unreadCount
          || previousConnection.lastMessageTime.getTime() !== nextConnection.lastMessageTime.getTime()
        ) {
          return derivedConnections;
        }
      }

      return prev;
    });
  }, [myPublicKeyHex, peerTrust.state.acceptedPeers, setCreatedConnections]);

  const { state: groupState, members: groupMembers } = useSealedCommunity({
    pool: relayPool,
    relayUrl: selectedConversation?.kind === 'group' ? (selectedConversation as GroupConversation).relayUrl : '',
    groupId: selectedConversation?.kind === 'group' ? (selectedConversation as GroupConversation).groupId : '',
    communityId: selectedConversation?.kind === 'group' ? (selectedConversation as GroupConversation).communityId : undefined,
    myPublicKeyHex,
    myPrivateKeyHex,
    enabled: selectedConversation?.kind === 'group',
    initialMembers: selectedConversation?.kind === 'group' ? (selectedConversation as GroupConversation).memberPubkeys as ReadonlyArray<PublicKeyHex> : undefined
  });

  // Sync live member list back to the group provider so persistence and UI stay current
  useEffect(() => {
    if (selectedConversation?.kind !== 'group' || groupMembers.length === 0) return;
    const group = selectedConversation as GroupConversation;
    const current = group.memberPubkeys ?? [];
    const merged = Array.from(new Set([...current, ...groupMembers]));
    const nextMembers = merged.filter((pubkey) => (
      !groupState.leftMembers.includes(pubkey) && !groupState.expelledMembers.includes(pubkey)
    ));
    const same = current.length === nextMembers.length &&
      nextMembers.every(pk => current.includes(pk));
    if (!same) {
      updateGroup({
        groupId: group.groupId,
        relayUrl: group.relayUrl,
        conversationId: group.id,
        updates: {
          memberPubkeys: nextMembers,
          memberCount: nextMembers.length
        }
      });
    }
  }, [groupMembers, groupState.expelledMembers, groupState.leftMembers, selectedConversation?.id, updateGroup]);



  const socialGraph = useMemo(() => new SocialGraphService(relayPool), [relayPool]);

  // Feature hooks
  const { handleSendMessage, deleteMessage, toggleReaction } = useChatActions(dmController);
  const requestTransport = useRequestTransport({
    dmController,
    peerTrust,
    requestsInbox,
  });
  const inviteStateBridge = useMemo(() => {
    const toLegacyRequest = (item: Readonly<{
      peerPublicKeyHex: PublicKeyHex;
      lastMessagePreview: string;
      lastReceivedAtUnixSeconds: number;
      status?: "pending" | "accepted" | "declined" | "canceled";
      isOutgoing?: boolean;
    }>): LegacyInviteRequest => {
      const matchedConnection = createdConnections.find(
        (entry) => entry.kind === "dm" && entry.pubkey === item.peerPublicKeyHex
      );
      const fallbackName = matchedConnection?.displayName || `User ${item.peerPublicKeyHex.slice(0, 8)}`;
      const timestampMs = item.lastReceivedAtUnixSeconds * 1000;
      return {
        id: `shared:${item.peerPublicKeyHex}`,
        type: item.isOutgoing ? "outgoing" : "incoming",
        senderPublicKey: item.isOutgoing ? (myPublicKeyHex as PublicKeyHex) : (item.peerPublicKeyHex as PublicKeyHex),
        recipientPublicKey: item.isOutgoing ? (item.peerPublicKeyHex as PublicKeyHex) : (myPublicKeyHex as PublicKeyHex),
        profile: {
          publicKey: item.peerPublicKeyHex as PublicKeyHex,
          displayName: fallbackName,
          timestamp: timestampMs,
          signature: "shared-runtime-bridge",
        },
        message: item.lastMessagePreview || undefined,
        status: item.status === "canceled" ? "cancelled" : (item.status ?? "pending"),
        createdAt: new Date(timestampMs),
      };
    };

    return {
      listIncoming: async (): Promise<ReadonlyArray<LegacyInviteRequest>> => {
        return requestsInbox.state.items
          .filter((item) => !item.isOutgoing && item.status === "pending")
          .map(toLegacyRequest);
      },
      listOutgoing: async (): Promise<ReadonlyArray<LegacyInviteRequest>> => {
        return requestsInbox.state.items
          .filter((item) => item.isOutgoing && item.status === "pending")
          .map(toLegacyRequest);
      },
      accept: async (request: LegacyInviteRequest): Promise<LegacyInviteConnection> => {
        const outcome = await requestTransport.acceptIncomingRequest({
          peerPublicKeyHex: request.senderPublicKey,
          plaintext: request.message || "Accepted",
        });
        if (outcome.status !== "ok" && outcome.status !== "partial") {
          throw new Error(outcome.message || "Failed to accept connection request");
        }
        return {
          id: request.senderPublicKey,
          publicKey: request.senderPublicKey,
          displayName: request.profile.displayName || `User ${request.senderPublicKey.slice(0, 8)}`,
          avatar: request.profile.avatar,
          bio: request.profile.bio,
          trustLevel: "neutral",
          groups: [],
          addedAt: new Date(),
          metadata: {
            source: "manual",
            notes: request.message,
          },
        };
      },
      decline: async (request: LegacyInviteRequest, block?: boolean): Promise<void> => {
        const outcome = await requestTransport.declineIncomingRequest({
          peerPublicKeyHex: request.senderPublicKey,
          plaintext: request.message || "Declined",
        });
        if (block) {
          peerTrust.mutePeer({ publicKeyHex: request.senderPublicKey });
        }
        if (outcome.status === "failed") {
          throw new Error(outcome.message || "Failed to decline connection request");
        }
      },
      cancel: async (request: LegacyInviteRequest): Promise<void> => {
        const outcome = await requestTransport.cancelOutgoingRequest({
          peerPublicKeyHex: request.recipientPublicKey,
          plaintext: request.message || "Canceled",
        });
        if (outcome.status === "failed") {
          throw new Error(outcome.message || "Failed to cancel connection request");
        }
      },
    };
  }, [createdConnections, myPublicKeyHex, peerTrust, requestTransport, requestsInbox]);
  useEffect(() => {
    configureInviteRequestTransportBridge(async ({ peerPublicKeyHex, introMessage }) => {
      const outcome = await requestTransport.sendRequest({
        peerPublicKeyHex,
        introMessage,
      });
      return {
        status: outcome.status,
        message: outcome.message,
      };
    });
    return () => {
      configureInviteRequestTransportBridge(null);
    };
  }, [requestTransport]);
  useEffect(() => {
    if (!myPublicKeyHex) {
      configureInviteRequestStateBridge(null);
      return;
    }
    configureInviteRequestStateBridge(inviteStateBridge);
    return () => {
      configureInviteRequestStateBridge(null);
    };
  }, [inviteStateBridge, myPublicKeyHex]);
  const { handleRedeemInvite } = useInviteRedemption(requestTransport);
  useDeepLinks(handleRedeemInvite);
  useDmSync(
    dmController.state.messages,
    selectedConversation?.id || null,
    setUnreadByConversationId,
    dmController.state.status === "ready"
  );
  useCommandMessages(dmController.state.messages);
  const { allConversations, filteredConversations, messageSearchResults } = useFilteredConversations(
    createdConnections, createdGroups, connectionOverridesByConnectionId, searchQuery,
    (params) => {
      if (peerTrust.isAccepted(params)) return true;
      const rs = requestsInbox.getRequestStatus({ peerPublicKeyHex: params.publicKeyHex as PublicKeyHex });
      return !!(rs?.isOutgoing && (rs.status === 'pending' || !rs.status));
    },
    myPublicKeyHex
  );
  const { pickAttachments, handleFilesSelected, removePendingAttachment, clearPendingAttachments } = useAttachmentHandler();

  const [restoredChatId, setRestoredChatId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated || !myPublicKeyHex) return;
    if (restoredChatId === null) {
      const scopedKey = getScopedStorageKey(`obscur-last-chat-${myPublicKeyHex}`);
      const savedId = localStorage.getItem(scopedKey) ?? localStorage.getItem(`obscur-last-chat-${myPublicKeyHex}`);
      setRestoredChatId(savedId || "");
    }
  }, [hasHydrated, myPublicKeyHex, restoredChatId]);

  useEffect(() => {
    if (restoredChatId && !selectedConversation) {
      const resolved = resolveConversationByToken({
        token: restoredChatId,
        groups: createdGroups,
        connections: createdConnections,
      });
      if (resolved) {
        setSelectedConversation(resolved);
        if (resolved.kind === "dm") {
          unhideConversation(resolved.id);
        }
        setRestoredChatId("");
      }
    }
  }, [restoredChatId, selectedConversation, setSelectedConversation, createdGroups, createdConnections, unhideConversation]);

  const selectedConversationView = selectedConversation ? applyConnectionOverrides(selectedConversation, connectionOverridesByConnectionId) : null;
  const nowMs = useSyncExternalStore(subscribeNowMs, getNowMsSnapshot, getNowMsServerSnapshot);
  const interactionByConversationId = useMemo(() => {
    const map: Record<string, Readonly<{ lastActiveAtMs?: number; lastViewedAtMs?: number }>> = {};
    allConversations.forEach((conversation) => {
      if (conversation.kind !== "dm") {
        return;
      }
      const lastActiveAtMs = peerLastActiveByPeerPubkey[conversation.pubkey];
      const lastViewedAtMs = lastViewedByConversationId[conversation.id];
      if (lastActiveAtMs || lastViewedAtMs) {
        map[conversation.id] = {
          ...(lastActiveAtMs ? { lastActiveAtMs } : {}),
          ...(lastViewedAtMs ? { lastViewedAtMs } : {}),
        };
      }
    });
    return map;
  }, [allConversations, lastViewedByConversationId, peerLastActiveByPeerPubkey]);

  const handleUnlock = async (passphrase: string) => {
    setIsUnlocking(true);
    try {
      await identity.unlockIdentity({ passphrase: passphrase as Passphrase });
      unlock();
      return true;
    } catch (error) {
      return false;
    } finally {
      setIsUnlocking(false);
    }
  };

  const storedPubkey: string | null = identity.state.stored?.publicKeyHex ?? null;
  const hasPin: boolean = storedPubkey ? PinLockService.hasPin(storedPubkey) : false;

  const handleUnlockPin = async (pin: string): Promise<boolean> => {
    if (!storedPubkey) {
      return false;
    }
    setIsUnlocking(true);
    try {
      const unlocked = await PinLockService.unlockWithPin({ publicKeyHex: storedPubkey, pin });
      if (!unlocked.ok) {
        return false;
      }
      await identity.unlockWithPrivateKeyHex({ privateKeyHex: unlocked.privateKeyHex as any });
      unlock();
      return true;
    } catch {
      return false;
    } finally {
      setIsUnlocking(false);
    }
  };

  const {
    handleLoadEarlier,
    handleCopyMyPubkey,
    handleCopyChatLink,
    visibleMessages,
    rawMessagesCount,
    hasEarlierMessages,
    selectedConversationMediaItems,
    pendingEventCount
  } = useChatViewProps({
    selectedConversation,
    myPublicKeyHex
  });
  const updateSidebarTab = (tab: "chats" | "requests") => {
    startTransition(() => setSidebarTab(tab));
    localStorage.setItem(getLastPageStorageKey(), JSON.stringify({ type: 'tab', id: tab }));
  };

  // Clear unread marks when switching to invitations tab
  useEffect(() => {
    if (sidebarTab === "requests" && requestsInbox.state.items.some(i => i.unreadCount > 0)) {
      requestsInbox.markAllRead();
    }
  }, [sidebarTab, requestsInbox.markAllRead, requestsInbox.state.items]);

  const isIdentityUnlocked = identity.state.status === "unlocked";
  const shouldShowLockScreen = (isLocked || identity.state.status === "locked") && !!identity.state.stored;

  if (identity.state.status === "loading") {
    return <AppLoadingScreen title="Restoring identity" detail="Unlocking profile context..." />;
  }

  if (shouldShowLockScreen) {
    return (
      <LockScreen
        publicKeyHex={identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? ""}
        username={identity.state.stored?.username}
        isUnlocking={isUnlocking}
        onUnlock={handleUnlock}
        hasPin={hasPin}
        onUnlockPin={handleUnlockPin}
        onForget={identity.forgetIdentity}
      />
    );
  }

  const accountSyncUiPolicy = resolveAccountSyncUiPolicy({
    isIdentityUnlocked,
    snapshot: accountSyncSnapshot,
  });

  const visibleChatsList = filteredConversations.filter((conversation) => (
    conversation.kind === "group" || !hiddenChatIds.includes(conversation.id)
  ));
  const accurateChatsUnreadCount = visibleChatsList.reduce((acc, c) => {
    if (selectedConversation?.id === c.id) {
      return acc;
    }
    return acc + (unreadByConversationId[c.id] ?? c.unreadCount);
  }, 0);

  return (
    <AppShell
      hideSidebar={!isIdentityUnlocked}
      navBadgeCounts={{ "/": accurateChatsUnreadCount }}
      sidebarContent={
        isIdentityUnlocked ? (
          <Sidebar
            isNewChatOpen={isNewChatOpen}
            setIsNewChatOpen={setIsNewChatOpen}
            isNewGroupOpen={isNewGroupOpen}
            setIsNewGroupOpen={setIsNewGroupOpen}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchInputRef={searchInputRef}
            hasHydrated={hasHydrated}
            filteredConversations={filteredConversations}
            selectedConversation={selectedConversation}
            unreadByConversationId={unreadByConversationId}
            nowMs={nowMs}
            messageSearchResults={messageSearchResults}
            allConversations={allConversations}
            setPendingScrollTarget={setPendingScrollTarget}
            activeTab={sidebarTab}
            setActiveTab={updateSidebarTab}
            selectConversation={setSelectedConversation}
            interactionByConversationId={interactionByConversationId}
            requests={getIncomingInboxRequests(requestsInbox.state.items)}
            pinnedChatIds={pinnedChatIds}
            togglePin={togglePin}
            hiddenChatIds={hiddenChatIds}
            hideConversation={hideConversation}
            deleteConversation={deleteConversation}
            clearHistory={clearHistory}
            onClearHistory={requestsInbox.clearHistory}
            isPeerOnline={(publicKeyHex) => presence.isPeerOnline(publicKeyHex)}
            onAcceptRequest={(pk) => {
              const requestEventId = requestsInbox.state.items.find(
                (item) => item.peerPublicKeyHex === (pk as PublicKeyHex) && !item.isOutgoing
              )?.eventId;
              void requestTransport.acceptIncomingRequest({
                peerPublicKeyHex: pk as PublicKeyHex,
                requestEventId,
              })
                .then((outcome) => {
                  if (outcome.status === "failed" || outcome.status === "queued") {
                    toast.warning("Request acceptance is pending relay confirmation.");
                    return;
                  }
                  toast.success("Request accepted.");
                });

              const cid = toDmConversationId({ myPublicKeyHex: myPublicKeyHex || "", peerPublicKeyHex: pk });
              if (!cid) return;
              const newConv: DmConversation = {
                kind: 'dm',
                id: cid,
                pubkey: pk as PublicKeyHex,
                displayName: pk.slice(0, 8),
                lastMessage: '',
                unreadCount: 0,
                lastMessageTime: new Date()
              };

              setSelectedConversation(newConv);
              updateSidebarTab("chats");
            }}
            onIgnoreRequest={(pk) => requestsInbox.remove({ peerPublicKeyHex: pk as PublicKeyHex })}
            onBlockRequest={(pk) => blocklist.addBlocked({ publicKeyInput: pk })}
            onSelectRequest={(pk) => {
              requestsInbox.markRead({ peerPublicKeyHex: pk as PublicKeyHex });
              const cid = toDmConversationId({ myPublicKeyHex: myPublicKeyHex || "", peerPublicKeyHex: pk });
              if (!cid) return;
              setSelectedConversation({
                kind: 'dm',
                id: cid,
                pubkey: pk as PublicKeyHex,
                displayName: pk.slice(0, 8),
                lastMessage: '',
                unreadCount: 0,
                lastMessageTime: new Date()
              });
            }}
          />
        ) : null
      }
    >
      {accountSyncUiPolicy.showRestoreProgress ? (
        <div className="border-b border-sky-500/20 bg-sky-500/10 px-4 py-2 text-sm text-sky-800 dark:text-sky-200">
          <span className="font-semibold">Account Restore:</span> {accountSyncSnapshot.message}. You can keep using the app while relay recovery runs.
        </div>
      ) : null}
      {accountSyncUiPolicy.showMissingSharedDataWarning ? (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
          <span className="font-semibold">Account Restore Warning:</span> Shared account data was not found on relays yet. Local identity access remains active.
        </div>
      ) : null}
      <main className="flex flex-1 flex-col min-h-0 overflow-hidden bg-transparent">
        {!selectedConversationView ? (
          <EmptyConversationView
            onNewChat={() => setIsNewChatOpen(true)}
            showWelcome={showWelcome}
            myPublicKeyHex={myPublicKeyHex ?? ""}
            relayStatus={relayStatus}
            onCopyMyPubkey={handleCopyMyPubkey}
            onCopyChatLink={handleCopyChatLink}
          />
        ) : (
          <ChatView
            conversation={selectedConversationView}
            isPeerOnline={
              selectedConversationView.kind === "dm"
                ? presence.isPeerOnline(selectedConversationView.pubkey)
                : undefined
            }
            interactionStatus={interactionByConversationId[selectedConversationView.id]}
            messages={visibleMessages}
            rawMessagesCount={rawMessagesCount}
            hasHydrated={hasHydrated}
            hasEarlierMessages={hasEarlierMessages}
            onLoadEarlier={handleLoadEarlier}
            nowMs={nowMs}
            flashMessageId={flashMessageId}
            onCopyPubkey={(pk) => {
              navigator.clipboard.writeText(pk);
              toast.success(t("messaging.pubkeyCopied"));
            }}
            onOpenMedia={() => setIsMediaGalleryOpen(true)}
            onOpenInfo={selectedConversationView.kind === 'group' ? () => setIsGroupInfoOpen(true) : undefined}
            groupAdmins={groupState.admins}
            messageMenu={messageMenu}
            setMessageMenu={setMessageMenu}
            messageMenuRef={messageMenuRef}
            onCopyText={(text) => {
              navigator.clipboard.writeText(text);
              toast.success(t("messaging.textCopied"));
            }}
            onCopyAttachmentUrl={(url) => {
              navigator.clipboard.writeText(url);
              toast.success(t("messaging.urlCopied"));
            }}
            onReferenceMessage={(m) => setReplyTo({ messageId: m.id, previewText: m.content })}
            onDeleteMessage={(id) => deleteMessage({ conversationId: selectedConversationView.id, messageId: id })}
            reactionPicker={reactionPicker}
            setReactionPicker={setReactionPicker}
            reactionPickerRef={reactionPickerRef}
            onToggleReaction={(message, emoji) => toggleReaction({ conversationId: selectedConversationView.id, message, emoji })}
            onRetryMessage={(m) => dmController.retryFailedMessage(m.id)}
            messageInput={messageInput}
            setMessageInput={setMessageInput}
            handleSendMessage={handleSendMessage}
            onSendDirectMessage={async (params: SendDirectMessageParams): Promise<SendDirectMessageResult> => {
              if (dmController) {
                return await dmController.sendDm({
                  peerPublicKeyInput: params.recipientPubkey,
                  plaintext: params.content,
                  replyTo: params.replyTo
                });
              }
              return { success: false, messageId: '', relayResults: [], error: 'DM Controller not ready' };
            }}
            isUploadingAttachment={isUploadingAttachment}
            uploadStage={uploadStage}
            pendingAttachments={pendingAttachments}
            pendingAttachmentPreviewUrls={pendingAttachmentPreviewUrls}
            attachmentError={attachmentError}
            replyTo={replyTo}
            setReplyTo={setReplyTo}
            onPickAttachments={(files) => files && handleFilesSelected(files)}
            onSelectFiles={pickAttachments}
            removePendingAttachment={removePendingAttachment}
            clearPendingAttachment={clearPendingAttachments}
            relayStatus={relayStatus}
            composerTextareaRef={composerTextareaRef}
            isProcessingMedia={isProcessingMedia}
            mediaProcessingProgress={mediaProcessingProgress}
            isMediaGalleryOpen={isMediaGalleryOpen}
            setIsMediaGalleryOpen={setIsMediaGalleryOpen}
            selectedConversationMediaItems={selectedConversationMediaItems}
            lightboxIndex={lightboxIndex}
            setLightboxIndex={setLightboxIndex}
            pendingEventCount={pendingEventCount}
            isPeerAccepted={(() => {
              if (selectedConversationView.kind !== 'dm') return true;
              const pk = selectedConversationView.pubkey;
              if (peerTrust.isAccepted({ publicKeyHex: pk })) return true;
              const rs = requestsInbox.getRequestStatus({ peerPublicKeyHex: pk });
              if (rs?.status === "accepted") return true;
              return !!(rs?.isOutgoing && (rs.status === 'pending' || !rs.status));
            })()}
            isInitiator={(() => {
              if (selectedConversationView.kind !== 'dm') return false;
              const pk = selectedConversationView.pubkey;
              const rs = requestsInbox.getRequestStatus({ peerPublicKeyHex: pk });
              if (rs?.isOutgoing && (rs.status === 'pending' || !rs.status)) return true;
              return !requestsInbox.state.items.some(i => i.peerPublicKeyHex === pk);
            })()}
            onAcceptPeer={() => {
              if (selectedConversationView.kind === 'dm') {
                const pk = selectedConversationView.pubkey;
                const requestEventId = requestsInbox.state.items.find(
                  (item) => item.peerPublicKeyHex === pk && !item.isOutgoing
                )?.eventId;
                const existingRequestState = requestsInbox.getRequestStatus({ peerPublicKeyHex: pk });
                if (!peerTrust.isAccepted({ publicKeyHex: pk }) && existingRequestState?.status === "accepted") {
                  peerTrust.acceptPeer({ publicKeyHex: pk });
                }
                if (peerTrust.isAccepted({ publicKeyHex: pk })) {
                  updateSidebarTab("chats");
                  return;
                }
                void requestTransport.acceptIncomingRequest({ peerPublicKeyHex: pk, requestEventId })
                  .then((outcome) => {
                    if (outcome.status === "failed" || outcome.status === "queued") {
                      toast.warning("Request acceptance is pending relay confirmation.");
                      return;
                    }
                    toast.success("Request accepted.");
                  });
                updateSidebarTab("chats");

                const cid = toDmConversationId({ myPublicKeyHex: myPublicKeyHex || "", peerPublicKeyHex: pk });
                if (!cid) return;
                const existing = allConversations.find(c => c.id === cid);
                if (existing) {
                  setSelectedConversation(existing);
                } else {
                  setSelectedConversation({
                    kind: 'dm',
                    id: cid,
                    pubkey: pk as PublicKeyHex,
                    displayName: selectedConversationView.displayName || pk.slice(0, 8),
                    lastMessage: '',
                    unreadCount: 0,
                    lastMessageTime: new Date()
                  });
                }
              }
            }}
            onBlockPeer={() => selectedConversationView.kind === 'dm' && blocklist.addBlocked({ publicKeyInput: selectedConversationView.pubkey })}
          />
        )}
      </main>
      <DevPanel dmController={dmController} />

      {selectedConversation?.kind === 'group' && (
        <GroupManagementDialog
          isOpen={isGroupInfoOpen}
          onClose={() => setIsGroupInfoOpen(false)}
          group={selectedConversation as GroupConversation}
          pool={relayPool}
          myPublicKeyHex={myPublicKeyHex}
          myPrivateKeyHex={myPrivateKeyHex}
        />
      )}
    </AppShell>
  );
}

export default function NostrMessenger() {
  return (
    <Suspense fallback={<AppLoadingScreen title="Loading messages" detail="Rebuilding chat workspace..." />}>
      <NostrMessengerContent />
    </Suspense>
  );
}
