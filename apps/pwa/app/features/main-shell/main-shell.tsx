"use client";

import type React from "react";
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import AppShell from "@/app/components/app-shell";
import { useEnhancedDmController } from "@/app/features/messaging/hooks/use-enhanced-dm-controller";
import { useContacts } from "@/app/features/contacts/providers/contacts-provider";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { toast } from "@/app/components/ui/toast";
import { useTranslation } from "react-i18next";
import { ProfileSearchService } from "../search/services/profile-search-service";
import { SocialGraphService } from "../social-graph/services/social-graph-service";

import type {
  DmConversation,
  GroupConversation,
  Message,
} from "@/app/features/messaging/types";

import {
  applyContactOverrides,
} from "@/app/features/messaging/utils/logic";

import {
  subscribeNowMs,
  getNowMsSnapshot,
  getNowMsServerSnapshot
} from "@/app/features/messaging/utils/time";

import { Sidebar } from "@/app/features/messaging/components/sidebar";
import { ChatView } from "@/app/features/messaging/components/chat-view";
import { GroupSettingsSheet } from "@/app/features/groups/components/group-settings-sheet";
import { useAutoLock } from "@/app/features/settings/hooks/use-auto-lock";
import { useNip29Group } from "@/app/features/groups/hooks/use-nip29-group";
import { LockScreen } from "@/app/components/lock-screen";
import type { Passphrase } from "@dweb/crypto/passphrase";
import { EmptyConversationView } from "./components/empty-conversation-view";
import { PersistenceManager } from "./components/persistence-manager";
import { DevPanel } from "../dev-tools/components/dev-panel";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useGroups } from "@/app/features/groups/providers/group-provider";

import { useInviteRedemption } from "./hooks/use-invite-redemption";
import { useDeepLinks } from "./hooks/use-deep-links";
import { useCommandMessages } from "./hooks/use-command-messages";
import { useChatActions } from "./hooks/use-chat-actions";
import { useFilteredConversations } from "./hooks/use-filtered-conversations";
import { useAttachmentHandler } from "./hooks/use-attachment-handler";
import { useDmSync } from "./hooks/use-dm-sync";
import { useChatViewProps } from "./hooks/use-chat-view-props";

const LAST_PAGE_STORAGE_KEY = "obscur-last-page";
const DEFAULT_VISIBLE_MESSAGES = 50;
const LOAD_EARLIER_STEP = 50;

