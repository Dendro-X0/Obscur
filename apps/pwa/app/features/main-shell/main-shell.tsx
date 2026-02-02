"use client";

import type React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { AppShell } from "@/app/components/app-shell";
import { OnboardingWizard } from "@/app/components/onboarding-wizard";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { useEnhancedDmController } from "@/app/features/messaging/hooks/use-enhanced-dm-controller";
import { useBlocklist } from "@/app/features/contacts/hooks/use-blocklist";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { usePeerTrust } from "@/app/features/contacts/hooks/use-peer-trust";
import { useRequestsInbox } from "@/app/features/messaging/hooks/use-requests-inbox";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { useRelayPool } from "@/app/features/relays/hooks/use-relay-pool";
import type { RelayConnection } from "@/app/features/relays/utils/relay-connection";
import { getNotificationsEnabled } from "@/app/features/notifications/utils/get-notifications-enabled";
import { showDesktopNotification } from "@/app/features/notifications/utils/show-desktop-notification";
import { toast } from "@/app/components/ui/toast";
import { logAppEvent } from "@/app/shared/log-app-event";
import { useAppStatusSnapshot } from "@/app/shared/hooks/use-app-status-snapshot";
import { useTranslation } from "react-i18next";
import { ProfileSearchService } from "../search/services/profile-search-service";
import { SocialGraphService } from "../social-graph/services/social-graph-service";

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
} from "@/app/features/messaging/types";

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
} from "@/app/features/messaging/utils/persistence";

import {
  createContactId,
  createGroupId,
  createMessageId,
  syncIdCountersFromState
} from "@/app/features/messaging/utils/ids";

import {
  subscribeNowMs,
  getNowMsSnapshot,
  getNowMsServerSnapshot
} from "@/app/features/messaging/utils/time";

import {
  applyContactOverrides,
  isVisibleUserMessage,
  createEmptyReactions,
  toReactionsByEmoji
} from "@/app/features/messaging/utils/logic";

import {
  createDeleteCommandMessage,
  encodeCommandMessage,
  parseCommandMessage
} from "@/app/features/messaging/utils/commands";

import { Sidebar } from "@/app/features/messaging/components/sidebar";
import { ChatView } from "@/app/features/messaging/components/chat-view";
import { NewChatDialog } from "@/app/features/messaging/components/new-chat-dialog";
import { NewGroupDialog } from "@/app/features/messaging/components/new-group-dialog";
import { useAutoLock } from "@/app/features/settings/hooks/use-auto-lock";
import { LockScreen } from "@/app/components/lock-screen";
import type { Passphrase } from "@dweb/crypto/passphrase";
import { useUploadService } from "@/app/features/messaging/lib/upload-service";
import { EmptyConversationView } from "./components/empty-conversation-view";
import { LockedIdentityView } from "./components/locked-identity-view";

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
const INVITE_REQUEST_SENT_PREFIX: string = "obscur.invites.request_sent.v1";

type CoordinationInviteRedeemResponse = Readonly<{
  inviteId: string;
  inviterPubkey: string;
  communityLabel: string | null;
  relays: ReadonlyArray<string>;
  expiresAtUnixSeconds: number | null;
}>;

type InviteRedemptionStatus = "idle" | "needs_unlock" | "redeeming" | "success" | "invalid" | "expired" | "server_down" | "error";

type InviteRedemptionState = Readonly<{
  status: InviteRedemptionStatus;
  token: string | null;
  message: string | null;
}>;

const createInviteRedemptionState = (params: Readonly<{ status: InviteRedemptionStatus; token?: string | null; message?: string | null }>): InviteRedemptionState => {
  return { status: params.status, token: params.token ?? null, message: params.message ?? null };
};

const classifyInviteRedeemError = (message: string): InviteRedemptionStatus => {
  const normalized: string = message.toLowerCase();
  if (normalized.includes("coordination_not_configured") || normalized.includes("network") || normalized.includes("failed to fetch") || normalized.includes("timeout")) {
    return "server_down";
  }
  if (normalized.includes("expired")) {
    return "expired";
  }
  if (normalized.includes("invalid") || normalized.includes("not_found") || normalized.includes("already_redeemed")) {
    return "invalid";
  }
  return "error";
};

