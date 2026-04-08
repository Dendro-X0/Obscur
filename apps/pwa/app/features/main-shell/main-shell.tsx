"use client";

import type React from "react";
import { Suspense, startTransition, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  VoiceCallInvitePayload,
} from "@/app/features/messaging/types";

import {
  applyConnectionOverrides,
  extractAttachmentsFromContent
} from "@/app/features/messaging/utils/logic";
import { createRealtimeVoiceSessionOwner } from "@/app/features/messaging/services/realtime-voice-session-owner";
import { getRealtimeVoiceCapability } from "@/app/features/messaging/services/realtime-voice-capability";
import { resolveVoiceInviteTombstoneVerdict } from "@/app/features/messaging/services/realtime-voice-invite-tombstone";
import {
  createVoiceCallSignalPayload,
  parseVoiceCallInvitePayload,
  parseVoiceCallSignalPayload,
  type VoiceCallSignalPayload,
} from "@/app/features/messaging/services/realtime-voice-signaling";
import { isRealtimeVoiceCallsEnabled } from "@/app/features/messaging/services/realtime-voice-feature-gate";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";

import {
  subscribeNowMs,
  getNowMsSnapshot,
  getNowMsServerSnapshot
} from "@/app/features/messaging/utils/time";

import { Sidebar } from "@/app/features/messaging/components/sidebar";
import { ChatView } from "@/app/features/messaging/components/chat-view";
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
import { getActiveProfileIdSafe, getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { useRequestTransport } from "@/app/features/messaging/hooks/use-request-transport";
import { configureInviteRequestStateBridge, configureInviteRequestTransportBridge } from "@/app/features/invites/utils/invite-manager";
import type { Connection as LegacyInviteConnection, ConnectionRequest as LegacyInviteRequest } from "@/app/features/invites/utils/types";
import { useAccountSyncSnapshot } from "@/app/features/account-sync/hooks/use-account-sync-snapshot";
import { useAccountProjectionSnapshot } from "@/app/features/account-sync/hooks/use-account-projection-snapshot";
import { resolveProjectionReadAuthority } from "@/app/features/account-sync/services/account-projection-read-authority";
import { resolveAccountSyncUiPolicy } from "@/app/features/account-sync/services/account-sync-ui-policy";
import {
  FIRST_LOGIN_HISTORY_SYNC_NOTICE_MIN_VISIBLE_MS,
  resolveHistorySyncNoticeVisible,
  shouldStartFirstLoginHistorySyncNoticeHold,
} from "@/app/features/account-sync/services/history-sync-notice-visibility";
import { AppLoadingScreen } from "@/app/components/app-loading-screen";
import { usePeerLastActiveByPeer } from "@/app/features/messaging/hooks/use-peer-last-active-by-peer";
import { getPublicGroupHref, getPublicProfileHref } from "@/app/features/navigation/public-routes";
import { logAppEvent } from "@/app/shared/log-app-event";
import { isRecentPresenceEvidenceActive } from "@/app/features/network/services/presence-evidence";
import { useResolvedProfileMetadata } from "@/app/features/profile/hooks/use-resolved-profile-metadata";
import {
  clearPendingVoiceCallRequest,
  PENDING_VOICE_CALL_REQUEST_MAX_AGE_MS,
  readPendingVoiceCallRequest,
} from "@/app/features/messaging/services/realtime-voice-pending-request";
import {
  setGlobalVoiceCallOverlayState,
  setGlobalVoiceCallOverlayWaveAudioLevel,
} from "@/app/features/messaging/services/realtime-voice-global-ui-store";
import { resolveIncomingVoiceInviteExit } from "@/app/features/messaging/services/realtime-voice-invite-exit";
import {
  VOICE_CALL_OVERLAY_ACTION_EVENT_NAME,
  extractVoiceCallOverlayAction,
  readAndConsumePendingVoiceCallOverlayAction,
  type VoiceCallOverlayAction,
} from "@/app/features/messaging/services/voice-call-overlay-action-bridge";
import { resolveRealtimeVoiceConnectTimeoutDecision } from "@/app/features/messaging/services/realtime-voice-timeout-policy";
import {
  advanceVoiceWaveAudioLevelChannel,
  getVoiceWaveOverlayLevel,
  type VoiceWaveAudioLevelState,
} from "@/app/features/messaging/services/realtime-voice-waveform-level";

const LAST_PAGE_STORAGE_KEY = "obscur-last-page";
const getLastPageStorageKey = (): string => getScopedStorageKey(LAST_PAGE_STORAGE_KEY);
const HISTORY_SYNC_NOTICE_FIRST_LOGIN_SEEN_KEY = "obscur.messaging.history_sync_notice.first_login_seen.v1";
const DEFAULT_VISIBLE_MESSAGES = 50;
const LOAD_EARLIER_STEP = 50;
const VOICE_CALL_MIN_WAIT_MS = 30_000;
const VOICE_CALL_INTERRUPTION_GRACE_MS = 30_000;
const VOICE_CALL_CONNECT_TIMEOUT_MAX_EXTENSIONS = 1;
const VOICE_CALL_LEAVE_TOMBSTONE_TTL_MS = 10 * 60 * 1000;
const VOICE_WAVE_SAMPLE_INTERVAL_MS = 120;
const VOICE_CALL_JOIN_REQUEST_RETRY_INTERVAL_MS = 3_000;
const VOICE_CALL_JOIN_REQUEST_RETRY_MAX_ATTEMPTS = 6;
const VOICE_CALL_OFFER_RETRY_INTERVAL_MS = 3_000;
const VOICE_CALL_OFFER_RETRY_MAX_ATTEMPTS = 6;
const VOICE_CALL_LEAVE_SIGNAL_RETRY_INTERVAL_MS = 1_500;
const VOICE_CALL_LEAVE_SIGNAL_RETRY_MAX_ATTEMPTS = 3;
const VOICE_SIGNAL_BOOTSTRAP_REPLAY_WINDOW_MS = 2 * 60 * 1000;
const VOICE_INVITE_BOOTSTRAP_REPLAY_WINDOW_MS = 5 * 60 * 1000;
const REALTIME_VOICE_CALLS_ENABLED = isRealtimeVoiceCallsEnabled();
const PRIVATE_CONTACT_DISPLAY_NAME = "Unknown contact";
const PRIVATE_CALLER_DISPLAY_NAME = "Unknown caller";

const toRoomIdHint = (roomIdInput: string): string => {
  const roomId = roomIdInput.trim();
  if (!roomId) {
    return "unknown-room";
  }
  if (roomId.length <= 24) {
    return roomId;
  }
  return `${roomId.slice(0, 10)}...${roomId.slice(-10)}`;
};

const toVoiceCallTombstoneKey = (params: Readonly<{ peerPubkey: string; roomId: string }>): string => (
  `${params.peerPubkey.trim()}|${params.roomId.trim()}`
);

const resolveVoiceMessageUnixMs = (params: Readonly<{
  signalSentAtUnixMs?: number;
  eventCreatedAt?: Date;
  messageTimestamp: Date;
}>): number => {
  if (typeof params.signalSentAtUnixMs === "number" && Number.isFinite(params.signalSentAtUnixMs)) {
    return Math.floor(params.signalSentAtUnixMs);
  }
  const createdAtUnixMs = params.eventCreatedAt?.getTime();
  if (typeof createdAtUnixMs === "number" && Number.isFinite(createdAtUnixMs)) {
    return createdAtUnixMs;
  }
  return params.messageTimestamp.getTime();
};

type ActiveVoiceCallSession = Readonly<{
  roomId: string;
  peerPubkey: string;
  role: "host" | "joiner";
}>;

type ActiveVoiceCallUiState = Readonly<{
  roomId: string;
  peerPubkey: string;
  role: "host" | "joiner";
  connectionState: "new" | "connecting" | "connected" | "disconnected" | "failed" | "closed";
}>;

type VoiceCallUiStatusState = Readonly<{
  roomId: string;
  peerPubkey: string;
  phase: "ringing_outgoing" | "ringing_incoming" | "connecting" | "connected" | "interrupted" | "ended";
  role: "host" | "joiner";
  sinceUnixMs: number;
  reasonCode?: "left_by_user" | "remote_left" | "network_interrupted" | "session_closed";
}>;

type PendingIncomingVoiceInvite = Readonly<{
  messageId: string;
  peerPubkey: string;
  inviterDisplayName: string;
  invite: VoiceCallInvitePayload;
  receivedAtUnixMs: number;
}>;

function NostrMessengerContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const isChatRoute = pathname === "/";
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
    messageMenu, setMessageMenu,
    reactionPicker, setReactionPicker,
    pinnedChatIds, togglePin,
    hiddenChatIds, hideConversation, clearHistory, unhideConversation,
    chatsUnreadCount,
    createdConnections, setCreatedConnections
  } = useMessaging();

  const { relayPool, relayStatus } = useRelay();
  const accountSyncSnapshot = useAccountSyncSnapshot();
  const accountProjectionSnapshot = useAccountProjectionSnapshot();
  const {
    createdGroups, isNewGroupOpen, setIsNewGroupOpen,
    updateGroup,
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
            displayName: existing?.displayName || PRIVATE_CONTACT_DISPLAY_NAME,
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
  const { handleSendMessage, deleteMessageForMe, deleteMessageForEveryone, toggleReaction } = useChatActions(dmController);
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
      const fallbackName = matchedConnection?.displayName || PRIVATE_CONTACT_DISPLAY_NAME;
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
          displayName: request.profile.displayName || PRIVATE_CONTACT_DISPLAY_NAME,
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
  const { allConversations, filteredConversations } = useFilteredConversations(
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
  const [isSendingVoiceCallInvite, setIsSendingVoiceCallInvite] = useState(false);
  const [joiningVoiceCallInviteMessageId, setJoiningVoiceCallInviteMessageId] = useState<string | null>(null);
  const [activeVoiceCallUiState, setActiveVoiceCallUiState] = useState<ActiveVoiceCallUiState | null>(null);
  const [voiceCallUiStatus, setVoiceCallUiStatus] = useState<VoiceCallUiStatusState | null>(null);
  const voiceCallUiStatusRef = useRef<VoiceCallUiStatusState | null>(null);
  const voiceWaveAudioLevelRef = useRef<VoiceWaveAudioLevelState>({
    local: 0,
    remote: 0,
  });
  const [incomingVoiceInvite, setIncomingVoiceInvite] = useState<PendingIncomingVoiceInvite | null>(null);
  const pendingBackgroundIncomingInviteRef = useRef<Readonly<{
    messageId: string;
    roomId: string;
  }> | null>(null);
  const realtimeVoiceSessionOwnerRef = useRef(createRealtimeVoiceSessionOwner());
  const activeVoiceCallSessionRef = useRef<ActiveVoiceCallSession | null>(null);
  const voicePeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const voiceLocalStreamRef = useRef<MediaStream | null>(null);
  const voiceRemoteStreamRef = useRef<MediaStream | null>(null);
  const voiceRemoteAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const voicePendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const voiceLocalAudioMonitorStopRef = useRef<(() => void) | null>(null);
  const voiceRemoteAudioMonitorStopRef = useRef<(() => void) | null>(null);
  const processedVoiceSignalMessageIdsRef = useRef<Set<string>>(new Set());
  const voiceSignalsBootstrappedRef = useRef(false);
  const processedVoiceInviteMessageIdsRef = useRef<Set<string>>(new Set());
  const voiceInvitesBootstrappedRef = useRef(false);
  const deferredVoiceInviteMessageIdsRef = useRef<Set<string>>(new Set());
  const outgoingVoiceInviteRoomIdsRef = useRef<Set<string>>(new Set());
  const voiceCallJoinAcceptedAtByRoomRef = useRef<Map<string, number>>(new Map());
  const voiceCallLeaveTombstonesRef = useRef<Map<string, number>>(new Map());
  const incomingVoiceRingtoneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceJoinRequestRetryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceJoinRequestRetryKeyRef = useRef<string | null>(null);
  const voiceJoinRequestRetryAttemptRef = useRef(0);
  const voiceOfferRetryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceOfferRetryKeyRef = useRef<string | null>(null);
  const voiceOfferRetryAttemptRef = useRef(0);
  const voiceCallConnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceCallInterruptionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceCallConnectTimeoutKeyRef = useRef<string | null>(null);
  const voiceCallConnectTimeoutExtensionAttemptRef = useRef(0);
  const voicePeerConnectionCreationRef = useRef<Promise<RTCPeerConnection | null> | null>(null);
  const voicePeerConnectionCreationKeyRef = useRef<string | null>(null);
  const voiceLeaveSignalRetryTimeoutsRef = useRef<Set<number>>(new Set());
  const leaveCallOnUnmountRef = useRef<() => void>(() => {});
  const relayStatusRef = useRef(relayStatus);
  const sendVoiceSignalRef = useRef<((params: Readonly<{
    peerPubkey: string;
    payload: VoiceCallSignalPayload;
  }>) => Promise<boolean>) | null>(null);

  useEffect(() => {
    voiceCallUiStatusRef.current = voiceCallUiStatus;
  }, [voiceCallUiStatus]);

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
  const selectedConversationDmPubkey = selectedConversationView?.kind === "dm"
    ? selectedConversationView.pubkey
    : null;
  const dmDisplayNameByPubkey = useMemo(() => {
    const map = new Map<string, string>();
    createdConnections.forEach((connection) => {
      if (connection.kind !== "dm") {
        return;
      }
      map.set(connection.pubkey, connection.displayName);
    });
    return map;
  }, [createdConnections]);
  const activeVoiceCallForSelectedConversation = (
    activeVoiceCallUiState
    && selectedConversationDmPubkey
    && activeVoiceCallUiState.peerPubkey === selectedConversationDmPubkey
  ) ? activeVoiceCallUiState : null;
  const voiceCallStatusForSelectedConversation = (
    voiceCallUiStatus
    && selectedConversationDmPubkey
    && voiceCallUiStatus.peerPubkey === selectedConversationDmPubkey
  ) ? voiceCallUiStatus : null;
  useEffect(() => {
    setIsSendingVoiceCallInvite(false);
    setJoiningVoiceCallInviteMessageId(null);
  }, [selectedConversationView?.id]);

  const sendVoiceSignal = useCallback(async (params: Readonly<{
    peerPubkey: string;
    payload: VoiceCallSignalPayload;
  }>): Promise<boolean> => {
    if (!dmController) {
      return false;
    }
    try {
      const result = await dmController.sendDm({
        peerPublicKeyInput: params.peerPubkey,
        plaintext: JSON.stringify(params.payload),
        customTags: [["t", "voice-call-signal"]],
      });
      const hasImmediateRelayEvidence = (
        result.deliveryStatus === "sent_quorum"
        || result.deliveryStatus === "sent_partial"
      );
      const hasLegacyRelayWriteEvidence = result.deliveryStatus === undefined
        ? (result.success || result.relayResults.some((relayResult) => relayResult.success))
        : false;
      const signalSent = hasImmediateRelayEvidence || hasLegacyRelayWriteEvidence;
      logAppEvent({
        name: "messaging.realtime_voice.signal_send_result",
        level: signalSent ? "info" : "warn",
        scope: { feature: "messaging", action: "realtime_voice_signal" },
        context: {
          status: signalSent ? "sent" : "failed",
          deliveryStatus: result.deliveryStatus ?? "legacy",
          signalType: params.payload.signalType,
          roomIdHint: toRoomIdHint(params.payload.roomId),
          relayResultCount: result.relayResults.length,
        },
      });
      return signalSent;
    } catch {
      logAppEvent({
        name: "messaging.realtime_voice.signal_send_result",
        level: "error",
        scope: { feature: "messaging", action: "realtime_voice_signal" },
        context: {
          status: "error",
          signalType: params.payload.signalType,
          roomIdHint: toRoomIdHint(params.payload.roomId),
        },
      });
      return false;
    }
  }, [dmController]);

  useEffect(() => {
    sendVoiceSignalRef.current = sendVoiceSignal;
  }, [sendVoiceSignal]);

  useEffect(() => {
    relayStatusRef.current = relayStatus;
  }, [relayStatus]);

  const pruneVoiceCallLeaveTombstones = useCallback((): void => {
    const nowUnixMs = Date.now();
    const tombstones = voiceCallLeaveTombstonesRef.current;
    tombstones.forEach((leftAtUnixMs, key) => {
      if (nowUnixMs - leftAtUnixMs > VOICE_CALL_LEAVE_TOMBSTONE_TTL_MS) {
        tombstones.delete(key);
      }
    });
  }, []);

  const playIncomingVoiceRingBurst = useCallback((): void => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const AudioContextCtor: typeof AudioContext | undefined =
        window.AudioContext
        || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        return;
      }
      const audioContext = new AudioContextCtor();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(860, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.05, audioContext.currentTime + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.28);
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      window.setTimeout(() => {
        void audioContext.close().catch(() => {
          // best effort cleanup
        });
      }, 380);
    } catch {
      // best effort notification sound only
    }
  }, []);

  const updateVoiceWaveAudioLevel = useCallback((channel: "local" | "remote", nextLevel: number): void => {
    const current = voiceWaveAudioLevelRef.current;
    const nextLevels = advanceVoiceWaveAudioLevelChannel({
      current,
      channel,
      nextSample: nextLevel,
    });
    if (nextLevels === current) {
      return;
    }
    voiceWaveAudioLevelRef.current = nextLevels;
    setGlobalVoiceCallOverlayWaveAudioLevel(getVoiceWaveOverlayLevel(nextLevels));
  }, []);

  const stopVoiceAudioMonitor = useCallback((channel: "local" | "remote"): void => {
    const stopRef = channel === "local" ? voiceLocalAudioMonitorStopRef : voiceRemoteAudioMonitorStopRef;
    const stop = stopRef.current;
    if (stop) {
      stopRef.current = null;
      stop();
      return;
    }
    const current = voiceWaveAudioLevelRef.current;
    if (channel === "local") {
      if (current.local === 0) {
        return;
      }
      const nextLevels = { ...current, local: 0 };
      voiceWaveAudioLevelRef.current = nextLevels;
      setGlobalVoiceCallOverlayWaveAudioLevel(Math.max(nextLevels.local, nextLevels.remote));
      return;
    }
    if (current.remote === 0) {
      return;
    }
    const nextLevels = { ...current, remote: 0 };
    voiceWaveAudioLevelRef.current = nextLevels;
    setGlobalVoiceCallOverlayWaveAudioLevel(Math.max(nextLevels.local, nextLevels.remote));
  }, []);

  const startVoiceAudioMonitor = useCallback((params: Readonly<{
    channel: "local" | "remote";
    stream: MediaStream;
  }>): void => {
    stopVoiceAudioMonitor(params.channel);
    if (typeof window === "undefined") {
      return;
    }
    if (params.stream.getAudioTracks().length === 0) {
      return;
    }
    try {
      const AudioContextCtor: typeof AudioContext | undefined =
        window.AudioContext
        || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        return;
      }
      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(params.stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.85;
      source.connect(analyser);

      const samples = new Uint8Array(analyser.fftSize);
      let disposed = false;
      let intervalId: ReturnType<typeof setInterval> | null = null;
      const sampleLevel = (): void => {
        if (disposed) {
          return;
        }
        analyser.getByteTimeDomainData(samples);
        let sumSquares = 0;
        for (let index = 0; index < samples.length; index += 1) {
          const centered = (samples[index] - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / samples.length);
        const normalized = Math.max(0, Math.min(1, (rms - 0.02) / 0.16));
        updateVoiceWaveAudioLevel(params.channel, normalized);
      };
      sampleLevel();
      intervalId = setInterval(() => {
        sampleLevel();
      }, VOICE_WAVE_SAMPLE_INTERVAL_MS);

      const stop = (): void => {
        if (disposed) {
          return;
        }
        disposed = true;
        if (intervalId !== null) {
          clearInterval(intervalId);
        }
        try {
          source.disconnect();
        } catch {
          // best effort
        }
        try {
          analyser.disconnect();
        } catch {
          // best effort
        }
        void audioContext.close().catch(() => {
          // best effort
        });
        updateVoiceWaveAudioLevel(params.channel, 0);
      };

      if (params.channel === "local") {
        voiceLocalAudioMonitorStopRef.current = stop;
      } else {
        voiceRemoteAudioMonitorStopRef.current = stop;
      }
    } catch {
      updateVoiceWaveAudioLevel(params.channel, 0);
    }
  }, [stopVoiceAudioMonitor, updateVoiceWaveAudioLevel]);

  const clearVoiceCallTimers = useCallback((): void => {
    if (voiceCallConnectTimeoutRef.current) {
      clearTimeout(voiceCallConnectTimeoutRef.current);
      voiceCallConnectTimeoutRef.current = null;
    }
    if (voiceCallInterruptionTimeoutRef.current) {
      clearTimeout(voiceCallInterruptionTimeoutRef.current);
      voiceCallInterruptionTimeoutRef.current = null;
    }
  }, []);

  const clearVoiceLeaveSignalRetryTimers = useCallback((): void => {
    const timeouts = voiceLeaveSignalRetryTimeoutsRef.current;
    timeouts.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    timeouts.clear();
  }, []);

  const clearVoiceJoinRequestRetryInterval = useCallback((): void => {
    if (voiceJoinRequestRetryIntervalRef.current) {
      clearInterval(voiceJoinRequestRetryIntervalRef.current);
      voiceJoinRequestRetryIntervalRef.current = null;
    }
    voiceJoinRequestRetryKeyRef.current = null;
    voiceJoinRequestRetryAttemptRef.current = 0;
  }, []);

  const clearVoiceOfferRetryInterval = useCallback((): void => {
    if (voiceOfferRetryIntervalRef.current) {
      clearInterval(voiceOfferRetryIntervalRef.current);
      voiceOfferRetryIntervalRef.current = null;
    }
    voiceOfferRetryKeyRef.current = null;
    voiceOfferRetryAttemptRef.current = 0;
  }, []);

  const stopVoiceLocalStream = useCallback((): void => {
    stopVoiceAudioMonitor("local");
    const stream = voiceLocalStreamRef.current;
    if (!stream) {
      return;
    }
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // best effort
      }
    });
    voiceLocalStreamRef.current = null;
  }, [stopVoiceAudioMonitor]);

  const clearVoiceRemoteStream = useCallback((): void => {
    stopVoiceAudioMonitor("remote");
    if (voiceRemoteAudioElementRef.current) {
      voiceRemoteAudioElementRef.current.srcObject = null;
    }
    voiceRemoteStreamRef.current = null;
  }, [stopVoiceAudioMonitor]);

  const tearDownVoicePeerConnection = useCallback((params?: Readonly<{ reasonCode?: "left_by_user" | "session_closed" }>): void => {
    const previousSession = activeVoiceCallSessionRef.current;
    clearVoiceCallTimers();
    clearVoiceLeaveSignalRetryTimers();
    clearVoiceJoinRequestRetryInterval();
    clearVoiceOfferRetryInterval();
    voicePeerConnectionCreationRef.current = null;
    voicePeerConnectionCreationKeyRef.current = null;
    const connection = voicePeerConnectionRef.current;
    if (connection) {
      connection.onicecandidate = null;
      connection.ontrack = null;
      connection.onconnectionstatechange = null;
      try {
        connection.close();
      } catch {
        // best effort
      }
    }
    voicePeerConnectionRef.current = null;
    voicePendingIceCandidatesRef.current = [];
    clearVoiceRemoteStream();
    stopVoiceLocalStream();
    realtimeVoiceSessionOwnerRef.current.closed({ eventUnixMs: Date.now() });
    realtimeVoiceSessionOwnerRef.current.left({
      reasonCode: params?.reasonCode ?? "session_closed",
      eventUnixMs: Date.now(),
    });
    activeVoiceCallSessionRef.current = null;
    setActiveVoiceCallUiState(null);
    if (previousSession) {
      voiceCallJoinAcceptedAtByRoomRef.current.delete(previousSession.roomId);
      setVoiceCallUiStatus({
        roomId: previousSession.roomId,
        peerPubkey: previousSession.peerPubkey,
        phase: "ended",
        role: previousSession.role,
        sinceUnixMs: Date.now(),
        reasonCode: params?.reasonCode ?? "session_closed",
      });
    }
  }, [clearVoiceCallTimers, clearVoiceLeaveSignalRetryTimers, clearVoiceJoinRequestRetryInterval, clearVoiceOfferRetryInterval, clearVoiceRemoteStream, stopVoiceLocalStream]);

  const ensureVoiceLocalStream = useCallback(async (): Promise<MediaStream | null> => {
    if (voiceLocalStreamRef.current) {
      return voiceLocalStreamRef.current;
    }
    if (typeof navigator === "undefined" || typeof navigator.mediaDevices?.getUserMedia !== "function") {
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceLocalStreamRef.current = stream;
      return stream;
    } catch (error) {
      const errorName = (
        error instanceof DOMException
          ? error.name
          : (error && typeof error === "object" && "name" in error
            ? String((error as { name?: unknown }).name ?? "")
            : "")
      ).trim();
      const errorMessage = (
        error instanceof Error
          ? error.message
          : (error === null || error === undefined ? "" : String(error))
      ).trim();
      let reasonCode = "microphone_access_failed";
      if (errorName === "NotAllowedError" || errorName === "SecurityError") {
        reasonCode = "microphone_permission_denied";
      } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
        reasonCode = "microphone_not_found";
      } else if (errorName === "NotReadableError" || errorName === "TrackStartError") {
        reasonCode = "microphone_unavailable";
      }

      let permissionState: string | null = null;
      if (typeof navigator.permissions?.query === "function") {
        try {
          const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
          permissionState = status.state;
        } catch {
          permissionState = null;
        }
      }

      let hasAudioInput: boolean | null = null;
      if (typeof navigator.mediaDevices?.enumerateDevices === "function") {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          hasAudioInput = devices.some((device) => device.kind === "audioinput");
        } catch {
          hasAudioInput = null;
        }
      }

      logAppEvent({
        name: "messaging.realtime_voice.media_access_failed",
        level: "warn",
        scope: { feature: "messaging", action: "realtime_voice_signal" },
        context: {
          reasonCode,
          errorName: errorName || null,
          errorMessage: errorMessage || null,
          permissionState,
          hasAudioInput,
        },
      });
      if (reasonCode === "microphone_not_found") {
        toast.error(t("messaging.microphoneNotDetected", "No microphone was detected on this device."));
      } else if (reasonCode === "microphone_unavailable") {
        toast.error(t("messaging.microphoneUnavailable", "Microphone is unavailable. Check whether another app is using it."));
      } else {
        toast.error(t("messaging.microphoneAccessDenied", "Microphone access denied"));
      }
      return null;
    }
  }, [t]);

  const ensureVoicePeerConnection = useCallback(async (session: ActiveVoiceCallSession): Promise<RTCPeerConnection | null> => {
    if (
      voicePeerConnectionRef.current
      && activeVoiceCallSessionRef.current?.roomId === session.roomId
      && activeVoiceCallSessionRef.current?.peerPubkey === session.peerPubkey
    ) {
      return voicePeerConnectionRef.current;
    }
    const sessionKey = `${session.roomId}|${session.peerPubkey}|${session.role}`;
    if (
      voicePeerConnectionCreationRef.current
      && voicePeerConnectionCreationKeyRef.current === sessionKey
    ) {
      return await voicePeerConnectionCreationRef.current;
    }

    const previous = activeVoiceCallSessionRef.current;
    if (previous && (previous.roomId !== session.roomId || previous.peerPubkey !== session.peerPubkey)) {
      tearDownVoicePeerConnection({ reasonCode: "session_closed" });
    }

    voicePeerConnectionCreationKeyRef.current = sessionKey;
    const createConnectionPromise = (async (): Promise<RTCPeerConnection | null> => {
      const stream = await ensureVoiceLocalStream();
      if (!stream) {
        return null;
      }

      if (typeof RTCPeerConnection !== "function") {
        return null;
      }

      const connection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" },
        ],
      });

      stream.getTracks().forEach((track) => {
        try {
          connection.addTrack(track, stream);
        } catch {
          // best effort
        }
      });

      connection.onicecandidate = (event): void => {
        const liveSession = activeVoiceCallSessionRef.current;
        if (
          voicePeerConnectionRef.current !== connection
          || !liveSession
          || liveSession.roomId !== session.roomId
          || liveSession.peerPubkey !== session.peerPubkey
        ) {
          return;
        }
        const candidate = event.candidate;
        if (!candidate || !myPublicKeyHex) {
          return;
        }
        const payload = createVoiceCallSignalPayload({
          roomId: session.roomId,
          signalType: "ice-candidate",
          fromPubkey: myPublicKeyHex,
          toPubkey: session.peerPubkey,
          candidate: {
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
            usernameFragment: candidate.usernameFragment,
          },
        });
        void sendVoiceSignal({
          peerPubkey: session.peerPubkey,
          payload,
        });
      };

      connection.ontrack = (event): void => {
        const liveSession = activeVoiceCallSessionRef.current;
        if (
          voicePeerConnectionRef.current !== connection
          || !liveSession
          || liveSession.roomId !== session.roomId
          || liveSession.peerPubkey !== session.peerPubkey
        ) {
          return;
        }
        const remoteStream = event.streams[0] ?? new MediaStream([event.track]);
        voiceRemoteStreamRef.current = remoteStream;
        const audioElement = voiceRemoteAudioElementRef.current;
        if (audioElement) {
          audioElement.srcObject = remoteStream;
          void audioElement.play().catch(() => {
            // autoplay might be blocked until user gesture.
          });
        }
      };

      connection.onconnectionstatechange = (): void => {
        const liveSession = activeVoiceCallSessionRef.current;
        if (
          voicePeerConnectionRef.current !== connection
          || !liveSession
          || liveSession.roomId !== session.roomId
          || liveSession.peerPubkey !== session.peerPubkey
          || liveSession.role !== session.role
        ) {
          return;
        }
        const state = connection.connectionState;
        setActiveVoiceCallUiState((current) => {
          if (!current || current.roomId !== session.roomId || current.peerPubkey !== session.peerPubkey) {
            return current;
          }
          return {
            ...current,
            connectionState: state,
          };
        });
        logAppEvent({
          name: "messaging.realtime_voice.rtc_state",
          level: state === "failed" || state === "disconnected" ? "warn" : "info",
          scope: { feature: "messaging", action: "realtime_voice_signal" },
          context: {
            roomIdHint: toRoomIdHint(session.roomId),
            connectionState: state,
            role: session.role,
          },
        });

        if (state === "connected") {
          if (session.role === "joiner") {
            const acceptedAtUnixMs = voiceCallJoinAcceptedAtByRoomRef.current.get(session.roomId) ?? null;
            if (acceptedAtUnixMs !== null) {
              logAppEvent({
                name: "messaging.realtime_voice.join_connected",
                level: "info",
                scope: { feature: "messaging", action: "realtime_voice_signal" },
                context: {
                  roomIdHint: toRoomIdHint(session.roomId),
                  peerPubkeySuffix: session.peerPubkey.slice(-8),
                  acceptToConnectedElapsedMs: Math.max(0, Date.now() - acceptedAtUnixMs),
                },
              });
            }
            voiceCallJoinAcceptedAtByRoomRef.current.delete(session.roomId);
          }
          setVoiceCallUiStatus({
            roomId: session.roomId,
            peerPubkey: session.peerPubkey,
            phase: "connected",
            role: session.role,
            sinceUnixMs: Date.now(),
          });
          realtimeVoiceSessionOwnerRef.current.connected({
            participantCount: 2,
            hasPeerSessionEvidence: true,
            eventUnixMs: Date.now(),
          });
        } else if (state === "disconnected" || state === "failed") {
          setVoiceCallUiStatus({
            roomId: session.roomId,
            peerPubkey: session.peerPubkey,
            phase: "interrupted",
            role: session.role,
            sinceUnixMs: Date.now(),
            reasonCode: "network_interrupted",
          });
          realtimeVoiceSessionOwnerRef.current.transportDegraded({
            reasonCode: "network_degraded",
            eventUnixMs: Date.now(),
          });
        } else if (state === "closed") {
          realtimeVoiceSessionOwnerRef.current.closed({ eventUnixMs: Date.now() });
        }
      };

      if (voicePeerConnectionCreationKeyRef.current !== sessionKey) {
        try {
          connection.close();
        } catch {
          // best effort
        }
        const liveSession = activeVoiceCallSessionRef.current;
        if (
          voicePeerConnectionRef.current
          && liveSession
          && liveSession.roomId === session.roomId
          && liveSession.peerPubkey === session.peerPubkey
          && liveSession.role === session.role
        ) {
          return voicePeerConnectionRef.current;
        }
        return null;
      }

      voicePeerConnectionRef.current = connection;
      activeVoiceCallSessionRef.current = session;
      setActiveVoiceCallUiState({
        roomId: session.roomId,
        peerPubkey: session.peerPubkey,
        role: session.role,
        connectionState: connection.connectionState,
      });
      setVoiceCallUiStatus({
        roomId: session.roomId,
        peerPubkey: session.peerPubkey,
        phase: "connecting",
        role: session.role,
        sinceUnixMs: Date.now(),
      });
      return connection;
    })();

    voicePeerConnectionCreationRef.current = createConnectionPromise;
    try {
      return await createConnectionPromise;
    } finally {
      if (voicePeerConnectionCreationKeyRef.current === sessionKey) {
        voicePeerConnectionCreationRef.current = null;
        voicePeerConnectionCreationKeyRef.current = null;
      }
    }
  }, [ensureVoiceLocalStream, myPublicKeyHex, sendVoiceSignal, tearDownVoicePeerConnection]);

  const dispatchVoiceLeaveSignalWithRetry = useCallback((params: Readonly<{
    roomId: string;
    peerPubkey: string;
  }>): void => {
    const roomId = params.roomId.trim();
    const peerPubkey = params.peerPubkey.trim();
    if (!REALTIME_VOICE_CALLS_ENABLED || !myPublicKeyHex || !roomId || !peerPubkey) {
      return;
    }
    clearVoiceLeaveSignalRetryTimers();
    const sendSignal = sendVoiceSignalRef.current;
    if (!sendSignal) {
      return;
    }
    let attempt = 0;
    const dispatch = (): void => {
      attempt += 1;
      const liveSendSignal = sendVoiceSignalRef.current;
      if (!liveSendSignal) {
        return;
      }
      void liveSendSignal({
        peerPubkey,
        payload: createVoiceCallSignalPayload({
          roomId,
          signalType: "leave",
          fromPubkey: myPublicKeyHex,
          toPubkey: peerPubkey,
        }),
      }).then((sent) => {
        if (sent || attempt >= VOICE_CALL_LEAVE_SIGNAL_RETRY_MAX_ATTEMPTS) {
          return;
        }
        const timeoutId = window.setTimeout(() => {
          voiceLeaveSignalRetryTimeoutsRef.current.delete(timeoutId);
          dispatch();
        }, VOICE_CALL_LEAVE_SIGNAL_RETRY_INTERVAL_MS);
        voiceLeaveSignalRetryTimeoutsRef.current.add(timeoutId);
      });
    };
    dispatch();
  }, [clearVoiceLeaveSignalRetryTimers, myPublicKeyHex]);

  const handleSendVoiceCallInvite = useCallback(async (): Promise<void> => {
    if (!REALTIME_VOICE_CALLS_ENABLED) {
      return;
    }
    if (selectedConversationView?.kind !== "dm") {
      return;
    }
    if (!dmController) {
      toast.error(t("messaging.voiceCallInviteControllerNotReady", "Voice call invite is unavailable right now. Please retry."));
      return;
    }
    if (isSendingVoiceCallInvite) {
      return;
    }

    setIsSendingVoiceCallInvite(true);
    const nowUnixMs = Date.now();
    const roomToken = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${nowUnixMs.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const roomId = `dm-voice-${roomToken}`;
    const expiresAtUnixMs = nowUnixMs + (5 * 60 * 1000);
    const payload = {
      type: "voice-call-invite",
      version: 1,
      roomId,
      invitedAtUnixMs: nowUnixMs,
      expiresAtUnixMs,
      fromPubkey: myPublicKeyHex ?? null,
    } as const;

    logAppEvent({
      name: "messaging.realtime_voice.invite_send_attempt",
      level: "info",
      scope: { feature: "messaging", action: "realtime_voice_invite" },
      context: {
        conversationKind: selectedConversationView.kind,
        roomIdHint: `${roomId.slice(0, 8)}...${roomId.slice(-8)}`,
      },
    });

    try {
      const result = await dmController.sendDm({
        peerPublicKeyInput: selectedConversationView.pubkey,
        plaintext: JSON.stringify(payload),
        customTags: [["t", "voice-call-invite"]],
      });
      const inviteSent = (
        result.deliveryStatus === "sent_quorum"
        || result.deliveryStatus === "sent_partial"
      );

      if (!inviteSent) {
        logAppEvent({
          name: "messaging.realtime_voice.invite_send_result",
          level: "warn",
          scope: { feature: "messaging", action: "realtime_voice_invite" },
          context: {
            status: result.deliveryStatus === "queued_retrying" ? "queued" : "failed",
            deliveryStatus: result.deliveryStatus ?? "unknown",
            roomIdHint: `${roomId.slice(0, 8)}...${roomId.slice(-8)}`,
            relayResultCount: result.relayResults.length,
            hasError: !!result.error,
          },
        });
        if (result.deliveryStatus === "queued_retrying") {
          toast.warning(t(
            "messaging.voiceCallInviteQueued",
            "Voice call invite queued due to relay instability. Please retry when relays reconnect.",
          ));
        } else {
          toast.error(result.error || t("messaging.voiceCallInviteSendFailed", "Failed to send voice call invitation."));
        }
        return;
      }

      logAppEvent({
        name: "messaging.realtime_voice.invite_send_result",
        level: result.deliveryStatus === "sent_quorum" ? "info" : "warn",
        scope: { feature: "messaging", action: "realtime_voice_invite" },
        context: {
          status: result.deliveryStatus === "sent_quorum" ? "sent" : "partial",
          deliveryStatus: result.deliveryStatus ?? "unknown",
          roomIdHint: `${roomId.slice(0, 8)}...${roomId.slice(-8)}`,
          relayResultCount: result.relayResults.length,
        },
      });
      outgoingVoiceInviteRoomIdsRef.current.add(roomId);
      setVoiceCallUiStatus({
        roomId,
        peerPubkey: selectedConversationView.pubkey,
        phase: "ringing_outgoing",
        role: "host",
        sinceUnixMs: Date.now(),
      });
      if (result.deliveryStatus === "sent_quorum") {
        toast.success(t("messaging.voiceCallInviteSent", "Voice call invitation sent."));
      } else {
        toast.warning(t("messaging.voiceCallInviteSentPartial", "Voice call invite sent with partial relay coverage."));
      }
    } catch {
      logAppEvent({
        name: "messaging.realtime_voice.invite_send_result",
        level: "error",
        scope: { feature: "messaging", action: "realtime_voice_invite" },
        context: {
          status: "error",
          roomIdHint: `${roomId.slice(0, 8)}...${roomId.slice(-8)}`,
        },
      });
      toast.error(t("messaging.voiceCallInviteSendFailed", "Failed to send voice call invitation."));
    } finally {
      setIsSendingVoiceCallInvite(false);
    }
  }, [dmController, isSendingVoiceCallInvite, myPublicKeyHex, selectedConversationView, t]);

  useEffect(() => {
    if (!REALTIME_VOICE_CALLS_ENABLED) {
      clearPendingVoiceCallRequest();
      return;
    }
    if (!selectedConversationDmPubkey || isSendingVoiceCallInvite) {
      return;
    }
    const pending = readPendingVoiceCallRequest();
    if (!pending) {
      return;
    }
    const ageMs = Date.now() - pending.requestedAtUnixMs;
    if (ageMs > PENDING_VOICE_CALL_REQUEST_MAX_AGE_MS) {
      clearPendingVoiceCallRequest();
      return;
    }
    if (pending.peerPubkey !== selectedConversationDmPubkey) {
      return;
    }
    clearPendingVoiceCallRequest();
    void handleSendVoiceCallInvite();
  }, [handleSendVoiceCallInvite, isSendingVoiceCallInvite, selectedConversationDmPubkey]);

  const handleJoinVoiceCallInvite = useCallback((params: Readonly<{
    invite: VoiceCallInvitePayload;
    messageId: string;
    peerPubkey?: string;
  }>): void => {
    if (!REALTIME_VOICE_CALLS_ENABLED) {
      return;
    }
    const targetPeerPubkey = (params.peerPubkey ?? selectedConversationDmPubkey ?? "").trim();
    if (!targetPeerPubkey) {
      return;
    }
    if (joiningVoiceCallInviteMessageId) {
      return;
    }
    const roomId = params.invite.roomId?.trim() ?? "";
    if (!roomId) {
      logAppEvent({
        name: "messaging.realtime_voice.invite_join_result",
        level: "warn",
        scope: { feature: "messaging", action: "realtime_voice_invite" },
        context: {
          status: "missing_room_id",
          roomIdHint: "unknown-room",
          phase: "idle",
          reasonCode: "missing_room_id",
        },
      });
      toast.error(t("messaging.voiceCallJoinFailedMissingRoom", "This invitation is missing call room data."));
      return;
    }

    const acceptedAtUnixMs = voiceCallJoinAcceptedAtByRoomRef.current.get(roomId) ?? null;
    const capability = getRealtimeVoiceCapability();
    setJoiningVoiceCallInviteMessageId(params.messageId);
    logAppEvent({
      name: "messaging.realtime_voice.invite_join_attempt",
      level: "info",
      scope: { feature: "messaging", action: "realtime_voice_invite" },
      context: {
        conversationKind: selectedConversationView?.kind ?? "unknown",
        roomIdHint: toRoomIdHint(roomId),
        acceptToJoinElapsedMs: acceptedAtUnixMs === null ? null : Math.max(0, Date.now() - acceptedAtUnixMs),
        capabilitySupported: capability.supported,
        capabilityReasonCode: capability.reasonCode,
      },
    });

    void (async () => {
      try {
        const next = realtimeVoiceSessionOwnerRef.current.start({
          roomId,
          mode: "join",
          capability,
          eventUnixMs: Date.now(),
        });

        const level = next.phase === "unsupported" ? "warn" : "info";
        logAppEvent({
          name: "messaging.realtime_voice.invite_join_result",
          level,
          scope: { feature: "messaging", action: "realtime_voice_invite" },
          context: {
            status: "started",
            roomIdHint: toRoomIdHint(roomId),
            phase: next.phase,
            reasonCode: next.lastTransitionReasonCode,
          },
        });

        if (next.phase === "unsupported") {
          toast.warning(t("messaging.voiceCallJoinUnsupported", "Voice call is not supported on this runtime."));
          return;
        }
        if (next.lastTransitionReasonCode === "invalid_transition") {
          toast.info(t("messaging.voiceCallJoinAlreadyActive", "A voice call session is already active in this window."));
          return;
        }
        if (next.phase === "degraded") {
          toast.warning(t("messaging.voiceCallJoinDegraded", "Joining call in degraded mode. Audio quality may be limited."));
        }

        if (!myPublicKeyHex) {
          toast.error(t("messaging.voiceCallJoinIdentityLocked", "Identity is not ready for voice call signaling."));
          return;
        }

        const session: ActiveVoiceCallSession = {
          roomId,
          peerPubkey: targetPeerPubkey,
          role: "joiner",
        };
        // Register the target session immediately so inbound offer signals are not dropped
        // while local media/RTCPeerConnection setup is still in progress.
        activeVoiceCallSessionRef.current = session;
        setActiveVoiceCallUiState({
          roomId,
          peerPubkey: targetPeerPubkey,
          role: "joiner",
          connectionState: "connecting",
        });
        const joinSignal = createVoiceCallSignalPayload({
          roomId,
          signalType: "join-request",
          fromPubkey: myPublicKeyHex,
          toPubkey: targetPeerPubkey,
        });
        let joinSignalAttemptCount = 1;
        let joinSignalSent = await sendVoiceSignal({
          peerPubkey: targetPeerPubkey,
          payload: joinSignal,
        });
        if (!joinSignalSent) {
          // Retry once to reduce transient relay-race misses immediately after accept.
          await new Promise<void>((resolve) => {
            window.setTimeout(() => resolve(), 1200);
          });
          joinSignalAttemptCount = 2;
          joinSignalSent = await sendVoiceSignal({
            peerPubkey: targetPeerPubkey,
            payload: joinSignal,
          });
        }
        logAppEvent({
          name: "messaging.realtime_voice.join_request_dispatch",
          level: joinSignalSent ? "info" : "warn",
          scope: { feature: "messaging", action: "realtime_voice_signal" },
          context: {
            roomIdHint: toRoomIdHint(roomId),
            peerPubkeySuffix: targetPeerPubkey.slice(-8),
            joinedOnAttempt: joinSignalAttemptCount,
            status: joinSignalSent ? "sent" : "failed",
            acceptToJoinRequestElapsedMs: acceptedAtUnixMs === null ? null : Math.max(0, Date.now() - acceptedAtUnixMs),
          },
        });

        const connection = await ensureVoicePeerConnection(session);
        if (!connection) {
          if (joinSignalSent && myPublicKeyHex) {
            dispatchVoiceLeaveSignalWithRetry({
              roomId,
              peerPubkey: targetPeerPubkey,
            });
          }
          activeVoiceCallSessionRef.current = null;
          setActiveVoiceCallUiState(null);
          voiceCallJoinAcceptedAtByRoomRef.current.delete(roomId);
          setVoiceCallUiStatus({
            roomId,
            peerPubkey: targetPeerPubkey,
            phase: "interrupted",
            role: "joiner",
            sinceUnixMs: Date.now(),
            reasonCode: "session_closed",
          });
          toast.error(t("messaging.voiceCallJoinConnectionFailed", "Failed to initialize voice call connection."));
          return;
        }
        if (!joinSignalSent) {
          toast.warning(t("messaging.voiceCallSignalDeliveryWeak", "Call signal delivery is weak. Waiting for relay recovery."));
        }

        toast.success(t("messaging.voiceCallJoinStarting", "Joining voice call..."));
      } finally {
        setJoiningVoiceCallInviteMessageId((current) => (
          current === params.messageId ? null : current
        ));
      }
    })();
  }, [
    dispatchVoiceLeaveSignalWithRetry,
    ensureVoicePeerConnection,
    joiningVoiceCallInviteMessageId,
    myPublicKeyHex,
    selectedConversationDmPubkey,
    selectedConversationView?.kind,
    sendVoiceSignal,
    t,
  ]);

  const flushPendingRemoteIceCandidates = useCallback(async (connection: RTCPeerConnection): Promise<void> => {
    if (voicePendingIceCandidatesRef.current.length === 0) {
      return;
    }
    const pending = [...voicePendingIceCandidatesRef.current];
    voicePendingIceCandidatesRef.current = [];
    for (const candidate of pending) {
      try {
        await connection.addIceCandidate(candidate);
      } catch {
        // best effort
      }
    }
  }, []);

  const handleIncomingVoiceSignal = useCallback(async (params: Readonly<{
    signal: VoiceCallSignalPayload;
    message: Message;
  }>): Promise<void> => {
    const { signal, message } = params;
    const liveVoiceCallUiStatus = voiceCallUiStatusRef.current;
    const peerPubkey = (message.senderPubkey ?? signal.fromPubkey).trim();
    if (!peerPubkey) {
      return;
    }

    logAppEvent({
      name: "messaging.realtime_voice.signal_received",
      level: "info",
      scope: { feature: "messaging", action: "realtime_voice_signal" },
      context: {
        signalType: signal.signalType,
        roomIdHint: toRoomIdHint(signal.roomId),
      },
    });

    if (signal.signalType === "join-request") {
      const hasLiveOutgoingCallContext = Boolean(
        liveVoiceCallUiStatus
        && liveVoiceCallUiStatus.role === "host"
        && liveVoiceCallUiStatus.roomId === signal.roomId
        && liveVoiceCallUiStatus.peerPubkey === peerPubkey
        && (
          liveVoiceCallUiStatus.phase === "ringing_outgoing"
          || liveVoiceCallUiStatus.phase === "connecting"
          || liveVoiceCallUiStatus.phase === "connected"
        )
      );
      const hasInviteEvidence =
        hasLiveOutgoingCallContext
        || (
          activeVoiceCallSessionRef.current?.role === "host"
          && activeVoiceCallSessionRef.current.roomId === signal.roomId
          && activeVoiceCallSessionRef.current.peerPubkey === peerPubkey
        )
        || (
        outgoingVoiceInviteRoomIdsRef.current.has(signal.roomId)
        || dmController.state.messages.some((candidate) => {
          if (!candidate.isOutgoing) {
            return false;
          }
          const invite = parseVoiceCallInvitePayload(candidate.content);
          return invite?.roomId === signal.roomId;
        })
        );
      if (!hasInviteEvidence || !myPublicKeyHex) {
        logAppEvent({
          name: "messaging.realtime_voice.join_request_ignored_missing_invite_evidence",
          level: "warn",
          scope: { feature: "messaging", action: "realtime_voice_signal" },
          context: {
            roomIdHint: toRoomIdHint(signal.roomId),
            peerPubkeySuffix: peerPubkey.slice(-8),
            hasLiveOutgoingCallContext,
            hasOutgoingRoomEvidence: outgoingVoiceInviteRoomIdsRef.current.has(signal.roomId),
            activeVoicePhase: liveVoiceCallUiStatus?.phase ?? null,
            activeVoiceRole: liveVoiceCallUiStatus?.role ?? null,
          },
        });
        return;
      }

      const existingSession = activeVoiceCallSessionRef.current;
      const existingConnection = voicePeerConnectionRef.current;
      if (
        existingSession
        && existingSession.role === "host"
        && existingSession.roomId === signal.roomId
        && existingSession.peerPubkey === peerPubkey
        && existingConnection
        && existingConnection.localDescription
        && existingConnection.localDescription.type === "offer"
        && typeof existingConnection.localDescription.sdp === "string"
        && existingConnection.localDescription.sdp.length > 0
      ) {
        const localDescription = existingConnection.localDescription;
        const resentOffer = await sendVoiceSignal({
          peerPubkey,
          payload: createVoiceCallSignalPayload({
            roomId: signal.roomId,
            signalType: "offer",
            fromPubkey: myPublicKeyHex,
            toPubkey: peerPubkey,
            sdp: {
              type: localDescription.type,
              sdp: localDescription.sdp,
            },
          }),
        });
        logAppEvent({
          name: "messaging.realtime_voice.join_offer_resend",
          level: resentOffer ? "info" : "warn",
          scope: { feature: "messaging", action: "realtime_voice_signal" },
          context: {
            roomIdHint: toRoomIdHint(signal.roomId),
            peerPubkeySuffix: peerPubkey.slice(-8),
            status: resentOffer ? "sent" : "failed",
          },
        });
        return;
      }

      const capability = getRealtimeVoiceCapability();
      const next = realtimeVoiceSessionOwnerRef.current.start({
        roomId: signal.roomId,
        mode: "create",
        capability,
        eventUnixMs: Date.now(),
      });
      if (next.phase === "unsupported") {
        toast.warning(t("messaging.voiceCallJoinUnsupported", "Voice call is not supported on this runtime."));
        return;
      }

      const session: ActiveVoiceCallSession = {
        roomId: signal.roomId,
        peerPubkey,
        role: "host",
      };
      setActiveVoiceCallUiState({
        roomId: signal.roomId,
        peerPubkey,
        role: "host",
        connectionState: "connecting",
      });
      const connection = await ensureVoicePeerConnection(session);
      if (!connection) {
        return;
      }

      const dispatchHostOffer = async (targetConnection: RTCPeerConnection): Promise<boolean> => {
        const offer = await targetConnection.createOffer({
          offerToReceiveAudio: true,
        });
        await targetConnection.setLocalDescription(offer);
        if (!targetConnection.localDescription) {
          return false;
        }
        return await sendVoiceSignal({
          peerPubkey,
          payload: createVoiceCallSignalPayload({
            roomId: signal.roomId,
            signalType: "offer",
            fromPubkey: myPublicKeyHex,
            toPubkey: peerPubkey,
            sdp: {
              type: targetConnection.localDescription.type,
              sdp: targetConnection.localDescription.sdp,
            },
          }),
        });
      };

      let offerSent = false;
      let offerDispatchRecovered = false;
      try {
        offerSent = await dispatchHostOffer(connection);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error ?? "unknown");
        const mLineOrderMismatch = /order of m-lines/i.test(errorMessage);
        logAppEvent({
          name: "messaging.realtime_voice.join_offer_create_failed",
          level: "warn",
          scope: { feature: "messaging", action: "realtime_voice_signal" },
          context: {
            roomIdHint: toRoomIdHint(signal.roomId),
            peerPubkeySuffix: peerPubkey.slice(-8),
            signalingState: connection.signalingState,
            connectionState: connection.connectionState,
            reasonCode: mLineOrderMismatch ? "mline_order_mismatch" : "offer_create_failed",
            errorMessage,
          },
        });

        if (mLineOrderMismatch) {
          tearDownVoicePeerConnection({ reasonCode: "session_closed" });
          const resetConnection = await ensureVoicePeerConnection(session);
          if (resetConnection) {
            try {
              offerSent = await dispatchHostOffer(resetConnection);
              offerDispatchRecovered = true;
            } catch (resetError) {
              const resetErrorMessage = resetError instanceof Error ? resetError.message : String(resetError ?? "unknown");
              logAppEvent({
                name: "messaging.realtime_voice.join_offer_retry_after_reset_failed",
                level: "warn",
                scope: { feature: "messaging", action: "realtime_voice_signal" },
                context: {
                  roomIdHint: toRoomIdHint(signal.roomId),
                  peerPubkeySuffix: peerPubkey.slice(-8),
                  errorMessage: resetErrorMessage,
                },
              });
              return;
            }
          } else {
            return;
          }
        } else {
          return;
        }
      }

      if (offerDispatchRecovered) {
        logAppEvent({
          name: "messaging.realtime_voice.join_offer_retry_after_reset",
          level: "info",
          scope: { feature: "messaging", action: "realtime_voice_signal" },
          context: {
            roomIdHint: toRoomIdHint(signal.roomId),
            peerPubkeySuffix: peerPubkey.slice(-8),
            status: offerSent ? "sent" : "failed",
          },
        });
      }

      if (!offerSent) {
        logAppEvent({
          name: "messaging.realtime_voice.join_offer_dispatch_failed",
          level: "warn",
          scope: { feature: "messaging", action: "realtime_voice_signal" },
          context: {
            roomIdHint: toRoomIdHint(signal.roomId),
            peerPubkeySuffix: peerPubkey.slice(-8),
          },
        });
      }
      return;
    }

    const activeSession = activeVoiceCallSessionRef.current;
    const isSignalForActiveSession = Boolean(
      activeSession
      && activeSession.roomId === signal.roomId
      && activeSession.peerPubkey === peerPubkey
    );
    if (signal.signalType === "leave") {
      const leaveEventUnixMs = (() => {
        const sentAtUnixMs = typeof signal.sentAtUnixMs === "number" && Number.isFinite(signal.sentAtUnixMs)
          ? Math.floor(signal.sentAtUnixMs)
          : null;
        if (sentAtUnixMs !== null) {
          return sentAtUnixMs;
        }
        const createdAtUnixMs = message.eventCreatedAt?.getTime();
        if (typeof createdAtUnixMs === "number" && Number.isFinite(createdAtUnixMs)) {
          return createdAtUnixMs;
        }
        return message.timestamp.getTime();
      })();
      pruneVoiceCallLeaveTombstones();
      const tombstoneKey = toVoiceCallTombstoneKey({
        peerPubkey,
        roomId: signal.roomId,
      });
      const previous = voiceCallLeaveTombstonesRef.current.get(tombstoneKey) ?? null;
      voiceCallLeaveTombstonesRef.current.set(
        tombstoneKey,
        previous === null ? leaveEventUnixMs : Math.max(previous, leaveEventUnixMs),
      );
    }
    if (signal.signalType === "leave" && !isSignalForActiveSession) {
      const pendingInviteMatches = (
        incomingVoiceInvite?.peerPubkey === peerPubkey
        && incomingVoiceInvite.invite.roomId === signal.roomId
      );
      const pendingStatusMatches = (
        liveVoiceCallUiStatus?.peerPubkey === peerPubkey
        && liveVoiceCallUiStatus.roomId === signal.roomId
        && (
          liveVoiceCallUiStatus.phase === "ringing_incoming"
          || liveVoiceCallUiStatus.phase === "ringing_outgoing"
          || liveVoiceCallUiStatus.phase === "connecting"
        )
      );
      if (pendingInviteMatches) {
        setIncomingVoiceInvite(null);
      }
      if (pendingInviteMatches || pendingStatusMatches) {
        voiceCallJoinAcceptedAtByRoomRef.current.delete(signal.roomId);
        setVoiceCallUiStatus((current) => {
          if (!current || current.roomId !== signal.roomId || current.peerPubkey !== peerPubkey) {
            return current;
          }
          return {
            ...current,
            phase: "ended",
            sinceUnixMs: Date.now(),
            reasonCode: "remote_left",
          };
        });
        toast.info(t("messaging.voiceCallRemoteLeft", "The other participant left the voice call."));
      }
      return;
    }
    const activeSessionSnapshot = activeSession;
    if (!activeSessionSnapshot || !isSignalForActiveSession) {
      return;
    }

    const connection = voicePeerConnectionRef.current ?? await ensureVoicePeerConnection(activeSessionSnapshot);
    if (!connection) {
      return;
    }

    if (signal.signalType === "offer" && signal.sdp && myPublicKeyHex) {
      const acceptedAtUnixMs = voiceCallJoinAcceptedAtByRoomRef.current.get(signal.roomId) ?? null;
      if (acceptedAtUnixMs !== null) {
        logAppEvent({
          name: "messaging.realtime_voice.join_offer_received",
          level: "info",
          scope: { feature: "messaging", action: "realtime_voice_signal" },
          context: {
            roomIdHint: toRoomIdHint(signal.roomId),
            peerPubkeySuffix: peerPubkey.slice(-8),
            acceptToOfferElapsedMs: Math.max(0, Date.now() - acceptedAtUnixMs),
          },
        });
      }
      const existingRemote = connection.remoteDescription;
      const existingLocal = connection.localDescription;
      const duplicateOfferWithLocalAnswer = Boolean(
        existingRemote?.type === "offer"
        && existingRemote.sdp === signal.sdp.sdp
        && existingLocal?.type === "answer"
        && typeof existingLocal.sdp === "string"
        && existingLocal.sdp.length > 0
      );
      if (duplicateOfferWithLocalAnswer) {
        const duplicateAnswerSent = await sendVoiceSignal({
          peerPubkey,
          payload: createVoiceCallSignalPayload({
            roomId: signal.roomId,
            signalType: "answer",
            fromPubkey: myPublicKeyHex,
            toPubkey: peerPubkey,
            sdp: {
              type: existingLocal!.type,
              sdp: existingLocal!.sdp,
            },
          }),
        });
        logAppEvent({
          name: "messaging.realtime_voice.join_answer_resend",
          level: duplicateAnswerSent ? "info" : "warn",
          scope: { feature: "messaging", action: "realtime_voice_signal" },
          context: {
            roomIdHint: toRoomIdHint(signal.roomId),
            peerPubkeySuffix: peerPubkey.slice(-8),
            status: duplicateAnswerSent ? "sent" : "failed",
          },
        });
        return;
      }
      try {
        await connection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } catch {
        if (existingLocal?.type === "answer" && typeof existingLocal.sdp === "string" && existingLocal.sdp.length > 0) {
          const fallbackAnswerSent = await sendVoiceSignal({
            peerPubkey,
            payload: createVoiceCallSignalPayload({
              roomId: signal.roomId,
              signalType: "answer",
              fromPubkey: myPublicKeyHex,
              toPubkey: peerPubkey,
              sdp: {
                type: existingLocal.type,
                sdp: existingLocal.sdp,
              },
            }),
          });
          logAppEvent({
            name: "messaging.realtime_voice.join_offer_set_remote_failed_answer_resend",
            level: fallbackAnswerSent ? "info" : "warn",
            scope: { feature: "messaging", action: "realtime_voice_signal" },
            context: {
              roomIdHint: toRoomIdHint(signal.roomId),
              peerPubkeySuffix: peerPubkey.slice(-8),
              status: fallbackAnswerSent ? "sent" : "failed",
            },
          });
          return;
        }
        logAppEvent({
          name: "messaging.realtime_voice.join_offer_set_remote_failed",
          level: "warn",
          scope: { feature: "messaging", action: "realtime_voice_signal" },
          context: {
            roomIdHint: toRoomIdHint(signal.roomId),
            peerPubkeySuffix: peerPubkey.slice(-8),
          },
        });
        return;
      }
      await flushPendingRemoteIceCandidates(connection);
      try {
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error ?? "unknown");
        logAppEvent({
          name: "messaging.realtime_voice.join_answer_create_failed",
          level: "warn",
          scope: { feature: "messaging", action: "realtime_voice_signal" },
          context: {
            roomIdHint: toRoomIdHint(signal.roomId),
            peerPubkeySuffix: peerPubkey.slice(-8),
            signalingState: connection.signalingState,
            connectionState: connection.connectionState,
            errorMessage,
          },
        });
        return;
      }
      if (connection.localDescription) {
        const answerSent = await sendVoiceSignal({
          peerPubkey,
          payload: createVoiceCallSignalPayload({
            roomId: signal.roomId,
            signalType: "answer",
            fromPubkey: myPublicKeyHex,
            toPubkey: peerPubkey,
            sdp: {
              type: connection.localDescription.type,
              sdp: connection.localDescription.sdp,
            },
          }),
        });
        if (!answerSent) {
          logAppEvent({
            name: "messaging.realtime_voice.join_answer_dispatch_failed",
            level: "warn",
            scope: { feature: "messaging", action: "realtime_voice_signal" },
            context: {
              roomIdHint: toRoomIdHint(signal.roomId),
              peerPubkeySuffix: peerPubkey.slice(-8),
            },
          });
        }
      }
      return;
    }

    if (signal.signalType === "answer" && signal.sdp) {
      try {
        await connection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } catch {
        logAppEvent({
          name: "messaging.realtime_voice.answer_set_remote_failed",
          level: "warn",
          scope: { feature: "messaging", action: "realtime_voice_signal" },
          context: {
            roomIdHint: toRoomIdHint(signal.roomId),
            peerPubkeySuffix: peerPubkey.slice(-8),
          },
        });
      }
      await flushPendingRemoteIceCandidates(connection);
      return;
    }

    if (signal.signalType === "ice-candidate" && signal.candidate) {
      if (!connection.remoteDescription) {
        voicePendingIceCandidatesRef.current.push(signal.candidate);
        return;
      }
      try {
        await connection.addIceCandidate(signal.candidate);
      } catch {
        // best effort
      }
      return;
    }

    if (signal.signalType === "leave") {
      tearDownVoicePeerConnection({ reasonCode: "left_by_user" });
      setVoiceCallUiStatus({
        roomId: signal.roomId,
        peerPubkey,
        phase: "ended",
        role: activeSessionSnapshot.role,
        sinceUnixMs: Date.now(),
        reasonCode: "remote_left",
      });
      toast.info(t("messaging.voiceCallRemoteLeft", "The other participant left the voice call."));
    }
  }, [
    dmController.state.messages,
    ensureVoicePeerConnection,
    flushPendingRemoteIceCandidates,
    incomingVoiceInvite?.invite.roomId,
    incomingVoiceInvite?.peerPubkey,
    myPublicKeyHex,
    pruneVoiceCallLeaveTombstones,
    sendVoiceSignal,
    t,
    tearDownVoicePeerConnection,
  ]);

  const handleLeaveVoiceCall = useCallback((): void => {
    if (!REALTIME_VOICE_CALLS_ENABLED) {
      setIncomingVoiceInvite(null);
      setVoiceCallUiStatus(null);
      tearDownVoicePeerConnection({ reasonCode: "session_closed" });
      return;
    }
    const active = activeVoiceCallSessionRef.current;
    const status = voiceCallUiStatus;
    if (myPublicKeyHex && active) {
      dispatchVoiceLeaveSignalWithRetry({
        roomId: active.roomId,
        peerPubkey: active.peerPubkey,
      });
      setVoiceCallUiStatus({
        roomId: active.roomId,
        peerPubkey: active.peerPubkey,
        phase: "ended",
        role: active.role,
        sinceUnixMs: Date.now(),
        reasonCode: "left_by_user",
      });
      tearDownVoicePeerConnection({ reasonCode: "left_by_user" });
      return;
    }
    if (
      myPublicKeyHex
      && status
      && (status.phase === "ringing_outgoing" || status.phase === "ringing_incoming" || status.phase === "connecting")
    ) {
      dispatchVoiceLeaveSignalWithRetry({
        roomId: status.roomId,
        peerPubkey: status.peerPubkey,
      });
      setVoiceCallUiStatus({
        ...status,
        phase: "ended",
        sinceUnixMs: Date.now(),
        reasonCode: "left_by_user",
      });
      setIncomingVoiceInvite(null);
    }
    tearDownVoicePeerConnection({ reasonCode: "left_by_user" });
  }, [dispatchVoiceLeaveSignalWithRetry, myPublicKeyHex, tearDownVoicePeerConnection, voiceCallUiStatus]);

  const handleAcceptIncomingVoiceInvite = useCallback((): void => {
    if (!REALTIME_VOICE_CALLS_ENABLED) {
      setIncomingVoiceInvite(null);
      return;
    }
    const pendingInvite = incomingVoiceInvite;
    if (!pendingInvite) {
      return;
    }
    pruneVoiceCallLeaveTombstones();
    const inviteRoomId = pendingInvite.invite.roomId;
    if (inviteRoomId) {
      const tombstoneKey = toVoiceCallTombstoneKey({
        peerPubkey: pendingInvite.peerPubkey,
        roomId: inviteRoomId,
      });
      const tombstoneVerdict = resolveVoiceInviteTombstoneVerdict({
        leftAtUnixMs: voiceCallLeaveTombstonesRef.current.get(tombstoneKey) ?? null,
        invitedAtUnixMs: pendingInvite.invite.invitedAtUnixMs,
      });
      if (tombstoneVerdict.tombstoned) {
        setIncomingVoiceInvite(null);
        setVoiceCallUiStatus({
          roomId: inviteRoomId,
          peerPubkey: pendingInvite.peerPubkey,
          phase: "ended",
          role: "joiner",
          sinceUnixMs: Date.now(),
          reasonCode: "remote_left",
        });
        logAppEvent({
          name: "messaging.realtime_voice.invite_accept_blocked_tombstoned",
          level: "info",
          scope: { feature: "messaging", action: "realtime_voice_invite" },
          context: {
            roomIdHint: toRoomIdHint(inviteRoomId),
            peerPubkeySuffix: pendingInvite.peerPubkey.slice(-8),
            leftAtUnixMs: tombstoneVerdict.leftAtUnixMs,
            invitedAtUnixMs: tombstoneVerdict.invitedAtUnixMs,
          },
        });
        toast.info(t("messaging.voiceCallRemoteLeft", "The other participant left the voice call."));
        return;
      }
    }
    const myPubkey = myPublicKeyHex ?? "";
    const conversationId = toDmConversationId({
      myPublicKeyHex: myPubkey,
      peerPublicKeyHex: pendingInvite.peerPubkey,
    });
    if (!conversationId) {
      toast.error(t("messaging.voiceCallJoinFailedMissingRoom", "This invitation is missing call room data."));
      setIncomingVoiceInvite(null);
      return;
    }
    const existingConversation = createdConnections.find((entry) => (
      entry.kind === "dm" && entry.id === conversationId
    ));
    const nextConversation = existingConversation ?? createDmConversation({
      myPublicKeyHex: myPubkey,
      peerPublicKeyHex: pendingInvite.peerPubkey as PublicKeyHex,
      displayName: pendingInvite.inviterDisplayName || PRIVATE_CALLER_DISPLAY_NAME,
    });
    if (!nextConversation) {
      toast.error(t("messaging.voiceCallJoinFailedMissingRoom", "This invitation is missing call room data."));
      setIncomingVoiceInvite(null);
      return;
    }
    setIncomingVoiceInvite(null);
    if (pendingInvite.invite.roomId) {
      voiceCallJoinAcceptedAtByRoomRef.current.set(pendingInvite.invite.roomId, Date.now());
      setVoiceCallUiStatus({
        roomId: pendingInvite.invite.roomId,
        peerPubkey: pendingInvite.peerPubkey,
        phase: "connecting",
        role: "joiner",
        sinceUnixMs: Date.now(),
      });
    }
    setSelectedConversation(nextConversation);
    unhideConversation(nextConversation.id);
    handleJoinVoiceCallInvite({
      invite: pendingInvite.invite,
      messageId: pendingInvite.messageId,
      peerPubkey: pendingInvite.peerPubkey,
    });
  }, [
    createdConnections,
    handleJoinVoiceCallInvite,
    incomingVoiceInvite,
    myPublicKeyHex,
    pruneVoiceCallLeaveTombstones,
    setSelectedConversation,
    t,
    unhideConversation,
  ]);

  const handleDeclineIncomingVoiceInvite = useCallback((): void => {
    if (!REALTIME_VOICE_CALLS_ENABLED) {
      setIncomingVoiceInvite(null);
      return;
    }
    const pendingInvite = incomingVoiceInvite;
    if (!pendingInvite) {
      return;
    }
    setIncomingVoiceInvite(null);
    const resolution = resolveIncomingVoiceInviteExit({
      pendingIncomingInvite: pendingInvite,
      kind: "decline",
      canDispatchLeaveSignal: Boolean(myPublicKeyHex),
      nowUnixMs: Date.now(),
    });
    if (resolution.nextStatus) {
      setVoiceCallUiStatus(resolution.nextStatus);
    }
    if (resolution.leaveSignalTarget) {
      dispatchVoiceLeaveSignalWithRetry(resolution.leaveSignalTarget);
    }
  }, [dispatchVoiceLeaveSignalWithRetry, incomingVoiceInvite, myPublicKeyHex]);

  const handleDismissVoiceCallStatus = useCallback((): void => {
    if (voiceCallUiStatus?.phase === "ringing_incoming" && incomingVoiceInvite) {
      handleDeclineIncomingVoiceInvite();
      return;
    }
    setVoiceCallUiStatus(null);
  }, [handleDeclineIncomingVoiceInvite, incomingVoiceInvite, voiceCallUiStatus]);

  useEffect(() => {
    if (!REALTIME_VOICE_CALLS_ENABLED) {
      return;
    }
    if (dmController.state.status !== "ready") {
      return;
    }
    const bootstrappingNow = !voiceSignalsBootstrappedRef.current;
    const nowUnixMs = Date.now();
    const processed = processedVoiceSignalMessageIdsRef.current;
    if (bootstrappingNow) {
      voiceSignalsBootstrappedRef.current = true;
    }
    dmController.state.messages.forEach((message) => {
      if (message.isOutgoing || processed.has(message.id)) {
        return;
      }
      const signal = parseVoiceCallSignalPayload(message.content);
      if (!signal) {
        return;
      }
      if (bootstrappingNow) {
        const signalUnixMs = resolveVoiceMessageUnixMs({
          signalSentAtUnixMs: signal.sentAtUnixMs,
          eventCreatedAt: message.eventCreatedAt,
          messageTimestamp: message.timestamp,
        });
        const ageMs = Math.max(0, nowUnixMs - signalUnixMs);
        const activeSessionMatches = (
          activeVoiceCallSessionRef.current?.roomId === signal.roomId
          && activeVoiceCallSessionRef.current.peerPubkey === (message.senderPubkey ?? signal.fromPubkey).trim()
        );
        const pendingInviteMatches = (
          incomingVoiceInvite?.invite.roomId === signal.roomId
          && incomingVoiceInvite.peerPubkey === (message.senderPubkey ?? signal.fromPubkey).trim()
        );
        const statusMatches = (
          voiceCallUiStatusRef.current?.roomId === signal.roomId
          && voiceCallUiStatusRef.current.peerPubkey === (message.senderPubkey ?? signal.fromPubkey).trim()
        );
        const shouldReplay = (
          ageMs <= VOICE_SIGNAL_BOOTSTRAP_REPLAY_WINDOW_MS
          || activeSessionMatches
          || pendingInviteMatches
          || statusMatches
        );
        if (!shouldReplay) {
          processed.add(message.id);
          return;
        }
      }
      processed.add(message.id);
      void handleIncomingVoiceSignal({ signal, message });
    });
    if (processed.size > 2000) {
      const lastIds = dmController.state.messages.slice(-1000).map((message) => message.id);
      processedVoiceSignalMessageIdsRef.current = new Set(lastIds);
    }
  }, [dmController.state.messages, dmController.state.status, handleIncomingVoiceSignal]);

  useEffect(() => {
    if (!REALTIME_VOICE_CALLS_ENABLED) {
      return;
    }
    if (dmController.state.status !== "ready") {
      return;
    }
    const bootstrappingNow = !voiceInvitesBootstrappedRef.current;
    const nowUnixMs = Date.now();
    pruneVoiceCallLeaveTombstones();
    const processed = processedVoiceInviteMessageIdsRef.current;
    if (bootstrappingNow) {
      voiceInvitesBootstrappedRef.current = true;
    }

    dmController.state.messages.forEach((message) => {
      if (message.isOutgoing || processed.has(message.id)) {
        return;
      }
      const invite = parseVoiceCallInvitePayload(message.content);
      if (!invite?.roomId) {
        return;
      }
      const peerPubkey = (message.senderPubkey ?? invite.fromPubkey ?? "").trim();
      if (!peerPubkey) {
        processed.add(message.id);
        return;
      }
      if (typeof invite.expiresAtUnixMs === "number" && invite.expiresAtUnixMs < Date.now()) {
        processed.add(message.id);
        return;
      }
      if (bootstrappingNow) {
        const inviteUnixMs = resolveVoiceMessageUnixMs({
          signalSentAtUnixMs: invite.invitedAtUnixMs,
          eventCreatedAt: message.eventCreatedAt,
          messageTimestamp: message.timestamp,
        });
        const ageMs = Math.max(0, nowUnixMs - inviteUnixMs);
        const statusMatches = (
          voiceCallUiStatusRef.current?.roomId === invite.roomId
          && voiceCallUiStatusRef.current.peerPubkey === peerPubkey
        );
        const shouldReplayInvite = ageMs <= VOICE_INVITE_BOOTSTRAP_REPLAY_WINDOW_MS || statusMatches;
        if (!shouldReplayInvite) {
          processed.add(message.id);
          return;
        }
      }
      const tombstoneKey = toVoiceCallTombstoneKey({
        peerPubkey,
        roomId: invite.roomId,
      });
      const tombstoneVerdict = resolveVoiceInviteTombstoneVerdict({
        leftAtUnixMs: voiceCallLeaveTombstonesRef.current.get(tombstoneKey) ?? null,
        invitedAtUnixMs: invite.invitedAtUnixMs,
      });
      if (tombstoneVerdict.tombstoned) {
        processed.add(message.id);
        logAppEvent({
          name: "messaging.realtime_voice.invite_ignored_tombstoned_room",
          level: "info",
          scope: { feature: "messaging", action: "realtime_voice_invite" },
          context: {
            roomIdHint: toRoomIdHint(invite.roomId),
            peerPubkeySuffix: peerPubkey.slice(-8),
            leftAtUnixMs: tombstoneVerdict.leftAtUnixMs,
            invitedAtUnixMs: tombstoneVerdict.invitedAtUnixMs,
          },
        });
        return;
      }
      const activeSession = activeVoiceCallSessionRef.current;
      const currentVoicePhase = voiceCallUiStatus?.phase ?? null;
      const rtcConnectionState = voicePeerConnectionRef.current?.connectionState ?? "none";
      const shouldBlockForActiveSession = (
        activeSession?.peerPubkey === peerPubkey
        && (
          currentVoicePhase === "connected"
          || currentVoicePhase === "connecting"
          || currentVoicePhase === "ringing_outgoing"
          || currentVoicePhase === "ringing_incoming"
          || rtcConnectionState === "new"
          || rtcConnectionState === "connecting"
          || rtcConnectionState === "connected"
        )
      );
      if (shouldBlockForActiveSession) {
        // Do not mark as processed yet; the current session may be tearing down.
        // We re-check this invite on the next pass to avoid losing immediate re-invites.
        if (!deferredVoiceInviteMessageIdsRef.current.has(message.id)) {
          deferredVoiceInviteMessageIdsRef.current.add(message.id);
          logAppEvent({
            name: "messaging.realtime_voice.invite_processing_deferred",
            level: "info",
            scope: { feature: "messaging", action: "realtime_voice_invite" },
            context: {
              roomIdHint: toRoomIdHint(invite.roomId),
              peerPubkeySuffix: peerPubkey.slice(-8),
              currentVoicePhase,
              rtcConnectionState,
            },
          });
        }
        return;
      }
      deferredVoiceInviteMessageIdsRef.current.delete(message.id);
      processed.add(message.id);
      setIncomingVoiceInvite({
        messageId: message.id,
        peerPubkey,
        inviterDisplayName: dmDisplayNameByPubkey.get(peerPubkey) ?? PRIVATE_CALLER_DISPLAY_NAME,
        invite,
        receivedAtUnixMs: Date.now(),
      });
      setVoiceCallUiStatus({
        roomId: invite.roomId,
        peerPubkey,
        phase: "ringing_incoming",
        role: "joiner",
        sinceUnixMs: Date.now(),
      });
    });

    if (processed.size > 2000) {
      const lastIds = dmController.state.messages.slice(-1000).map((message) => message.id);
      processedVoiceInviteMessageIdsRef.current = new Set(lastIds);
    }
  }, [
    dmController.state.messages,
    dmController.state.status,
    dmDisplayNameByPubkey,
    pruneVoiceCallLeaveTombstones,
    voiceCallUiStatus?.phase,
    voiceCallUiStatus?.peerPubkey,
    activeVoiceCallUiState?.connectionState,
  ]);

  useEffect(() => {
    if (!REALTIME_VOICE_CALLS_ENABLED) {
      if (incomingVoiceRingtoneIntervalRef.current) {
        clearInterval(incomingVoiceRingtoneIntervalRef.current);
        incomingVoiceRingtoneIntervalRef.current = null;
      }
      return;
    }
    if (!incomingVoiceInvite) {
      if (incomingVoiceRingtoneIntervalRef.current) {
        clearInterval(incomingVoiceRingtoneIntervalRef.current);
        incomingVoiceRingtoneIntervalRef.current = null;
      }
      return;
    }
    playIncomingVoiceRingBurst();
    if (incomingVoiceRingtoneIntervalRef.current) {
      clearInterval(incomingVoiceRingtoneIntervalRef.current);
    }
    incomingVoiceRingtoneIntervalRef.current = setInterval(() => {
      playIncomingVoiceRingBurst();
    }, 1800);

    return () => {
      if (incomingVoiceRingtoneIntervalRef.current) {
        clearInterval(incomingVoiceRingtoneIntervalRef.current);
        incomingVoiceRingtoneIntervalRef.current = null;
      }
    };
  }, [incomingVoiceInvite, playIncomingVoiceRingBurst]);

  useEffect(() => {
    if (!REALTIME_VOICE_CALLS_ENABLED) {
      return;
    }
    if (!voiceCallUiStatus) {
      return;
    }
    if (
      voiceCallUiStatus.phase === "connected"
      || voiceCallUiStatus.phase === "connecting"
      || voiceCallUiStatus.phase === "ringing_outgoing"
      || voiceCallUiStatus.phase === "ringing_incoming"
    ) {
      return;
    }
    const statusSnapshot = voiceCallUiStatus;
    const timeoutId = window.setTimeout(() => {
      setVoiceCallUiStatus((current) => {
        if (
          !current
          || current.roomId !== statusSnapshot.roomId
          || current.peerPubkey !== statusSnapshot.peerPubkey
          || current.phase !== statusSnapshot.phase
        ) {
          return current;
        }
        return null;
      });
    }, 10_000);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [voiceCallUiStatus]);

  useEffect(() => {
    if (!REALTIME_VOICE_CALLS_ENABLED) {
      clearVoiceJoinRequestRetryInterval();
      return;
    }
    if (!myPublicKeyHex) {
      clearVoiceJoinRequestRetryInterval();
      return;
    }
    const roomId = voiceCallUiStatus?.roomId ?? null;
    const peerPubkey = voiceCallUiStatus?.peerPubkey ?? null;
    const phase = voiceCallUiStatus?.phase ?? null;
    const role = voiceCallUiStatus?.role ?? null;
    if (!roomId || !peerPubkey || phase !== "connecting" || role !== "joiner") {
      clearVoiceJoinRequestRetryInterval();
      return;
    }
    const active = activeVoiceCallSessionRef.current;
    if (
      !active
      || active.role !== "joiner"
      || active.roomId !== roomId
      || active.peerPubkey !== peerPubkey
    ) {
      clearVoiceJoinRequestRetryInterval();
      return;
    }
    const retryKey = `${roomId}|${peerPubkey}`;
    if (voiceJoinRequestRetryKeyRef.current !== retryKey) {
      voiceJoinRequestRetryKeyRef.current = retryKey;
      voiceJoinRequestRetryAttemptRef.current = 0;
    }
    if (voiceJoinRequestRetryIntervalRef.current) {
      return;
    }
    voiceJoinRequestRetryIntervalRef.current = setInterval(() => {
      const sendSignal = sendVoiceSignalRef.current;
      if (!sendSignal) {
        clearVoiceJoinRequestRetryInterval();
        return;
      }
      const openRelayCount = relayStatusRef.current.openCount;
      if (openRelayCount <= 0) {
        return;
      }
      const liveStatus = voiceCallUiStatusRef.current;
      const liveSession = activeVoiceCallSessionRef.current;
      if (
        !liveStatus
        || liveStatus.phase !== "connecting"
        || liveStatus.role !== "joiner"
        || liveStatus.roomId !== roomId
        || liveStatus.peerPubkey !== peerPubkey
        || !liveSession
        || liveSession.role !== "joiner"
        || liveSession.roomId !== roomId
        || liveSession.peerPubkey !== peerPubkey
      ) {
        clearVoiceJoinRequestRetryInterval();
        return;
      }
      if (voiceJoinRequestRetryAttemptRef.current >= VOICE_CALL_JOIN_REQUEST_RETRY_MAX_ATTEMPTS) {
        logAppEvent({
          name: "messaging.realtime_voice.join_request_retry_exhausted",
          level: "warn",
          scope: { feature: "messaging", action: "realtime_voice_signal" },
          context: {
            roomIdHint: toRoomIdHint(roomId),
            peerPubkeySuffix: peerPubkey.slice(-8),
            attemptCount: voiceJoinRequestRetryAttemptRef.current,
          },
        });
        clearVoiceJoinRequestRetryInterval();
        return;
      }

      voiceJoinRequestRetryAttemptRef.current += 1;
      const attemptNumber = voiceJoinRequestRetryAttemptRef.current;
      void sendSignal({
        peerPubkey,
        payload: createVoiceCallSignalPayload({
          roomId,
          signalType: "join-request",
          fromPubkey: myPublicKeyHex,
          toPubkey: peerPubkey,
        }),
      }).then((sent) => {
        logAppEvent({
          name: "messaging.realtime_voice.join_request_retry_dispatch",
          level: sent ? "info" : "warn",
          scope: { feature: "messaging", action: "realtime_voice_signal" },
          context: {
            roomIdHint: toRoomIdHint(roomId),
            peerPubkeySuffix: peerPubkey.slice(-8),
            attemptNumber,
            status: sent ? "sent" : "failed",
          },
        });
      });
    }, VOICE_CALL_JOIN_REQUEST_RETRY_INTERVAL_MS);
    return () => {
      clearVoiceJoinRequestRetryInterval();
    };
  }, [
    clearVoiceJoinRequestRetryInterval,
    myPublicKeyHex,
    voiceCallUiStatus?.peerPubkey,
    voiceCallUiStatus?.phase,
    voiceCallUiStatus?.role,
    voiceCallUiStatus?.roomId,
  ]);

  useEffect(() => {
    if (!REALTIME_VOICE_CALLS_ENABLED) {
      clearVoiceOfferRetryInterval();
      return;
    }
    if (!myPublicKeyHex) {
      clearVoiceOfferRetryInterval();
      return;
    }
    const status = voiceCallUiStatus;
    if (!status || status.role !== "host" || (status.phase !== "ringing_outgoing" && status.phase !== "connecting")) {
      clearVoiceOfferRetryInterval();
      return;
    }
    const active = activeVoiceCallSessionRef.current;
    const connection = voicePeerConnectionRef.current;
    if (
      !active
      || active.role !== "host"
      || active.roomId !== status.roomId
      || active.peerPubkey !== status.peerPubkey
      || !connection
      || !connection.localDescription
      || connection.localDescription.type !== "offer"
      || typeof connection.localDescription.sdp !== "string"
      || connection.localDescription.sdp.length === 0
    ) {
      clearVoiceOfferRetryInterval();
      return;
    }
    const retryKey = `${status.roomId}|${status.peerPubkey}`;
    if (voiceOfferRetryKeyRef.current !== retryKey) {
      voiceOfferRetryKeyRef.current = retryKey;
      voiceOfferRetryAttemptRef.current = 0;
    }
    if (voiceOfferRetryIntervalRef.current) {
      return;
    }
    voiceOfferRetryIntervalRef.current = setInterval(() => {
      const sendSignal = sendVoiceSignalRef.current;
      if (!sendSignal) {
        clearVoiceOfferRetryInterval();
        return;
      }
      const openRelayCount = relayStatusRef.current.openCount;
      if (openRelayCount <= 0) {
        return;
      }
      const liveStatus = voiceCallUiStatusRef.current;
      const liveSession = activeVoiceCallSessionRef.current;
      const liveConnection = voicePeerConnectionRef.current;
      if (
        !liveStatus
        || liveStatus.role !== "host"
        || (liveStatus.phase !== "ringing_outgoing" && liveStatus.phase !== "connecting")
        || liveStatus.roomId !== status.roomId
        || liveStatus.peerPubkey !== status.peerPubkey
        || !liveSession
        || liveSession.role !== "host"
        || liveSession.roomId !== status.roomId
        || liveSession.peerPubkey !== status.peerPubkey
        || !liveConnection
        || !liveConnection.localDescription
        || liveConnection.localDescription.type !== "offer"
        || typeof liveConnection.localDescription.sdp !== "string"
        || liveConnection.localDescription.sdp.length === 0
      ) {
        clearVoiceOfferRetryInterval();
        return;
      }
      if (voiceOfferRetryAttemptRef.current >= VOICE_CALL_OFFER_RETRY_MAX_ATTEMPTS) {
        logAppEvent({
          name: "messaging.realtime_voice.offer_retry_exhausted",
          level: "warn",
          scope: { feature: "messaging", action: "realtime_voice_signal" },
          context: {
            roomIdHint: toRoomIdHint(status.roomId),
            peerPubkeySuffix: status.peerPubkey.slice(-8),
            attemptCount: voiceOfferRetryAttemptRef.current,
          },
        });
        clearVoiceOfferRetryInterval();
        return;
      }
      voiceOfferRetryAttemptRef.current += 1;
      const attemptNumber = voiceOfferRetryAttemptRef.current;
      const offerDescription = liveConnection.localDescription;
      void sendSignal({
        peerPubkey: status.peerPubkey,
        payload: createVoiceCallSignalPayload({
          roomId: status.roomId,
          signalType: "offer",
          fromPubkey: myPublicKeyHex,
          toPubkey: status.peerPubkey,
          sdp: {
            type: offerDescription.type,
            sdp: offerDescription.sdp,
          },
        }),
      }).then((sent) => {
        logAppEvent({
          name: "messaging.realtime_voice.offer_retry_dispatch",
          level: sent ? "info" : "warn",
          scope: { feature: "messaging", action: "realtime_voice_signal" },
          context: {
            roomIdHint: toRoomIdHint(status.roomId),
            peerPubkeySuffix: status.peerPubkey.slice(-8),
            attemptNumber,
            status: sent ? "sent" : "failed",
          },
        });
      });
    }, VOICE_CALL_OFFER_RETRY_INTERVAL_MS);
    return () => {
      clearVoiceOfferRetryInterval();
    };
  }, [
    clearVoiceOfferRetryInterval,
    myPublicKeyHex,
    voiceCallUiStatus?.peerPubkey,
    voiceCallUiStatus?.phase,
    voiceCallUiStatus?.role,
    voiceCallUiStatus?.roomId,
  ]);

  useEffect(() => {
    if (!REALTIME_VOICE_CALLS_ENABLED) {
      clearVoiceCallTimers();
      clearVoiceLeaveSignalRetryTimers();
      return;
    }
    clearVoiceCallTimers();
    if (!voiceCallUiStatus) {
      return;
    }

    if (voiceCallUiStatus.phase === "ringing_outgoing" || voiceCallUiStatus.phase === "connecting") {
      const statusSnapshot = voiceCallUiStatus;
      const timeoutPhase = statusSnapshot.phase === "connecting" ? "connecting" : "ringing_outgoing";
      const timeoutKey = `${statusSnapshot.roomId}|${statusSnapshot.peerPubkey}|${statusSnapshot.phase}`;
      if (voiceCallConnectTimeoutKeyRef.current !== timeoutKey) {
        voiceCallConnectTimeoutKeyRef.current = timeoutKey;
        voiceCallConnectTimeoutExtensionAttemptRef.current = 0;
      }
      voiceCallConnectTimeoutRef.current = setTimeout(() => {
        const active = activeVoiceCallSessionRef.current;
        const connection = voicePeerConnectionRef.current;
        const timeoutDecision = resolveRealtimeVoiceConnectTimeoutDecision({
          phase: timeoutPhase,
          hasActiveSession: Boolean(
            active
            && active.roomId === statusSnapshot.roomId
            && active.peerPubkey === statusSnapshot.peerPubkey
          ),
          rtcConnectionState: connection?.connectionState ?? "none",
          hasLocalDescription: Boolean(connection?.localDescription),
          hasRemoteDescription: Boolean(connection?.remoteDescription),
          extensionAttemptCount: voiceCallConnectTimeoutExtensionAttemptRef.current,
          maxExtensionAttempts: VOICE_CALL_CONNECT_TIMEOUT_MAX_EXTENSIONS,
        });
        logAppEvent({
          name: "messaging.realtime_voice.connect_timeout_diagnostics",
          level: "warn",
          scope: { feature: "messaging", action: "realtime_voice_signal" },
          context: {
            roomIdHint: toRoomIdHint(statusSnapshot.roomId),
            peerPubkeySuffix: statusSnapshot.peerPubkey.slice(-8),
            role: statusSnapshot.role,
            phase: statusSnapshot.phase,
            openRelayCount: relayStatusRef.current.openCount,
            configuredRelayCount: relayStatusRef.current.total,
            joinRequestRetryAttempts: voiceJoinRequestRetryAttemptRef.current,
            offerRetryAttempts: voiceOfferRetryAttemptRef.current,
            hasActiveSession: Boolean(active),
            activeSessionRole: active?.role ?? null,
            rtcConnectionState: connection?.connectionState ?? "none",
            hasLocalDescription: Boolean(connection?.localDescription),
            hasRemoteDescription: Boolean(connection?.remoteDescription),
            timeoutExtensionAttemptCount: voiceCallConnectTimeoutExtensionAttemptRef.current,
            timeoutDecision: timeoutDecision.action,
            timeoutDecisionReasonCode: timeoutDecision.reasonCode,
          },
        });

        if (timeoutDecision.action === "extend") {
          voiceCallConnectTimeoutExtensionAttemptRef.current += 1;
          logAppEvent({
            name: "messaging.realtime_voice.connect_timeout_extended",
            level: "info",
            scope: { feature: "messaging", action: "realtime_voice_signal" },
            context: {
              roomIdHint: toRoomIdHint(statusSnapshot.roomId),
              peerPubkeySuffix: statusSnapshot.peerPubkey.slice(-8),
              role: statusSnapshot.role,
              phase: statusSnapshot.phase,
              extensionAttemptCount: voiceCallConnectTimeoutExtensionAttemptRef.current,
              maxExtensionAttempts: VOICE_CALL_CONNECT_TIMEOUT_MAX_EXTENSIONS,
              reasonCode: timeoutDecision.reasonCode,
            },
          });
          setVoiceCallUiStatus((current) => {
            if (
              !current
              || current.roomId !== statusSnapshot.roomId
              || current.peerPubkey !== statusSnapshot.peerPubkey
              || current.phase !== statusSnapshot.phase
            ) {
              return current;
            }
            return {
              ...current,
              sinceUnixMs: Date.now(),
            };
          });
          return;
        }

        if (
          active
          && active.roomId === statusSnapshot.roomId
          && active.peerPubkey === statusSnapshot.peerPubkey
        ) {
          leaveCallOnUnmountRef.current();
          toast.warning(t("messaging.voiceCallWaitTimeout", "Call setup timed out after 30 seconds."));
          return;
        }
        if (myPublicKeyHex) {
          dispatchVoiceLeaveSignalWithRetry({
            roomId: statusSnapshot.roomId,
            peerPubkey: statusSnapshot.peerPubkey,
          });
        }

        setVoiceCallUiStatus((current) => {
          if (
            !current
            || current.roomId !== statusSnapshot.roomId
            || current.peerPubkey !== statusSnapshot.peerPubkey
            || current.phase !== statusSnapshot.phase
          ) {
            return current;
          }
          return {
            ...current,
            phase: "interrupted",
            sinceUnixMs: Date.now(),
            reasonCode: "session_closed",
          };
        });
      }, VOICE_CALL_MIN_WAIT_MS);
    } else {
      voiceCallConnectTimeoutKeyRef.current = null;
      voiceCallConnectTimeoutExtensionAttemptRef.current = 0;
    }

    if (voiceCallUiStatus.phase === "interrupted") {
      const statusSnapshot = voiceCallUiStatus;
      voiceCallInterruptionTimeoutRef.current = setTimeout(() => {
        const active = activeVoiceCallSessionRef.current;
        if (
          active
          && active.roomId === statusSnapshot.roomId
          && active.peerPubkey === statusSnapshot.peerPubkey
        ) {
          leaveCallOnUnmountRef.current();
        }
      }, VOICE_CALL_INTERRUPTION_GRACE_MS);
    }

    return () => {
      clearVoiceCallTimers();
      clearVoiceLeaveSignalRetryTimers();
    };
  }, [clearVoiceCallTimers, clearVoiceLeaveSignalRetryTimers, dispatchVoiceLeaveSignalWithRetry, myPublicKeyHex, t, voiceCallUiStatus]);

  useEffect(() => {
    if (!REALTIME_VOICE_CALLS_ENABLED) {
      stopVoiceAudioMonitor("local");
      stopVoiceAudioMonitor("remote");
      return;
    }
    const isConnected = voiceCallUiStatus?.phase === "connected";
    if (!isConnected) {
      stopVoiceAudioMonitor("local");
      stopVoiceAudioMonitor("remote");
      return;
    }
    if (voiceLocalStreamRef.current && !voiceLocalAudioMonitorStopRef.current) {
      startVoiceAudioMonitor({
        channel: "local",
        stream: voiceLocalStreamRef.current,
      });
    }
    if (voiceRemoteStreamRef.current && !voiceRemoteAudioMonitorStopRef.current) {
      startVoiceAudioMonitor({
        channel: "remote",
        stream: voiceRemoteStreamRef.current,
      });
    }
  }, [startVoiceAudioMonitor, stopVoiceAudioMonitor, voiceCallUiStatus?.phase]);

  useEffect(() => {
    processedVoiceSignalMessageIdsRef.current = new Set();
    voiceSignalsBootstrappedRef.current = false;
    processedVoiceInviteMessageIdsRef.current = new Set();
    voiceInvitesBootstrappedRef.current = false;
    deferredVoiceInviteMessageIdsRef.current = new Set();
    outgoingVoiceInviteRoomIdsRef.current = new Set();
    voiceCallJoinAcceptedAtByRoomRef.current.clear();
    voiceCallLeaveTombstonesRef.current.clear();
    setJoiningVoiceCallInviteMessageId(null);
    setIncomingVoiceInvite(null);
    setVoiceCallUiStatus(null);
    clearVoiceJoinRequestRetryInterval();
    clearVoiceOfferRetryInterval();
    clearVoiceLeaveSignalRetryTimers();
    voiceWaveAudioLevelRef.current = { local: 0, remote: 0 };
    tearDownVoicePeerConnection({ reasonCode: "session_closed" });
  }, [clearVoiceJoinRequestRetryInterval, clearVoiceLeaveSignalRetryTimers, clearVoiceOfferRetryInterval, myPublicKeyHex, tearDownVoicePeerConnection]);

  useEffect(() => {
    leaveCallOnUnmountRef.current = handleLeaveVoiceCall;
  }, [handleLeaveVoiceCall]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleWindowBeforeUnload = (): void => {
      clearVoiceLeaveSignalRetryTimers();
      leaveCallOnUnmountRef.current();
    };
    window.addEventListener("beforeunload", handleWindowBeforeUnload);
    window.addEventListener("pagehide", handleWindowBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleWindowBeforeUnload);
      window.removeEventListener("pagehide", handleWindowBeforeUnload);
    };
  }, [clearVoiceLeaveSignalRetryTimers]);

  useEffect(() => {
    return () => {
      clearVoiceLeaveSignalRetryTimers();
    };
  }, [clearVoiceLeaveSignalRetryTimers]);

  const nowMs = useSyncExternalStore(subscribeNowMs, getNowMsSnapshot, getNowMsServerSnapshot);
  const handleOpenVoiceCallConversation = useCallback((): void => {
    const status = voiceCallUiStatus;
    if (!status || !myPublicKeyHex) {
      return;
    }
    const conversationId = toDmConversationId({
      myPublicKeyHex,
      peerPublicKeyHex: status.peerPubkey,
    });
    if (!conversationId) {
      return;
    }
    const existingConversation = createdConnections.find((entry) => (
      entry.kind === "dm" && entry.id === conversationId
    ));
    const nextConversation = existingConversation ?? createDmConversation({
      myPublicKeyHex,
      peerPublicKeyHex: status.peerPubkey as PublicKeyHex,
      displayName: dmDisplayNameByPubkey.get(status.peerPubkey) ?? PRIVATE_CONTACT_DISPLAY_NAME,
    });
    if (!nextConversation) {
      return;
    }
    setSelectedConversation(nextConversation);
    unhideConversation(nextConversation.id);
    if (!isChatRoute) {
      void router.push("/");
    }
  }, [
    createdConnections,
    dmDisplayNameByPubkey,
    isChatRoute,
    myPublicKeyHex,
    router,
    setSelectedConversation,
    unhideConversation,
    voiceCallUiStatus,
  ]);
  const executeVoiceCallOverlayAction = useCallback((action: VoiceCallOverlayAction): void => {
    if (!REALTIME_VOICE_CALLS_ENABLED) {
      return;
    }
    switch (action) {
      case "open_chat":
        handleOpenVoiceCallConversation();
        return;
      case "accept":
        handleAcceptIncomingVoiceInvite();
        return;
      case "decline":
        handleDeclineIncomingVoiceInvite();
        return;
      case "end":
        handleLeaveVoiceCall();
        return;
      case "dismiss":
        handleDismissVoiceCallStatus();
        return;
      default:
        return;
    }
  }, [
    handleAcceptIncomingVoiceInvite,
    handleDeclineIncomingVoiceInvite,
    handleDismissVoiceCallStatus,
    handleLeaveVoiceCall,
    handleOpenVoiceCallConversation,
  ]);
  const voiceCallDockPeerDisplayName = useMemo(() => {
    if (!voiceCallUiStatus) {
      return PRIVATE_CALLER_DISPLAY_NAME;
    }
    if (
      selectedConversationView?.kind === "dm"
      && selectedConversationView.pubkey === voiceCallUiStatus.peerPubkey
      && selectedConversationView.displayName.trim().length > 0
    ) {
      return selectedConversationView.displayName;
    }
    return dmDisplayNameByPubkey.get(voiceCallUiStatus.peerPubkey) ?? PRIVATE_CONTACT_DISPLAY_NAME;
  }, [dmDisplayNameByPubkey, selectedConversationView, voiceCallUiStatus]);
  const voiceCallDockPeerMetadata = useResolvedProfileMetadata(voiceCallUiStatus?.peerPubkey ?? null);
  const voiceCallDockResolvedPeerDisplayName = (
    voiceCallDockPeerMetadata?.displayName && voiceCallDockPeerMetadata.displayName.trim().length > 0
  )
    ? voiceCallDockPeerMetadata.displayName
    : voiceCallDockPeerDisplayName;
  const voiceCallDockResolvedPeerAvatarUrl = voiceCallDockPeerMetadata?.avatarUrl || "";
  useEffect(() => {
    setGlobalVoiceCallOverlayState({
      status: voiceCallUiStatus ? { ...voiceCallUiStatus } : null,
      peerDisplayName: voiceCallDockResolvedPeerDisplayName,
      peerAvatarUrl: voiceCallDockResolvedPeerAvatarUrl,
      waveAudioLevel: voiceCallUiStatus?.phase === "connected"
        ? undefined
        : 0,
    });
  }, [
    voiceCallDockResolvedPeerAvatarUrl,
    voiceCallDockResolvedPeerDisplayName,
    voiceCallUiStatus,
  ]);
  useEffect(() => {
    if (!REALTIME_VOICE_CALLS_ENABLED || typeof document === "undefined") {
      return;
    }
    if (!incomingVoiceInvite || voiceCallUiStatus?.phase !== "ringing_incoming") {
      pendingBackgroundIncomingInviteRef.current = null;
      return;
    }
    if (document.visibilityState === "visible") {
      return;
    }
    const incomingRoomId = incomingVoiceInvite.invite.roomId ?? "";
    if (!incomingRoomId) {
      pendingBackgroundIncomingInviteRef.current = null;
      return;
    }
    pendingBackgroundIncomingInviteRef.current = {
      messageId: incomingVoiceInvite.messageId,
      roomId: incomingRoomId,
    };
  }, [
    incomingVoiceInvite?.invite.roomId,
    incomingVoiceInvite?.messageId,
    voiceCallUiStatus?.phase,
  ]);

  useEffect(() => {
    if (!REALTIME_VOICE_CALLS_ENABLED || typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const maybeResumeIncomingInvite = (): void => {
      if (document.visibilityState !== "visible") {
        return;
      }
      const pendingInvite = pendingBackgroundIncomingInviteRef.current;
      if (!pendingInvite) {
        return;
      }
      const currentMessageId = incomingVoiceInvite?.messageId ?? null;
      const currentRoomId = incomingVoiceInvite?.invite.roomId ?? null;
      const matchesPendingInvite = (
        (currentMessageId !== null && currentMessageId === pendingInvite.messageId)
        || (currentRoomId !== null && currentRoomId === pendingInvite.roomId)
      );
      if (!matchesPendingInvite || voiceCallUiStatus?.phase !== "ringing_incoming") {
        pendingBackgroundIncomingInviteRef.current = null;
        return;
      }
      pendingBackgroundIncomingInviteRef.current = null;
      executeVoiceCallOverlayAction("open_chat");
    };

    maybeResumeIncomingInvite();
    window.addEventListener("focus", maybeResumeIncomingInvite);
    document.addEventListener("visibilitychange", maybeResumeIncomingInvite);
    return () => {
      window.removeEventListener("focus", maybeResumeIncomingInvite);
      document.removeEventListener("visibilitychange", maybeResumeIncomingInvite);
    };
  }, [
    executeVoiceCallOverlayAction,
    incomingVoiceInvite?.invite.roomId,
    incomingVoiceInvite?.messageId,
    voiceCallUiStatus?.phase,
  ]);

  useEffect(() => {
    if (!REALTIME_VOICE_CALLS_ENABLED || typeof window === "undefined") {
      return;
    }
    const applyOverlayActionPayload = (payload: unknown): void => {
      const action = extractVoiceCallOverlayAction(payload);
      if (!action) {
        return;
      }
      executeVoiceCallOverlayAction(action);
    };

    const readAndConsumePendingOverlayAction = (): void => {
      const action = readAndConsumePendingVoiceCallOverlayAction();
      if (!action) {
        return;
      }
      executeVoiceCallOverlayAction(action);
    };

    const handleOverlayActionEvent = (event: Event): void => {
      const custom = event as CustomEvent<unknown>;
      applyOverlayActionPayload(custom.detail);
    };

    readAndConsumePendingOverlayAction();
    window.addEventListener(VOICE_CALL_OVERLAY_ACTION_EVENT_NAME, handleOverlayActionEvent as EventListener);
    return () => {
      window.removeEventListener(VOICE_CALL_OVERLAY_ACTION_EVENT_NAME, handleOverlayActionEvent as EventListener);
    };
  }, [executeVoiceCallOverlayAction]);
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
  const isPeerOnlineByEvidence = useCallback((publicKeyHex: PublicKeyHex): boolean => {
    if (presence.isPeerOnline(publicKeyHex)) {
      return true;
    }
    return isRecentPresenceEvidenceActive({
      nowMs,
      lastObservedAtMs: peerLastActiveByPeerPubkey[publicKeyHex],
    });
  }, [nowMs, peerLastActiveByPeerPubkey, presence]);

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
  const activeProfileId = getActiveProfileIdSafe();
  const projectionReadAuthority = useMemo(() => (
    resolveProjectionReadAuthority({
      projectionSnapshot: accountProjectionSnapshot,
      expectedProfileId: activeProfileId,
      expectedAccountPublicKeyHex: myPublicKeyHex,
    })
  ), [accountProjectionSnapshot, activeProfileId, myPublicKeyHex]);
  const showProjectionScopeMismatchNotice = isIdentityUnlocked
    && projectionReadAuthority.reason === "projection_scope_mismatch";
  const projectionScopeMismatchLogKeyRef = useRef<string | null>(null);
  const historySyncNoticeLogKeyRef = useRef<string | null>(null);
  const [historySyncNoticeHoldVisibleUntilUnixMs, setHistorySyncNoticeHoldVisibleUntilUnixMs] = useState<number | null>(null);

  useEffect(() => {
    if (!showProjectionScopeMismatchNotice) {
      projectionScopeMismatchLogKeyRef.current = null;
      return;
    }
    const logKey = [
      activeProfileId,
      accountProjectionSnapshot.profileId ?? "none",
      myPublicKeyHex ?? "none",
      accountProjectionSnapshot.accountPublicKeyHex ?? "none",
    ].join("|");
    if (projectionScopeMismatchLogKeyRef.current === logKey) {
      return;
    }
    projectionScopeMismatchLogKeyRef.current = logKey;
    logAppEvent({
      name: "messaging.profile_scope_mismatch_notice_visible",
      level: "warn",
      scope: { feature: "messaging", action: "profile_scope_mismatch_notice" },
      context: {
        expectedProfileId: activeProfileId,
        projectionProfileId: accountProjectionSnapshot.profileId ?? null,
        expectedAccountPublicKeyHex: myPublicKeyHex ?? null,
        projectionAccountPublicKeyHex: accountProjectionSnapshot.accountPublicKeyHex ?? null,
      },
    });
  }, [
    accountProjectionSnapshot.accountPublicKeyHex,
    accountProjectionSnapshot.profileId,
    activeProfileId,
    myPublicKeyHex,
    showProjectionScopeMismatchNotice,
  ]);
  const hiddenChatIdSet = useMemo(() => new Set(hiddenChatIds), [hiddenChatIds]);
  const visibleChatsList = useMemo(() => (
    filteredConversations.filter((conversation) => (
      conversation.kind === "group" || !hiddenChatIdSet.has(conversation.id)
    ))
  ), [filteredConversations, hiddenChatIdSet]);
  const accurateChatsUnreadCount = useMemo(() => (
    visibleChatsList.reduce((acc, c) => {
      if (selectedConversation?.id === c.id) {
        return acc;
      }
      return acc + (unreadByConversationId[c.id] ?? c.unreadCount);
    }, 0)
  ), [selectedConversation?.id, unreadByConversationId, visibleChatsList]);
  const hasVisibleConversations = visibleChatsList.length > 0;
  const accountSyncUiPolicy = resolveAccountSyncUiPolicy({
    isIdentityUnlocked,
    snapshot: accountSyncSnapshot,
    projectionSnapshot: accountProjectionSnapshot,
    hasVisibleConversations,
  });
  const firstLoginHistorySyncNoticeStorageKey = useMemo(() => {
    if (!myPublicKeyHex) {
      return null;
    }
    return getScopedStorageKey(
      `${HISTORY_SYNC_NOTICE_FIRST_LOGIN_SEEN_KEY}:${myPublicKeyHex}`,
      activeProfileId,
    );
  }, [activeProfileId, myPublicKeyHex]);
  useEffect(() => {
    setHistorySyncNoticeHoldVisibleUntilUnixMs(null);
  }, [firstLoginHistorySyncNoticeStorageKey, isIdentityUnlocked]);
  useEffect(() => {
    if (!firstLoginHistorySyncNoticeStorageKey) {
      return;
    }
    let hasSeenFirstLoginNotice = false;
    try {
      hasSeenFirstLoginNotice = window.localStorage.getItem(firstLoginHistorySyncNoticeStorageKey) === "1";
    } catch {
      hasSeenFirstLoginNotice = false;
    }
    const shouldStartHold = shouldStartFirstLoginHistorySyncNoticeHold({
      isIdentityUnlocked,
      showInitialHistorySyncNotice: accountSyncUiPolicy.showInitialHistorySyncNotice,
      hasVisibleConversations,
      accountPublicKeyHex: myPublicKeyHex,
      hasSeenFirstLoginNotice,
    });
    if (!shouldStartHold) {
      return;
    }
    const holdUntilUnixMs = Date.now() + FIRST_LOGIN_HISTORY_SYNC_NOTICE_MIN_VISIBLE_MS;
    setHistorySyncNoticeHoldVisibleUntilUnixMs((currentValue) => {
      if (typeof currentValue === "number" && currentValue > holdUntilUnixMs) {
        return currentValue;
      }
      return holdUntilUnixMs;
    });
    try {
      window.localStorage.setItem(firstLoginHistorySyncNoticeStorageKey, "1");
    } catch {
      // localStorage can be unavailable in embedded runtimes.
    }
  }, [
    accountSyncUiPolicy.showInitialHistorySyncNotice,
    firstLoginHistorySyncNoticeStorageKey,
    hasVisibleConversations,
    isIdentityUnlocked,
    myPublicKeyHex,
  ]);
  const showHistorySyncNotice = resolveHistorySyncNoticeVisible({
    policyVisible: accountSyncUiPolicy.showInitialHistorySyncNotice,
    holdVisibleUntilUnixMs: historySyncNoticeHoldVisibleUntilUnixMs,
    nowUnixMs: typeof nowMs === "number" ? nowMs : Date.now(),
  });
  useEffect(() => {
    if (!showHistorySyncNotice) {
      historySyncNoticeLogKeyRef.current = null;
      return;
    }
    const logKey = [
      activeProfileId,
      accountSyncSnapshot.phase,
      accountSyncSnapshot.status,
      accountProjectionSnapshot.phase,
      accountProjectionSnapshot.status,
      myPublicKeyHex ?? "none",
    ].join("|");
    if (historySyncNoticeLogKeyRef.current === logKey) {
      return;
    }
    historySyncNoticeLogKeyRef.current = logKey;
    logAppEvent({
      name: "messaging.history_sync_notice_visible",
      level: "info",
      scope: { feature: "messaging", action: "history_sync_notice" },
      context: {
        profileId: activeProfileId,
        accountSyncPhase: accountSyncSnapshot.phase,
        accountSyncStatus: accountSyncSnapshot.status,
        projectionPhase: accountProjectionSnapshot.phase,
        projectionStatus: accountProjectionSnapshot.status,
        accountPublicKeyHex: myPublicKeyHex ?? null,
      },
    });
  }, [
      accountProjectionSnapshot.phase,
      accountProjectionSnapshot.status,
      accountSyncSnapshot.phase,
      accountSyncSnapshot.status,
      showHistorySyncNotice,
      activeProfileId,
      myPublicKeyHex,
    ]);

  if (!isChatRoute) {
    return null;
  }

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
            activeTab={sidebarTab}
            setActiveTab={updateSidebarTab}
            selectConversation={setSelectedConversation}
            interactionByConversationId={interactionByConversationId}
            requests={getIncomingInboxRequests(requestsInbox.state.items)}
            pinnedChatIds={pinnedChatIds}
            togglePin={togglePin}
            hiddenChatIds={hiddenChatIds}
            hideConversation={hideConversation}
            clearHistory={clearHistory}
            onClearHistory={requestsInbox.clearHistory}
            isPeerOnline={isPeerOnlineByEvidence}
            showHistorySyncNotice={showHistorySyncNotice}
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
                displayName: PRIVATE_CONTACT_DISPLAY_NAME,
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
                displayName: PRIVATE_CONTACT_DISPLAY_NAME,
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
      {showHistorySyncNotice ? (
        <div className="border-b border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-900 dark:text-indigo-100">
          <span className="font-semibold">Syncing account history:</span> This device is still restoring contacts and messages. First-time recovery on a new device can take a few minutes.
        </div>
      ) : null}
      {showProjectionScopeMismatchNotice ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-orange-500/25 bg-orange-500/10 px-4 py-2 text-sm text-orange-900 dark:text-orange-100">
          <span className="font-semibold">{t("messaging.profileScopeMismatchNoticeTitle", "Profile Scope Notice")}:</span>
          <span>
            {t(
              "messaging.profileScopeMismatchNoticeBody",
              "This window is bound to a different local profile slot than this account's data. Open the saved profile that owns this account, or switch this window's profile before signing in."
            )}
          </span>
          <button
            type="button"
            className="ml-auto rounded-md border border-orange-500/40 bg-orange-500/10 px-2 py-1 text-xs font-semibold text-orange-900 transition-colors hover:bg-orange-500/20 dark:text-orange-50"
            onClick={() => {
              void router.push("/profiles");
            }}
          >
            {t("messaging.openProfiles", "Open Profiles")}
          </button>
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
            showHistorySyncNotice={showHistorySyncNotice}
          />
        ) : (
          <ChatView
            conversation={selectedConversationView}
            isPeerOnline={
              selectedConversationView.kind === "dm"
                ? isPeerOnlineByEvidence(selectedConversationView.pubkey)
                : undefined
            }
            interactionStatus={interactionByConversationId[selectedConversationView.id]}
            messages={visibleMessages}
            renderMetaMessages={visibleMessages}
            rawMessagesCount={visibleMessages.length}
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
            onToggleConversationNotifications={({ conversation, enabled }) => {
              const entityLabel = conversation.kind === "group" ? "group" : "chat";
              toast.success(
                enabled
                  ? `Notifications enabled for this ${entityLabel}.`
                  : `Notifications muted for this ${entityLabel}.`
              );
            }}
            onOpenInfo={selectedConversationView.kind === "group"
              ? () => {
                router.push(
                  getPublicGroupHref(
                    selectedConversationView.groupId,
                    selectedConversationView.relayUrl
                  )
                );
              }
              : undefined}
            onOpenProfile={selectedConversationView.kind === "dm"
              ? (pubkey) => {
                router.push(getPublicProfileHref(pubkey));
              }
              : undefined}
            onSendVoiceCallInvite={REALTIME_VOICE_CALLS_ENABLED && selectedConversationView.kind === "dm"
              ? () => {
                void handleSendVoiceCallInvite();
              }
              : undefined}
            canSendVoiceCallInvite={REALTIME_VOICE_CALLS_ENABLED && selectedConversationView.kind === "dm" && !!dmController}
            isSendingVoiceCallInvite={REALTIME_VOICE_CALLS_ENABLED ? isSendingVoiceCallInvite : false}
            onJoinVoiceCallInvite={REALTIME_VOICE_CALLS_ENABLED ? (params) => {
              handleJoinVoiceCallInvite(params);
            } : undefined}
            onRequestVoiceCallCallback={REALTIME_VOICE_CALLS_ENABLED ? () => {
              void handleSendVoiceCallInvite();
            } : undefined}
            joiningVoiceCallInviteMessageId={REALTIME_VOICE_CALLS_ENABLED ? joiningVoiceCallInviteMessageId : null}
            activeVoiceCallState={REALTIME_VOICE_CALLS_ENABLED ? activeVoiceCallForSelectedConversation : null}
            voiceCallStatus={REALTIME_VOICE_CALLS_ENABLED ? voiceCallStatusForSelectedConversation : null}
            onLeaveVoiceCall={REALTIME_VOICE_CALLS_ENABLED ? handleLeaveVoiceCall : undefined}
            onAcceptIncomingVoiceCall={REALTIME_VOICE_CALLS_ENABLED ? handleAcceptIncomingVoiceInvite : undefined}
            onDeclineIncomingVoiceCall={REALTIME_VOICE_CALLS_ENABLED ? handleDeclineIncomingVoiceInvite : undefined}
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
            onDeleteMessageForMe={(message) => deleteMessageForMe({ conversationId: selectedConversationView.id, message })}
            onDeleteMessageForEveryone={(message) => deleteMessageForEveryone({ conversationId: selectedConversationView.id, message })}
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
            onSendVoiceNote={(file) => {
              void handleFilesSelected([file]);
            }}
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
                    displayName: selectedConversationView.displayName || PRIVATE_CONTACT_DISPLAY_NAME,
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
      <audio ref={voiceRemoteAudioElementRef} autoPlay playsInline className="hidden" />
      <DevPanel dmController={dmController} />
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
