"use client";

import type React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import { AppShell } from "./components/app-shell";
import { IdentityCard } from "./components/identity-card";
import { OnboardingWizard } from "./components/onboarding-wizard";
import { SessionChip } from "./components/session-chip";
import { UserAvatarMenu } from "./components/user-avatar-menu";
import { parsePublicKeyInput } from "./lib/parse-public-key-input";
import { useEnhancedDmController } from "./lib/use-enhanced-dm-controller";
import { useBlocklist } from "./lib/use-blocklist";
import { useIdentity } from "./lib/use-identity";
import { usePeerTrust } from "./lib/use-peer-trust";
import { useRequestsInbox } from "./lib/use-requests-inbox";
import { useRelayList } from "./lib/use-relay-list";
import { useRelayPool } from "./lib/use-relay-pool";
import type { RelayConnection } from "./lib/relay-connection";
import { getNotificationsEnabled } from "./lib/notifications/get-notifications-enabled";
import { showDesktopNotification } from "./lib/notifications/show-desktop-notification";
import { useTranslation } from "react-i18next";

import type {
  Conversation,
  DmConversation,
  GroupConversation,
  Message,
  MessageStatus,
  RelayStatusSummary,
  ReplyTo,
  Attachment,
  AttachmentKind,
  MediaItem,
  ReactionEmoji,
  ReactionsByEmoji,
  UnreadByConversationId,
  ContactOverridesByContactId,
  MessagesByConversationId,
  UploadApiResponse,
  PersistedChatState,
  PersistedDmConversation,
  PersistedGroupConversation,
  PersistedMessage,
  DeleteCommandMessage
} from "./features/messaging/types";

import {
  loadPersistedChatState,
  savePersistedChatState,
  fromPersistedDmConversation,
  fromPersistedGroupConversation,
  fromPersistedMessagesByConversationId,
  fromPersistedOverridesByContactId,
  toPersistedDmConversation,
  toPersistedGroupConversation,
  toPersistedOverridesByContactId,
  toPersistedMessagesByConversationId,
  updateLastSeen,
  loadLastSeen
} from "./features/messaging/utils/persistence";

import {
  createContactId,
  createGroupId,
  createMessageId,
  syncIdCountersFromState
} from "./features/messaging/utils/ids";

import {
  subscribeNowMs,
  getNowMsSnapshot,
  getNowMsServerSnapshot
} from "./features/messaging/utils/time";

import {
  applyContactOverrides,
  isVisibleUserMessage,
  createEmptyReactions,
  toReactionsByEmoji
} from "./features/messaging/utils/logic";

import {
  createDeleteCommandMessage,
  encodeCommandMessage,
  parseCommandMessage
} from "./features/messaging/utils/commands";

import { Sidebar } from "./features/messaging/components/sidebar";
import { ChatView } from "./features/messaging/components/chat-view";
import { NewChatDialog } from "./features/messaging/components/new-chat-dialog";
import { NewGroupDialog } from "./features/messaging/components/new-group-dialog";
import { useAutoLock } from "./lib/use-auto-lock";
import { LockScreen } from "./components/lock-screen";
import type { Passphrase } from "@dweb/crypto/passphrase";
import { useUploadService } from "./lib/services/upload-service";

const LAST_PAGE_STORAGE_KEY = "obscur-last-page";

const ONE_MINUTE_MS: number = 60_000;
const ONE_HOUR_MS: number = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS: number = 24 * ONE_HOUR_MS;
const PROFILE_STORAGE_PREFIX: string = "dweb.nostr.pwa.profile";
const LEGACY_PROFILE_STORAGE_KEY: string = "dweb.nostr.pwa.profile";
const DEFAULT_VISIBLE_MESSAGES: number = 50;
const LOAD_EARLIER_STEP: number = 50;
const DEFAULT_PROFILE_USERNAME: string = "Anon";
const ONBOARDING_DISMISSED_STORAGE_KEY: string = "dweb.nostr.pwa.ui.onboardingDismissed";
const PERSISTED_CHAT_STATE_VERSION: number = 2;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";