type CoordinationOkResponse<T> = Readonly<{ ok: true; data: T }>;

type CoordinationErrorResponse = Readonly<{ ok: false; error: string }>;

type CoordinationResponse<T> = CoordinationOkResponse<T> | CoordinationErrorResponse;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";

const getInviteRequestSentKey = (params: Readonly<{ redeemerPubkeyHex: string; inviteId: string }>): string => {
  return `${INVITE_REQUEST_SENT_PREFIX}.${params.redeemerPubkeyHex}.${params.inviteId}`;
};

const wasInviteRequestSent = (params: Readonly<{ redeemerPubkeyHex: string; inviteId: string }>): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(getInviteRequestSentKey(params)) === "1";
  } catch {
    return false;
  }
};

const markInviteRequestSent = (params: Readonly<{ redeemerPubkeyHex: string; inviteId: string }>): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getInviteRequestSentKey(params), "1");
  } catch {
    return;
  }
};

const getCoordinationBaseUrl = (): string | null => {
  const raw: string = (process.env.NEXT_PUBLIC_COORDINATION_URL ?? "").trim();
  if (!raw) {
    return null;
  }
  return raw.replace(/\/+$/, "");
};

const parseCoordinationResponse = <T,>(value: unknown): CoordinationResponse<T> | null => {
  if (!isRecord(value)) {
    return null;
  }
  const ok: unknown = value.ok;
  if (ok === true) {
    return value as CoordinationOkResponse<T>;
  }
  if (ok === false) {
    return value as CoordinationErrorResponse;
  }
  return null;
};

const redeemInviteToken = async (params: Readonly<{ token: string; redeemerPubkey: string }>): Promise<CoordinationInviteRedeemResponse> => {
  const baseUrl: string | null = getCoordinationBaseUrl();
  if (!baseUrl) {
    throw new Error("coordination_not_configured");
  }
  logAppEvent({
    name: "coordination.invite.redeem.start",
    level: "info",
    scope: { feature: "invites", action: "redeem" },
    context: { hasBaseUrl: true }
  });
  const response: Response = await fetch(`${baseUrl}/invites/redeem`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: params.token, redeemerPubkey: params.redeemerPubkey })
  });
  const raw: unknown = await response.json().catch((): null => null);
  const parsed: CoordinationResponse<CoordinationInviteRedeemResponse> | null = parseCoordinationResponse<CoordinationInviteRedeemResponse>(raw);
  if (!parsed) {
    throw new Error("coordination_invalid_response");
  }
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  logAppEvent({
    name: "coordination.invite.redeem.success",
    level: "info",
    scope: { feature: "invites", action: "redeem" },
    context: { relaysCount: parsed.data.relays.length }
  });
  return parsed.data;
};

