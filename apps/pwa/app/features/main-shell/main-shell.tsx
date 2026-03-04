"use client";

import type React from "react";
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import AppShell from "@/app/components/app-shell";
import { useEnhancedDmController } from "@/app/features/messaging/hooks/use-enhanced-dm-controller";
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
import { AuthScreen } from "../auth/components/auth-screen";
import { installChatPerformanceDevTools } from "../messaging/dev/chat-performance-dev-tools";

const LAST_PAGE_STORAGE_KEY = "obscur-last-page";
const DEFAULT_VISIBLE_MESSAGES = 50;
const LOAD_EARLIER_STEP = 50;

function NostrMessengerContent() {
  const { t } = useTranslation();
  const identity = useIdentity();
  const { blocklist, peerTrust, requestsInbox } = useNetwork();

  const myPublicKeyHex = (identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null);
  const myPrivateKeyHex = identity.state.privateKeyHex || null;
  const { isLocked, unlock } = useAutoLock();

  const {
    selectedConversation, setSelectedConversation,
    unreadByConversationId, setUnreadByConversationId,
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
    hiddenChatIds, deleteConversation, clearHistory, unhideConversation,
    chatsUnreadCount,
    createdConnections, setCreatedConnections
  } = useMessaging();

  const { relayPool, relayStatus } = useRelay();
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

  const dmController = useEnhancedDmController({
    myPublicKeyHex, myPrivateKeyHex, pool: relayPool, blocklist, peerTrust, requestsInbox,
    onConnectionCreated: (pubkey) => {
      const cid = [myPublicKeyHex || '', pubkey].sort().join(':');
      setCreatedConnections(prev => {
        if (prev.some(c => c.id === cid)) return prev;
        return [...prev, {
          kind: 'dm',
          id: cid,
          pubkey: pubkey as PublicKeyHex,
          displayName: pubkey.slice(0, 8),
          lastMessage: '',
          unreadCount: 0,
          lastMessageTime: new Date()
        } as DmConversation];
      });
    }
  });

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
    const same = current.length === groupMembers.length &&
      groupMembers.every(pk => current.includes(pk));
    if (!same) {
      updateGroup({
        groupId: group.groupId,
        relayUrl: group.relayUrl,
        conversationId: group.id,
        updates: { memberPubkeys: [...groupMembers] }
      });
    }
  }, [groupMembers, selectedConversation?.id]);



  const socialGraph = useMemo(() => new SocialGraphService(relayPool), [relayPool]);

  // Feature hooks
  const { handleSendMessage, deleteMessage, toggleReaction } = useChatActions(dmController);
  const { handleRedeemInvite } = useInviteRedemption(dmController);
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
      const savedId = localStorage.getItem(`obscur-last-chat-${myPublicKeyHex}`);
      setRestoredChatId(savedId || "");
    }
  }, [hasHydrated, myPublicKeyHex, restoredChatId]);

  useEffect(() => {
    if (restoredChatId && !selectedConversation) {
      const found = allConversations.find(c => c.id === restoredChatId);
      if (found) {
        setSelectedConversation(found);
        setRestoredChatId("");
      }
    }
  }, [restoredChatId, allConversations, selectedConversation, setSelectedConversation]);

  const selectedConversationView = selectedConversation ? applyConnectionOverrides(selectedConversation, connectionOverridesByConnectionId) : null;
  const nowMs = useSyncExternalStore(subscribeNowMs, getNowMsSnapshot, getNowMsServerSnapshot);

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
    setSidebarTab(tab);
    localStorage.setItem(LAST_PAGE_STORAGE_KEY, JSON.stringify({ type: 'tab', id: tab }));
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
    return <div className="fixed inset-0 flex items-center justify-center bg-zinc-50 dark:bg-black z-[200]">Loading...</div>;
  }

  const hasStoredAccount = !!identity.state.stored;

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

  if (!hasStoredAccount && identity.state.status !== "unlocked") {
    return <AuthScreen />;
  }

  const visibleChatsList = filteredConversations.filter(c => !hiddenChatIds.includes(c.id));
  const accurateChatsUnreadCount = visibleChatsList.reduce((acc, c) => acc + (unreadByConversationId[c.id] ?? c.unreadCount), 0);

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
            requests={requestsInbox.state.items}
            pinnedChatIds={pinnedChatIds}
            togglePin={togglePin}
            hiddenChatIds={hiddenChatIds}
            deleteConversation={deleteConversation}
            clearHistory={clearHistory}
            onClearHistory={requestsInbox.clearHistory}
            onAcceptRequest={(pk) => {
              peerTrust.acceptPeer({ publicKeyHex: pk as PublicKeyHex });
              requestsInbox.setStatus({ peerPublicKeyHex: pk as PublicKeyHex, status: 'accepted' });

              void dmController.sendDm({
                peerPublicKeyInput: pk,
                plaintext: "Accepted",
                customTags: [['t', 'connection-accept']]
              });

              const cid = [myPublicKeyHex || '', pk].sort().join(':');
              const newConv: DmConversation = {
                kind: 'dm',
                id: cid,
                pubkey: pk as PublicKeyHex,
                displayName: pk.slice(0, 8),
                lastMessage: '',
                unreadCount: 0,
                lastMessageTime: new Date()
              };

              // Ensure it's in createdConnections
              setCreatedConnections(prev => {
                if (prev.some(c => c.id === cid)) return prev;
                return [...prev, newConv];
              });

              setSelectedConversation(newConv);
              updateSidebarTab("chats");
            }}
            onIgnoreRequest={(pk) => requestsInbox.remove({ peerPublicKeyHex: pk as PublicKeyHex })}
            onBlockRequest={(pk) => blocklist.addBlocked({ publicKeyInput: pk })}
            onSelectRequest={(pk) => {
              requestsInbox.markRead({ peerPublicKeyHex: pk as PublicKeyHex });
              const cid = [myPublicKeyHex || '', pk].sort().join(':');
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
                peerTrust.acceptPeer({ publicKeyHex: pk });
                requestsInbox.setStatus({ peerPublicKeyHex: pk, status: 'accepted' });

                void dmController.sendDm({
                  peerPublicKeyInput: pk,
                  plaintext: "Accepted",
                  customTags: [['t', 'connection-accept']]
                });
                updateSidebarTab("chats");

                const cid = [myPublicKeyHex || '', pk].sort().join(':');
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
    <Suspense fallback={null}>
      <NostrMessengerContent />
    </Suspense>
  );
}