function NostrMessengerContent() {
  const { t } = useTranslation();
  const identity = useIdentity();
  const { blocklist, peerTrust, requestsInbox } = useContacts();

  const myPublicKeyHex = identity.state.publicKeyHex || null;
  const myPrivateKeyHex = identity.state.privateKeyHex || null;
  const { isLocked, unlock } = useAutoLock();

  const {
    selectedConversation, setSelectedConversation,
    unreadByConversationId,
    contactOverridesByContactId,
    setMessagesByConversationId, messagesByConversationId,
    visibleMessageCountByConversationId, setVisibleMessageCountByConversationId,
    replyTo, setReplyTo,
    pendingAttachments,
    pendingAttachmentPreviewUrls,
    isUploadingAttachment,
    attachmentError,
    hasHydrated, sidebarTab, setSidebarTab,
    messageInput, setMessageInput,
    searchQuery, setSearchQuery,
    isNewChatOpen, setIsNewChatOpen,
    isMediaGalleryOpen, setIsMediaGalleryOpen,
    lightboxIndex, setLightboxIndex,
    flashMessageId,
    pendingScrollTarget, setPendingScrollTarget,
    messageMenu, setMessageMenu,
    reactionPicker, setReactionPicker,
    chatsUnreadCount,
    createdContacts, setCreatedContacts
  } = useMessaging();

  const { relayPool, relayStatus } = useRelay();
  const {
    createdGroups, isNewGroupOpen, setIsNewGroupOpen,
    isGroupInfoOpen, setIsGroupInfoOpen,
  } = useGroups();

  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showWelcome] = useState(false);

  // Refs
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messageMenuRef = useRef<HTMLDivElement | null>(null);
  const reactionPickerRef = useRef<HTMLDivElement | null>(null);

  // No-op - moved to top

  const dmController = useEnhancedDmController({
    myPublicKeyHex, myPrivateKeyHex, pool: relayPool, blocklist, peerTrust, requestsInbox
  });

  const { state: groupState } = useNip29Group({
    pool: relayPool,
    relayUrl: selectedConversation?.kind === 'group' ? (selectedConversation as GroupConversation).relayUrl : '',
    groupId: selectedConversation?.kind === 'group' ? (selectedConversation as GroupConversation).groupId : '',
    myPublicKeyHex,
    myPrivateKeyHex,
    enabled: selectedConversation?.kind === 'group'
  });

  useEffect(() => {
    if (selectedConversation?.kind !== 'group' || !groupState.messages.length) return;

    setMessagesByConversationId(prev => {
      const existing = prev[selectedConversation.id] ?? [];
      const newMessages = groupState.messages
        .filter(m => !existing.some(em => em.id === m.id))
        .map(m => ({
          id: m.id,
          kind: 'user',
          content: m.content,
          timestamp: new Date(m.created_at * 1000),
          isOutgoing: m.pubkey === myPublicKeyHex,
          senderPubkey: m.pubkey as PublicKeyHex,
          status: 'delivered',
          reactions: {},
        } as Message));

      if (newMessages.length === 0) return prev;
      return {
        ...prev,
        [selectedConversation.id]: [...existing, ...newMessages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      };
    });
  }, [groupState.messages, selectedConversation, myPublicKeyHex, setMessagesByConversationId]);

  const socialGraph = useMemo(() => new SocialGraphService(relayPool), [relayPool]);

  // Feature hooks
  const { handleSendMessage, deleteMessage, toggleReaction } = useChatActions(dmController);
  const { handleRedeemInvite } = useInviteRedemption(dmController);
  useDeepLinks(handleRedeemInvite);
  useDmSync(dmController.state.messages, setMessagesByConversationId);
  useCommandMessages(dmController.state.messages, setMessagesByConversationId);
  const { allConversations, filteredConversations, messageSearchResults } = useFilteredConversations(
    createdContacts, createdGroups, contactOverridesByContactId, messagesByConversationId, searchQuery, peerTrust.isAccepted, myPublicKeyHex
  );
  const { pickAttachments, handleFilesSelected, removePendingAttachment, clearPendingAttachments } = useAttachmentHandler();

  const selectedConversationView = selectedConversation ? applyContactOverrides(selectedConversation, contactOverridesByContactId) : null;
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

  const {
    handleLoadEarlier,
    handleCopyMyPubkey,
    handleCopyChatLink,
    visibleMessages,
    rawMessagesCount,
    hasEarlierMessages,
    selectedConversationMediaItems
  } = useChatViewProps({
    selectedConversation,
    messagesByConversationId,
    visibleMessageCountByConversationId,
    setVisibleMessageCountByConversationId,
    myPublicKeyHex,
    DEFAULT_VISIBLE_MESSAGES,
    LOAD_EARLIER_STEP
  });

  const updateSidebarTab = (tab: "chats" | "requests") => {
    setSidebarTab(tab);
    localStorage.setItem(LAST_PAGE_STORAGE_KEY, JSON.stringify({ type: 'tab', id: tab }));
  };

  const isIdentityUnlocked = identity.state.status === "unlocked";
  const shouldShowLockScreen = (isLocked || identity.state.status === "locked") && !!identity.state.stored;

  if (identity.state.status === "loading") {
    return <div className="fixed inset-0 flex items-center justify-center bg-zinc-50 dark:bg-black z-[200]">Loading...</div>;
  }

  if (shouldShowLockScreen) {
    return <LockScreen publicKeyHex={identity.state.publicKeyHex ?? ""} isUnlocking={isUnlocking} onUnlock={handleUnlock} onForget={identity.forgetIdentity} />;
  }

  return (
    <AppShell
      hideSidebar={!isIdentityUnlocked}
      navBadgeCounts={{ "/": chatsUnreadCount }}
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
            onAcceptRequest={(pk) => {
              peerTrust.acceptPeer({ publicKeyHex: pk as PublicKeyHex });
              requestsInbox.setStatus({ peerPublicKeyHex: pk as PublicKeyHex, status: 'accepted' });

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

              // Ensure it's in createdContacts
              setCreatedContacts(prev => {
                if (prev.some(c => c.id === cid)) return prev;
                return [...prev, newConv];
              });

              setSelectedConversation(newConv);
              updateSidebarTab("chats");
            }}
            onIgnoreRequest={(pk) => requestsInbox.remove({ peerPublicKeyHex: pk as PublicKeyHex })}
            onBlockRequest={(pk) => blocklist.addBlocked({ publicKeyInput: pk })}
            onSelectRequest={(pk) => {
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
      <main className="flex flex-1 flex-col overflow-hidden bg-zinc-50 dark:bg-black">
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
            onToggleReaction={(id, emoji) => toggleReaction({ conversationId: selectedConversationView.id, messageId: id, emoji })}
            onRetryMessage={(m) => dmController.retryFailedMessage(m.id)}
            messageInput={messageInput}
            setMessageInput={setMessageInput}
            handleSendMessage={handleSendMessage}
            isUploadingAttachment={isUploadingAttachment}
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
            isMediaGalleryOpen={isMediaGalleryOpen}
            setIsMediaGalleryOpen={setIsMediaGalleryOpen}
            selectedConversationMediaItems={selectedConversationMediaItems}
            lightboxIndex={lightboxIndex}
            setLightboxIndex={setLightboxIndex}
            isPeerAccepted={peerTrust.isAccepted({ publicKeyHex: selectedConversationView.kind === 'dm' ? selectedConversationView.pubkey : '' as PublicKeyHex })}
            isInitiator={selectedConversationView.kind === 'dm' && !requestsInbox.state.items.some(i => i.peerPublicKeyHex === selectedConversationView.pubkey)}
            onAcceptPeer={() => {
              if (selectedConversationView.kind === 'dm') {
                const pk = selectedConversationView.pubkey;
                peerTrust.acceptPeer({ publicKeyHex: pk });
                requestsInbox.setStatus({ peerPublicKeyHex: pk, status: 'accepted' });
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
      <PersistenceManager />
      <DevPanel dmController={dmController} />

      {selectedConversation?.kind === 'group' && (
        <GroupSettingsSheet
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