const getProfileStorageKey = (publicKeyHex: string): string => `${PROFILE_STORAGE_PREFIX}.${publicKeyHex}`;
function NostrMessengerContent() {
  const { t } = useTranslation();
  const didHydrateFromStorageRef = useRef<boolean>(false);
  const lastRelayStatusRef = useRef<"offline" | "connecting" | "connected" | "degraded" | null>(null);
  const lastInviteRedemptionStatusRef = useRef<InviteRedemptionStatus | null>(null);
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

  const appStatusSnapshot = useAppStatusSnapshot({
    identity: identity.state,
    relayConnections: relayPool.connections
  });

  useEffect((): void => {
    if (appStatusSnapshot.identity.status !== "unlocked") {
      lastRelayStatusRef.current = null;
      return;
    }
    const next: "offline" | "connecting" | "connected" | "degraded" = appStatusSnapshot.relay.status;
    const previous: "offline" | "connecting" | "connected" | "degraded" | null = lastRelayStatusRef.current;
    if (previous === next) {
      return;
    }
    lastRelayStatusRef.current = next;
    logAppEvent({
      name: "relays.status.changed",
      level: "info",
      scope: { feature: "relays", action: "status" },
      context: {
        from: previous ?? "unknown",
        to: next,
        openCount: relayStatus.openCount,
        total: relayStatus.total,
        errorCount: relayStatus.errorCount
      }
    });
    if (next === "offline") {
      toast.warning("Relays are offline. Messaging may not work.");
      return;
    }
    if (next === "degraded") {
      toast.warning("Relay connectivity is degraded.");
      return;
    }
    if (next === "connected" && previous !== null) {
      toast.success("Relays connected.");
    }
  }, [appStatusSnapshot.identity.status, appStatusSnapshot.relay.status, relayStatus.errorCount, relayStatus.openCount, relayStatus.total]);

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
  const socialGraphService = useMemo(() => new SocialGraphService(relayPool), [relayPool]);
  const profileSearchService = useMemo(() => new ProfileSearchService(relayPool, socialGraphService, identity.state.publicKeyHex ?? undefined), [relayPool, socialGraphService, identity.state.publicKeyHex]);

  const handleSearchProfiles = useCallback(async (query: string) => {
    return await profileSearchService.searchByName(query);
  }, [profileSearchService]);

  const uploadService = useUploadService();

  const [inviteRedemption, setInviteRedemption] = useState<InviteRedemptionState>(() => createInviteRedemptionState({ status: "idle" }));

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
    const pubkey: string = (searchParams.get("chat") || searchParams.get("pubkey") || "").trim();
    const relays: string = (searchParams.get("relays") || "").trim();
    const inviteToken: string = (searchParams.get("inviteToken") || "").trim();

    if (!pubkey && !relays && !inviteToken) {
      return;
    }

    const identityKey: string = (identity.state.publicKeyHex ?? "").trim();
    const cacheKey = `${pubkey}:${relays}:${inviteToken}:${identityKey}`;
    if (handledSearchParamPubkeyRef.current === cacheKey) {
      return;
    }
    handledSearchParamPubkeyRef.current = cacheKey;

    if (inviteToken) {
      if (!identity.state.publicKeyHex) {
        setInviteRedemption(createInviteRedemptionState({ status: "needs_unlock", token: inviteToken }));
        return;
      }
      setInviteRedemption(createInviteRedemptionState({ status: "redeeming", token: inviteToken }));
      void (async (): Promise<void> => {
        try {
          const redeemed = await redeemInviteToken({ token: inviteToken, redeemerPubkey: identity.state.publicKeyHex as string });
          redeemed.relays.forEach((url: string): void => {
            relayList.addRelay({ url });
          });
          logAppEvent({
            name: "invites.inviteToken.redeemed",
            level: "info",
            scope: { feature: "invites", action: "redeem" },
            context: { relaysCount: redeemed.relays.length }
          });
          setInviteRedemption(createInviteRedemptionState({ status: "success", token: inviteToken }));
          const parsed = parsePublicKeyInput(redeemed.inviterPubkey);
          if (parsed.ok) {
            const myPk: string = identity.state.publicKeyHex as string;
            if (!wasInviteRequestSent({ redeemerPubkeyHex: myPk, inviteId: redeemed.inviteId })) {
              logAppEvent({
                name: "requests.invite_auto_send.start",
                level: "info",
                scope: { feature: "requests", action: "invite_auto_send" },
                context: { inviteId: redeemed.inviteId }
              });
              try {
                const sent = await dmController.sendConnectionRequest({ peerPublicKeyHex: parsed.publicKeyHex as PublicKeyHex });
                if (sent.success) {
                  markInviteRequestSent({ redeemerPubkeyHex: myPk, inviteId: redeemed.inviteId });
                  logAppEvent({
                    name: "requests.invite_auto_send.success",
                    level: "info",
                    scope: { feature: "requests", action: "invite_auto_send" },
                    context: { inviteId: redeemed.inviteId }
                  });
                  toast.success("Connection request sent.");
                } else {
                  logAppEvent({
                    name: "requests.invite_auto_send.failure",
                    level: "warn",
                    scope: { feature: "requests", action: "invite_auto_send" },
                    context: { inviteId: redeemed.inviteId, error: sent.error ?? "unknown" }
                  });
                  toast.warning("Invite redeemed, but sending the connection request failed.");
                }
              } catch (e: unknown) {
                const message: string = e instanceof Error ? e.message : "unknown";
                logAppEvent({
                  name: "requests.invite_auto_send.failure",
                  level: "warn",
                  scope: { feature: "requests", action: "invite_auto_send" },
                  context: { inviteId: redeemed.inviteId, error: message }
                });
                toast.warning("Invite redeemed, but sending the connection request failed.");
              }
            }
            queueMicrotask((): void => {
              setNewChatPubkey(parsed.publicKeyHex);
              setNewChatDisplayName("");
              setIsNewChatOpen(true);
              router.replace("/");
            });
            return;
          }
          router.replace("/");
        } catch (error: unknown) {
          const message: string = error instanceof Error ? error.message : "Invite redeem failed";
          const status: InviteRedemptionStatus = classifyInviteRedeemError(message);
          logAppEvent({
            name: "invites.inviteToken.redeem_failed",
            level: "error",
            scope: { feature: "invites", action: "redeem" },
            context: { error: message, classifiedAs: status }
          });
          setInviteRedemption(createInviteRedemptionState({ status, token: inviteToken, message }));
          router.replace("/");
        }
      })();
      return;
    }

    // Handle relay hints
    if (relays) {
      const relayUrls = relays.split(',').map(r => r.trim()).filter(Boolean);
      relayUrls.forEach(url => {
        relayList.addRelay({ url });
      });
    }

    // Handle pubkey/npub
    if (pubkey) {
      const parsed = parsePublicKeyInput(pubkey);
      if (parsed.ok) {
        queueMicrotask((): void => {
          setNewChatPubkey(parsed.publicKeyHex);
          setNewChatDisplayName("");
          setIsNewChatOpen(true);
          router.replace("/");
        });
      }
    }
  }, [router, searchParams, relayList, identity.state.publicKeyHex, dmController]);

  useEffect((): void => {
    const previous: InviteRedemptionStatus | null = lastInviteRedemptionStatusRef.current;
    if (previous === inviteRedemption.status) {
      return;
    }
    lastInviteRedemptionStatusRef.current = inviteRedemption.status;
    if (inviteRedemption.status === "idle") {
      return;
    }
    logAppEvent({
      name: "invites.redeem.status",
      level: "info",
      scope: { feature: "invites", action: "redeem" },
      context: { status: inviteRedemption.status }
    });
    if (inviteRedemption.status === "needs_unlock") {
      toast.info("Unlock to redeem invite.");
      return;
    }
    if (inviteRedemption.status === "redeeming") {
      toast.info("Redeeming invite...");
      return;
    }
    if (inviteRedemption.status === "success") {
      toast.success("Invite redeemed. Relay hints applied.");
      return;
    }
    if (inviteRedemption.status === "expired") {
      toast.error("Invite is expired.");
      return;
    }
    if (inviteRedemption.status === "invalid") {
      toast.error("Invite is invalid.");
      return;
    }
    if (inviteRedemption.status === "server_down") {
      toast.error("Invite server is unavailable. Try again later.");
      return;
    }
    toast.error(inviteRedemption.message ? `Invite redeem failed: ${inviteRedemption.message}` : "Invite redeem failed.");
  }, [inviteRedemption.message, inviteRedemption.status]);

  useEffect((): void => {
    const accepted = dmController.state.messages
      .filter((m: Message): boolean => m.isOutgoing)
      .filter((m: Message): boolean => m.status === "accepted")
      .filter((m: Message): boolean => !handledAcceptedOutgoingDmIdsRef.current.has(m.id));
    if (accepted.length === 0) {
      return;
    }
    accepted.forEach((m: Message): void => {
      handledAcceptedOutgoingDmIdsRef.current.add(m.id);
    });
    const acceptedIds: ReadonlySet<string> = new Set(accepted.map((m: Message): string => m.id));
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
      .filter((m: Message): boolean => m.isOutgoing)
      .filter((m: Message): boolean => m.status === "rejected")
      .filter((m: Message): boolean => !handledRejectedOutgoingDmIdsRef.current.has(m.id));
    if (rejected.length === 0) {
      return;
    }
    rejected.forEach((m: Message): void => {
      handledRejectedOutgoingDmIdsRef.current.add(m.id);
    });
    const rejectedIds: ReadonlySet<string> = new Set(rejected.map((m: Message): string => m.id));
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
      .filter((m: Message): boolean => !m.isOutgoing)
      .map((m: Message): Readonly<{ id: string; peerPublicKeyHex: PublicKeyHex; plaintext: string; createdAtUnixSeconds: number }> => ({
        id: m.id,
        peerPublicKeyHex: m.senderPubkey as PublicKeyHex,
        plaintext: m.content,
        createdAtUnixSeconds: Math.floor(m.timestamp.getTime() / 1000),
      }))
      .filter((m: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): boolean => !isPeerBlocked({ publicKeyHex: m.peerPublicKeyHex }))
      .filter((m: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): boolean => !isPeerMuted({ publicKeyHex: m.peerPublicKeyHex }))
      .filter((m: Readonly<{ id: string }>): boolean => !handledIncomingDmIdsRef.current.has(m.id));
    if (incoming.length === 0) {
      return;
    }
    incoming.forEach((dm: Readonly<{ id: string }>): void => {
      handledIncomingDmIdsRef.current.add(dm.id);
    });

    const acceptedIncoming = incoming.filter((dm: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): boolean => isPeerAccepted({ publicKeyHex: dm.peerPublicKeyHex }));

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
      acceptedIncoming.forEach((dm: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): void => {
        const peer: string = dm.peerPublicKeyHex;
        showDesktopNotification({ title: "New message", body: `From ${peer.slice(0, 8)}…`, tag: `dm-${peer}` });
      });
    }

    const conversationIdByPeer: Map<PublicKeyHex, string> = new Map();
    createdContacts.forEach((c: DmConversation): void => {
      conversationIdByPeer.set(c.pubkey, c.id);
    });
    const newContacts: DmConversation[] = [];
    acceptedIncoming.forEach((dm: Readonly<{ peerPublicKeyHex: PublicKeyHex; plaintext: string; createdAtUnixSeconds: number }>): void => {
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
        acceptedIncoming.forEach((dm: Readonly<{ peerPublicKeyHex: PublicKeyHex; plaintext: string; createdAtUnixSeconds: number; id: string }>): void => {
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
      void dmController.verifyRecipient(conversation.pubkey as PublicKeyHex).then((result: { exists: boolean; profile?: any }) => {
        setRecipientVerificationStatus(prev => ({
          ...prev,
          [conversation.id]: result.exists ? 'found' : 'not_found'
        }));
      });
    }
  }, [dmController, recipientVerificationStatus]);

  const createChat = async (): Promise<void> => {
    const pubkey: string = newChatPubkey.trim();
    const displayName: string = (newChatDisplayName.trim() || pubkey.slice(0, 8)).trim();
    if (!pubkey) {
      return;
    }

    let resolvedPubkey: PublicKeyHex | null = null;
    let relayHints: string[] = [];

    const parsed = parsePublicKeyInput(pubkey);
    if (parsed.ok) {
      resolvedPubkey = parsed.publicKeyHex;
      relayHints = parsed.relays || [];
    } else if (pubkey.includes('@')) {
      // Resolve NIP-05
      const nip05 = await import("@/app/features/profile/utils/nip05-resolver").then(m => m.resolveNip05(pubkey));
      if (nip05.ok) {
        resolvedPubkey = nip05.publicKeyHex;
      }
    }

    if (!resolvedPubkey) {
      return;
    }

    if (!peerTrust.isAccepted({ publicKeyHex: resolvedPubkey })) {
      return;
    }

    // Handle relay hints
    if (relayHints.length > 0) {
      relayHints.forEach(url => {
        try {
          relayList.addRelay({ url });
        } catch (e) {
          console.warn("Failed to add relay hint:", url, e);
        }
      });
    }

    const id: string = createContactId();
    const baseNowMs: number = nowMs ?? 0;
    const contact: DmConversation = {
      kind: "dm",
      id,
      displayName,
      pubkey: resolvedPubkey,
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
        // if (attachment) {
        //   throw new Error("Attachments are not supported for DMs yet.");
        // }
        if (blocklist.isBlocked({ publicKeyHex: selectedConversation.pubkey })) {
          throw new Error("Recipient is blocked.");
        }
        if (!isPeerAccepted({ publicKeyHex: selectedConversation.pubkey })) {
          throw new Error("Peer is not accepted. Send a connection request first.");
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
      .then((sent: { success: boolean; messageId: string }): void => {
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

  // Real-time Gossip: Watch the active conversation's relays
  useEffect(() => {
    if (selectedConversationView?.kind === 'dm' && selectedConversationView.pubkey) {
      void dmController.watchConversation(selectedConversationView.pubkey);
    }
  }, [selectedConversationView, dmController]);

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
    requestsInbox.setStatus({ peerPublicKeyHex, status: 'accepted' });

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
  }, [peerTrust, createdContacts, selectConversation, requestsInbox]);

  const handleIgnoreRequest = useCallback((peerPublicKeyHex: PublicKeyHex) => {
    requestsInbox.setStatus({ peerPublicKeyHex, status: "declined" });
    requestsInbox.remove({ peerPublicKeyHex });
  }, [requestsInbox]);

  const handleBlockRequest = useCallback((peerPublicKeyHex: PublicKeyHex) => {
    blocklist.addBlocked({ publicKeyInput: peerPublicKeyHex });
    peerTrust.unacceptPeer({ publicKeyHex: peerPublicKeyHex });
    peerTrust.unmutePeer({ publicKeyHex: peerPublicKeyHex });
    requestsInbox.setStatus({ peerPublicKeyHex, status: "declined" });
    requestsInbox.remove({ peerPublicKeyHex });
  }, [blocklist, peerTrust, requestsInbox]);

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
        onForget={identity.forgetIdentity}
      />
    );
  }

  return (
    <AppShell
      hideSidebar={!isIdentityUnlocked}
      navBadgeCounts={{ "/": chatsUnreadCount }}
      sidebarContent={
        isIdentityUnlocked ? (
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
        ) : null
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
        searchProfiles={handleSearchProfiles}
        isAccepted={(pub) => peerTrust.isAccepted({ publicKeyHex: pub as PublicKeyHex })}
        sendConnectionRequest={async (params) => {
          // Wrap request sending to auto-create the chat
          const result = await dmController.sendConnectionRequest(params);
          if (result.success) {
            // 1. Locally trust the user we just invited
            peerTrust.acceptPeer({ publicKeyHex: params.peerPublicKeyHex });

            // 2. Create the conversation object immediately
            const id = createContactId();
            const baseNowMs = nowMs ?? Date.now();
            const displayName = (newChatDisplayName.trim() || params.peerPublicKeyHex.slice(0, 8)).trim();

            const contact: DmConversation = {
              kind: "dm",
              id,
              displayName,
              pubkey: params.peerPublicKeyHex,
              lastMessage: params.introMessage || "Connection request sent",
              unreadCount: 0,
              lastMessageTime: new Date(baseNowMs),
            };

            // 3. Update state to show the chat
            upsertCreatedContact(contact);
            setUnreadByConversationId((prev) => ({
              ...prev,
              [id]: 0,
            }));

            // 4. Open the chat
            closeNewChat();
            selectConversation(contact);

            // 5. Add a system message (fake) to show the request in chat?
            // Optional, but for now the 'lastMessage' update in controller might handle it?
            // controller sends a DM. If successful, it persists it.
            // But we need to make sure the UI sees it.
          } else {
            toast.error(result.error || "Failed to send request");
            throw new Error(result.error || "Failed to send request");
          }
          return result;
        }}
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
                <LockedIdentityView
                  showOnboarding={showOnboarding}
                  isStep1Done={isStep1Done}
                  isStep2Done={isStep2Done}
                  onOpenSettings={() => router.push("/settings")}
                  onDismissOnboarding={dismissOnboarding}
                  onForget={identity.forgetIdentity}
                />
              )}
            </div>
          ) : !selectedConversationView ? (
            <EmptyConversationView
              showWelcome={showWelcome}
              myPublicKeyHex={myPublicKeyHex}
              relayStatus={relayStatus}
              onCopyMyPubkey={handleCopyMyPubkey}
              onCopyChatLink={handleCopyChatLink}
            />
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
              isPeerAccepted={selectedConversationView.kind === 'dm' ? peerTrust.isAccepted({ publicKeyHex: selectedConversationView.pubkey }) : true}
              onAcceptPeer={() => selectedConversationView.kind === 'dm' && handleAcceptRequest(selectedConversationView.pubkey)}
              onBlockPeer={() => selectedConversationView.kind === 'dm' && handleBlockRequest(selectedConversationView.pubkey)}
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