const getProfileStorageKey = (publicKeyHex: string): string => `${PROFILE_STORAGE_PREFIX}.${publicKeyHex}`;
function NostrMessengerContent() {
  const { t } = useTranslation();
  const didHydrateFromStorageRef = useRef<boolean>(false);
  const handledIncomingDmIdsRef = useRef<Set<string>>(new Set<string>());
  const handledAcceptedOutgoingDmIdsRef = useRef<Set<string>>(new Set<string>());
  const handledRejectedOutgoingDmIdsRef = useRef<Set<string>>(new Set<string>());
  const handledSearchParamPubkeyRef = useRef<string | null>(null);
  const messageMenuRef = useRef<HTMLDivElement | null>(null);
  const reactionPickerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const identity = useIdentity();
  const relayList = useRelayList({ publicKeyHex: identity.state.publicKeyHex ?? null });
  const blocklist = useBlocklist({ publicKeyHex: identity.state.publicKeyHex ?? null });
  const peerTrust = usePeerTrust({ publicKeyHex: identity.state.publicKeyHex ?? null });
  const requestsInbox = useRequestsInbox({ publicKeyHex: identity.state.publicKeyHex ?? null });
  const { isLocked, lock, unlock, settings } = useAutoLock();
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const handleUnlock = async (passphrase: string): Promise<boolean> => {
    setIsUnlocking(true);
    try {
      await identity.unlockIdentity({ passphrase: passphrase as Passphrase });
      // We don't check state immediately as identity hook might need a tick
      return true;
    } catch (error) {
      console.error("Unlock failed:", error);
      return false;
    } finally {
      setIsUnlocking(false);
    }
  };

  // Wrap setSidebarTab to track last page
  const updateSidebarTab = useCallback((tab: "chats" | "requests") => {
    setSidebarTab(tab);
    localStorage.setItem(LAST_PAGE_STORAGE_KEY, JSON.stringify({ type: 'tab', id: tab }));
  }, []);
  const isPeerBlocked = blocklist.isBlocked;
  const isPeerAccepted = peerTrust.isAccepted;
  const isPeerMuted = peerTrust.isMuted;
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hasHydrated, setHasHydrated] = useState<boolean>(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState<boolean>(false);
  const [newChatPubkey, setNewChatPubkey] = useState<string>("");
  const [newChatDisplayName, setNewChatDisplayName] = useState<string>("");
  const [isNewGroupOpen, setIsNewGroupOpen] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>("");
  const [newGroupMemberPubkeys, setNewGroupMemberPubkeys] = useState<string>("");
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [unreadByConversationId, setUnreadByConversationId] = useState<UnreadByConversationId>({});
  const [contactOverridesByContactId, setContactOverridesByContactId] =
    useState<ContactOverridesByContactId>({});
  const [messagesByConversationId, setMessagesByConversationId] =
    useState<MessagesByConversationId>({});
  const [visibleMessageCountByConversationId, setVisibleMessageCountByConversationId] =
    useState<Readonly<Record<string, number>>>({});
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [pendingAttachmentPreviewUrl, setPendingAttachmentPreviewUrl] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState<boolean>(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [messageMenu, setMessageMenu] = useState<Readonly<{ messageId: string; x: number; y: number }> | null>(null);
  const [reactionPicker, setReactionPicker] = useState<Readonly<{ messageId: string; x: number; y: number }> | null>(null);
  const [pendingScrollTarget, setPendingScrollTarget] = useState<Readonly<{ conversationId: string; messageId: string }> | null>(null);
  const [flashMessageId, setFlashMessageId] = useState<string | null>(null);
  const [isMediaGalleryOpen, setIsMediaGalleryOpen] = useState<boolean>(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"chats" | "requests">("chats");
  const [createdContacts, setCreatedContacts] = useState<ReadonlyArray<DmConversation>>([]);
  const [createdGroups, setCreatedGroups] = useState<ReadonlyArray<GroupConversation>>([]);
  const [recipientVerificationStatus, setRecipientVerificationStatus] = useState<Readonly<Record<string, 'idle' | 'found' | 'not_found' | 'verifying'>>>({});
  const nowMs: number | null = useSyncExternalStore(
    subscribeNowMs,
    getNowMsSnapshot,
    getNowMsServerSnapshot
  );

  const getActiveProfilePublicKeyHex = useCallback((): string => {
    return identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? "";
  }, [identity.state.publicKeyHex, identity.state.stored?.publicKeyHex]);

  const loadLegacyProfileUsername = (): string => {
    try {
      const raw: string | null = localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY);
      if (!raw) {
        return DEFAULT_PROFILE_USERNAME;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) {
        return DEFAULT_PROFILE_USERNAME;
      }
      const username: unknown = parsed.username;
      return isString(username) && username.trim() ? username.trim() : DEFAULT_PROFILE_USERNAME;
    } catch {
      return DEFAULT_PROFILE_USERNAME;
    }
  };

  const loadProfileUsername = useCallback((publicKeyHex: string): string => {
    if (typeof window === "undefined") {
      return DEFAULT_PROFILE_USERNAME;
    }
    const trimmedPublicKeyHex: string = publicKeyHex.trim();
    if (!trimmedPublicKeyHex) {
      return DEFAULT_PROFILE_USERNAME;
    }
    try {
      const raw: string | null = localStorage.getItem(getProfileStorageKey(trimmedPublicKeyHex));
      if (!raw) {
        return loadLegacyProfileUsername();
      }
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) {
        return loadLegacyProfileUsername();
      }
      const username: unknown = parsed.username;
      return isString(username) && username.trim() ? username.trim() : DEFAULT_PROFILE_USERNAME;
    } catch {
      return loadLegacyProfileUsername();
    }
  }, []);

  useEffect((): void => {
    queueMicrotask((): void => {
      const publicKeyHex: string = getActiveProfilePublicKeyHex();
      void loadProfileUsername(publicKeyHex);
    });
  }, [getActiveProfilePublicKeyHex, loadProfileUsername]);

  const enabledRelayUrls: ReadonlyArray<string> = useMemo((): ReadonlyArray<string> => {
    return relayList.state.relays
      .filter((relay: Readonly<{ url: string; enabled: boolean }>): boolean => relay.enabled)
      .map((relay: Readonly<{ url: string; enabled: boolean }>): string => relay.url);
  }, [relayList.state.relays]);

  const relayPool = useRelayPool(enabledRelayUrls);
  const relayStatus = useMemo<RelayStatusSummary>(() => {
    const total: number = relayPool.connections.length;
    let openCount: number = 0;
    let errorCount: number = 0;
    relayPool.connections.forEach((connection: RelayConnection): void => {
      if (connection.status === "open") {
        openCount += 1;
      }
      if (connection.status === "error") {
        errorCount += 1;
      }
    });
    return { total, openCount, errorCount };
  }, [relayPool.connections]);

  const isIdentityUnlocked: boolean = identity.state.status === "unlocked";
  const isIdentityLocked: boolean = identity.state.status === "locked";

  const isRelayConnected: boolean = relayStatus.openCount > 0;
  const isStep1Done: boolean = isIdentityUnlocked;
  const isStep2Done: boolean = isRelayConnected;

  const myPublicKeyHex: PublicKeyHex | null = identity.state.status === "unlocked" ? identity.state.publicKeyHex ?? null : null;
  const myPrivateKeyHex: PrivateKeyHex | null = identity.state.status === "unlocked" ? identity.state.privateKeyHex ?? null : null;
  const dmController = useEnhancedDmController({
    myPublicKeyHex,
    myPrivateKeyHex,
    pool: relayPool,
    blocklist,
    peerTrust,
    requestsInbox
  });

  const uploadService = useUploadService();

  // Subscribe to incoming DMs when identity is unlocked and relays are connected
  useEffect((): void => {
    if (!isIdentityUnlocked) {
      return;
    }
    if (!isRelayConnected) {
      return;
    }
    if (dmController.state.status !== "ready") {
      return;
    }
    // Explicitly subscribe to ensure we receive incoming messages
    dmController.subscribeToIncomingDMs();
  }, [isIdentityUnlocked, isRelayConnected, dmController]);

  const dismissOnboarding = (): void => {
    try {
      localStorage.setItem(ONBOARDING_DISMISSED_STORAGE_KEY, "1");
    } catch {
      return;
    }
    setShowOnboarding(false);
  };

  const handleCopyMyPubkey = (): void => {
    if (!myPublicKeyHex) {
      return;
    }
    void navigator.clipboard.writeText(myPublicKeyHex);
  };

  const handleCopyChatLink = (): void => {
    if (!myPublicKeyHex) {
      return;
    }
    const url: string = `${window.location.origin}/?pubkey=${encodeURIComponent(myPublicKeyHex)}`;
    void navigator.clipboard.writeText(url);
  };

  useEffect((): void => {
    const raw: string | null = searchParams.get("pubkey");
    const trimmed: string = (raw ?? "").trim();
    if (!trimmed) {
      return;
    }
    if (handledSearchParamPubkeyRef.current === trimmed) {
      return;
    }
    handledSearchParamPubkeyRef.current = trimmed;
    const parsed = parsePublicKeyInput(trimmed);
    if (!parsed.ok) {
      return;
    }
    queueMicrotask((): void => {
      setNewChatPubkey(parsed.publicKeyHex);
      setNewChatDisplayName("");
      setIsNewChatOpen(true);
      router.replace("/");
    });
  }, [router, searchParams]);

  useEffect((): void => {
    const accepted = dmController.state.messages
      .filter((m): boolean => m.isOutgoing)
      .filter((m): boolean => m.status === "accepted")
      .filter((m): boolean => !handledAcceptedOutgoingDmIdsRef.current.has(m.id));
    if (accepted.length === 0) {
      return;
    }
    accepted.forEach((m): void => {
      handledAcceptedOutgoingDmIdsRef.current.add(m.id);
    });
    const acceptedIds: ReadonlySet<string> = new Set(accepted.map((m): string => m.id));
    queueMicrotask((): void => {
      setMessagesByConversationId((prev: MessagesByConversationId): MessagesByConversationId => {
        const next: Record<string, ReadonlyArray<Message>> = {};
        Object.entries(prev).forEach(([conversationId, messages]: [string, ReadonlyArray<Message>]): void => {
          const updated: ReadonlyArray<Message> = messages.map((msg: Message): Message => {
            if (!acceptedIds.has(msg.id)) {
              return msg;
            }
            if (msg.status === "accepted") {
              return msg;
            }
            return { ...msg, status: "accepted" };
          });
          next[conversationId] = updated;
        });
        return next;
      });
    });
  }, [dmController.state.messages]);

  useEffect((): void => {
    const rejected = dmController.state.messages
      .filter((m): boolean => m.isOutgoing)
      .filter((m): boolean => m.status === "rejected")
      .filter((m): boolean => !handledRejectedOutgoingDmIdsRef.current.has(m.id));
    if (rejected.length === 0) {
      return;
    }
    rejected.forEach((m): void => {
      handledRejectedOutgoingDmIdsRef.current.add(m.id);
    });
    const rejectedIds: ReadonlySet<string> = new Set(rejected.map((m): string => m.id));
    queueMicrotask((): void => {
      setMessagesByConversationId((prev: MessagesByConversationId): MessagesByConversationId => {
        const next: Record<string, ReadonlyArray<Message>> = {};
        Object.entries(prev).forEach(([conversationId, messages]: [string, ReadonlyArray<Message>]): void => {
          const updated: ReadonlyArray<Message> = messages.map((msg: Message): Message => {
            if (!rejectedIds.has(msg.id)) {
              return msg;
            }
            if (msg.status === "rejected") {
              return msg;
            }
            return { ...msg, status: "rejected" };
          });
          next[conversationId] = updated;
        });
        return next;
      });
    });
  }, [dmController.state.messages]);

  useEffect((): void => {
    if (!isIdentityUnlocked) {
      return;
    }
    if (dmController.state.status !== "ready") {
      return;
    }
    const incoming = dmController.state.messages
      .filter((m): boolean => !m.isOutgoing)
      .map((m): Readonly<{ id: string; peerPublicKeyHex: PublicKeyHex; plaintext: string; createdAtUnixSeconds: number }> => ({
        id: m.id,
        peerPublicKeyHex: m.senderPubkey,
        plaintext: m.content,
        createdAtUnixSeconds: Math.floor(m.timestamp.getTime() / 1000),
      }))
      .filter((m): boolean => !isPeerBlocked({ publicKeyHex: m.peerPublicKeyHex }))
      .filter((m): boolean => !isPeerMuted({ publicKeyHex: m.peerPublicKeyHex }))
      .filter((m): boolean => !handledIncomingDmIdsRef.current.has(m.id));
    if (incoming.length === 0) {
      return;
    }
    incoming.forEach((dm): void => {
      handledIncomingDmIdsRef.current.add(dm.id);
    });

    const acceptedIncoming = incoming.filter((dm): boolean => isPeerAccepted({ publicKeyHex: dm.peerPublicKeyHex }));
    const requestIncoming = incoming.filter((dm): boolean => !isPeerAccepted({ publicKeyHex: dm.peerPublicKeyHex }));

    requestIncoming.forEach((dm): void => {
      requestsInbox.upsertIncoming({ peerPublicKeyHex: dm.peerPublicKeyHex, plaintext: dm.plaintext, createdAtUnixSeconds: dm.createdAtUnixSeconds });
    });

    if (acceptedIncoming.length === 0) {
      return;
    }

    const notificationsEnabled: boolean = getNotificationsEnabled().enabled;
    const shouldNotify: boolean =
      notificationsEnabled &&
      typeof document !== "undefined" &&
      document.hidden &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted";
    if (shouldNotify) {
      acceptedIncoming.forEach((dm): void => {
        const peer: string = dm.peerPublicKeyHex;
        showDesktopNotification({ title: "New message", body: `From ${peer.slice(0, 8)}…`, tag: `dm-${peer}` });
      });
    }

    const conversationIdByPeer: Map<PublicKeyHex, string> = new Map();
    createdContacts.forEach((c: DmConversation): void => {
      conversationIdByPeer.set(c.pubkey, c.id);
    });
    const newContacts: DmConversation[] = [];
    acceptedIncoming.forEach((dm): void => {
      if (conversationIdByPeer.has(dm.peerPublicKeyHex)) {
        return;
      }
      const id: string = createContactId();
      const displayName: string = dm.peerPublicKeyHex.slice(0, 8);
      const createdAt: Date = new Date(dm.createdAtUnixSeconds * 1000);
      const contact: DmConversation = { kind: "dm", id, displayName, pubkey: dm.peerPublicKeyHex, lastMessage: dm.plaintext, unreadCount: 0, lastMessageTime: createdAt };
      conversationIdByPeer.set(dm.peerPublicKeyHex, id);
      newContacts.push(contact);
    });
    queueMicrotask((): void => {
      if (newContacts.length > 0) {
        setCreatedContacts((prev: ReadonlyArray<DmConversation>): ReadonlyArray<DmConversation> => [...newContacts, ...prev]);
      }
      setMessagesByConversationId((prev: MessagesByConversationId): MessagesByConversationId => {
        const next: Record<string, ReadonlyArray<Message>> = { ...prev };
        acceptedIncoming.forEach((dm): void => {
          const conversationId: string | undefined = conversationIdByPeer.get(dm.peerPublicKeyHex);
          if (!conversationId) {
            return;
          }
          const existing: ReadonlyArray<Message> = next[conversationId] ?? [];
          const timestamp: Date = new Date(dm.createdAtUnixSeconds * 1000);
          const message: Message = { id: dm.id, kind: "user", content: dm.plaintext, timestamp, isOutgoing: false, status: "delivered" };
          next[conversationId] = [...existing, message];
        });
        return next;
      });
      setContactOverridesByContactId((prev: ContactOverridesByContactId): ContactOverridesByContactId => {
        const next: Record<string, Readonly<{ lastMessage: string; lastMessageTime: Date }>> = { ...prev };
        acceptedIncoming.forEach((dm: Readonly<{ peerPublicKeyHex: PublicKeyHex; plaintext: string; createdAtUnixSeconds: number }>): void => {
          const conversationId: string | undefined = conversationIdByPeer.get(dm.peerPublicKeyHex);
          if (!conversationId) {
            return;
          }
          next[conversationId] = { lastMessage: dm.plaintext, lastMessageTime: new Date(dm.createdAtUnixSeconds * 1000) };
        });
        return next;
      });
      setUnreadByConversationId((prev: UnreadByConversationId): UnreadByConversationId => {
        const next: Record<string, number> = { ...prev };
        acceptedIncoming.forEach((dm: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): void => {
          const conversationId: string | undefined = conversationIdByPeer.get(dm.peerPublicKeyHex);
          if (!conversationId) {
            return;
          }
          if (selectedConversation?.id === conversationId) {
            return;
          }
          next[conversationId] = (next[conversationId] ?? 0) + 1;
        });
        return next;
      });
    });
  }, [createdContacts, dmController.state.messages, dmController.state.status, isIdentityUnlocked, isPeerAccepted, isPeerBlocked, isPeerMuted, requestsInbox, selectedConversation?.id]);

  useEffect((): void => {
    if (didHydrateFromStorageRef.current) {
      return;
    }
    const persisted: PersistedChatState | null = loadPersistedChatState();
    queueMicrotask((): void => {
      if (persisted) {
        const nextCreatedContacts: ReadonlyArray<DmConversation> = persisted.createdContacts
          .map((c: PersistedDmConversation): DmConversation | null => fromPersistedDmConversation(c))
          .filter((c: DmConversation | null): c is DmConversation => c !== null);
        const nextCreatedGroups: ReadonlyArray<GroupConversation> = persisted.createdGroups.map((g: PersistedGroupConversation): GroupConversation =>
          fromPersistedGroupConversation(g)
        );
        const nextMessagesByConversationId: MessagesByConversationId = fromPersistedMessagesByConversationId(persisted.messagesByConversationId);
        setCreatedContacts(nextCreatedContacts);
        setCreatedGroups(nextCreatedGroups);
        setUnreadByConversationId(persisted.unreadByConversationId);
        setContactOverridesByContactId(fromPersistedOverridesByContactId(persisted.contactOverridesByContactId));
        setMessagesByConversationId(nextMessagesByConversationId);
        syncIdCountersFromState({ createdContacts: nextCreatedContacts, createdGroups: nextCreatedGroups, messagesByConversationId: nextMessagesByConversationId });
      } else {
        syncIdCountersFromState({ createdContacts: [], createdGroups: [], messagesByConversationId: {} });
      }
      setHasHydrated(true);
      didHydrateFromStorageRef.current = true;
    });
  }, []);

  useEffect((): void => {
    if (!hasHydrated) {
      return;
    }
    queueMicrotask((): void => {
      try {
        const raw: string | null = localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY);
        setShowOnboarding(raw !== "1" && isIdentityLocked);
      } catch {
        setShowOnboarding(isIdentityLocked);
      }
    });
  }, [hasHydrated, isIdentityLocked]);

  useEffect((): (() => void) => {
    if (typeof window === "undefined") {
      return (): void => { };
    }
    const onStorage = (event: StorageEvent): void => {
      if (event.storageArea !== localStorage) {
        return;
      }
      const key: string | null = event.key;
      const publicKeyHex: string = getActiveProfilePublicKeyHex();
      const activeKey: string | null = publicKeyHex ? getProfileStorageKey(publicKeyHex) : null;
      if (key !== LEGACY_PROFILE_STORAGE_KEY && (!activeKey || key !== activeKey)) {
        return;
      }
      void loadProfileUsername(publicKeyHex);
    };
    window.addEventListener("storage", onStorage);
    return (): void => {
      window.removeEventListener("storage", onStorage);
    };
  }, [getActiveProfilePublicKeyHex, loadProfileUsername]);

  useEffect((): (() => void) => {
    const onGlobalKeyDown = (event: KeyboardEvent): void => {
      const isMac: boolean = navigator.platform.toLowerCase().includes("mac");
      const isMod: boolean = isMac ? event.metaKey : event.ctrlKey;
      if (isMod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (event.key !== "Escape") {
        return;
      }
      if (isNewChatOpen) {
        setIsNewChatOpen(false);
        setNewChatPubkey("");
        setNewChatDisplayName("");
      }
      if (isNewGroupOpen) {
        setIsNewGroupOpen(false);
        setNewGroupName("");
        setNewGroupMemberPubkeys("");
      }
      if (isMediaGalleryOpen) {
        setIsMediaGalleryOpen(false);
      }
      if (lightboxIndex !== null) {
        setLightboxIndex(null);
      }
      setMessageMenu(null);
      setReactionPicker(null);
    };
    window.addEventListener("keydown", onGlobalKeyDown);
    return (): void => {
      window.removeEventListener("keydown", onGlobalKeyDown);
    };
  }, [isMediaGalleryOpen, isNewChatOpen, isNewGroupOpen, lightboxIndex]);

  useEffect((): void => {
    if (!didHydrateFromStorageRef.current) {
      return;
    }
    const persisted: PersistedChatState = {
      version: PERSISTED_CHAT_STATE_VERSION,
      createdContacts: createdContacts.map((c: DmConversation): PersistedDmConversation => toPersistedDmConversation(c)),
      createdGroups: createdGroups.map((g: GroupConversation): PersistedGroupConversation => toPersistedGroupConversation(g)),
      unreadByConversationId,
      contactOverridesByContactId: toPersistedOverridesByContactId(contactOverridesByContactId),
      messagesByConversationId: toPersistedMessagesByConversationId(messagesByConversationId),
    };
    savePersistedChatState(persisted);
  }, [createdContacts, createdGroups, unreadByConversationId, contactOverridesByContactId, messagesByConversationId]);

  const handleCopyPubkey = (pubkey: string) => {
    navigator.clipboard.writeText(pubkey);
  };

  const copyToClipboard = async (value: string): Promise<void> => {
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea: HTMLTextAreaElement = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  const getReplyPreviewText = (message: Message): string => {
    if (message.content.trim()) {
      return message.content.trim().slice(0, 140);
    }
    if (message.attachment) {
      return message.attachment.fileName;
    }
    return "(message)";
  };

  const getLastMessageSnapshot = (params: Readonly<{ conversationId: string; messagesByConversationId: MessagesByConversationId }>): Readonly<{ lastMessage: string; lastMessageTime: Date }> | null => {
    const combined: ReadonlyArray<Message> = params.messagesByConversationId[params.conversationId] ?? [];
    const last: Message | undefined = [...combined].reverse().find((m: Message): boolean => isVisibleUserMessage(m));
    if (!last) {
      return null;
    }
    const lastMessage: string = last.deletedAt ? "Message deleted" : last.attachment ? last.attachment.fileName : last.content;
    return { lastMessage, lastMessageTime: last.timestamp };
  };

  const openMessageMenu = (params: Readonly<{ messageId: string; x: number; y: number }>): void => {
    setMessageMenu(params);
  };

  const closeMessageMenu = (): void => {
    setMessageMenu(null);
  };

  const closeReactionPicker = (): void => {
    setReactionPicker(null);
  };

  const deleteMessage = (params: Readonly<{ conversationId: string; messageId: string }>): void => {
    const existing: ReadonlyArray<Message> = messagesByConversationId[params.conversationId] ?? [];
    const now: Date = new Date();
    const nextMessagesBase: ReadonlyArray<Message> = existing.map((m: Message): Message => {
      if (m.id !== params.messageId) {
        return m;
      }
      return { ...m, deletedAt: now, content: "" };
    });
    const commandMessage: Message = {
      id: createMessageId(),
      kind: "command",
      content: encodeCommandMessage(createDeleteCommandMessage(params.messageId)),
      timestamp: now,
      isOutgoing: true,
      status: "accepted",
    };
    const nextMessages: ReadonlyArray<Message> = [...nextMessagesBase, commandMessage];
    const nextMessagesByConversationId: MessagesByConversationId = {
      ...messagesByConversationId,
      [params.conversationId]: nextMessages,
    };
    setMessagesByConversationId(nextMessagesByConversationId);
    const snapshot: Readonly<{ lastMessage: string; lastMessageTime: Date }> | null = getLastMessageSnapshot({ conversationId: params.conversationId, messagesByConversationId: nextMessagesByConversationId });
    setContactOverridesByContactId(
      (prev: ContactOverridesByContactId): ContactOverridesByContactId => {
        const next: Record<string, Readonly<{ lastMessage: string; lastMessageTime: Date }>> = { ...prev };
        if (snapshot) {
          next[params.conversationId] = snapshot;
        } else {
          delete next[params.conversationId];
        }
        return next;
      }
    );
  };

  const getMessageById = (params: Readonly<{ conversationId: string; messageId: string }>): Message | null => {
    const list: ReadonlyArray<Message> = messagesByConversationId[params.conversationId] ?? [];
    return list.find((m: Message): boolean => m.id === params.messageId) ?? null;
  };

  const getMediaItemsForConversation = (params: Readonly<{ conversationId: string }>): ReadonlyArray<MediaItem> => {
    const list: ReadonlyArray<Message> = messagesByConversationId[params.conversationId] ?? [];
    return list
      .filter((m: Message): m is Message & Readonly<{ attachment: Attachment }> => m.kind === "user" && Boolean(m.attachment))
      .map((m: Message & Readonly<{ attachment: Attachment }>): MediaItem => ({
        messageId: m.id,
        attachment: m.attachment,
        timestamp: m.timestamp,
      }));
  };

  const isDeletableMessageId = (messageId: string): boolean => {
    void messageId;
    return true;
  };

  const isReactableMessageId = (messageId: string): boolean => {
    void messageId;
    return true;
  };

  const toAbsoluteUrl = (url: string): string => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `${window.location.origin}${url}`;
  };

  useEffect((): (() => void) => {
    const onGlobalPointerDown = (event: PointerEvent): void => {
      if (!messageMenu && !reactionPicker) {
        return;
      }
      if (event.button === 2) {
        return;
      }
      const target: EventTarget | null = event.target;
      if (target instanceof Node && messageMenuRef.current?.contains(target)) {
        return;
      }
      closeMessageMenu();
      closeReactionPicker();
    };
    const onGlobalKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }
      closeMessageMenu();
      closeReactionPicker();
    };
    window.addEventListener("pointerdown", onGlobalPointerDown);
    window.addEventListener("keydown", onGlobalKeyDown);
    return (): void => {
      window.removeEventListener("pointerdown", onGlobalPointerDown);
      window.removeEventListener("keydown", onGlobalKeyDown);
    };
  }, [messageMenu, reactionPicker]);

  useLayoutEffect((): (() => void) => {
    const marginPx: number = 8;
    const rafId: number = window.requestAnimationFrame((): void => {
      if (messageMenu && messageMenuRef.current) {
        const rect: DOMRect = messageMenuRef.current.getBoundingClientRect();
        const vw: number = window.innerWidth;
        const vh: number = window.innerHeight;
        let nextX: number = messageMenu.x;
        let nextY: number = messageMenu.y;
        if (rect.right > vw - marginPx) {
          nextX = nextX - (rect.right - (vw - marginPx));
        }
        if (rect.bottom > vh - marginPx) {
          nextY = nextY - (rect.bottom - (vh - marginPx));
        }
        if (rect.left < marginPx) {
          nextX = nextX + (marginPx - rect.left);
        }
        if (rect.top < marginPx) {
          nextY = nextY + (marginPx - rect.top);
        }
        if (Math.abs(nextX - messageMenu.x) >= 1 || Math.abs(nextY - messageMenu.y) >= 1) {
          setMessageMenu({ ...messageMenu, x: nextX, y: nextY });
        }
      }
      if (reactionPicker && reactionPickerRef.current) {
        const rect: DOMRect = reactionPickerRef.current.getBoundingClientRect();
        const vw: number = window.innerWidth;
        const vh: number = window.innerHeight;
        let nextX: number = reactionPicker.x;
        let nextY: number = reactionPicker.y;
        if (rect.right > vw - marginPx) {
          nextX = nextX - (rect.right - (vw - marginPx));
        }
        if (rect.bottom > vh - marginPx) {
          nextY = nextY - (rect.bottom - (vh - marginPx));
        }
        if (rect.left < marginPx) {
          nextX = nextX + (marginPx - rect.left);
        }
        if (rect.top < marginPx) {
          nextY = nextY + (marginPx - rect.top);
        }
        if (Math.abs(nextX - reactionPicker.x) >= 1 || Math.abs(nextY - reactionPicker.y) >= 1) {
          setReactionPicker({ ...reactionPicker, x: nextX, y: nextY });
        }
      }
    });
    return (): void => {
      window.cancelAnimationFrame(rafId);
    };
  }, [messageMenu, reactionPicker]);

  const toggleReaction = (params: Readonly<{ conversationId: string; messageId: string; emoji: ReactionEmoji }>): void => {
    setMessagesByConversationId((prev: MessagesByConversationId): MessagesByConversationId => {
      const existing: ReadonlyArray<Message> = prev[params.conversationId] ?? [];
      const nextMessages: ReadonlyArray<Message> = existing.map((m: Message): Message => {
        if (m.id !== params.messageId) {
          return m;
        }
        const currentCount: number = m.reactions?.[params.emoji] ?? 0;
        const nextCount: number = currentCount > 0 ? 0 : 1;
        if (nextCount === 0) {
          const { reactions, ...rest }: Message & Readonly<{ reactions?: ReactionsByEmoji }> = m;
          void reactions;
          return rest;
        }
        const base: Record<ReactionEmoji, number> = createEmptyReactions();
        base[params.emoji] = nextCount;
        return { ...m, reactions: toReactionsByEmoji(base) };
      });
      return { ...prev, [params.conversationId]: nextMessages };
    });
  };

  const clearPendingAttachment = (): void => {
    setPendingAttachment(null);
    if (pendingAttachmentPreviewUrl) {
      URL.revokeObjectURL(pendingAttachmentPreviewUrl);
    }
    setPendingAttachmentPreviewUrl(null);
    setAttachmentError(null);
  };

  const onPickAttachment = (file: File | null): void => {
    clearPendingAttachment();
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setAttachmentError("Only image/video files are supported.");
      return;
    }
    setPendingAttachment(file);
    setPendingAttachmentPreviewUrl(URL.createObjectURL(file));
  };

  const uploadAttachment = useCallback(async (file: File): Promise<Attachment> => {
    return uploadService.uploadFile(file);
  }, [uploadService]);

  const closeNewChat = (): void => {
    setIsNewChatOpen(false);
    setNewChatPubkey("");
    setNewChatDisplayName("");
  };

  const upsertCreatedContact = (nextContact: DmConversation): void => {
    setCreatedContacts((prev: ReadonlyArray<DmConversation>): ReadonlyArray<DmConversation> => {
      const exists: boolean = prev.some((c: DmConversation): boolean => c.id === nextContact.id);
      if (exists) {
        return prev.map((c: DmConversation): DmConversation => (c.id === nextContact.id ? nextContact : c));
      }
      return [nextContact, ...prev];
    });
  };

  const selectConversation = useCallback((conversation: Conversation): void => {
    setSelectedConversation(conversation);
    localStorage.setItem(LAST_PAGE_STORAGE_KEY, JSON.stringify({ type: 'conversation', id: conversation.id }));
    setUnreadByConversationId((prev: UnreadByConversationId): UnreadByConversationId => ({
      ...prev,
      [conversation.id]: 0,
    }));
    setVisibleMessageCountByConversationId((prev: Readonly<Record<string, number>>): Readonly<Record<string, number>> => ({
      ...prev,
      [conversation.id]: prev[conversation.id] ?? DEFAULT_VISIBLE_MESSAGES,
    }));

    // Auto-verify recipient for DMs if not already verified
    if (conversation.kind === "dm" && (!recipientVerificationStatus[conversation.id] || recipientVerificationStatus[conversation.id] === 'idle')) {
      setRecipientVerificationStatus(prev => ({ ...prev, [conversation.id]: 'verifying' }));
      void dmController.verifyRecipient(conversation.pubkey as PublicKeyHex).then(result => {
        setRecipientVerificationStatus(prev => ({
          ...prev,
          [conversation.id]: result.exists ? 'found' : 'not_found'
        }));
      });
    }
  }, [dmController, recipientVerificationStatus]);

  const createChat = (): void => {
    const pubkey: string = newChatPubkey.trim();
    const displayName: string = (newChatDisplayName.trim() || pubkey.slice(0, 8)).trim();
    if (!pubkey) {
      return;
    }
    const parsed = parsePublicKeyInput(pubkey);
    if (!parsed.ok) {
      return;
    }
    const id: string = createContactId();
    const baseNowMs: number = nowMs ?? 0;
    const contact: DmConversation = {
      kind: "dm",
      id,
      displayName,
      pubkey: parsed.publicKeyHex,
      lastMessage: "",
      unreadCount: 0,
      lastMessageTime: new Date(baseNowMs),
    };
    upsertCreatedContact(contact);
    setUnreadByConversationId((prev: UnreadByConversationId): UnreadByConversationId => ({
      ...prev,
      [id]: 0,
    }));
    closeNewChat();
    selectConversation(contact);
  };

  const createGroup = (): void => {
    const rawName: string = newGroupName.trim();
    const baseNowMs: number = nowMs ?? 0;
    const memberPubkeys: ReadonlyArray<string> = Array.from(
      new Set(
        newGroupMemberPubkeys
          .split(/\s+/)
          .map((v: string): string => v.trim())
          .filter((v: string): boolean => v.length > 0)
      )
    );
    if (memberPubkeys.length === 0) {
      return;
    }
    const id: string = createGroupId();
    const displayName: string = rawName || `Group ${id}`;
    const group: GroupConversation = {
      kind: "group",
      id,
      displayName,
      memberPubkeys,
      lastMessage: "",
      unreadCount: 0,
      lastMessageTime: new Date(baseNowMs),
    };
    setCreatedGroups((prev: ReadonlyArray<GroupConversation>): ReadonlyArray<GroupConversation> => [group, ...prev]);
    setUnreadByConversationId((prev: UnreadByConversationId): UnreadByConversationId => ({
      ...prev,
      [id]: 0,
    }));
    setIsNewGroupOpen(false);
    setNewGroupName("");
    setNewGroupMemberPubkeys("");
    selectConversation(group);
  };

  const handleSendMessage = (): void => {
    if (!isIdentityUnlocked) {
      return;
    }
    const content: string = messageInput.trim();
    if ((!content && !pendingAttachment) || !selectedConversation) {
      return;
    }
    if (isUploadingAttachment) {
      return;
    }
    const baseNowMs: number = nowMs ?? 0;
    setIsUploadingAttachment(true);
    setAttachmentError(null);
    const send = async (): Promise<void> => {
      const timestamp: Date = new Date(baseNowMs);
      let attachment: Attachment | undefined;
      if (pendingAttachment) {
        attachment = await uploadAttachment(pendingAttachment);
      }
      const resolvedContent: string = content;
      let resolvedMessageId: string = createMessageId();
      let resolvedTimestamp: Date = timestamp;
      let resolvedStatus: MessageStatus = "delivered";
      if (selectedConversation.kind === "dm") {
        if (attachment) {
          throw new Error("Attachments are not supported for DMs yet.");
        }
        if (blocklist.isBlocked({ publicKeyHex: selectedConversation.pubkey })) {
          throw new Error("Recipient is blocked.");
        }
        const sent = await dmController.sendDm({ peerPublicKeyInput: selectedConversation.pubkey, plaintext: resolvedContent });
        if (sent.success && sent.messageId) {
          resolvedMessageId = sent.messageId;
          resolvedTimestamp = new Date(); // Use current time since enhanced controller handles timing
          resolvedStatus = "sending";
        } else {
          throw new Error(sent.error || "Failed to send message");
        }
      }
      const message: Message = {
        id: resolvedMessageId,
        kind: "user",
        content: resolvedContent,
        timestamp: resolvedTimestamp,
        isOutgoing: true,
        status: resolvedStatus,
        ...(attachment ? { attachment } : {}),
        ...(replyTo ? { replyTo } : {}),
      };
      setMessagesByConversationId((prev: MessagesByConversationId): MessagesByConversationId => {
        const existing: ReadonlyArray<Message> = prev[selectedConversation.id] ?? [];
        return {
          ...prev,
          [selectedConversation.id]: [...existing, message],
        };
      });
      setContactOverridesByContactId(
        (prev: ContactOverridesByContactId): ContactOverridesByContactId => ({
          ...prev,
          [selectedConversation.id]: {
            lastMessage: attachment ? attachment.fileName : resolvedContent,
            lastMessageTime: message.timestamp,
          },
        })
      );
      setMessageInput("");
      clearPendingAttachment();
      setReplyTo(null);
    };
    send()
      .catch((error: unknown): void => {
        const message: string = error instanceof Error ? error.message : "Upload failed";
        setAttachmentError(message);
      })
      .finally((): void => {
        setIsUploadingAttachment(false);
      });
  };

  const handleRetryMessage = (message: Message): void => {
    const conversation: Conversation | null = selectedConversationView ?? selectedConversation;
    if (!conversation || conversation.kind !== "dm") {
      return;
    }
    if (blocklist.isBlocked({ publicKeyHex: conversation.pubkey })) {
      setAttachmentError("Recipient is blocked.");
      return;
    }
    const plaintext: string = message.content.trim();
    if (plaintext.length === 0) {
      return;
    }
    dmController
      .sendDm({ peerPublicKeyInput: conversation.pubkey, plaintext })
      .then((sent): void => {
        if (!sent.success || !sent.messageId) {
          return;
        }
        const outgoing: Message = {
          id: sent.messageId,
          kind: "user",
          content: plaintext,
          timestamp: new Date(), // Use current time since enhanced controller handles timing
          isOutgoing: true,
          status: "sending",
        };
        setMessagesByConversationId((prev: MessagesByConversationId): MessagesByConversationId => {
          const existing: ReadonlyArray<Message> = prev[conversation.id] ?? [];
          return { ...prev, [conversation.id]: [...existing, outgoing] };
        });
        setContactOverridesByContactId((prev: ContactOverridesByContactId): ContactOverridesByContactId => ({
          ...prev,
          [conversation.id]: { lastMessage: plaintext, lastMessageTime: outgoing.timestamp },
        }));
      })
      .catch((): void => {
        return;
      });
  };

  const visibleCreatedContacts: ReadonlyArray<DmConversation> = useMemo((): ReadonlyArray<DmConversation> => {
    return createdContacts.filter((c: DmConversation): boolean => isPeerAccepted({ publicKeyHex: c.pubkey }));
  }, [createdContacts, isPeerAccepted]);

  const allConversations: ReadonlyArray<Conversation> = [...visibleCreatedContacts, ...createdGroups].map(
    (conversation: Conversation): Conversation =>
      applyContactOverrides(conversation, contactOverridesByContactId)
  );
  const selectedConversationView: Conversation | null = selectedConversation
    ? applyContactOverrides(selectedConversation, contactOverridesByContactId)
    : null;

  const selectedConversationMediaItems: ReadonlyArray<MediaItem> = selectedConversationView
    ? getMediaItemsForConversation({ conversationId: selectedConversationView.id })
    : [];

  useEffect(() => {
    if (selectedConversationView) {
      document.title = `${selectedConversationView.displayName} | Obscur`;
    } else {
      document.title = `Obscur`;
    }
  }, [selectedConversationView]);

  const normalizedSearchQuery: string = searchQuery.trim().toLowerCase();

  const messageSearchResults: ReadonlyArray<Readonly<{ conversationId: string; messageId: string; timestamp: Date; preview: string }>> = (() => {
    if (normalizedSearchQuery.length === 0) {
      return [];
    }
    const results: Array<Readonly<{ conversationId: string; messageId: string; timestamp: Date; preview: string }>> = [];
    allConversations.forEach((conversation: Conversation): void => {
      const conversationId: string = conversation.id;
      const combined: ReadonlyArray<Message> = messagesByConversationId[conversationId] ?? [];
      const commandDeletedIds: ReadonlySet<string> = new Set(
        combined
          .filter((m: Message): boolean => m.kind === "command")
          .map((m: Message): DeleteCommandMessage | null => parseCommandMessage(m.content))
          .filter((cmd: DeleteCommandMessage | null): cmd is DeleteCommandMessage => cmd !== null)
          .map((cmd: DeleteCommandMessage): string => cmd.targetMessageId)
      );
      combined
        .filter((m: Message): boolean => m.kind === "user")
        .forEach((m: Message): void => {
          if (m.deletedAt || commandDeletedIds.has(m.id)) {
            return;
          }
          const haystack: string = (m.attachment?.fileName ?? "") + " " + m.content;
          if (haystack.toLowerCase().includes(normalizedSearchQuery)) {
            const preview: string = m.attachment ? m.attachment.fileName : m.content;
            results.push({ conversationId, messageId: m.id, timestamp: m.timestamp, preview });
          }
        });
    });
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return results.slice(0, 12);
  })();

  const messageMatchConversationIds: ReadonlySet<string> = new Set(
    messageSearchResults.map((r: Readonly<{ conversationId: string; messageId: string; timestamp: Date; preview: string }>): string => r.conversationId)
  );

  const filteredConversations: ReadonlyArray<Conversation> = normalizedSearchQuery.length === 0
    ? allConversations
    : allConversations.filter((conversation: Conversation): boolean => {
      const nameOrKeyMatch: boolean =
        conversation.displayName.toLowerCase().includes(normalizedSearchQuery) ||
        (conversation.kind === "dm" && conversation.pubkey.toLowerCase().includes(normalizedSearchQuery));
      return nameOrKeyMatch || messageMatchConversationIds.has(conversation.id);
    });

  const selectedConversationId: string | null = selectedConversationView?.id ?? null;

  const selectedCombinedMessages: ReadonlyArray<Message> = selectedConversationId
    ? (messagesByConversationId[selectedConversationId] ?? [])
    : [];

  const selectedSortedMessages: ReadonlyArray<Message> = [...selectedCombinedMessages].sort(
    (a: Message, b: Message): number => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const visibleWindowSize: number = selectedConversationView ? (visibleMessageCountByConversationId[selectedConversationView.id] ?? DEFAULT_VISIBLE_MESSAGES) : DEFAULT_VISIBLE_MESSAGES;

  const hasEarlierMessages: boolean = selectedSortedMessages.length > visibleWindowSize;

  const selectedWindowMessages: ReadonlyArray<Message> = selectedSortedMessages.slice(-visibleWindowSize);

  const deletedMessageIdsFromCommands: ReadonlySet<string> = new Set(
    selectedCombinedMessages
      .filter((m: Message): boolean => m.kind === "command")
      .map((m: Message): DeleteCommandMessage | null => parseCommandMessage(m.content))
      .filter((m: DeleteCommandMessage | null): m is DeleteCommandMessage => m !== null)
      .map((cmd: DeleteCommandMessage): string => cmd.targetMessageId)
  );

  const visibleSelectedMessages: ReadonlyArray<Message> = selectedWindowMessages
    .filter((m: Message): boolean => isVisibleUserMessage(m))
    .map((m: Message): Message => {
      if (m.deletedAt || deletedMessageIdsFromCommands.has(m.id)) {
        return { ...m, deletedAt: m.deletedAt ?? new Date(0), content: "" };
      }
      return m;
    });

  useEffect((): void => {
    if (identity.state.status !== "unlocked") {
      return;
    }
    const pk: PublicKeyHex | undefined = identity.state.publicKeyHex;
    if (!pk) {
      return;
    }
    if (!selectedConversationId) {
      return;
    }
    const newestVisible: Message | undefined = [...selectedSortedMessages].reverse().find((m: Message): boolean => m.kind === "user");
    const baselineSeenAtMs: number | null = nowMs;
    if (baselineSeenAtMs === null) {
      return;
    }
    const computedSeenAtMs: number = newestVisible ? Math.max(baselineSeenAtMs, newestVisible.timestamp.getTime()) : baselineSeenAtMs;
    updateLastSeen({ publicKeyHex: pk, conversationId: selectedConversationId, seenAtMs: computedSeenAtMs });
  }, [identity.state.publicKeyHex, identity.state.status, nowMs, selectedConversationId, selectedSortedMessages]);

  const handleAcceptRequest = useCallback((peerPublicKeyHex: PublicKeyHex) => {
    peerTrust.acceptPeer({ publicKeyHex: peerPublicKeyHex });

    // Create conversation if it doesn't exist
    const exists = createdContacts.some(c => c.pubkey === peerPublicKeyHex);
    if (!exists) {
      const id = createContactId();
      const contact: DmConversation = {
        kind: "dm",
        id,
        displayName: peerPublicKeyHex.slice(0, 8),
        pubkey: peerPublicKeyHex,
        lastMessage: "",
        unreadCount: 0,
        lastMessageTime: new Date(),
      };
      setCreatedContacts(prev => [contact, ...prev]);
      selectConversation(contact);
    }

    // Switch to chats tab
    setSidebarTab("chats");
  }, [peerTrust, createdContacts, selectConversation]);

  const handleIgnoreRequest = useCallback((peerPublicKeyHex: PublicKeyHex) => {
    requestsInbox.remove({ peerPublicKeyHex });
  }, [requestsInbox]);

  const handleBlockRequest = useCallback((peerPublicKeyHex: PublicKeyHex) => {
    blocklist.addBlocked({ publicKeyInput: peerPublicKeyHex });
  }, [blocklist]);

  const handleSelectRequest = useCallback((peerPublicKeyHex: PublicKeyHex) => {
    // Show the chat history even if not accepted yet
    // We create a temporary conversation object
    const id = createContactId();
    const contact: DmConversation = {
      kind: "dm",
      id,
      displayName: `Request: ${peerPublicKeyHex.slice(0, 8)}`,
      pubkey: peerPublicKeyHex,
      lastMessage: "",
      unreadCount: 0,
      lastMessageTime: new Date(),
    };
    setSelectedConversation(contact);
  }, []);


  useEffect((): void | (() => void) => {
    if (!pendingScrollTarget || !selectedConversationView) {
      return;
    }
    if (pendingScrollTarget.conversationId !== selectedConversationView.id) {
      return;
    }
    const maxAttempts: number = 20;
    let isCanceled: boolean = false;
    let attempt: number = 0;

    const tick = (): void => {
      if (isCanceled) {
        return;
      }
      const element: HTMLElement | null = document.getElementById(`msg-${pendingScrollTarget.messageId}`);
      if (element) {
        element.scrollIntoView({ block: "center", inline: "nearest" });
        setFlashMessageId(pendingScrollTarget.messageId);
        setPendingScrollTarget(null);
        return;
      }
      attempt += 1;
      if (attempt >= maxAttempts) {
        setPendingScrollTarget(null);
        return;
      }
      window.requestAnimationFrame(tick);
    };

    const rafId: number = window.requestAnimationFrame(tick);
    return (): void => {
      isCanceled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [pendingScrollTarget, selectedConversationView]);

  useEffect((): void | (() => void) => {
    if (!flashMessageId) {
      return;
    }
    const timeoutId: number = window.setTimeout((): void => {
      setFlashMessageId(null);
    }, 1200);
    return (): void => {
      window.clearTimeout(timeoutId);
    };
  }, [flashMessageId]);

  const formatTime = (date: Date, currentNowMs: number | null): string => {
    if (currentNowMs === null) {
      return "";
    }
    const diff: number = currentNowMs - date.getTime();

    // Handle future timestamps (clock sync issues)
    if (diff < 0) {
      return "Just now";
    }

    if (diff < ONE_HOUR_MS) {
      return `${Math.floor(diff / ONE_MINUTE_MS)}m ago`;
    }
    if (diff < ONE_DAY_MS) {
      return `${Math.floor(diff / ONE_HOUR_MS)}h ago`;
    }
    return `${Math.floor(diff / ONE_DAY_MS)}d ago`;
  };

  const chatsUnreadCount: number = useMemo((): number => {
    return Object.values(unreadByConversationId).reduce((sum: number, count: number): number => sum + count, 0);
  }, [unreadByConversationId]);

  // Handle last page restoration after unlocking
  useEffect(() => {
    if (!isLocked && isIdentityUnlocked && !selectedConversation) {
      const stored = localStorage.getItem(LAST_PAGE_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.type === 'conversation') {
            const conv = allConversations.find(c => c.id === parsed.id);
            if (conv) selectConversation(conv);
          } else if (parsed.type === 'tab') {
            setSidebarTab(parsed.id);
          } else if (parsed.type === 'home') {
            setShowWelcome(true);
          }
        } catch (e) {
          console.error("Failed to restore last page", e);
        }
      } else {
        setShowWelcome(true);
        localStorage.setItem(LAST_PAGE_STORAGE_KEY, JSON.stringify({ type: 'home' }));
      }
    }
  }, [isLocked, isIdentityUnlocked, allConversations, selectedConversation]);

  if (isLocked && identity.state.stored) {
    return (
      <LockScreen
        publicKeyHex={identity.state.publicKeyHex ?? undefined}
        isUnlocking={isUnlocking}
        onUnlock={handleUnlock}
      />
    );
  }

  return (
    <AppShell
      navBadgeCounts={{ "/": chatsUnreadCount }}
      sidebarContent={
        <div className="w-full h-full bg-white dark:bg-black">
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
            selectConversation={selectConversation}
            selectedConversation={selectedConversation}
            unreadByConversationId={unreadByConversationId}
            nowMs={nowMs}
            messageSearchResults={messageSearchResults}
            allConversations={allConversations}
            setPendingScrollTarget={setPendingScrollTarget}
            activeTab={sidebarTab}
            setActiveTab={updateSidebarTab}
            requests={requestsInbox.state.items}
            onAcceptRequest={handleAcceptRequest}
            onIgnoreRequest={handleIgnoreRequest}
            onBlockRequest={handleBlockRequest}
            onSelectRequest={handleSelectRequest}
          />
        </div>
      }
    >
      <NewChatDialog
        isOpen={isNewChatOpen}
        onClose={closeNewChat}
        pubkey={newChatPubkey}
        setPubkey={setNewChatPubkey}
        displayName={newChatDisplayName}
        setDisplayName={setNewChatDisplayName}
        onCreate={createChat}
        verifyRecipient={dmController.verifyRecipient}
      />

      <NewGroupDialog
        isOpen={isNewGroupOpen}
        onClose={() => {
          setIsNewGroupOpen(false);
          setNewGroupName("");
          setNewGroupMemberPubkeys("");
        }}
        name={newGroupName}
        setName={setNewGroupName}
        memberPubkeys={newGroupMemberPubkeys}
        setMemberPubkeys={setNewGroupMemberPubkeys}
        onCreate={createGroup}
      />

      <div className="flex flex-1 overflow-hidden">
        <main className="page-transition flex flex-1 flex-col bg-zinc-50 dark:bg-black">
          {isIdentityLocked ? (
            <div className="flex flex-1 items-center justify-center p-6">
              {!identity.state.stored ? (
                <OnboardingWizard
                  onComplete={() => {
                    dismissOnboarding();
                    window.location.reload();
                  }}
                />
              ) : (
                <div className="w-full max-w-md space-y-4">
                  {showOnboarding ? (
                    <Card title={t("messaging.gettingStarted")} description={t("messaging.gettingStartedDesc")} className="w-full">
                      <div className="space-y-3 text-left">
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <div className={isStep1Done ? "mt-0.5 h-5 w-5 flex-none rounded-full border border-emerald-500/30 bg-emerald-500/10 text-center text-xs leading-5 text-emerald-800 dark:text-emerald-200" : "mt-0.5 h-5 w-5 flex-none rounded-full border border-black/20 bg-white text-center text-xs leading-5 dark:border-white/10 dark:bg-zinc-950/60"}>
                              {isStep1Done ? "✓" : "1"}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("messaging.unlockIdentity")}</div>
                              <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("messaging.unlockIdentityDesc")}</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className={isStep2Done ? "mt-0.5 h-5 w-5 flex-none rounded-full border border-emerald-500/30 bg-emerald-500/10 text-center text-xs leading-5 text-emerald-800 dark:text-emerald-200" : "mt-0.5 h-5 w-5 flex-none rounded-full border border-black/20 bg-white text-center text-xs leading-5 dark:border-white/10 dark:bg-zinc-950/60"}>
                              {isStep2Done ? "✓" : "2"}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("messaging.connectRelays")}</div>
                              <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("messaging.connectRelaysDesc")}</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 h-5 w-5 flex-none rounded-full border border-black/20 bg-white text-center text-xs leading-5 dark:border-white/10 dark:bg-zinc-950/60">3</div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("messaging.startAChat")}</div>
                              <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("messaging.startAChatDesc")}</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" onClick={() => router.push("/settings")}>{t("messaging.openSettings")}</Button>
                          <Button type="button" variant="secondary" onClick={dismissOnboarding}>{t("common.dismiss")}</Button>
                        </div>
                      </div>
                    </Card>
                  ) : null}
                  <Card title={t("messaging.identityLocked")} description={t("messaging.identityLockedDesc")} className="w-full">
                    <div className="space-y-3">
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("messaging.passphraseProtectDesc")}</div>
                      <IdentityCard embedded />
                    </div>
                  </Card>
                </div>
              )}
            </div>
          ) : !selectedConversationView ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="w-full max-w-lg space-y-4 px-6 text-center">
                {showWelcome && (
                  <div className="mb-8 p-8 rounded-[40px] bg-zinc-900/40 border border-white/[0.03] backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000 group">
                    <div className="relative">
                      <div className="absolute -inset-4 bg-white/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                      <h1 className="text-4xl font-bold bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent mb-3 tracking-tight">Welcome home</h1>
                      <p className="text-zinc-400 text-lg font-medium tracking-tight opacity-80">Your sanctuary is secure and ready for you.</p>
                    </div>
                  </div>
                )}
                <div>
                  <div className="mb-4 flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-black/10 bg-white text-2xl dark:border-white/10 dark:bg-zinc-950/60">+</div>
                  </div>
                  <h2 className="mb-2 text-xl font-semibold">{t("messaging.selectConversation")}</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("messaging.selectConversationDesc")}</p>
                </div>
                {myPublicKeyHex ? (
                  <Card title={t("messaging.share")} description={t("messaging.shareDesc")} className="w-full">
                    <div className="space-y-3">
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("messaging.pubkeySafeShare")}</div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" onClick={handleCopyMyPubkey}>{t("messaging.copyPubkey")}</Button>
                        <Button type="button" variant="secondary" onClick={handleCopyChatLink}>{t("messaging.copyChatLink")}</Button>
                      </div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">
                        Relay status: {relayStatus.openCount}/{relayStatus.total} open
                      </div>
                    </div>
                  </Card>
                ) : null}
              </div>
            </div>
          ) : (
            <ChatView
              conversation={selectedConversationView}
              messages={visibleSelectedMessages}
              rawMessagesCount={selectedCombinedMessages.length}
              hasHydrated={hasHydrated}
              hasEarlierMessages={hasEarlierMessages}
              onLoadEarlier={() => {
                const conversationId = selectedConversationView.id;
                setVisibleMessageCountByConversationId(prev => ({
                  ...prev,
                  [conversationId]: (prev[conversationId] ?? DEFAULT_VISIBLE_MESSAGES) + LOAD_EARLIER_STEP
                }));
              }}
              nowMs={nowMs}
              flashMessageId={flashMessageId}
              onCopyPubkey={handleCopyPubkey}
              onOpenMedia={() => setIsMediaGalleryOpen(true)}
              messageMenu={messageMenu}
              setMessageMenu={setMessageMenu}
              messageMenuRef={messageMenuRef}
              onCopyText={(text) => copyToClipboard(text)}
              onCopyAttachmentUrl={(url) => copyToClipboard(toAbsoluteUrl(url))}
              onReferenceMessage={(activeMessage) => setReplyTo({ messageId: activeMessage.id, previewText: getReplyPreviewText(activeMessage) })}
              onDeleteMessage={(messageId) => deleteMessage({ conversationId: selectedConversationView.id, messageId })}
              reactionPicker={reactionPicker}
              setReactionPicker={setReactionPicker}
              reactionPickerRef={reactionPickerRef}
              onToggleReaction={(messageId, emoji) => toggleReaction({ conversationId: selectedConversationView.id, messageId, emoji })}
              onRetryMessage={handleRetryMessage}
              messageInput={messageInput}
              setMessageInput={setMessageInput}
              handleSendMessage={handleSendMessage}
              isUploadingAttachment={isUploadingAttachment}
              pendingAttachment={pendingAttachment}
              pendingAttachmentPreviewUrl={pendingAttachmentPreviewUrl}
              attachmentError={attachmentError}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              onPickAttachment={onPickAttachment}
              clearPendingAttachment={clearPendingAttachment}
              relayStatus={relayStatus}
              composerTextareaRef={composerTextareaRef}
              isMediaGalleryOpen={isMediaGalleryOpen}
              setIsMediaGalleryOpen={setIsMediaGalleryOpen}
              selectedConversationMediaItems={selectedConversationMediaItems}
              lightboxIndex={lightboxIndex}
              setLightboxIndex={setLightboxIndex}
              recipientStatus={selectedConversationView.kind === 'dm' ? recipientVerificationStatus[selectedConversationView.id] : 'idle'}
            />
          )}
        </main>
      </div>
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
