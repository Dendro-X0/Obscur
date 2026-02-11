"use client";

import type React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { AppShell } from "@/app/components/app-shell";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { useEnhancedDmController } from "@/app/features/messaging/hooks/use-enhanced-dm-controller";
import { useBlocklist } from "@/app/features/contacts/hooks/use-blocklist";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { usePeerTrust } from "@/app/features/contacts/hooks/use-peer-trust";
import { useRequestsInbox } from "@/app/features/messaging/hooks/use-requests-inbox";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { toast } from "@/app/components/ui/toast";
import { useTranslation } from "react-i18next";
import { ProfileSearchService } from "../search/services/profile-search-service";
import { SocialGraphService } from "../social-graph/services/social-graph-service";

import type {
  Conversation,
  DmConversation,
  GroupConversation,
  Message,
  ReplyTo,
  MediaItem,
  MessagesByConversationId,
} from "@/app/features/messaging/types";

import {
  applyContactOverrides,
  isVisibleUserMessage,
} from "@/app/features/messaging/utils/logic";

import {
  subscribeNowMs,
  getNowMsSnapshot,
  getNowMsServerSnapshot
} from "@/app/features/messaging/utils/time";

import {
  createContactId,
} from "@/app/features/messaging/utils/ids";

import { Sidebar } from "@/app/features/messaging/components/sidebar";
import { ChatView } from "@/app/features/messaging/components/chat-view";
import { NewChatDialog } from "@/app/features/messaging/components/new-chat-dialog";
import { CreateGroupDialog, type GroupCreateInfo } from "@/app/features/groups/components/create-group-dialog";
import { GroupSettingsSheet } from "@/app/features/groups/components/group-settings-sheet";
import { GroupService } from "@/app/features/groups/services/group-service";
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
const PROFILE_STORAGE_PREFIX = "dweb.nostr.pwa.profile";
const LEGACY_PROFILE_STORAGE_KEY = "dweb.nostr.pwa.profile";
const DEFAULT_VISIBLE_MESSAGES = 50;
const LOAD_EARLIER_STEP = 50;
const DEFAULT_PROFILE_USERNAME = "Anon";
const ONBOARDING_DISMISSED_STORAGE_KEY = "dweb.nostr.pwa.ui.onboardingDismissed";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const getProfileStorageKey = (publicKeyHex: string): string => `${PROFILE_STORAGE_PREFIX}.${publicKeyHex}`;

function NostrMessengerContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const identity = useIdentity();
  const blocklist = useBlocklist({ publicKeyHex: identity.state.publicKeyHex ?? null });
  const peerTrust = usePeerTrust({ publicKeyHex: identity.state.publicKeyHex ?? null });
  const requestsInbox = useRequestsInbox({ publicKeyHex: identity.state.publicKeyHex ?? null });
  const { isLocked, unlock } = useAutoLock();

  const {
    selectedConversation, setSelectedConversation,
    unreadByConversationId, setUnreadByConversationId,
    contactOverridesByContactId, setContactOverridesByContactId,
    setMessagesByConversationId, messagesByConversationId,
    visibleMessageCountByConversationId, setVisibleMessageCountByConversationId,
    replyTo, setReplyTo,
    pendingAttachments, setPendingAttachments,
    pendingAttachmentPreviewUrls, setPendingAttachmentPreviewUrls,
    isUploadingAttachment, setIsUploadingAttachment,
    attachmentError, setAttachmentError,
    hasHydrated, sidebarTab, setSidebarTab,
    messageInput, setMessageInput,
    searchQuery, setSearchQuery,
    isNewChatOpen, setIsNewChatOpen,
    newChatPubkey, setNewChatPubkey,
    newChatDisplayName, setNewChatDisplayName,
    isMediaGalleryOpen, setIsMediaGalleryOpen,
    lightboxIndex, setLightboxIndex,
    flashMessageId, setFlashMessageId,
    pendingScrollTarget, setPendingScrollTarget,
    messageMenu, setMessageMenu,
    reactionPicker, setReactionPicker,
    chatsUnreadCount,
    createdContacts, setCreatedContacts
  } = useMessaging();

  const { relayList, relayPool, relayStatus } = useRelay();
  const {
    createdGroups, setCreatedGroups, isNewGroupOpen, setIsNewGroupOpen,
    isCreatingGroup, setIsCreatingGroup, isGroupInfoOpen, setIsGroupInfoOpen,
    newGroupName, setNewGroupName, newGroupMemberPubkeys, setNewGroupMemberPubkeys
  } = useGroups();

  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Refs
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messageMenuRef = useRef<HTMLDivElement | null>(null);
  const reactionPickerRef = useRef<HTMLDivElement | null>(null);

  const myPublicKeyHex = identity.state.status === "unlocked" ? identity.state.publicKeyHex ?? null : null;
  const myPrivateKeyHex = identity.state.status === "unlocked" ? identity.state.privateKeyHex ?? null : null;

  const dmController = useEnhancedDmController({
    myPublicKeyHex, myPrivateKeyHex, pool: relayPool, blocklist, peerTrust, requestsInbox
  });

  const profileSearch = useMemo(() => new ProfileSearchService(relayPool), [relayPool]);

  // Feature hooks
  const { handleSendMessage, deleteMessage, toggleReaction } = useChatActions(dmController);
  const { inviteRedemption, handleRedeemInvite } = useInviteRedemption(dmController);
  useDeepLinks(handleRedeemInvite);
  useDmSync(dmController.state.messages, setMessagesByConversationId);
  useCommandMessages(dmController.state.messages, setMessagesByConversationId);
  const { allConversations, filteredConversations, messageSearchResults } = useFilteredConversations(
    createdContacts, createdGroups, contactOverridesByContactId, messagesByConversationId, searchQuery, peerTrust.isAccepted
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

  const handleCreateChat = useCallback(() => {
    if (!newChatPubkey) return;
    const existing = createdContacts.find(c => c.pubkey === newChatPubkey);
    if (existing) {
      setSelectedConversation(existing);
    } else {
      const newId = [myPublicKeyHex || '', newChatPubkey].sort().join(':');
      const newConv: DmConversation = {
        kind: 'dm',
        id: newId,
        pubkey: newChatPubkey as PublicKeyHex,
        displayName: newChatDisplayName || newChatPubkey.slice(0, 8),
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
  }, [newChatPubkey, newChatDisplayName, createdContacts, myPublicKeyHex, setSelectedConversation, setCreatedContacts, setIsNewChatOpen, setNewChatPubkey, setNewChatDisplayName]);

  const handleCreateGroup = useCallback(async (info: GroupCreateInfo) => {
    if (!myPrivateKeyHex || !myPublicKeyHex) return;
    setIsCreatingGroup(true);
    try {
      const { groupId, host: relayUrl, name, about, picture } = info;
      const groupService = new GroupService(myPublicKeyHex, myPrivateKeyHex);
      await groupService.createGroup({ groupId, relayUrl });

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
      toast.success(t("groups.created"));
    } catch (e) {
      toast.error(t("groups.error.createFailed"));
    } finally {
      setIsCreatingGroup(false);
    }
  }, [myPrivateKeyHex, myPublicKeyHex, setCreatedGroups, setSelectedConversation, setIsNewGroupOpen, t]);

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
            onAcceptRequest={(pk) => peerTrust.acceptPeer({ publicKeyHex: pk })}
            onIgnoreRequest={(pk) => requestsInbox.remove({ peerPublicKeyHex: pk })}
            onBlockRequest={(pk) => blocklist.addBlocked({ publicKeyInput: pk })}
            onSelectRequest={(pk) => setSelectedConversation({ kind: 'dm', id: pk, pubkey: pk, displayName: pk, lastMessage: '', unreadCount: 0, lastMessageTime: new Date() })}
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
            isPeerAccepted={peerTrust.isAccepted({ publicKeyHex: selectedConversationView.kind === 'dm' ? selectedConversationView.pubkey : '' })}
            onAcceptPeer={() => selectedConversationView.kind === 'dm' && peerTrust.acceptPeer({ publicKeyHex: selectedConversationView.pubkey })}
            onBlockPeer={() => selectedConversationView.kind === 'dm' && blocklist.addBlocked({ publicKeyInput: selectedConversationView.pubkey })}
          />
        )}
      </main>
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
      <PersistenceManager />
      <DevPanel />
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
