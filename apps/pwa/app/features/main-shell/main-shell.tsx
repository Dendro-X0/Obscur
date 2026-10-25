"use client";
import React, { Suspense, startTransition, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useRegisterAppChrome } from "@/app/components/app-chrome-registry";
import { ChatSidebarPortal } from "@/app/components/app-shell-sidebar-portal";
import { MobileDmShellLayout } from "@/app/components/mobile/mobile-dm-shell-layout";
import { MobileDmThreadHeader } from "@/app/components/mobile/mobile-dm-thread-header";
import { buildMobileShellStatusItems } from "@/app/components/mobile/mobile-shell-status-items";
import { MobileShellStatusStrip } from "@/app/components/mobile/mobile-shell-status-strip";
import { useMobileDmBackNavigation } from "@/app/components/mobile/use-mobile-dm-back-navigation";
import { isMobileShellProduct } from "@/app/features/runtime/shell-contract";
import { useRuntimeMessagingTransportOwnerController } from "@/app/features/messaging/providers/runtime-messaging-transport-owner-provider";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { createPendingStartupAuthState, shouldShowStoredIdentityLockScreen, } from "@/app/features/auth/services/startup-auth-state-contracts";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { toast } from "@dweb/ui-kit/toast";
import { useTranslation } from "react-i18next";
import type { Conversation, DmConversation, GroupConversation, Message, SendDirectMessageParams, SendDirectMessageResult, VoiceCallInvitePayload, } from "@/app/features/messaging/types";
import { applyConnectionOverrides, extractAttachmentsFromContent } from "@/app/features/messaging/utils/logic";
import { createRealtimeVoiceSessionOwner } from "@/app/features/messaging/services/realtime-voice-session-owner";
import { getRealtimeVoiceCapability } from "@/app/features/messaging/services/realtime-voice-capability";
import {
    shouldOpenMediaConsentRecovery,
    type MediaConsentPurpose,
} from "@/app/features/messaging/services/media-device-access";
import { MediaDeviceConsentDialog } from "@/app/features/messaging/components/media-device-consent-dialog";
import { shouldWarnOfflinePeerBeforeVoiceInviteDial } from "@/app/features/messaging/services/voice-invite-offline-peer-honesty";
import {
    canStartVoiceCallInviteDial,
    isVoiceCallInviteDeliveryAccepted,
    shouldStartVoiceCallInviteSession,
} from "@/app/features/messaging/services/voice-call-invite-delivery";
import { isVoiceCallSignalDeliveryAccepted } from "@/app/features/messaging/services/voice-call-signal-delivery";
import {
    isHaveLocalOfferInvalidState,
    runHostOfferDispatchCoalesced,
    type HostOfferInFlightMap,
} from "@/app/features/messaging/services/voice-call-host-offer-coalesce";
import {
    canStartVoiceCallInviteWhileLineIdle,
    shouldDeferVoiceInviteForBusyLine,
} from "@/app/features/messaging/services/voice-call-busy-line";
import { preserveVoiceCallUiStatusMedia } from "@/app/features/messaging/services/voice-call-ui-status-media";
import { preserveVoiceCallMediaFields } from "@/app/features/messaging/services/voice-call-ui-status-preserve";
import { getRelayPublishFailureUserMessage } from "@/app/features/relays/services/relay-publish-user-copy";
import { resolveVoiceInviteTombstoneVerdict } from "@/app/features/messaging/services/realtime-voice-invite-tombstone";
import { createVoiceCallInvitePayload, createVoiceCallSignalPayload, parseVoiceCallInvitePayload, parseVoiceCallSignalPayload, type VoiceCallSignalPayload, } from "@/app/features/messaging/services/realtime-voice-signaling";
import { resolveCallTypeFromInvite } from "@/app/features/messaging/services/voice-call-reason-honesty";
import { resolveVoicePeerConnectionStartFailureUi } from "@/app/features/messaging/services/voice-peer-connection-start-honesty";
import { resolveVoiceOfferDispatchFailureUi } from "@/app/features/messaging/services/voice-offer-dispatch-honesty";
import { resolveVoiceAnswerDispatchFailureUi } from "@/app/features/messaging/services/voice-answer-dispatch-honesty";
import {
    acquireLocalCallMedia,
    attachLocalMediaToPeerConnection,
    CAMERA_UNAVAILABLE_BANNER_DEFAULT,
    CAMERA_UNAVAILABLE_BANNER_I18N_KEY,
    isLabCanvasVideoEnabled,
    resolveOfferToReceiveVideo,
    type CallLocalMediaMode,
} from "@/app/features/messaging/services/realtime-call-local-media";
import { prepareLocalMediaForCallDial } from "@/app/features/messaging/services/video-call-dial-preflight";
import { isRealtimeVoiceCallsEnabled } from "@/app/features/messaging/services/realtime-voice-feature-gate";
import { subscribeNowMs, getNowMsSnapshot, getNowMsServerSnapshot } from "@/app/features/messaging/utils/time";
import { Sidebar } from "@/app/features/messaging/components/sidebar";
import { resolveConversationUnreadCount } from "@/app/features/messaging/providers/unread-last-seen-suppression";
import { ChatView } from "@/app/features/messaging/components/chat-view";
import { useAutoLock } from "@/app/features/settings/hooks/use-auto-lock";
import type { GroupMessageEvent } from "@/app/features/groups/hooks/use-sealed-community-types";
import { useLegacySealedCommunity } from "@/app/features/groups/hooks/sealed-community-port";
import { useGroupThreadRelayIngest } from "@/app/features/groups/hooks/use-group-thread-relay-ingest";
import { hasWritableCommunityRelayTransport } from "@/app/features/groups/services/community-relay-transport";
import { readBotPubkeysFromMetadataField } from "@/app/features/groups/services/community-bot-policy";
import { readBotTriggersFromMetadataField, summarizeCommunityBotTriggerStatuses, } from "@/app/features/groups/services/community-bot-triggers-policy";
import { resolveMainShellGroupThreadRelayIngestEnabled, resolveMainShellSealedCommunityEnabled, } from "@/app/features/groups/services/sealed-community-instance-policy";
import { getResolvedClientGateway } from "@/app/features/profiles/services/resolve-client-gateway";
import { LockScreen } from "@/app/components/lock-screen";
import type { Passphrase } from "@dweb/crypto/passphrase";
import { EmptyConversationView } from "./components/empty-conversation-view";
import { DevPanel } from "../dev-tools/components/dev-panel";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useContactRelayOverlap } from "@/app/features/messaging/hooks/use-contact-relay-overlap";
import { useGroups } from "@/app/features/groups/providers/group-provider-port";
import { useCommunityMembershipReadModelIndex } from "@/app/features/groups/hooks/use-community-membership-read-model-index";
import { buildCommunityMembershipReadModelIndexGroupInputs } from "@/app/features/groups/services/community-membership-read-model-index-input";
import { COMMUNITY_TERMINAL_MEMBERSHIP_UPDATED_EVENT, loadCommunityTerminalMembershipCache, } from "@/app/features/groups/services/community-terminal-membership-cache";
import { dedupeCommunityMemberPubkeys } from "@/app/features/groups/services/community-member-roster-projection";
import { loadCoordinationMembershipDirectoryRecord } from "@/app/features/groups/services/community-coordination-membership-directory-store";
import { resolveCommunityHeaderMemberMetrics } from "@/app/features/groups/services/community-header-member-metrics";
import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";
import { resolveWorkspaceKernelActiveMemberPubkeys } from "@/app/features/workspace-kernel/workspace-kernel-roster-port";
import { workspaceRelayUrlsMatch } from "@/app/features/groups/services/workspace-relay-url";
import { PinLockService } from "@/app/features/auth/services/pin-lock-service";
import { useInviteRedemption } from "./hooks/use-invite-redemption";
import { useDeepLinks } from "./hooks/use-deep-links";
import { useCommandMessages } from "./hooks/use-command-messages";
import { useChatActions } from "./hooks/use-chat-actions";
import { SendCeremonyDialog } from "@/app/features/security/components/send-ceremony-dialog";
import { useFilteredConversations } from "./hooks/use-filtered-conversations";
import { useAttachmentHandler } from "./hooks/use-attachment-handler";
import { useDmSync } from "./hooks/use-dm-sync";
import { useChatViewProps } from "./hooks/use-chat-view-props";
import { useSyncMediaPreviewScope } from "@/app/features/messaging/hooks/use-sync-media-preview-scope";
import { getPeerFirstSeenAtUnixMs } from "@/app/features/dm-kernel/dm-kernel-trust-peer-state";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { installChatPerformanceDevTools } from "../messaging/dev/chat-performance-dev-tools";
import { toDmConversationId } from "@/app/features/messaging/utils/dm-conversation-id";
import { createDmConversation } from "@/app/features/messaging/utils/create-dm-conversation";
import { upsertDmConversationInList } from "@/app/features/messaging/utils/dm-conversation-list-merge";
import { resolveConversationByToken } from "@/app/features/messaging/utils/conversation-target";
import { partitionOpenRequestsByLane } from "@/app/features/messaging/services/request-inbox-view";
import { buildSidebarRequestsInboxItems } from "@/app/features/messaging/services/request-sidebar-items";
import type { MessagingSidebarTab } from "@/app/features/messaging/services/messaging-sidebar-tab";
import { resolveDmPeerEstablishedForUi, resolveDmPeerOutgoingWaitInitiatorForUi, resolveDmPeerOutgoingResendEligibleForUi, isPendingContactHandshake, } from "@/app/features/messaging/services/dm-peer-established-ui";
import {
    hasDmThreadRowForPeer,
    resolveEffectiveContactRequestStatus,
} from "@/app/features/messaging/services/contact-request-legacy-orphan";
import {
    readRequestsPendingBadgeDismissed,
    writeRequestsPendingBadgeDismissed,
} from "@/app/features/messaging/services/request-inbox-badge-preference";
import { resolveContactRequestComposeMode } from "@/app/features/messaging/services/contact-request-sandbox-policy";
import { DEFAULT_INVITATION_INTRO } from "@/app/features/messaging/services/invitation-composer";
import { getDirectInvitationToastCopy } from "@/app/features/messaging/services/invitation-presentation";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { useOptionalProfileMessageBus } from "@/app/features/profiles/providers/profile-runtime-provider";
import { useRequestTransport } from "@/app/features/messaging/hooks/use-request-transport";
import {
  pendingAcceptRelayQueue,
  retryAcceptRelayNotification,
} from "@/app/features/messaging/services/request-transport-service";
import { configureInviteRequestStateBridge, configureInviteRequestTransportBridge } from "@/app/features/invites/utils/invite-manager";
import type { Connection as LegacyInviteConnection, ConnectionRequest as LegacyInviteRequest } from "@/app/features/invites/utils/types";
import { useAccountSyncSnapshot } from "@/app/features/account-sync/hooks/use-account-sync-snapshot";
import { useAccountProjectionSnapshot } from "@/app/features/account-sync/hooks/use-account-projection-snapshot";
import { resolveProjectionReadAuthority } from "@/app/features/account-sync/services/account-projection-read-authority";
import { resolveAccountSyncUiPolicy, isAccountDataLoading } from "@/app/features/account-sync/services/account-sync-ui-policy";
import { profileWindowHasLocalAccountEvidence } from "@/app/features/auth/services/auth-profile-local-evidence";
import { FIRST_LOGIN_HISTORY_SYNC_NOTICE_MIN_VISIBLE_MS, resolveHistorySyncNoticeVisible, shouldStartFirstLoginHistorySyncNoticeHold, } from "@/app/features/account-sync/services/history-sync-notice-visibility";
import { AppLoadingScreen } from "@/app/components/app-loading-screen";
import { usePeerLastActiveByPeer } from "@/app/features/messaging/hooks/use-peer-last-active-by-peer";
import { getPublicGroupHref, getPublicProfileHref } from "@/app/features/navigation/public-routes";
import { logAppEvent } from "@/app/shared/log-app-event";
import { isRecentPresenceEvidenceActive } from "@/app/features/network/services/presence-evidence";
import { useResolvedProfileMetadata } from "@/app/features/profile/hooks/use-resolved-profile-metadata";
import { clearPendingVoiceCallRequest, PENDING_VOICE_CALL_REQUEST_MAX_AGE_MS, readPendingVoiceCallRequest, } from "@/app/features/messaging/services/realtime-voice-pending-request";
import { useVoiceCallCRDT } from "@/app/features/messaging/hooks/use-voice-call-crdt";
import { setGlobalVoiceCallOverlayState, setGlobalVoiceCallOverlayWaveAudioLevel, } from "@/app/features/messaging/services/realtime-voice-global-ui-store";
import { resolveIncomingVoiceInviteExit } from "@/app/features/messaging/services/realtime-voice-invite-exit";
import { extractVoiceCallOverlayAction, readAndConsumePendingVoiceCallOverlayAction, type VoiceCallOverlayAction, } from "@/app/features/messaging/services/voice-call-overlay-action-bridge";
import { subscribeVoiceCallOverlayActionDual } from "@/app/features/messaging/services/subscribe-voice-call-overlay-action-dual";
import {
    mapRealtimeVoiceConnectTimeoutToUiReasonCode,
    resolveRealtimeVoiceConnectTimeoutDecision,
    resolveRealtimeVoiceConnectTimeoutMaxExtensions,
} from "@/app/features/messaging/services/realtime-voice-timeout-policy";
import { resolveVoiceInviteBootstrapReplayDecision, resolveVoiceSignalBootstrapReplayDecision, } from "@/app/features/messaging/services/realtime-voice-history-replay-policy";
import { advanceVoiceWaveAudioLevelChannel, getVoiceWaveOverlayLevel, type VoiceWaveAudioLevelState, } from "@/app/features/messaging/services/realtime-voice-waveform-level";
import {
    emitRealtimeCallQualitySample,
    parseRealtimeCallQualitySnapshot,
    REALTIME_CALL_QUALITY_SAMPLE_MIN_INTERVAL_MS,
    shouldEmitRealtimeCallQualitySample,
} from "@/app/features/messaging/services/realtime-call-quality-stats";
import {
    REALTIME_CALL_DISCONNECT_GRACE_MS,
    resolveRealtimeCallConnectionStateAction,
    shouldEndCallAfterDisconnectGrace,
} from "@/app/features/messaging/services/realtime-call-disconnect-grace";
import { buildRealtimeCallHostConnectedContext } from "@/app/features/messaging/services/realtime-call-connect-latency";
import { resolveRealtimeCallIceServersFromEnv } from "@/app/features/messaging/services/realtime-call-ice-servers";
const LAST_PAGE_STORAGE_KEY = "obscur-last-page";
const getLastPageStorageKey = (): string => getScopedStorageKey(LAST_PAGE_STORAGE_KEY, getResolvedProfileId());
const HISTORY_SYNC_NOTICE_FIRST_LOGIN_SEEN_KEY = "obscur.messaging.history_sync_notice.first_login_seen.v1";
const DEFAULT_VISIBLE_MESSAGES = 50;
const LOAD_EARLIER_STEP = 50;
const VOICE_CALL_MIN_WAIT_MS = 30000;
const VOICE_CALL_INTERRUPTION_GRACE_MS = 30000;
const VOICE_CALL_CONNECT_TIMEOUT_MAX_EXTENSIONS = 1;
const VOICE_CALL_LEAVE_TOMBSTONE_TTL_MS = 10 * 60 * 1000;
const VOICE_WAVE_SAMPLE_INTERVAL_MS = 120;
const VOICE_CALL_JOIN_REQUEST_RETRY_INTERVAL_MS = 3000;
const VOICE_CALL_JOIN_REQUEST_RETRY_MAX_ATTEMPTS = 6;
const VOICE_CALL_OFFER_RETRY_INTERVAL_MS = 3000;
const VOICE_CALL_OFFER_RETRY_MAX_ATTEMPTS = 6;
const VOICE_CALL_LEAVE_SIGNAL_RETRY_INTERVAL_MS = 1500;
const VOICE_CALL_LEAVE_SIGNAL_RETRY_MAX_ATTEMPTS = 3;
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
const toVoiceCallTombstoneKey = (params: Readonly<{
    peerPubkey: string;
    roomId: string;
}>): string => (`${params.peerPubkey.trim()}|${params.roomId.trim()}`);
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
    /** M1-A negotiated type; omit = voice. */
    callType?: "voice" | "video";
    /** M1-B: local media outcome (audio_only_fallback → honesty banner). */
    mediaMode?: CallLocalMediaMode;
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
    const searchParams = useSearchParams();
    const isChatRoute = pathname === "/";
    const identity = useIdentity();
    const { blocklist, peerTrust, requestsInbox, presence } = useNetwork();
    const myPublicKeyHex = (identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null);
    const myPrivateKeyHex = identity.state.privateKeyHex || null;
    const { isLocked, unlock } = useAutoLock();
    const { selectedConversation, setSelectedConversation, unreadByConversationId, setUnreadByConversationId, lastViewedByConversationId, connectionOverridesByConnectionId, visibleMessageCountByConversationId, setVisibleMessageCountByConversationId, replyTo, setReplyTo, pendingAttachments, pendingAttachmentPreviewUrls, isUploadingAttachment, uploadStage, attachmentError, hasHydrated, sidebarTab, setSidebarTab, messageInput, setMessageInput, isProcessingMedia, mediaProcessingProgress, searchQuery, setSearchQuery, isNewChatOpen, setIsNewChatOpen, setIsMediaGalleryOpen, flashMessageId, messageMenu, setMessageMenu, reactionPicker, setReactionPicker, pinnedChatIds, togglePin, hiddenChatIds, hideConversation, clearHistory, unhideConversation, chatsUnreadCount, createdConnections, setCreatedConnections } = useMessaging();
    const optionalProfileBus = useOptionalProfileMessageBus();
    const { relayPool, relayList, relayStatus, enabledRelayUrls } = useRelay();
    const accountSyncSnapshot = useAccountSyncSnapshot();
    const accountProjectionSnapshot = useAccountProjectionSnapshot();
    const { createdGroups, isNewGroupOpen, setIsNewGroupOpen, communityKnownParticipantDirectoryByConversationId, communityRosterByConversationId, } = useGroups();
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [showWelcome] = useState(false);
    /** Soft-lock slice 2: identity unlocked but DbState cannot accept writes. */
    const [nativeSqliteWriteBlocked, setNativeSqliteWriteBlocked] = useState(false);
    const [pendingRequestsBadgeDismissed, setPendingRequestsBadgeDismissed] = useState(
        () => readRequestsPendingBadgeDismissed(),
    );
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
    const sealedCommunityInitialMembers = useMemo((): ReadonlyArray<PublicKeyHex> | undefined => {
        if (selectedConversation?.kind !== "group") {
            return undefined;
        }
        const group = selectedConversation as GroupConversation;
        return getResolvedClientGateway().communityRoster.resolveSeedMemberPubkeysFromDirectory({
            directory: communityKnownParticipantDirectoryByConversationId[group.id] ?? null,
            persistedGroupMemberPubkeys: group.memberPubkeys,
            projectionMemberPubkeys: communityRosterByConversationId[group.id]?.activeMemberPubkeys,
            localMemberPubkey: myPublicKeyHex as PublicKeyHex | null,
        });
    }, [
        selectedConversation,
        communityKnownParticipantDirectoryByConversationId,
        communityRosterByConversationId,
        myPublicKeyHex,
    ]);
    const selectedGroupHasRelayTransport = useMemo((): boolean => {
        if (selectedConversation?.kind !== "group") {
            return false;
        }
        return hasWritableCommunityRelayTransport((selectedConversation as GroupConversation).relayUrl);
    }, [selectedConversation]);
    // Path B B1-3: one live sealed-community instance — sidebar on `/`; group-home owns `/groups/[id]`.
    const sealedCommunityShellEnabled = resolveMainShellSealedCommunityEnabled({
        selectedConversationKind: selectedConversation?.kind,
        pathname,
        hasRelayTransport: selectedGroupHasRelayTransport,
    });
    const groupThreadRelayIngestEnabled = resolveMainShellGroupThreadRelayIngestEnabled({
        selectedConversationKind: selectedConversation?.kind,
        pathname,
        hasRelayTransport: selectedGroupHasRelayTransport,
    });
    const { state: groupState, members: sealedCommunityMembers } = useLegacySealedCommunity({
        pool: relayPool,
        relayUrl: selectedConversation?.kind === 'group' ? (selectedConversation as GroupConversation).relayUrl : '',
        groupId: selectedConversation?.kind === 'group' ? (selectedConversation as GroupConversation).groupId : '',
        communityId: selectedConversation?.kind === 'group' ? (selectedConversation as GroupConversation).communityId : undefined,
        myPublicKeyHex,
        myPrivateKeyHex,
        enabled: sealedCommunityShellEnabled,
        initialMembers: sealedCommunityInitialMembers,
    });
    useGroupThreadRelayIngest({
        pool: relayPool,
        relayUrl: selectedConversation?.kind === "group" ? (selectedConversation as GroupConversation).relayUrl : "",
        groupId: selectedConversation?.kind === "group" ? (selectedConversation as GroupConversation).groupId : "",
        communityId: selectedConversation?.kind === "group" ? (selectedConversation as GroupConversation).communityId : undefined,
        communityMode: selectedConversation?.kind === "group" ? (selectedConversation as GroupConversation).communityMode : undefined,
        myPublicKeyHex,
        myPrivateKeyHex,
        enabled: groupThreadRelayIngestEnabled,
    });
    // Feature hooks
    const { handleSendMessage, deleteMessageForMe, deleteMessageForEveryone, showMessageOnDeviceAgain, showAllHiddenMessagesOnDevice, toggleReaction, sendCeremonyViewModel, confirmSendCeremony, cancelSendCeremony, } = useChatActions(dmController);
    const waitForWritableRelay = useCallback(
        (timeoutMs: number) => relayPool.waitForScopedConnection([], timeoutMs),
        [relayPool],
    );
    const requestTransport = useRequestTransport({
        dmController,
        peerTrust,
        requestsInbox,
        waitForWritableRelay,
    });
    const [acceptRelayPendingPeers, setAcceptRelayPendingPeers] = useState<ReadonlySet<PublicKeyHex>>(() => new Set());
    const inviteStateBridge = useMemo(() => {
        const toLegacyRequest = (item: Readonly<{
            peerPublicKeyHex: PublicKeyHex;
            lastMessagePreview: string;
            lastReceivedAtUnixSeconds: number;
            status?: "pending" | "accepted" | "declined" | "canceled";
            isOutgoing?: boolean;
        }>): LegacyInviteRequest => {
            const matchedConnection = createdConnections.find((entry) => entry.kind === "dm" && entry.pubkey === item.peerPublicKeyHex);
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
    const selectedDmConversationId = selectedConversation?.kind === "dm" ? selectedConversation.id : null;
    useDmSync(dmController.state.messages, selectedDmConversationId, setUnreadByConversationId, dmController.state.status === "ready", hasHydrated, lastViewedByConversationId);
    useCommandMessages(dmController.state.messages);
    const dmThreadPeerPubkeys = useMemo((): ReadonlySet<string> => {
        const peers = new Set<string>();
        createdConnections.forEach((connection) => {
            const normalized = connection.pubkey.trim().toLowerCase();
            if (normalized.length === 64) {
                peers.add(normalized);
            }
        });
        return peers;
    }, [createdConnections]);
    const resolveEffectiveRequestStatusForPeer = useCallback((peerPublicKeyHex: PublicKeyHex) => (
        resolveEffectiveContactRequestStatus({
            peerPublicKeyHex,
            isPeerAcceptedByTrust: peerTrust.isAccepted({ publicKeyHex: peerPublicKeyHex }),
            requestStatus: requestsInbox.getRequestStatus({ peerPublicKeyHex }),
            hasDmThreadRow: hasDmThreadRowForPeer(peerPublicKeyHex, dmThreadPeerPubkeys),
        })
    ), [dmThreadPeerPubkeys, peerTrust, requestsInbox]);
    const resolvePeerEstablishedForUi = useCallback((peerPublicKeyHex: PublicKeyHex): boolean => (resolveDmPeerEstablishedForUi({
        peerPublicKeyHex,
        isPeerAcceptedByTrust: peerTrust.isAccepted({ publicKeyHex: peerPublicKeyHex }),
        requestStatus: resolveEffectiveRequestStatusForPeer(peerPublicKeyHex),
    })), [peerTrust, resolveEffectiveRequestStatusForPeer]);
    const { allConversations, filteredConversations } = useFilteredConversations(createdConnections, createdGroups, connectionOverridesByConnectionId, searchQuery, (params) => resolvePeerEstablishedForUi(params.publicKeyHex as PublicKeyHex), myPublicKeyHex);
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
    const voiceLocalMediaModeRef = useRef<CallLocalMediaMode>("audio");
    const voiceMicConsentResolverRef = useRef<((stream: MediaStream | null) => void) | null>(null);
    const [voiceMicConsentOpen, setVoiceMicConsentOpen] = useState(false);
    const [voiceMediaConsentPurpose, setVoiceMediaConsentPurpose] = useState<MediaConsentPurpose>("voice_call");
    const voiceRemoteStreamRef = useRef<MediaStream | null>(null);
    /** Bumps when local/remote MediaStream refs change so the global dock/stage can preview video. */
    const [voiceCallMediaRevision, setVoiceCallMediaRevision] = useState(0);
    const bumpVoiceCallMediaRevision = useCallback((): void => {
        setVoiceCallMediaRevision((current) => current + 1);
    }, []);
    const voiceRemoteAudioElementRef = useRef<HTMLAudioElement | null>(null);
    const voicePendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
    const voiceLocalAudioMonitorStopRef = useRef<(() => void) | null>(null);
    const voiceRemoteAudioMonitorStopRef = useRef<(() => void) | null>(null);
    const voiceQualitySampleLastEmitUnixMsRef = useRef<number | null>(null);
    const processedVoiceSignalMessageIdsRef = useRef<Set<string>>(new Set());
    const voiceSignalsBootstrappedRef = useRef(false);
    const processedVoiceInviteMessageIdsRef = useRef<Set<string>>(new Set());
    const voiceInvitesBootstrappedRef = useRef(false);
    const deferredVoiceInviteMessageIdsRef = useRef<Set<string>>(new Set());
    const outgoingVoiceInviteRoomIdsRef = useRef<Set<string>>(new Set());
    const voiceCallJoinAcceptedAtByRoomRef = useRef<Map<string, number>>(new Map());
    const voiceCallHostDialStartedAtByRoomRef = useRef<Map<string, number>>(new Map());
    const voiceCallHostOfferSentAtByRoomRef = useRef<Map<string, number>>(new Map());
    const voiceCallIceStunOnlyRef = useRef(true);
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
    const voiceCallDisconnectGraceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const voiceCallConnectTimeoutKeyRef = useRef<string | null>(null);
    const voiceCallConnectTimeoutExtensionAttemptRef = useRef(0);
    const voiceCallQualitySampleAtRef = useRef<number | null>(null);
    const voicePeerConnectionCreationRef = useRef<Promise<RTCPeerConnection | null> | null>(null);
    const voicePeerConnectionCreationKeyRef = useRef<string | null>(null);
    const voiceHostOfferInFlightRef = useRef<HostOfferInFlightMap>(new Map());
    const voiceLeaveSignalRetryTimeoutsRef = useRef<Set<number>>(new Set());
    const leaveCallOnUnmountRef = useRef<() => void>(() => { });
    const relayStatusRef = useRef(relayStatus);
    const sendVoiceSignalRef = useRef<((params: Readonly<{
        peerPubkey: string;
        payload: VoiceCallSignalPayload;
    }>) => Promise<boolean>) | null>(null);
    useEffect(() => {
        voiceCallUiStatusRef.current = voiceCallUiStatus;
    }, [voiceCallUiStatus]);
    useEffect(() => {
        if (!hasHydrated || !myPublicKeyHex)
            return;
        if (restoredChatId === null) {
            const scopedKey = getScopedStorageKey(`obscur-last-chat-${myPublicKeyHex}`, getResolvedProfileId());
            const savedId = localStorage.getItem(scopedKey);
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
                if (resolved.kind === "group" && !hasWritableCommunityRelayTransport(resolved.relayUrl)) {
                    if (myPublicKeyHex) {
                        const scopedKey = getScopedStorageKey(`obscur-last-chat-${myPublicKeyHex}`, getResolvedProfileId());
                        try {
                            localStorage.removeItem(scopedKey);
                        }
                        catch {
                            // ignore storage failures
                        }
                    }
                    setRestoredChatId("");
                    return;
                }
                setSelectedConversation(resolved);
                if (resolved.kind === "dm") {
                    unhideConversation(resolved.id);
                }
                setRestoredChatId("");
            }
        }
    }, [
        createdConnections,
        createdGroups,
        myPublicKeyHex,
        restoredChatId,
        selectedConversation,
        setSelectedConversation,
        unhideConversation,
    ]);
    const selectedConversationView = selectedConversation ? applyConnectionOverrides(selectedConversation, connectionOverridesByConnectionId) : null;
    const [selectedGroupTerminalRevision, setSelectedGroupTerminalRevision] = useState(0);
    useEffect(() => {
        if (selectedConversationView?.kind !== "group" || typeof window === "undefined") {
            return;
        }
        const selectedGroupId = selectedConversationView.groupId;
        const selectedRelayUrl = selectedConversationView.relayUrl;
        const onTerminalMembershipUpdated = (event: Event) => {
            const detail = (event as CustomEvent<Readonly<{
                groupId?: string;
                relayUrl?: string;
            }>>).detail;
            if (detail?.groupId !== selectedGroupId
                || !detail?.relayUrl
                || !workspaceRelayUrlsMatch(detail.relayUrl, selectedRelayUrl)) {
                return;
            }
            setSelectedGroupTerminalRevision((value) => value + 1);
        };
        window.addEventListener(COMMUNITY_TERMINAL_MEMBERSHIP_UPDATED_EVENT, onTerminalMembershipUpdated);
        return () => {
            window.removeEventListener(COMMUNITY_TERMINAL_MEMBERSHIP_UPDATED_EVENT, onTerminalMembershipUpdated);
        };
    }, [selectedConversationView]);
    const selectedGroupTerminalMembership = useMemo(() => {
        if (selectedConversationView?.kind !== "group") {
            return null;
        }
        const cached = loadCommunityTerminalMembershipCache({
            groupId: selectedConversationView.groupId,
            relayUrl: selectedConversationView.relayUrl,
        });
        return {
            leftMemberPubkeys: dedupeCommunityMemberPubkeys([
                ...(cached?.leftMemberPubkeys ?? []),
                ...(groupState.leftMembers ?? []),
            ] as ReadonlyArray<PublicKeyHex>),
            expelledMemberPubkeys: dedupeCommunityMemberPubkeys([
                ...(cached?.expelledMemberPubkeys ?? []),
                ...(groupState.expelledMembers ?? []),
            ] as ReadonlyArray<PublicKeyHex>),
        };
    }, [
        groupState.expelledMembers,
        groupState.leftMembers,
        selectedConversationView,
        selectedGroupTerminalRevision,
    ]);
    const selectedGroupMembershipReadModel = useCommunityMembershipReadModelIndex({
        ownerPubkey: myPublicKeyHex as PublicKeyHex | null,
        groups: useMemo(() => {
            if (selectedConversationView?.kind !== "group") {
                return [];
            }
            return buildCommunityMembershipReadModelIndexGroupInputs({
                ownerPubkey: myPublicKeyHex as PublicKeyHex | null,
                groups: [selectedConversationView],
                communityKnownParticipantDirectoryByConversationId,
                communityRosterByConversationId,
                terminalOverridesByConversationId: selectedGroupTerminalMembership
                    ? {
                        [selectedConversationView.id]: {
                            leftMemberPubkeys: selectedGroupTerminalMembership.leftMemberPubkeys,
                            expelledMemberPubkeys: selectedGroupTerminalMembership.expelledMemberPubkeys,
                        },
                    }
                    : undefined,
            });
        }, [
            communityKnownParticipantDirectoryByConversationId,
            communityRosterByConversationId,
            myPublicKeyHex,
            selectedConversationView,
            selectedGroupTerminalMembership,
        ]),
    });
    const selectedGroupActiveMemberPubkeys = useMemo((): ReadonlyArray<PublicKeyHex> => {
        if (selectedConversationView?.kind !== "group") {
            return [];
        }
        const leftSet = new Set((selectedGroupTerminalMembership?.leftMemberPubkeys ?? [])
            .map((pubkey) => pubkey.trim().toLowerCase()));
        const expelledSet = new Set((selectedGroupTerminalMembership?.expelledMemberPubkeys ?? [])
            .map((pubkey) => pubkey.trim().toLowerCase()));
        const isActive = (pubkey: PublicKeyHex): boolean => {
            const normalized = pubkey.trim().toLowerCase();
            return normalized.length > 0 && !leftSet.has(normalized) && !expelledSet.has(normalized);
        };
        if (isWorkspaceKernelAuthority()) {
            const projection = communityRosterByConversationId[selectedConversationView.id];
            const kernelActive = resolveWorkspaceKernelActiveMemberPubkeys({
                rosterProjection: projection,
            }).filter(isActive);
            if (kernelActive.length > 0) {
                return kernelActive;
            }
            const readModelCount = selectedGroupMembershipReadModel[selectedConversationView.id]?.memberCount ?? 1;
            const fallbackPubkeys = (selectedConversationView.memberPubkeys ?? []).filter(isActive);
            if (fallbackPubkeys.length > 0) {
                return fallbackPubkeys.slice(0, Math.max(1, readModelCount));
            }
            return [];
        }
        const r2DisplayPubkeys = (selectedGroupMembershipReadModel[selectedConversationView.id]?.displayPubkeys ?? []) as ReadonlyArray<PublicKeyHex>;
        const r2Active = r2DisplayPubkeys.filter(isActive);
        if (r2Active.length > 0) {
            const liveActive = sealedCommunityMembers.filter(isActive);
            if (liveActive.length > r2Active.length) {
                return dedupeCommunityMemberPubkeys([...r2Active, ...liveActive]);
            }
            return r2Active;
        }
        const projection = communityRosterByConversationId[selectedConversationView.id];
        const liveActive = sealedCommunityMembers.filter(isActive);
        if (liveActive.length > 0) {
            return liveActive;
        }
        const projectionActive = (projection?.activeMemberPubkeys ?? []).filter(isActive);
        if (projectionActive.length > 0) {
            return projectionActive;
        }
        const readModelCount = selectedGroupMembershipReadModel[selectedConversationView.id]?.memberCount ?? 1;
        const fallbackPubkeys = (selectedConversationView.memberPubkeys ?? []).filter(isActive);
        if (fallbackPubkeys.length > 0) {
            return fallbackPubkeys.slice(0, Math.max(1, readModelCount));
        }
        return [];
    }, [
        communityRosterByConversationId,
        sealedCommunityMembers,
        selectedConversationView,
        selectedGroupMembershipReadModel,
        selectedGroupTerminalMembership,
    ]);
    const selectedCommunityBotTriggerSummary = useMemo(() => {
        if (selectedConversationView?.kind !== "group" || !groupState.metadata) {
            return null;
        }
        const botPubkeys = readBotPubkeysFromMetadataField(groupState.metadata.botPubkeys);
        if (botPubkeys.length === 0) {
            return null;
        }
        const botTriggers = readBotTriggersFromMetadataField(groupState.metadata.botTriggers);
        return summarizeCommunityBotTriggerStatuses({ botPubkeys, botTriggers });
    }, [groupState.metadata, selectedConversationView]);
    const isMobileDmShell = isMobileShellProduct();
    const handleLeaveMobileThread = useCallback(() => {
        setSelectedConversation(null);
    }, [setSelectedConversation]);
    useMobileDmBackNavigation(isMobileDmShell && Boolean(selectedConversationView), handleLeaveMobileThread);
    const selectedConversationDmPubkey = selectedConversationView?.kind === "dm"
        ? selectedConversationView.pubkey
        : null;
    const contactRelayOverlap = useContactRelayOverlap(selectedConversationDmPubkey, enabledRelayUrls, relayPool);
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
    const activeVoiceCallForSelectedConversation = (activeVoiceCallUiState
        && selectedConversationDmPubkey
        && activeVoiceCallUiState.peerPubkey === selectedConversationDmPubkey) ? activeVoiceCallUiState : null;
    const voiceCallStatusForSelectedConversation = (voiceCallUiStatus
        && selectedConversationDmPubkey
        && voiceCallUiStatus.peerPubkey === selectedConversationDmPubkey) ? voiceCallUiStatus : null;
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
        const attemptSend = async (): Promise<boolean> => {
            try {
                const result = await dmController.sendDm({
                    peerPublicKeyInput: params.peerPubkey,
                    plaintext: JSON.stringify(params.payload),
                    customTags: [["t", "voice-call-signal"]],
                });
                const signalSent = isVoiceCallSignalDeliveryAccepted({
                    deliveryStatus: result.deliveryStatus,
                    success: result.success,
                    partialWireDelivery: result.partialWireDelivery,
                    eventId: result.eventId,
                    relayResults: result.relayResults,
                });
                const provisional = signalSent
                    && (result.deliveryStatus === "pending_ack"
                        || (result.deliveryStatus === "failed" && result.partialWireDelivery === true));
                logAppEvent({
                    name: "messaging.realtime_voice.signal_send_result",
                    level: signalSent ? (provisional ? "warn" : "info") : "warn",
                    scope: { feature: "messaging", action: "realtime_voice_signal" },
                    context: {
                        status: signalSent ? (provisional ? "sent_provisional" : "sent") : "failed",
                        deliveryStatus: result.deliveryStatus ?? "legacy",
                        signalType: params.payload.signalType,
                        roomIdHint: toRoomIdHint(params.payload.roomId),
                        relayResultCount: result.relayResults.length,
                        partialWireDelivery: result.partialWireDelivery === true,
                    },
                });
                return signalSent;
            }
            catch {
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
        };
        const first = await attemptSend();
        if (first) {
            return true;
        }
        // Past DM send dedup window (500ms); stamp sentAt so plaintext differs.
        await new Promise<void>((resolve) => {
            window.setTimeout(() => resolve(), 600);
        });
        const retryPayload: VoiceCallSignalPayload = {
            ...params.payload,
            sentAtUnixMs: Date.now(),
        };
        const retry = await (async (): Promise<boolean> => {
            try {
                const result = await dmController.sendDm({
                    peerPublicKeyInput: params.peerPubkey,
                    plaintext: JSON.stringify(retryPayload),
                    customTags: [["t", "voice-call-signal"]],
                });
                const signalSent = isVoiceCallSignalDeliveryAccepted({
                    deliveryStatus: result.deliveryStatus,
                    success: result.success,
                    partialWireDelivery: result.partialWireDelivery,
                    eventId: result.eventId,
                    relayResults: result.relayResults,
                });
                logAppEvent({
                    name: "messaging.realtime_voice.signal_send_result",
                    level: signalSent ? "info" : "warn",
                    scope: { feature: "messaging", action: "realtime_voice_signal" },
                    context: {
                        status: signalSent ? "sent_retry" : "failed_retry",
                        deliveryStatus: result.deliveryStatus ?? "legacy",
                        signalType: params.payload.signalType,
                        roomIdHint: toRoomIdHint(params.payload.roomId),
                        relayResultCount: result.relayResults.length,
                        partialWireDelivery: result.partialWireDelivery === true,
                    },
                });
                return signalSent;
            }
            catch {
                return false;
            }
        })();
        if (retry) {
            logAppEvent({
                name: "messaging.realtime_voice.signal_send_retry_recovered",
                level: "info",
                scope: { feature: "messaging", action: "realtime_voice_signal" },
                context: {
                    signalType: params.payload.signalType,
                    roomIdHint: toRoomIdHint(params.payload.roomId),
                },
            });
        }
        return retry;
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
            const AudioContextCtor: typeof AudioContext | undefined = window.AudioContext
                || (window as Window & {
                    webkitAudioContext?: typeof AudioContext;
                }).webkitAudioContext;
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
        }
        catch {
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
            const AudioContextCtor: typeof AudioContext | undefined = window.AudioContext
                || (window as Window & {
                    webkitAudioContext?: typeof AudioContext;
                }).webkitAudioContext;
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
                }
                catch {
                    // best effort
                }
                try {
                    analyser.disconnect();
                }
                catch {
                    // best effort
                }
                void audioContext.close().catch(() => {
                    // best effort
                });
                updateVoiceWaveAudioLevel(params.channel, 0);
            };
            if (params.channel === "local") {
                voiceLocalAudioMonitorStopRef.current = stop;
            }
            else {
                voiceRemoteAudioMonitorStopRef.current = stop;
            }
        }
        catch {
            updateVoiceWaveAudioLevel(params.channel, 0);
        }
    }, [stopVoiceAudioMonitor, updateVoiceWaveAudioLevel]);
    const clearVoiceDisconnectGraceTimer = useCallback((): void => {
        if (voiceCallDisconnectGraceTimeoutRef.current) {
            clearTimeout(voiceCallDisconnectGraceTimeoutRef.current);
            voiceCallDisconnectGraceTimeoutRef.current = null;
        }
    }, []);
    const clearVoiceCallTimers = useCallback((): void => {
        if (voiceCallConnectTimeoutRef.current) {
            clearTimeout(voiceCallConnectTimeoutRef.current);
            voiceCallConnectTimeoutRef.current = null;
        }
        if (voiceCallInterruptionTimeoutRef.current) {
            clearTimeout(voiceCallInterruptionTimeoutRef.current);
            voiceCallInterruptionTimeoutRef.current = null;
        }
        clearVoiceDisconnectGraceTimer();
    }, [clearVoiceDisconnectGraceTimer]);
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
            }
            catch {
                // best effort
            }
        });
        voiceLocalStreamRef.current = null;
        voiceLocalMediaModeRef.current = "audio";
        bumpVoiceCallMediaRevision();
    }, [bumpVoiceCallMediaRevision, stopVoiceAudioMonitor]);
    const clearVoiceRemoteStream = useCallback((): void => {
        stopVoiceAudioMonitor("remote");
        if (voiceRemoteAudioElementRef.current) {
            voiceRemoteAudioElementRef.current.srcObject = null;
        }
        if (voiceRemoteStreamRef.current) {
            voiceRemoteStreamRef.current = null;
            bumpVoiceCallMediaRevision();
        }
    }, [bumpVoiceCallMediaRevision, stopVoiceAudioMonitor]);
    const tearDownVoicePeerConnection = useCallback((params?: Readonly<{
        reasonCode?: "left_by_user" | "session_closed";
    }>): void => {
        const previousSession = activeVoiceCallSessionRef.current;
        clearVoiceCallTimers();
        clearVoiceLeaveSignalRetryTimers();
        clearVoiceJoinRequestRetryInterval();
        clearVoiceOfferRetryInterval();
        voicePeerConnectionCreationRef.current = null;
        voicePeerConnectionCreationKeyRef.current = null;
        voiceCallQualitySampleAtRef.current = null;
        const connection = voicePeerConnectionRef.current;
        if (connection) {
            connection.onicecandidate = null;
            connection.ontrack = null;
            connection.onconnectionstatechange = null;
            try {
                connection.close();
            }
            catch {
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
            voiceCallHostDialStartedAtByRoomRef.current.delete(previousSession.roomId);
            voiceCallHostOfferSentAtByRoomRef.current.delete(previousSession.roomId);
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

        const wantVideo = voiceCallUiStatusRef.current?.callType === "video";
        // Always getUserMedia first — WebView owns the prompt. In-app dialog is
        // recovery only after mic NotAllowedError (never trust permissions.query alone).
        // M1-B: camera failure → audio_only_fallback (no camera consent loop).
        const result = await acquireLocalCallMedia({
            wantVideo,
            labCanvasVideoEnabled: isLabCanvasVideoEnabled(),
        });
        if (result.ok) {
            voiceLocalStreamRef.current = result.stream;
            voiceLocalMediaModeRef.current = result.mediaMode;
            bumpVoiceCallMediaRevision();
            if (result.mediaMode === "audio_only_fallback") {
                setVoiceCallUiStatus((current) => (
                    current
                        ? { ...current, mediaMode: "audio_only_fallback" }
                        : current
                ));
                logAppEvent({
                    name: "messaging.realtime_voice.camera_fallback",
                    level: "info",
                    scope: { feature: "messaging", action: "realtime_voice_media" },
                    context: {
                        cameraReasonCode: result.cameraReasonCode ?? "unknown",
                        mediaMode: result.mediaMode,
                    },
                });
            } else if (wantVideo && (result.mediaMode === "av" || result.mediaMode === "av_lab_canvas")) {
                const mediaMode = result.mediaMode;
                setVoiceCallUiStatus((current) => (
                    current ? { ...current, mediaMode } : current
                ));
                if (mediaMode === "av_lab_canvas") {
                    logAppEvent({
                        name: "messaging.realtime_voice.lab_canvas_video",
                        level: "info",
                        scope: { feature: "messaging", action: "realtime_voice_media" },
                        context: {
                            mediaMode,
                            cameraReasonCode: result.cameraReasonCode ?? "unknown",
                        },
                    });
                }
            }
            return result.stream;
        }
        if (!shouldOpenMediaConsentRecovery(result.reasonCode)) {
            return null;
        }

        const stream = await new Promise<MediaStream | null>((resolve) => {
            voiceMicConsentResolverRef.current = resolve;
            setVoiceMediaConsentPurpose(wantVideo ? "video_call" : "voice_call");
            setVoiceMicConsentOpen(true);
        });
        if (stream) {
            voiceLocalStreamRef.current = stream;
            voiceLocalMediaModeRef.current = wantVideo ? "audio_only_fallback" : "audio";
            bumpVoiceCallMediaRevision();
            if (wantVideo) {
                setVoiceCallUiStatus((current) => (
                    current
                        ? { ...current, mediaMode: "audio_only_fallback" }
                        : current
                ));
            }
        }
        return stream;
    }, [bumpVoiceCallMediaRevision]);

    const closeVoiceMicConsent = useCallback((stream: MediaStream | null): void => {
        setVoiceMicConsentOpen(false);
        const resolver = voiceMicConsentResolverRef.current;
        voiceMicConsentResolverRef.current = null;
        resolver?.(stream);
    }, []);
    const failVoicePeerConnectionStart = useCallback((params: Readonly<{
        roomId: string;
        peerPubkey: string;
        role: "host" | "joiner";
    }>): void => {
        const honesty = resolveVoicePeerConnectionStartFailureUi();
        activeVoiceCallSessionRef.current = null;
        setActiveVoiceCallUiState(null);
        setVoiceCallUiStatus({
            roomId: params.roomId,
            peerPubkey: params.peerPubkey,
            phase: honesty.phase,
            role: params.role,
            sinceUnixMs: Date.now(),
            reasonCode: honesty.reasonCode,
        });
        logAppEvent({
            name: "messaging.realtime_voice.peer_connection_start_failed",
            level: "warn",
            scope: { feature: "messaging", action: "realtime_voice_signal" },
            context: {
                status: honesty.logStatus,
                roomIdHint: toRoomIdHint(params.roomId),
                role: params.role,
            },
        });
        toast.error(t(honesty.toastKey));
    }, [t]);
    const failVoiceOfferDispatch = useCallback((params: Readonly<{
        roomId: string;
        peerPubkey: string;
        role: "host" | "joiner";
    }>): void => {
        const honesty = resolveVoiceOfferDispatchFailureUi();
        tearDownVoicePeerConnection({ reasonCode: "session_closed" });
        activeVoiceCallSessionRef.current = null;
        setActiveVoiceCallUiState(null);
        setVoiceCallUiStatus({
            roomId: params.roomId,
            peerPubkey: params.peerPubkey,
            phase: honesty.phase,
            role: params.role,
            sinceUnixMs: Date.now(),
            reasonCode: honesty.reasonCode,
        });
        logAppEvent({
            name: "messaging.realtime_voice.offer_dispatch_failed",
            level: "warn",
            scope: { feature: "messaging", action: "realtime_voice_signal" },
            context: {
                status: honesty.logStatus,
                roomIdHint: toRoomIdHint(params.roomId),
                role: params.role,
            },
        });
        toast.error(t(honesty.toastKey));
    }, [t, tearDownVoicePeerConnection]);
    const failVoiceAnswerDispatch = useCallback((params: Readonly<{
        roomId: string;
        peerPubkey: string;
        role: "host" | "joiner";
    }>): void => {
        const honesty = resolveVoiceAnswerDispatchFailureUi();
        tearDownVoicePeerConnection({ reasonCode: "session_closed" });
        activeVoiceCallSessionRef.current = null;
        setActiveVoiceCallUiState(null);
        setVoiceCallUiStatus({
            roomId: params.roomId,
            peerPubkey: params.peerPubkey,
            phase: honesty.phase,
            role: params.role,
            sinceUnixMs: Date.now(),
            reasonCode: honesty.reasonCode,
        });
        logAppEvent({
            name: "messaging.realtime_voice.answer_dispatch_failed",
            level: "warn",
            scope: { feature: "messaging", action: "realtime_voice_signal" },
            context: {
                status: honesty.logStatus,
                roomIdHint: toRoomIdHint(params.roomId),
                role: params.role,
            },
        });
        toast.error(t(honesty.toastKey));
    }, [t, tearDownVoicePeerConnection]);
    const ensureVoicePeerConnection = useCallback(async (session: ActiveVoiceCallSession): Promise<RTCPeerConnection | null> => {
        if (voicePeerConnectionRef.current
            && activeVoiceCallSessionRef.current?.roomId === session.roomId
            && activeVoiceCallSessionRef.current?.peerPubkey === session.peerPubkey) {
            return voicePeerConnectionRef.current;
        }
        const sessionKey = `${session.roomId}|${session.peerPubkey}|${session.role}`;
        if (voicePeerConnectionCreationRef.current
            && voicePeerConnectionCreationKeyRef.current === sessionKey) {
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
            const iceResolution = resolveRealtimeCallIceServersFromEnv();
            voiceCallIceStunOnlyRef.current = iceResolution.stunOnly;
            logAppEvent({
                name: "messaging.realtime_voice.ice_config",
                level: iceResolution.stunOnly ? "warn" : "info",
                scope: { feature: "messaging", action: "realtime_voice_signal" },
                context: {
                    roomIdHint: toRoomIdHint(session.roomId),
                    role: session.role,
                    stunOnly: iceResolution.stunOnly,
                    hasTurn: iceResolution.hasTurn,
                    stunUrlCount: iceResolution.stunUrlCount,
                    turnUrlCount: iceResolution.turnUrlCount,
                },
            });
            const connection = new RTCPeerConnection({
                iceServers: [...iceResolution.iceServers],
            });
            const wantVideoReceive = voiceCallUiStatusRef.current?.callType === "video";
            attachLocalMediaToPeerConnection({
                connection,
                stream,
                wantVideoReceive,
            });
            connection.onicecandidate = (event): void => {
                const liveSession = activeVoiceCallSessionRef.current;
                if (voicePeerConnectionRef.current !== connection
                    || !liveSession
                    || liveSession.roomId !== session.roomId
                    || liveSession.peerPubkey !== session.peerPubkey) {
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
                if (voicePeerConnectionRef.current !== connection
                    || !liveSession
                    || liveSession.roomId !== session.roomId
                    || liveSession.peerPubkey !== session.peerPubkey) {
                    return;
                }
                const remoteStream = event.streams[0] ?? new MediaStream([event.track]);
                voiceRemoteStreamRef.current = remoteStream;
                bumpVoiceCallMediaRevision();
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
                if (voicePeerConnectionRef.current !== connection
                    || !liveSession
                    || liveSession.roomId !== session.roomId
                    || liveSession.peerPubkey !== session.peerPubkey
                    || liveSession.role !== session.role) {
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
                        stunOnly: voiceCallIceStunOnlyRef.current,
                    },
                });
                const markNetworkInterrupted = (): void => {
                    clearVoiceDisconnectGraceTimer();
                    setVoiceCallUiStatus((previous) => ({
                        roomId: session.roomId,
                        peerPubkey: session.peerPubkey,
                        phase: "interrupted",
                        role: session.role,
                        sinceUnixMs: Date.now(),
                        reasonCode: "network_interrupted",
                        ...preserveVoiceCallUiStatusMedia({
                            roomId: session.roomId,
                            previous,
                        }),
                    }));
                    realtimeVoiceSessionOwnerRef.current.transportDegraded({
                        reasonCode: "network_degraded",
                        eventUnixMs: Date.now(),
                    });
                };
                const graceAction = resolveRealtimeCallConnectionStateAction({
                    connectionState: state,
                    gracePending: voiceCallDisconnectGraceTimeoutRef.current !== null,
                });
                if (graceAction === "cancel_grace") {
                    clearVoiceDisconnectGraceTimer();
                }
                else if (graceAction === "start_grace") {
                    voiceCallDisconnectGraceTimeoutRef.current = setTimeout(() => {
                        voiceCallDisconnectGraceTimeoutRef.current = null;
                        const stillLive = activeVoiceCallSessionRef.current;
                        const liveConnection = voicePeerConnectionRef.current;
                        if (!stillLive
                            || stillLive.roomId !== session.roomId
                            || stillLive.peerPubkey !== session.peerPubkey
                            || liveConnection !== connection) {
                            return;
                        }
                        if (shouldEndCallAfterDisconnectGrace(connection.connectionState)) {
                            markNetworkInterrupted();
                        }
                    }, REALTIME_CALL_DISCONNECT_GRACE_MS);
                }
                else if (graceAction === "end_interrupted") {
                    markNetworkInterrupted();
                }
                if (state === "connected") {
                    const connectedAtUnixMs = Date.now();
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
                                    acceptToConnectedElapsedMs: Math.max(0, connectedAtUnixMs - acceptedAtUnixMs),
                                },
                            });
                        }
                        voiceCallJoinAcceptedAtByRoomRef.current.delete(session.roomId);
                    }
                    else if (session.role === "host") {
                        const hostContext = buildRealtimeCallHostConnectedContext({
                            roomIdHint: toRoomIdHint(session.roomId),
                            peerPubkeySuffix: session.peerPubkey.slice(-8),
                            dialStartedAtUnixMs: voiceCallHostDialStartedAtByRoomRef.current.get(session.roomId),
                            offerSentAtUnixMs: voiceCallHostOfferSentAtByRoomRef.current.get(session.roomId),
                            connectedAtUnixMs,
                        });
                        logAppEvent({
                            name: "messaging.realtime_voice.host_connected",
                            level: "info",
                            scope: { feature: "messaging", action: "realtime_voice_signal" },
                            context: hostContext,
                        });
                        voiceCallHostDialStartedAtByRoomRef.current.delete(session.roomId);
                        voiceCallHostOfferSentAtByRoomRef.current.delete(session.roomId);
                    }
                    setVoiceCallUiStatus((previous) => ({
                        roomId: session.roomId,
                        peerPubkey: session.peerPubkey,
                        phase: "connected",
                        role: session.role,
                        sinceUnixMs: connectedAtUnixMs,
                        ...preserveVoiceCallUiStatusMedia({
                            roomId: session.roomId,
                            previous,
                        }),
                    }));
                    realtimeVoiceSessionOwnerRef.current.connected({
                        participantCount: 2,
                        hasPeerSessionEvidence: true,
                        eventUnixMs: connectedAtUnixMs,
                    });
                }
                else if (state === "closed") {
                    clearVoiceDisconnectGraceTimer();
                    realtimeVoiceSessionOwnerRef.current.closed({ eventUnixMs: Date.now() });
                }
            };
            if (voicePeerConnectionCreationKeyRef.current !== sessionKey) {
                try {
                    connection.close();
                }
                catch {
                    // best effort
                }
                const liveSession = activeVoiceCallSessionRef.current;
                if (voicePeerConnectionRef.current
                    && liveSession
                    && liveSession.roomId === session.roomId
                    && liveSession.peerPubkey === session.peerPubkey
                    && liveSession.role === session.role) {
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
            setVoiceCallUiStatus((previous) => ({
                roomId: session.roomId,
                peerPubkey: session.peerPubkey,
                phase: "connecting",
                role: session.role,
                sinceUnixMs: Date.now(),
                ...preserveVoiceCallUiStatusMedia({
                    roomId: session.roomId,
                    previous,
                }),
            }));
            return connection;
        })();
        voicePeerConnectionCreationRef.current = createConnectionPromise;
        try {
            return await createConnectionPromise;
        }
        finally {
            if (voicePeerConnectionCreationKeyRef.current === sessionKey) {
                voicePeerConnectionCreationRef.current = null;
                voicePeerConnectionCreationKeyRef.current = null;
            }
        }
    }, [bumpVoiceCallMediaRevision, clearVoiceDisconnectGraceTimer, ensureVoiceLocalStream, myPublicKeyHex, sendVoiceSignal, tearDownVoicePeerConnection]);
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
    const handleSendVoiceCallInvite = useCallback(async (
        requestedCallType: "voice" | "video" = "voice",
    ): Promise<void> => {
        if (!REALTIME_VOICE_CALLS_ENABLED) {
            return;
        }
        if (selectedConversationView?.kind !== "dm") {
            return;
        }
        if (!dmController) {
            toast.error(t("messaging.voiceCallInviteControllerNotReady"));
            return;
        }
        if (isSendingVoiceCallInvite) {
            return;
        }
        if (!canStartVoiceCallInviteWhileLineIdle({ phase: voiceCallUiStatusRef.current?.phase })) {
            toast.info(t(
                "messaging.voiceCallLineBusyDialBlocked",
                "Already in a call — end it before starting another.",
            ));
            return;
        }
        const openRelayCount = relayStatusRef.current.openCount;
        if (!canStartVoiceCallInviteDial({ openRelayCount })) {
            logAppEvent({
                name: "messaging.realtime_voice.invite_send_result",
                level: "warn",
                scope: { feature: "messaging", action: "realtime_voice_invite" },
                context: {
                    status: "blocked_no_open_relay",
                    openRelayCount,
                    configuredRelayCount: relayStatusRef.current.total,
                    callType: requestedCallType,
                },
            });
            toast.error(t(
                requestedCallType === "video"
                    ? "messaging.videoCallInviteNoOpenRelay"
                    : "messaging.voiceCallInviteNoOpenRelay",
                requestedCallType === "video"
                    ? "No open relays — enable a relay in Settings → Relays, then retry the video call."
                    : "No open relays — enable a relay in Settings → Relays, then retry the voice call.",
            ));
            return;
        }
        const dialPeerPubkey = selectedConversationView.pubkey;
        const peerIsOnline = presence.isPeerOnline(dialPeerPubkey)
            || isRecentPresenceEvidenceActive({
                nowMs: Date.now(),
                lastObservedAtMs: peerLastActiveByPeerPubkey[dialPeerPubkey],
            });
        if (shouldWarnOfflinePeerBeforeVoiceInviteDial({ peerIsOnline })) {
            toast.warning(t(
                requestedCallType === "video"
                    ? "messaging.videoCallInvitePeerOffline"
                    : "messaging.voiceCallInvitePeerOffline",
                "This contact looks offline — they may not see the invite until they reconnect.",
            ));
        }
        setIsSendingVoiceCallInvite(true);
        let dialMediaMode: CallLocalMediaMode = requestedCallType === "video" ? "av" : "audio";
        try {
            if (requestedCallType === "video") {
                const preflight = await prepareLocalMediaForCallDial({
                    wantVideo: true,
                    labCanvasVideoEnabled: isLabCanvasVideoEnabled(),
                    existingStream: voiceLocalStreamRef.current,
                    existingMediaMode: voiceLocalMediaModeRef.current,
                });
                logAppEvent({
                    name: "messaging.realtime_voice.video_dial_preflight",
                    level: preflight.ok ? "info" : "warn",
                    scope: { feature: "messaging", action: "realtime_voice_invite" },
                    context: {
                        ok: preflight.ok,
                        microphoneCount: preflight.microphoneCount,
                        cameraCount: preflight.cameraCount,
                        mediaMode: preflight.ok ? preflight.mediaMode : null,
                        reasonCode: preflight.ok ? (preflight.cameraReasonCode ?? null) : preflight.reasonCode,
                    },
                });
                if (!preflight.ok) {
                    if (preflight.needsConsentRecovery) {
                        const stream = await new Promise<MediaStream | null>((resolve) => {
                            voiceMicConsentResolverRef.current = resolve;
                            setVoiceMediaConsentPurpose("video_call");
                            setVoiceMicConsentOpen(true);
                        });
                        if (!stream) {
                            toast.error(t(
                                "messaging.videoCallMediaPermissionDenied",
                                "Camera or microphone permission is required for a video call.",
                            ));
                            return;
                        }
                        voiceLocalStreamRef.current = stream;
                        voiceLocalMediaModeRef.current = "audio_only_fallback";
                        bumpVoiceCallMediaRevision();
                        dialMediaMode = "audio_only_fallback";
                        toast.info(t(
                            CAMERA_UNAVAILABLE_BANNER_I18N_KEY,
                            CAMERA_UNAVAILABLE_BANNER_DEFAULT,
                        ));
                    }
                    else {
                        toast.error(t(
                            "messaging.videoCallMediaUnavailable",
                            "Microphone is unavailable — cannot start a video call.",
                        ));
                        return;
                    }
                }
                else {
                    voiceLocalStreamRef.current = preflight.stream;
                    voiceLocalMediaModeRef.current = preflight.mediaMode;
                    bumpVoiceCallMediaRevision();
                    dialMediaMode = preflight.mediaMode;
                    if (preflight.mediaMode === "audio_only_fallback") {
                        toast.info(t(
                            CAMERA_UNAVAILABLE_BANNER_I18N_KEY,
                            CAMERA_UNAVAILABLE_BANNER_DEFAULT,
                        ));
                    }
                }
            }
            const nowUnixMs = Date.now();
            const roomToken = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `${nowUnixMs.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
            const roomId = `dm-voice-${roomToken}`;
            const expiresAtUnixMs = nowUnixMs + (5 * 60 * 1000);
            const localCapability = getRealtimeVoiceCapability();
            const payload = createVoiceCallInvitePayload({
                roomId,
                invitedAtUnixMs: nowUnixMs,
                expiresAtUnixMs,
                fromPubkey: myPublicKeyHex ?? null,
                callType: requestedCallType,
                capabilities: { video: localCapability.supportsVideo },
            });
            logAppEvent({
                name: "messaging.realtime_voice.invite_send_attempt",
                level: "info",
                scope: { feature: "messaging", action: "realtime_voice_invite" },
                context: {
                    conversationKind: selectedConversationView.kind,
                    roomIdHint: `${roomId.slice(0, 8)}...${roomId.slice(-8)}`,
                    openRelayCount,
                    callType: requestedCallType,
                },
            });
            try {
                const result = await dmController.sendDm({
                    peerPublicKeyInput: selectedConversationView.pubkey,
                    plaintext: JSON.stringify(payload),
                    customTags: [["t", "voice-call-invite"]],
                    waitForConfirmation: true,
                    suppressPublishFeedbackToast: true,
                });
                const inviteConfirmed = isVoiceCallInviteDeliveryAccepted(result.deliveryStatus);
                const inviteProvisional = shouldStartVoiceCallInviteSession({
                    deliveryStatus: result.deliveryStatus,
                    partialWireDelivery: result.partialWireDelivery,
                    eventId: result.eventId || result.messageId,
                }) && !inviteConfirmed;
                const inviteStart = inviteConfirmed || inviteProvisional;
                if (!inviteStart) {
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
                            partialWireDelivery: result.partialWireDelivery === true,
                            reasonCode: result.reasonCode ?? null,
                            callType: requestedCallType,
                        },
                    });
                    if (requestedCallType === "video") {
                        stopVoiceLocalStream();
                    }
                    if (result.deliveryStatus === "queued_retrying") {
                        toast.warning(t(
                            requestedCallType === "video"
                                ? "messaging.videoCallInviteQueued"
                                : "messaging.voiceCallInviteQueued",
                        ));
                    }
                    else {
                        toast.error(
                            getRelayPublishFailureUserMessage({
                                reasonCode: result.reasonCode,
                                error: result.error,
                                successCount: result.relayResults.filter((r) => r.success).length,
                                totalRelays: result.relayResults.length,
                                partialWireDelivery: result.partialWireDelivery,
                            }) || t(
                                requestedCallType === "video"
                                    ? "messaging.videoCallInviteSendFailed"
                                    : "messaging.voiceCallInviteSendFailed",
                            ),
                        );
                    }
                    return;
                }
                logAppEvent({
                    name: "messaging.realtime_voice.invite_send_result",
                    level: inviteConfirmed && result.deliveryStatus === "sent_quorum" ? "info" : "warn",
                    scope: { feature: "messaging", action: "realtime_voice_invite" },
                    context: {
                        status: inviteConfirmed
                            ? (result.deliveryStatus === "sent_quorum" ? "sent" : "partial")
                            : "provisional_wire",
                        deliveryStatus: result.deliveryStatus ?? "unknown",
                        roomIdHint: `${roomId.slice(0, 8)}...${roomId.slice(-8)}`,
                        relayResultCount: result.relayResults.length,
                        partialWireDelivery: result.partialWireDelivery === true,
                        callType: requestedCallType,
                    },
                });
                outgoingVoiceInviteRoomIdsRef.current.add(roomId);
                const dialStartedAtUnixMs = Date.now();
                voiceCallHostDialStartedAtByRoomRef.current.set(roomId, dialStartedAtUnixMs);
                setVoiceCallUiStatus({
                    roomId,
                    peerPubkey: selectedConversationView.pubkey,
                    phase: "ringing_outgoing",
                    role: "host",
                    sinceUnixMs: dialStartedAtUnixMs,
                    callType: requestedCallType,
                    mediaMode: requestedCallType === "video" ? dialMediaMode : undefined,
                });
                if (inviteConfirmed && result.deliveryStatus === "sent_quorum") {
                    toast.success(t(
                        requestedCallType === "video"
                            ? "messaging.videoCallInviteSent"
                            : "messaging.voiceCallInviteSent",
                    ));
                }
                else if (inviteConfirmed) {
                    toast.warning(t(
                        requestedCallType === "video"
                            ? "messaging.videoCallInviteSentPartial"
                            : "messaging.voiceCallInviteSentPartial",
                    ));
                }
                else {
                    toast.warning(getRelayPublishFailureUserMessage({
                        partialWireDelivery: true,
                    }));
                }
            }
            catch {
                logAppEvent({
                    name: "messaging.realtime_voice.invite_send_result",
                    level: "error",
                    scope: { feature: "messaging", action: "realtime_voice_invite" },
                    context: {
                        status: "error",
                        roomIdHint: `${roomId.slice(0, 8)}...${roomId.slice(-8)}`,
                        callType: requestedCallType,
                    },
                });
                if (requestedCallType === "video") {
                    stopVoiceLocalStream();
                }
                toast.error(t(
                    requestedCallType === "video"
                        ? "messaging.videoCallInviteSendFailed"
                        : "messaging.voiceCallInviteSendFailed",
                ));
            }
        }
        finally {
            setIsSendingVoiceCallInvite(false);
        }
    }, [
        bumpVoiceCallMediaRevision,
        dmController,
        isSendingVoiceCallInvite,
        myPublicKeyHex,
        peerLastActiveByPeerPubkey,
        presence,
        selectedConversationView,
        stopVoiceLocalStream,
        t,
    ]);
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
            toast.error(t("messaging.voiceCallJoinFailedMissingRoom"));
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
                    toast.warning(t("messaging.voiceCallJoinUnsupported"));
                    return;
                }
                if (next.lastTransitionReasonCode === "invalid_transition") {
                    toast.info(t("messaging.voiceCallJoinAlreadyActive"));
                    return;
                }
                if (next.phase === "degraded") {
                    toast.warning(t("messaging.voiceCallJoinDegraded"));
                }
                if (!myPublicKeyHex) {
                    toast.error(t("messaging.voiceCallJoinIdentityLocked"));
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
                // Join from card or accept toast must keep wire video intent (same-machine dual
                // profile may lose the camera, not the video stage chrome).
                const joinCallType = resolveCallTypeFromInvite({
                    inviteCallType: params.invite.callType,
                    inviteAdvertisesVideo: params.invite.capabilities?.video,
                    localSupportsVideo: getRealtimeVoiceCapability().supportsVideo,
                });
                setVoiceCallUiStatus((previous) => ({
                    roomId,
                    peerPubkey: targetPeerPubkey,
                    phase: "connecting",
                    role: "joiner",
                    sinceUnixMs: Date.now(),
                    ...preserveVoiceCallUiStatusMedia({ roomId, previous }),
                    // Wire invite wins — do not keep a prior voice demotion.
                    callType: joinCallType,
                }));
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
                    voiceCallHostDialStartedAtByRoomRef.current.delete(roomId);
                    voiceCallHostOfferSentAtByRoomRef.current.delete(roomId);
                    setVoiceCallUiStatus({
                        roomId,
                        peerPubkey: targetPeerPubkey,
                        phase: "interrupted",
                        role: "joiner",
                        sinceUnixMs: Date.now(),
                        reasonCode: "session_closed",
                    });
                    toast.error(t("messaging.voiceCallJoinConnectionFailed"));
                    return;
                }
                if (!joinSignalSent) {
                    toast.warning(t("messaging.voiceCallSignalDeliveryWeak"));
                }
                toast.success(t("messaging.voiceCallJoinStarting"));
            }
            finally {
                setJoiningVoiceCallInviteMessageId((current) => (current === params.messageId ? null : current));
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
            }
            catch {
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
            const hasLiveOutgoingCallContext = Boolean(liveVoiceCallUiStatus
                && liveVoiceCallUiStatus.role === "host"
                && liveVoiceCallUiStatus.roomId === signal.roomId
                && liveVoiceCallUiStatus.peerPubkey === peerPubkey
                && (liveVoiceCallUiStatus.phase === "ringing_outgoing"
                    || liveVoiceCallUiStatus.phase === "connecting"
                    || liveVoiceCallUiStatus.phase === "connected"));
            const hasInviteEvidence = hasLiveOutgoingCallContext
                || (activeVoiceCallSessionRef.current?.role === "host"
                    && activeVoiceCallSessionRef.current.roomId === signal.roomId
                    && activeVoiceCallSessionRef.current.peerPubkey === peerPubkey)
                || (outgoingVoiceInviteRoomIdsRef.current.has(signal.roomId)
                    || dmController.state.messages.some((candidate) => {
                        if (!candidate.isOutgoing) {
                            return false;
                        }
                        const invite = parseVoiceCallInvitePayload(candidate.content);
                        return invite?.roomId === signal.roomId;
                    }));
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
            const resendExistingHostOffer = async (): Promise<boolean | null> => {
                const existingSession = activeVoiceCallSessionRef.current;
                const existingConnection = voicePeerConnectionRef.current;
                if (!(existingSession
                    && existingSession.role === "host"
                    && existingSession.roomId === signal.roomId
                    && existingSession.peerPubkey === peerPubkey
                    && existingConnection
                    && existingConnection.localDescription
                    && existingConnection.localDescription.type === "offer"
                    && typeof existingConnection.localDescription.sdp === "string"
                    && existingConnection.localDescription.sdp.length > 0)) {
                    return null;
                }
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
                return resentOffer;
            };
            // Single-flight: concurrent join-request (dupes + joiner retries) must not
            // double createOffer and tear down a healthy accept path.
            let hostOfferSoftAbort = false;
            const offerSent = await runHostOfferDispatchCoalesced({
                roomId: signal.roomId,
                inFlight: voiceHostOfferInFlightRef.current,
                dispatch: async (): Promise<boolean> => {
                    const existingResend = await resendExistingHostOffer();
                    if (existingResend !== null) {
                        return existingResend;
                    }
                    const capability = getRealtimeVoiceCapability();
                    const next = realtimeVoiceSessionOwnerRef.current.start({
                        roomId: signal.roomId,
                        mode: "create",
                        capability,
                        eventUnixMs: Date.now(),
                    });
                    if (next.phase === "unsupported") {
                        toast.warning(t("messaging.voiceCallJoinUnsupported"));
                        hostOfferSoftAbort = true;
                        return false;
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
                        failVoicePeerConnectionStart({
                            roomId: signal.roomId,
                            peerPubkey,
                            role: "host",
                        });
                        hostOfferSoftAbort = true;
                        return false;
                    }
                    const dispatchHostOffer = async (targetConnection: RTCPeerConnection): Promise<boolean> => {
                        const offer = await targetConnection.createOffer({
                            offerToReceiveAudio: true,
                            offerToReceiveVideo: resolveOfferToReceiveVideo(
                                voiceCallUiStatusRef.current?.callType === "video",
                            ),
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
                    try {
                        return await dispatchHostOffer(connection);
                    }
                    catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error ?? "unknown");
                        const mLineOrderMismatch = /order of m-lines/i.test(errorMessage);
                        const haveLocalOfferRace = isHaveLocalOfferInvalidState(errorMessage);
                        logAppEvent({
                            name: "messaging.realtime_voice.join_offer_create_failed",
                            level: "warn",
                            scope: { feature: "messaging", action: "realtime_voice_signal" },
                            context: {
                                roomIdHint: toRoomIdHint(signal.roomId),
                                peerPubkeySuffix: peerPubkey.slice(-8),
                                signalingState: connection.signalingState,
                                connectionState: connection.connectionState,
                                reasonCode: mLineOrderMismatch
                                    ? "mline_order_mismatch"
                                    : (haveLocalOfferRace ? "have_local_offer_race" : "offer_create_failed"),
                                errorMessage,
                            },
                        });
                        if (haveLocalOfferRace) {
                            const resendAfterRace = await resendExistingHostOffer();
                            if (resendAfterRace === true) {
                                return true;
                            }
                            // Local offer exists but resend failed — keep PC alive; periodic offer retry may recover.
                            if (connection.localDescription?.type === "offer") {
                                logAppEvent({
                                    name: "messaging.realtime_voice.join_offer_race_kept_local",
                                    level: "warn",
                                    scope: { feature: "messaging", action: "realtime_voice_signal" },
                                    context: {
                                        roomIdHint: toRoomIdHint(signal.roomId),
                                        peerPubkeySuffix: peerPubkey.slice(-8),
                                    },
                                });
                                return true;
                            }
                            return false;
                        }
                        if (mLineOrderMismatch) {
                            tearDownVoicePeerConnection({ reasonCode: "session_closed" });
                            const resetConnection = await ensureVoicePeerConnection(session);
                            if (!resetConnection) {
                                failVoicePeerConnectionStart({
                                    roomId: signal.roomId,
                                    peerPubkey,
                                    role: "host",
                                });
                                hostOfferSoftAbort = true;
                                return false;
                            }
                            try {
                                const recovered = await dispatchHostOffer(resetConnection);
                                logAppEvent({
                                    name: "messaging.realtime_voice.join_offer_retry_after_reset",
                                    level: "info",
                                    scope: { feature: "messaging", action: "realtime_voice_signal" },
                                    context: {
                                        roomIdHint: toRoomIdHint(signal.roomId),
                                        peerPubkeySuffix: peerPubkey.slice(-8),
                                        status: recovered ? "sent" : "failed",
                                    },
                                });
                                return recovered;
                            }
                            catch (resetError) {
                                const resetErrorMessage = resetError instanceof Error
                                    ? resetError.message
                                    : String(resetError ?? "unknown");
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
                                return false;
                            }
                        }
                        return false;
                    }
                },
            });
            if (hostOfferSoftAbort) {
                return;
            }
            if (!offerSent) {
                failVoiceOfferDispatch({
                    roomId: signal.roomId,
                    peerPubkey,
                    role: "host",
                });
            }
            else if (!voiceCallHostOfferSentAtByRoomRef.current.has(signal.roomId)) {
                voiceCallHostOfferSentAtByRoomRef.current.set(signal.roomId, Date.now());
            }
            return;
        }
        const activeSession = activeVoiceCallSessionRef.current;
        const isSignalForActiveSession = Boolean(activeSession
            && activeSession.roomId === signal.roomId
            && activeSession.peerPubkey === peerPubkey);
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
            voiceCallLeaveTombstonesRef.current.set(tombstoneKey, previous === null ? leaveEventUnixMs : Math.max(previous, leaveEventUnixMs));
        }
        if (signal.signalType === "leave" && !isSignalForActiveSession) {
            const pendingInviteMatches = (incomingVoiceInvite?.peerPubkey === peerPubkey
                && incomingVoiceInvite.invite.roomId === signal.roomId);
            const pendingStatusMatches = (liveVoiceCallUiStatus?.peerPubkey === peerPubkey
                && liveVoiceCallUiStatus.roomId === signal.roomId
                && (liveVoiceCallUiStatus.phase === "ringing_incoming"
                    || liveVoiceCallUiStatus.phase === "ringing_outgoing"
                    || liveVoiceCallUiStatus.phase === "connecting"));
            if (pendingInviteMatches) {
                setIncomingVoiceInvite(null);
            }
            if (pendingInviteMatches || pendingStatusMatches) {
                voiceCallJoinAcceptedAtByRoomRef.current.delete(signal.roomId);
                voiceCallHostDialStartedAtByRoomRef.current.delete(signal.roomId);
                voiceCallHostOfferSentAtByRoomRef.current.delete(signal.roomId);
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
                toast.info(t("messaging.voiceCallRemoteLeft"));
            }
            return;
        }
        const activeSessionSnapshot = activeSession;
        if (!activeSessionSnapshot || !isSignalForActiveSession) {
            return;
        }
        const connection = voicePeerConnectionRef.current ?? await ensureVoicePeerConnection(activeSessionSnapshot);
        if (!connection) {
            failVoicePeerConnectionStart({
                roomId: activeSessionSnapshot.roomId,
                peerPubkey: activeSessionSnapshot.peerPubkey,
                role: activeSessionSnapshot.role,
            });
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
            const duplicateOfferWithLocalAnswer = Boolean(existingRemote?.type === "offer"
                && existingRemote.sdp === signal.sdp.sdp
                && existingLocal?.type === "answer"
                && typeof existingLocal.sdp === "string"
                && existingLocal.sdp.length > 0);
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
            }
            catch {
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
                failVoiceAnswerDispatch({
                    roomId: signal.roomId,
                    peerPubkey,
                    role: activeSessionSnapshot.role,
                });
                return;
            }
            await flushPendingRemoteIceCandidates(connection);
            try {
                const answer = await connection.createAnswer();
                await connection.setLocalDescription(answer);
            }
            catch (error) {
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
                failVoiceAnswerDispatch({
                    roomId: signal.roomId,
                    peerPubkey,
                    role: activeSessionSnapshot.role,
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
                    failVoiceAnswerDispatch({
                        roomId: signal.roomId,
                        peerPubkey,
                        role: activeSessionSnapshot.role,
                    });
                }
            } else {
                failVoiceAnswerDispatch({
                    roomId: signal.roomId,
                    peerPubkey,
                    role: activeSessionSnapshot.role,
                });
            }
            return;
        }
        if (signal.signalType === "answer" && signal.sdp) {
            try {
                await connection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            }
            catch {
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
            }
            catch {
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
            toast.info(t("messaging.voiceCallRemoteLeft"));
        }
    }, [
        dmController.state.messages,
        ensureVoicePeerConnection,
        failVoiceAnswerDispatch,
        failVoiceOfferDispatch,
        failVoicePeerConnectionStart,
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
        if (myPublicKeyHex
            && status
            && (status.phase === "ringing_outgoing" || status.phase === "ringing_incoming" || status.phase === "connecting")) {
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
                toast.info(t("messaging.voiceCallRemoteLeft"));
                return;
            }
        }
        const myPubkey = myPublicKeyHex ?? "";
        const conversationId = toDmConversationId({
            myPublicKeyHex: myPubkey,
            peerPublicKeyHex: pendingInvite.peerPubkey,
        });
        if (!conversationId) {
            toast.error(t("messaging.voiceCallJoinFailedMissingRoom"));
            setIncomingVoiceInvite(null);
            return;
        }
        const existingConversation = createdConnections.find((entry) => (entry.kind === "dm" && entry.id === conversationId));
        const nextConversation = existingConversation ?? createDmConversation({
            myPublicKeyHex: myPubkey,
            peerPublicKeyHex: pendingInvite.peerPubkey as PublicKeyHex,
            displayName: pendingInvite.inviterDisplayName || PRIVATE_CALLER_DISPLAY_NAME,
        });
        if (!nextConversation) {
            toast.error(t("messaging.voiceCallJoinFailedMissingRoom"));
            setIncomingVoiceInvite(null);
            return;
        }
        setIncomingVoiceInvite(null);
        if (pendingInvite.invite.roomId) {
            voiceCallJoinAcceptedAtByRoomRef.current.set(pendingInvite.invite.roomId, Date.now());
            const acceptCallType = resolveCallTypeFromInvite({
                inviteCallType: pendingInvite.invite.callType,
                inviteAdvertisesVideo: pendingInvite.invite.capabilities?.video,
                localSupportsVideo: getRealtimeVoiceCapability().supportsVideo,
            });
            setVoiceCallUiStatus({
                roomId: pendingInvite.invite.roomId,
                peerPubkey: pendingInvite.peerPubkey,
                phase: "connecting",
                role: "joiner",
                sinceUnixMs: Date.now(),
                callType: acceptCallType,
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
        // CRITICAL: Skip voice signal replay during account sync/restore.
        // Historical voice-call-signal rows restored during account sync must not
        // trigger live WebRTC signaling. Only process signals after sync is complete.
        if (accountSyncSnapshot.phase !== "ready") {
            return;
        }
        const bootstrappingNow = !voiceSignalsBootstrappedRef.current;
        const processed = processedVoiceSignalMessageIdsRef.current;
        if (bootstrappingNow) {
            voiceSignalsBootstrappedRef.current = true;
        }
        const VOICE_SIGNAL_MAX_AGE_MS = 5 * 60 * 1000;
        const nowMs = Date.now();
        dmController.state.messages.forEach((message) => {
            if (message.isOutgoing || processed.has(message.id)) {
                return;
            }
            const signal = parseVoiceCallSignalPayload(message.content);
            if (!signal) {
                return;
            }
            if (bootstrappingNow) {
                const activeSessionMatches = (activeVoiceCallSessionRef.current?.roomId === signal.roomId
                    && activeVoiceCallSessionRef.current.peerPubkey === (message.senderPubkey ?? signal.fromPubkey).trim());
                const pendingInviteMatches = (incomingVoiceInvite?.invite.roomId === signal.roomId
                    && incomingVoiceInvite.peerPubkey === (message.senderPubkey ?? signal.fromPubkey).trim());
                const statusMatches = (voiceCallUiStatusRef.current?.roomId === signal.roomId
                    && voiceCallUiStatusRef.current.peerPubkey === (message.senderPubkey ?? signal.fromPubkey).trim());
                const signalAge = typeof signal.sentAtUnixMs === "number"
                    ? nowMs - signal.sentAtUnixMs
                    : Infinity;
                const replayDecision = resolveVoiceSignalBootstrapReplayDecision({
                    isBootstrapPass: true,
                    signalAgeMs: signalAge,
                    maxSignalAgeMs: VOICE_SIGNAL_MAX_AGE_MS,
                    activeSessionMatches,
                    pendingInviteMatches,
                    statusMatches,
                });
                if (!replayDecision.shouldReplay) {
                    processed.add(message.id);
                    logAppEvent({
                        name: "messaging.realtime_voice.bootstrap_history_replay_ignored",
                        level: "info",
                        scope: { feature: "messaging", action: "realtime_voice_signal" },
                        context: {
                            payloadType: "voice-call-signal",
                            roomIdHint: toRoomIdHint(signal.roomId),
                            peerPubkeySuffix: (message.senderPubkey ?? signal.fromPubkey).trim().slice(-8),
                            reasonCode: replayDecision.reasonCode,
                            activeSessionMatches,
                            pendingInviteMatches,
                            statusMatches,
                        },
                    });
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
    }, [dmController.state.messages, dmController.state.status, handleIncomingVoiceSignal, accountSyncSnapshot.phase]);
    useEffect(() => {
        if (!REALTIME_VOICE_CALLS_ENABLED) {
            return;
        }
        if (dmController.state.status !== "ready") {
            return;
        }
        // CRITICAL: Skip voice invite replay during account sync/restore.
        // Historical voice-call-invite rows restored during account sync must not
        // trigger the ringing UI. Only process invites after sync is complete.
        if (accountSyncSnapshot.phase !== "ready") {
            return;
        }
        const bootstrappingNow = !voiceInvitesBootstrappedRef.current;
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
                const statusMatches = (voiceCallUiStatusRef.current?.roomId === invite.roomId
                    && voiceCallUiStatusRef.current.peerPubkey === peerPubkey);
                const VOICE_INVITE_MAX_AGE_MS = 5 * 60 * 1000;
                const nowMs = Date.now();
                const inviteAge = typeof invite.invitedAtUnixMs === "number"
                    ? nowMs - invite.invitedAtUnixMs
                    : Infinity;
                const replayDecision = resolveVoiceInviteBootstrapReplayDecision({
                    isBootstrapPass: true,
                    inviteAgeMs: inviteAge,
                    maxInviteAgeMs: VOICE_INVITE_MAX_AGE_MS,
                    statusMatches,
                });
                if (!replayDecision.shouldReplay) {
                    processed.add(message.id);
                    const logContext: Record<string, string | number | boolean | null> = {
                        payloadType: "voice-call-invite",
                        roomIdHint: toRoomIdHint(invite.roomId),
                        peerPubkeySuffix: peerPubkey.slice(-8),
                        reasonCode: replayDecision.reasonCode,
                        statusMatches,
                    };
                    if (typeof invite.invitedAtUnixMs === "number") {
                        logContext.invitedAtUnixMs = invite.invitedAtUnixMs;
                    }
                    logAppEvent({
                        name: "messaging.realtime_voice.bootstrap_history_replay_ignored",
                        level: "info",
                        scope: { feature: "messaging", action: "realtime_voice_invite" },
                        context: logContext,
                    });
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
            const currentVoicePhase = voiceCallUiStatus?.phase ?? null;
            const rtcConnectionState = voicePeerConnectionRef.current?.connectionState ?? "none";
            // Busy-line: defer ANY invite (same peer or third-party C) while a call is live.
            // Previously only same-peer was deferred — C could overwrite A↔B call UI mid-media.
            const shouldBlockForActiveSession = shouldDeferVoiceInviteForBusyLine({
                phase: currentVoicePhase,
                rtcConnectionState,
            });
            if (shouldBlockForActiveSession) {
                // Do not mark as processed yet; the current session may be tearing down.
                // We re-check this invite on the next pass to avoid losing immediate re-invites.
                if (!deferredVoiceInviteMessageIdsRef.current.has(message.id)) {
                    deferredVoiceInviteMessageIdsRef.current.add(message.id);
                    const activePeer = activeVoiceCallSessionRef.current?.peerPubkey ?? null;
                    const thirdParty = Boolean(activePeer && activePeer !== peerPubkey);
                    logAppEvent({
                        name: "messaging.realtime_voice.invite_processing_deferred",
                        level: "info",
                        scope: { feature: "messaging", action: "realtime_voice_invite" },
                        context: {
                            roomIdHint: toRoomIdHint(invite.roomId),
                            peerPubkeySuffix: peerPubkey.slice(-8),
                            currentVoicePhase,
                            rtcConnectionState,
                            thirdParty,
                            reasonCode: "busy_line",
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
            const negotiatedCallType = resolveCallTypeFromInvite({
                inviteCallType: invite.callType,
                inviteAdvertisesVideo: invite.capabilities?.video,
                localSupportsVideo: getRealtimeVoiceCapability().supportsVideo,
            });
            setVoiceCallUiStatus({
                roomId: invite.roomId,
                peerPubkey,
                phase: "ringing_incoming",
                role: "joiner",
                sinceUnixMs: Date.now(),
                callType: negotiatedCallType,
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
        accountSyncSnapshot.phase,
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
        if (voiceCallUiStatus.phase === "connected"
            || voiceCallUiStatus.phase === "connecting"
            || voiceCallUiStatus.phase === "ringing_outgoing"
            || voiceCallUiStatus.phase === "ringing_incoming") {
            return;
        }
        const statusSnapshot = voiceCallUiStatus;
        const timeoutId = window.setTimeout(() => {
            setVoiceCallUiStatus((current) => {
                if (!current
                    || current.roomId !== statusSnapshot.roomId
                    || current.peerPubkey !== statusSnapshot.peerPubkey
                    || current.phase !== statusSnapshot.phase) {
                    return current;
                }
                return null;
            });
        }, 10000);
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
        if (!active
            || active.role !== "joiner"
            || active.roomId !== roomId
            || active.peerPubkey !== peerPubkey) {
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
            if (!liveStatus
                || liveStatus.phase !== "connecting"
                || liveStatus.role !== "joiner"
                || liveStatus.roomId !== roomId
                || liveStatus.peerPubkey !== peerPubkey
                || !liveSession
                || liveSession.role !== "joiner"
                || liveSession.roomId !== roomId
                || liveSession.peerPubkey !== peerPubkey) {
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
        if (!active
            || active.role !== "host"
            || active.roomId !== status.roomId
            || active.peerPubkey !== status.peerPubkey
            || !connection
            || !connection.localDescription
            || connection.localDescription.type !== "offer"
            || typeof connection.localDescription.sdp !== "string"
            || connection.localDescription.sdp.length === 0) {
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
            if (!liveStatus
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
                || liveConnection.localDescription.sdp.length === 0) {
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
        if (
            voiceCallUiStatus.phase === "ringing_outgoing"
            || voiceCallUiStatus.phase === "ringing_incoming"
            || voiceCallUiStatus.phase === "connecting"
        ) {
            const statusSnapshot = voiceCallUiStatus;
            const timeoutPhase = statusSnapshot.phase === "connecting"
                ? "connecting"
                : statusSnapshot.phase === "ringing_incoming"
                    ? "ringing_incoming"
                    : "ringing_outgoing";
            const timeoutKey = `${statusSnapshot.roomId}|${statusSnapshot.peerPubkey}|${statusSnapshot.phase}`;
            if (voiceCallConnectTimeoutKeyRef.current !== timeoutKey) {
                voiceCallConnectTimeoutKeyRef.current = timeoutKey;
                voiceCallConnectTimeoutExtensionAttemptRef.current = 0;
            }
            voiceCallConnectTimeoutRef.current = setTimeout(() => {
                const active = activeVoiceCallSessionRef.current;
                const connection = voicePeerConnectionRef.current;
                const hasLocalDescription = Boolean(connection?.localDescription);
                const hasRemoteDescription = Boolean(connection?.remoteDescription);
                const maxExtensionAttempts = resolveRealtimeVoiceConnectTimeoutMaxExtensions({
                    openRelayCount: relayStatusRef.current.openCount,
                    configuredRelayCount: relayStatusRef.current.total,
                    hasLocalDescription,
                    hasRemoteDescription,
                    baselineMaxExtensionAttempts: VOICE_CALL_CONNECT_TIMEOUT_MAX_EXTENSIONS,
                });
                const timeoutDecision = resolveRealtimeVoiceConnectTimeoutDecision({
                    phase: timeoutPhase,
                    hasActiveSession: Boolean(active
                        && active.roomId === statusSnapshot.roomId
                        && active.peerPubkey === statusSnapshot.peerPubkey),
                    rtcConnectionState: connection?.connectionState ?? "none",
                    hasLocalDescription,
                    hasRemoteDescription,
                    extensionAttemptCount: voiceCallConnectTimeoutExtensionAttemptRef.current,
                    maxExtensionAttempts,
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
                        hasLocalDescription,
                        hasRemoteDescription,
                        timeoutExtensionAttemptCount: voiceCallConnectTimeoutExtensionAttemptRef.current,
                        maxExtensionAttempts,
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
                            maxExtensionAttempts,
                            reasonCode: timeoutDecision.reasonCode,
                        },
                    });
                    setVoiceCallUiStatus((current) => {
                        if (!current
                            || current.roomId !== statusSnapshot.roomId
                            || current.peerPubkey !== statusSnapshot.peerPubkey
                            || current.phase !== statusSnapshot.phase) {
                            return current;
                        }
                        return {
                            ...current,
                            sinceUnixMs: Date.now(),
                        };
                    });
                    return;
                }
                const timeoutReasonCode = mapRealtimeVoiceConnectTimeoutToUiReasonCode(
                    timeoutDecision.reasonCode,
                );
                if (myPublicKeyHex) {
                    dispatchVoiceLeaveSignalWithRetry({
                        roomId: statusSnapshot.roomId,
                        peerPubkey: statusSnapshot.peerPubkey,
                    });
                }
                setVoiceCallUiStatus({
                    roomId: statusSnapshot.roomId,
                    peerPubkey: statusSnapshot.peerPubkey,
                    phase: "interrupted",
                    role: statusSnapshot.role,
                    sinceUnixMs: Date.now(),
                    reasonCode: timeoutReasonCode,
                    callType: statusSnapshot.callType,
                    mediaMode: statusSnapshot.mediaMode,
                });
                if (active
                    && active.roomId === statusSnapshot.roomId
                    && active.peerPubkey === statusSnapshot.peerPubkey) {
                    tearDownVoicePeerConnection({ reasonCode: "session_closed" });
                }
                toast.warning(t("messaging.voiceCallWaitTimeout"));
            }, VOICE_CALL_MIN_WAIT_MS);
        }
        else {
            voiceCallConnectTimeoutKeyRef.current = null;
            voiceCallConnectTimeoutExtensionAttemptRef.current = 0;
        }
        if (voiceCallUiStatus.phase === "interrupted") {
            const statusSnapshot = voiceCallUiStatus;
            voiceCallInterruptionTimeoutRef.current = setTimeout(() => {
                const active = activeVoiceCallSessionRef.current;
                if (active
                    && active.roomId === statusSnapshot.roomId
                    && active.peerPubkey === statusSnapshot.peerPubkey) {
                    leaveCallOnUnmountRef.current();
                }
            }, VOICE_CALL_INTERRUPTION_GRACE_MS);
        }
        return () => {
            clearVoiceCallTimers();
            clearVoiceLeaveSignalRetryTimers();
        };
    }, [clearVoiceCallTimers, clearVoiceLeaveSignalRetryTimers, dispatchVoiceLeaveSignalWithRetry, myPublicKeyHex, t, tearDownVoicePeerConnection, voiceCallUiStatus]);
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
        if (!REALTIME_VOICE_CALLS_ENABLED || voiceCallUiStatus?.phase !== "connected") {
            return;
        }
        let disposed = false;
        const sampleQuality = async (): Promise<void> => {
            if (disposed) {
                return;
            }
            const connection = voicePeerConnectionRef.current;
            const status = voiceCallUiStatusRef.current;
            const nowUnixMs = Date.now();
            if (!connection || !shouldEmitRealtimeCallQualitySample({
                phase: status?.phase,
                lastEmitUnixMs: voiceCallQualitySampleAtRef.current,
                nowUnixMs,
            })) {
                return;
            }
            voiceCallQualitySampleAtRef.current = nowUnixMs;
            try {
                const report = await connection.getStats();
                if (disposed || voicePeerConnectionRef.current !== connection) {
                    return;
                }
                const snapshot = parseRealtimeCallQualitySnapshot({
                    report,
                    sampledAtUnixMs: nowUnixMs,
                    connectionState: connection.connectionState,
                    iceConnectionState: connection.iceConnectionState,
                });
                emitRealtimeCallQualitySample({
                    roomIdHint: toRoomIdHint(status?.roomId ?? ""),
                    role: status?.role ?? null,
                    snapshot,
                });
            }
            catch {
                // Quality sampling is diagnostic only.
            }
        };
        void sampleQuality();
        const intervalId = window.setInterval(() => {
            void sampleQuality();
        }, REALTIME_CALL_QUALITY_SAMPLE_MIN_INTERVAL_MS);
        return () => {
            disposed = true;
            window.clearInterval(intervalId);
        };
    }, [voiceCallUiStatus?.phase]);
    useEffect(() => {
        processedVoiceSignalMessageIdsRef.current = new Set();
        voiceSignalsBootstrappedRef.current = false;
        processedVoiceInviteMessageIdsRef.current = new Set();
        voiceInvitesBootstrappedRef.current = false;
        deferredVoiceInviteMessageIdsRef.current = new Set();
        outgoingVoiceInviteRoomIdsRef.current = new Set();
        voiceCallJoinAcceptedAtByRoomRef.current.clear();
        voiceCallHostDialStartedAtByRoomRef.current.clear();
        voiceCallHostOfferSentAtByRoomRef.current.clear();
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
        const existingConversation = createdConnections.find((entry) => (entry.kind === "dm" && entry.id === conversationId));
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
        if (selectedConversationView?.kind === "dm"
            && selectedConversationView.pubkey === voiceCallUiStatus.peerPubkey
            && selectedConversationView.displayName.trim().length > 0) {
            return selectedConversationView.displayName;
        }
        return dmDisplayNameByPubkey.get(voiceCallUiStatus.peerPubkey) ?? PRIVATE_CONTACT_DISPLAY_NAME;
    }, [dmDisplayNameByPubkey, selectedConversationView, voiceCallUiStatus]);
    const voiceCallDockPeerMetadata = useResolvedProfileMetadata(voiceCallUiStatus?.peerPubkey ?? null);
    const voiceCallDockResolvedPeerDisplayName = (voiceCallDockPeerMetadata?.displayName && voiceCallDockPeerMetadata.displayName.trim().length > 0)
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
            localVideoStream: voiceLocalStreamRef.current,
            remoteVideoStream: voiceRemoteStreamRef.current,
        });
    }, [
        voiceCallDockResolvedPeerAvatarUrl,
        voiceCallDockResolvedPeerDisplayName,
        voiceCallMediaRevision,
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
            const matchesPendingInvite = ((currentMessageId !== null && currentMessageId === pendingInvite.messageId)
                || (currentRoomId !== null && currentRoomId === pendingInvite.roomId));
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
        readAndConsumePendingOverlayAction();
        const unsubDual = subscribeVoiceCallOverlayActionDual(applyOverlayActionPayload, optionalProfileBus);
        return unsubDual;
    }, [executeVoiceCallOverlayAction, optionalProfileBus]);
    const interactionByConversationId = useMemo(() => {
        const map: Record<string, Readonly<{
            lastActiveAtMs?: number;
            lastViewedAtMs?: number;
        }>> = {};
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
    const selectedGroupHeaderMetrics = useMemo(() => {
        if (selectedConversationView?.kind !== "group") {
            return null;
        }
        const communityId = selectedConversationView.communityId?.trim() ?? "";
        const directoryRecord = communityId
            ? loadCoordinationMembershipDirectoryRecord(communityId)
            : null;
        return resolveCommunityHeaderMemberMetrics({
            directoryActivePubkeys: directoryRecord
                ? directoryRecord.materialization.activeMemberPubkeys
                : null,
            directoryFetchedAtUnixMs: directoryRecord?.updatedAtUnixMs ?? null,
            knownHerePubkeys: selectedGroupActiveMemberPubkeys,
            isPeerOnline: isPeerOnlineByEvidence,
        });
    }, [
        isPeerOnlineByEvidence,
        selectedConversationView,
        selectedGroupActiveMemberPubkeys,
    ]);
    const selectedGroupMemberCount = selectedGroupHeaderMetrics?.memberCount;
    const selectedGroupMemberCountSource = selectedGroupHeaderMetrics?.memberCountSource;
    const selectedGroupMemberCountFetchedAtMs = selectedGroupHeaderMetrics?.directoryFetchedAtUnixMs ?? null;
    const selectedGroupOnlineMemberCount = selectedGroupHeaderMetrics?.onlineAmongVisible;
    const selectedGroupLastActivityAtMs = useMemo(() => {
        if (selectedConversationView?.kind !== "group") {
            return undefined;
        }
        let latestMs: number | undefined;
        (groupState.messages ?? []).forEach((message) => {
            const messageMs = message.created_at * 1000;
            if (!latestMs || messageMs > latestMs) {
                latestMs = messageMs;
            }
        });
        const conversationLastMs = selectedConversationView.lastMessageTime?.getTime();
        if (conversationLastMs && (!latestMs || conversationLastMs > latestMs)) {
            latestMs = conversationLastMs;
        }
        return latestMs;
    }, [groupState.messages, selectedConversationView]);
    const reprobeNativeSqliteWriteReady = useCallback(async (): Promise<void> => {
        if (!hasNativeRuntime()) {
            setNativeSqliteWriteBlocked(false);
            return;
        }
        const { ensureNativeSqliteOpenForWrites } = await import(
            "@/app/features/storage/services/native-storage-at-rest-service"
        );
        const ready = await ensureNativeSqliteOpenForWrites({
            profileId: getResolvedProfileId(),
        });
        setNativeSqliteWriteBlocked(!ready);
    }, []);
    const handleUnlock = async (passphrase: string) => {
        setIsUnlocking(true);
        try {
            const { resolveSoftLockUnlockMode, activateNativeStorageAtRestUnlock } = await import(
                "@/app/features/storage/services/native-storage-at-rest-service"
            );
            const unlockMode = resolveSoftLockUnlockMode({
                identityStatus: identity.state.status,
                nativeSqliteWriteBlocked,
            });
            if (unlockMode === "storage_only") {
                const activated = await activateNativeStorageAtRestUnlock({
                    profileId: getResolvedProfileId(),
                    passphrase: passphrase as Passphrase,
                });
                if (!activated) {
                    return false;
                }
                unlock();
                await reprobeNativeSqliteWriteReady();
                return true;
            }
            await identity.unlockIdentity({ passphrase: passphrase as Passphrase });
            unlock();
            await reprobeNativeSqliteWriteReady();
            return true;
        }
        catch (error) {
            return false;
        }
        finally {
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
            await reprobeNativeSqliteWriteReady();
            return true;
        }
        catch {
            return false;
        }
        finally {
            setIsUnlocking(false);
        }
    };
    const { handleLoadEarlier, handleCopyMyPubkey, handleCopyChatLink, conversationHasHydrated, visibleMessages, inviteResponseStatusByMessageId, hasEarlierMessages, selectedConversationMediaItems, pendingEventCount } = useChatViewProps({
        selectedConversation: selectedConversationView,
        myPublicKeyHex
    });
    const mediaPreviewTrustExportContext = useMemo(() => {
        if (selectedConversationView?.kind !== "dm") {
            return null;
        }
        const peerPublicKeyHex = selectedConversationView.pubkey;
        const firstIncoming = visibleMessages.find((message) => !message.isOutgoing);
        const messageContentByMessageId: Record<string, string> = {};
        visibleMessages.forEach((message) => {
            messageContentByMessageId[message.id] = message.content;
        });
        return {
            peerPublicKeyHex,
            isPeerAccepted: peerTrust.isAccepted({ publicKeyHex: peerPublicKeyHex }),
            threadFirstPeerMessageAtUnixMs: firstIncoming?.timestamp.getTime() ?? null,
            peerFirstSeenAtUnixMs: getPeerFirstSeenAtUnixMs(getResolvedProfileId(), peerPublicKeyHex),
            messageContentByMessageId,
        };
    }, [peerTrust, selectedConversationView, visibleMessages]);
    useSyncMediaPreviewScope({
        conversationDisplayName: selectedConversationView?.displayName ?? "",
        items: selectedConversationMediaItems,
        trustExportContext: mediaPreviewTrustExportContext,
    });
    const updateSidebarTab = useCallback((tab: MessagingSidebarTab) => {
        if (tab === "chats" && selectedConversation?.kind === "dm") {
            const requestStatus = resolveEffectiveRequestStatusForPeer(selectedConversation.pubkey);
            if (isPendingContactHandshake(requestStatus)) {
                setSelectedConversation(null);
            }
        }
        startTransition(() => setSidebarTab(tab));
        localStorage.setItem(getLastPageStorageKey(), JSON.stringify({ type: 'tab', id: tab }));
    }, [resolveEffectiveRequestStatusForPeer, selectedConversation, setSelectedConversation, setSidebarTab]);
    const handleSelectConversation = useCallback((conversation: Conversation) => {
        setSelectedConversation(conversation);
        if (searchParams.get("convId")) {
            router.replace("/");
        }
    }, [router, searchParams, setSelectedConversation]);

    const promoteAcceptedContactToChats = useCallback((pk: PublicKeyHex, displayName?: string) => {
        const cid = toDmConversationId({ myPublicKeyHex: myPublicKeyHex || "", peerPublicKeyHex: pk });
        if (!cid) {
            return;
        }
        const existingDm = createdConnections.find((connection): connection is DmConversation => connection.kind === "dm" && connection.id === cid)
            ?? allConversations.find((conversation): conversation is DmConversation => conversation.kind === "dm" && conversation.id === cid);
        const acceptedConversation: DmConversation | null = existingDm ?? createDmConversation({
            myPublicKeyHex: myPublicKeyHex || "",
            peerPublicKeyHex: pk,
            displayName: displayName || PRIVATE_CONTACT_DISPLAY_NAME,
        });
        if (!acceptedConversation) {
            return;
        }
        if (!createdConnections.some((connection) => connection.id === cid)) {
            setCreatedConnections((previous) => upsertDmConversationInList(previous, acceptedConversation));
        }
        setSelectedConversation(acceptedConversation);
        updateSidebarTab("chats");
    }, [allConversations, createdConnections, myPublicKeyHex, setCreatedConnections, setSelectedConversation]);

    const handleAcceptContactRequest = useCallback(async (pk: PublicKeyHex) => {
        const requestEventId = requestsInbox.state.items.find(
            (item) => item.peerPublicKeyHex === pk && !item.isOutgoing,
        )?.eventId;
        const outcome = await requestTransport.acceptIncomingRequest({
            peerPublicKeyHex: pk,
            requestEventId,
        });
        if (outcome.relayConfirmed === false) {
            setAcceptRelayPendingPeers((previous) => new Set(previous).add(pk));
            toast.success("Contact accepted. Relay notification pending — use Retry now when relays connect.");
        } else {
            setAcceptRelayPendingPeers((previous) => {
                if (!previous.has(pk)) return previous;
                const next = new Set(previous);
                next.delete(pk);
                return next;
            });
            toast.success("Request accepted.");
        }
        promoteAcceptedContactToChats(pk, dmDisplayNameByPubkey.get(pk) ?? PRIVATE_CONTACT_DISPLAY_NAME);
    }, [dmDisplayNameByPubkey, promoteAcceptedContactToChats, requestTransport, requestsInbox.state.items]);

    const handleRetryAcceptRelayNotification = useCallback(async (pk: PublicKeyHex) => {
        const confirmed = await retryAcceptRelayNotification(
            pk,
            (params) => dmController.sendDm(params),
        );
        if (confirmed) {
            setAcceptRelayPendingPeers((previous) => {
                if (!previous.has(pk)) return previous;
                const next = new Set(previous);
                next.delete(pk);
                return next;
            });
            toast.success("Accept notification delivered to relay.");
            return;
        }
        toast.error("Relay still unavailable. Check footer relay count and retry.");
    }, [dmController]);

    const handleDeclineContactRequest = useCallback(async (pk: PublicKeyHex) => {
        const requestEventId = requestsInbox.state.items.find(
            (item) => item.peerPublicKeyHex === pk && !item.isOutgoing,
        )?.eventId;
        const outcome = await requestTransport.declineIncomingRequest({
            peerPublicKeyHex: pk,
            requestEventId,
        });
        if (outcome.status === "failed") {
            toast.error(outcome.message || "Failed to decline request.");
            return;
        }
        toast.success("Request declined.");
        setSelectedConversation(null);
        updateSidebarTab("requests");
    }, [requestTransport, requestsInbox.state.items, setSelectedConversation]);

    const handleCancelOutgoingRequest = useCallback(async (pk: PublicKeyHex) => {
        const requestEventId = requestsInbox.state.items.find(
            (item) => item.peerPublicKeyHex === pk && item.isOutgoing,
        )?.eventId;
        const outcome = await requestTransport.cancelOutgoingRequest({
            peerPublicKeyHex: pk,
            requestEventId,
        });
        if (outcome.status === "failed") {
            toast.error(outcome.message || "Failed to cancel request.");
            return;
        }
        toast.success("Request canceled.");
        setSelectedConversation(null);
    }, [requestTransport, requestsInbox.state.items, setSelectedConversation]);

    const handleResendConnectionRequest = useCallback(async (pk: PublicKeyHex) => {
        if (blocklist.isBlocked({ publicKeyHex: pk })) {
            toast.error("You blocked this contact. Unblock them before sending a new request.");
            return;
        }
        const outcome = await requestTransport.sendRequest({
            peerPublicKeyHex: pk,
            introMessage: DEFAULT_INVITATION_INTRO,
        });
        if (outcome.status === "ok") {
            toast.success(getDirectInvitationToastCopy("ok").message);
            return;
        }
        if (outcome.status === "partial") {
            toast.warning(getDirectInvitationToastCopy("partial", {
                relaySuccessCount: outcome.relaySuccessCount,
                relayTotal: outcome.relayTotal,
            }).message);
            return;
        }
        if (outcome.status === "queued") {
            toast.warning(getDirectInvitationToastCopy("queued", {
                message: outcome.message,
            }).message);
            return;
        }
        toast.error(getDirectInvitationToastCopy("failed", {
            message: outcome.message || "Could not send a new request.",
        }).message);
    }, [blocklist, requestTransport]);
    // Clear unread marks when switching to invitations tab
    useEffect(() => {
        if ((sidebarTab === "requests" || sidebarTab === "junk") && requestsInbox.state.items.some(i => i.unreadCount > 0)) {
            requestsInbox.markAllRead();
        }
    }, [sidebarTab, requestsInbox.markAllRead, requestsInbox.state.items]);
    const canonicalRequestsInboxItems = requestsInbox.state.items;
    const sidebarRequestsInboxItems = useMemo(() => (
        buildSidebarRequestsInboxItems({
            inboxItems: canonicalRequestsInboxItems,
            createdConnections,
            isPeerAcceptedByTrust: (peerPublicKeyHex) => peerTrust.isAccepted({ publicKeyHex: peerPublicKeyHex }),
            getRequestStatus: (peerPublicKeyHex) => requestsInbox.getRequestStatus({ peerPublicKeyHex }),
        })
    ), [canonicalRequestsInboxItems, createdConnections, peerTrust, requestsInbox]);
    const partitionedIncomingRequests = useMemo(() => (
        partitionOpenRequestsByLane(sidebarRequestsInboxItems, { nowUnixMs: nowMs ?? Date.now() })
    ), [sidebarRequestsInboxItems, nowMs]);
    const handleDismissPendingRequestsBadge = useCallback(() => {
        writeRequestsPendingBadgeDismissed(true);
        setPendingRequestsBadgeDismissed(true);
    }, []);
    const isIdentityUnlocked = identity.state.status === "unlocked";
    const activeProfileId = getResolvedProfileId();
    const startupState = identity.getIdentityDiagnostics?.()?.startupState ?? createPendingStartupAuthState({
        storedPublicKeyHex: identity.state.stored?.publicKeyHex,
    });
    useEffect(() => {
        if (!isIdentityUnlocked || !hasNativeRuntime()) {
            setNativeSqliteWriteBlocked(false);
            return;
        }
        let cancelled = false;
        void (async () => {
            const { ensureNativeSqliteOpenForWrites } = await import(
                "@/app/features/storage/services/native-storage-at-rest-service"
            );
            const ready = await ensureNativeSqliteOpenForWrites({
                profileId: activeProfileId,
            });
            if (!cancelled) {
                setNativeSqliteWriteBlocked(!ready);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isIdentityUnlocked, identity.state.publicKeyHex, activeProfileId]);
    const shouldShowLockScreen = shouldShowStoredIdentityLockScreen({
        startupState,
        isAutoLockLocked: isLocked,
        identityStatus: identity.state.status,
        nativeSqliteWriteBlocked,
    });
    const projectionReadAuthority = useMemo(() => (resolveProjectionReadAuthority({
        projectionSnapshot: accountProjectionSnapshot,
        expectedProfileId: activeProfileId,
        expectedAccountPublicKeyHex: myPublicKeyHex,
    })), [accountProjectionSnapshot, activeProfileId, myPublicKeyHex]);
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
    const visibleChatsList = useMemo(() => (filteredConversations.filter((conversation) => (conversation.kind === "group" || !hiddenChatIdSet.has(conversation.id)))), [filteredConversations, hiddenChatIdSet]);
    const accurateChatsUnreadCount = useMemo(() => (visibleChatsList.reduce((acc, conversation) => (
        acc + resolveConversationUnreadCount({
            conversation,
            unreadByConversationId,
            lastSeenByConversationId: lastViewedByConversationId,
            selectedConversationId: selectedConversation?.id ?? null,
        })
    ), 0)), [lastViewedByConversationId, selectedConversation?.id, unreadByConversationId, visibleChatsList]);
    const chatNavBadgeCounts = useMemo((): Readonly<Record<string, number>> => ({ "/": accurateChatsUnreadCount }), [accurateChatsUnreadCount]);
    useRegisterAppChrome(isMobileDmShell
        ? {
            hideSidebar: true,
            // Thread has MobileDmThreadHeader — hide the redundant Obscur app header.
            hideHeader: Boolean(selectedConversationView),
            mobileDmMode: Boolean(selectedConversationView),
            navBadgeCounts: chatNavBadgeCounts,
        }
        : {
            hideSidebar: !isIdentityUnlocked,
            mobileDmMode: false,
            navBadgeCounts: chatNavBadgeCounts,
        });
    const hasVisibleConversations = visibleChatsList.length > 0;
    const accountSyncUiPolicy = resolveAccountSyncUiPolicy({
        isIdentityUnlocked,
        snapshot: accountSyncSnapshot,
        projectionSnapshot: accountProjectionSnapshot,
        hasVisibleConversations,
        hasLocalReturningUserEvidence: profileWindowHasLocalAccountEvidence(activeProfileId),
    });
    const firstLoginHistorySyncNoticeStorageKey = useMemo(() => {
        if (!myPublicKeyHex) {
            return null;
        }
        return getScopedStorageKey(`${HISTORY_SYNC_NOTICE_FIRST_LOGIN_SEEN_KEY}:${myPublicKeyHex}`, activeProfileId);
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
        }
        catch {
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
        }
        catch {
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
    const suppressAccountLoadingNotices = isAccountDataLoading({
        isIdentityUnlocked,
        snapshot: accountSyncSnapshot,
        projectionSnapshot: accountProjectionSnapshot,
        accountSyncUiPolicy,
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
    const mobileShellStatusItems = useMemo(() => {
        if (!isMobileDmShell) {
            return [];
        }
        return buildMobileShellStatusItems({
            showRestoreProgress: accountSyncUiPolicy.showRestoreProgress,
            restoreMessage: accountSyncSnapshot.message,
            showMissingSharedDataWarning: accountSyncUiPolicy.showMissingSharedDataWarning,
            showHistorySyncNotice,
            showProjectionScopeMismatchNotice,
            suppressAccountLoadingNotices,
            scopeMismatchTitle: t("messaging.profileScopeMismatchNoticeTitle"),
            scopeMismatchBody: t("messaging.profileScopeMismatchNoticeBody"),
            // Mobile shell / phone-preview: no relay disconnect banners (status strip or toasts).
            relayBannerCopy: null,
        });
    }, [
        accountSyncSnapshot.message,
        accountSyncSnapshot.phase,
        accountProjectionSnapshot.phase,
        accountProjectionSnapshot.accountProjectionReady,
        accountSyncUiPolicy.showMissingSharedDataWarning,
        accountSyncUiPolicy.showRestoreProgress,
        accountSyncUiPolicy.showInitialHistorySyncNotice,
        suppressAccountLoadingNotices,
        isIdentityUnlocked,
        isMobileDmShell,
        showHistorySyncNotice,
        showProjectionScopeMismatchNotice,
        t,
    ]);
    if (!isChatRoute) {
        return null;
    }
    if (startupState.kind === "pending") {
        return <AppLoadingScreen title="Restoring identity" detail="Unlocking profile context..."/>;
    }
    if (shouldShowLockScreen) {
        return (<LockScreen publicKeyHex={identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? ""} username={identity.state.stored?.username} isUnlocking={isUnlocking} onUnlock={handleUnlock} hasPin={hasPin} onUnlockPin={handleUnlockPin} onForget={identity.forgetIdentity} errorMessage={nativeSqliteWriteBlocked
                ? "Local database is locked. Unlock this profile (device password or Import Key), then retry."
                : undefined}/>);
    }
    const syncStatusBanners = (<>
      {accountSyncUiPolicy.showRestoreProgress ? (<div className="border-b border-sky-500/20 bg-sky-500/10 px-4 py-2 text-sm text-sky-800 dark:text-sky-200">
          <span className="font-semibold">Account Restore:</span> {accountSyncSnapshot.message}. You can keep using the app while relay recovery runs.
        </div>) : null}
      {accountSyncUiPolicy.showMissingSharedDataWarning ? (<div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
          <span className="font-semibold">Account Restore Warning:</span> Shared account data was not found on relays yet. Local identity access remains active.
        </div>) : null}
      {showHistorySyncNotice ? (<div className="border-b border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-900 dark:text-indigo-100">
          <span className="font-semibold">Syncing account history:</span> This device is still restoring contacts and messages. First-time recovery on a new device can take a few minutes.
        </div>) : null}
      {showProjectionScopeMismatchNotice ? (<div className="flex flex-wrap items-center gap-2 border-b border-orange-500/25 bg-orange-500/10 px-4 py-2 text-sm text-orange-900 dark:text-orange-100">
          <span className="font-semibold">{t("messaging.profileScopeMismatchNoticeTitle")}:</span>
          <span>
            {t("messaging.profileScopeMismatchNoticeBody")}
          </span>
          <button type="button" className="ml-auto rounded-md border border-orange-500/40 bg-orange-500/10 px-2 py-1 text-xs font-semibold text-orange-900 transition-colors hover:bg-orange-500/20 dark:text-orange-50" onClick={() => {
                void router.push("/profiles");
            }}>
            {t("messaging.openProfiles")}
          </button>
        </div>) : null}
    </>);
    const sidebarNode = isIdentityUnlocked ? (<Sidebar isNewChatOpen={isNewChatOpen} setIsNewChatOpen={setIsNewChatOpen} isNewGroupOpen={isNewGroupOpen} setIsNewGroupOpen={setIsNewGroupOpen} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchInputRef={searchInputRef} hasHydrated={hasHydrated} filteredConversations={filteredConversations} selectedConversation={selectedConversation} unreadByConversationId={unreadByConversationId} lastViewedByConversationId={lastViewedByConversationId} nowMs={nowMs} activeTab={sidebarTab} setActiveTab={updateSidebarTab} selectConversation={handleSelectConversation} interactionByConversationId={interactionByConversationId} requests={partitionedIncomingRequests.inbox} junkRequests={partitionedIncomingRequests.junk} pinnedChatIds={pinnedChatIds} togglePin={togglePin} hiddenChatIds={hiddenChatIds} hideConversation={hideConversation} clearHistory={clearHistory} onClearHistory={requestsInbox.clearHistory} isPeerOnline={isPeerOnlineByEvidence} showHistorySyncNotice={showHistorySyncNotice} onAcceptRequest={(pk) => {
            void handleAcceptContactRequest(pk as PublicKeyHex);
        }} onIgnoreRequest={(pk) => requestsInbox.remove({ peerPublicKeyHex: pk as PublicKeyHex })} onBlockRequest={(pk) => blocklist.addBlocked({ publicKeyInput: pk })} pendingRequestsBadgeDismissed={pendingRequestsBadgeDismissed} onDismissPendingRequestsBadge={handleDismissPendingRequestsBadge} pendingRequestsCount={sidebarRequestsInboxItems.length} onSelectRequest={(pk) => {
            requestsInbox.markRead({ peerPublicKeyHex: pk as PublicKeyHex });
            updateSidebarTab("requests");
            const cid = toDmConversationId({ myPublicKeyHex: myPublicKeyHex || "", peerPublicKeyHex: pk });
            if (!cid)
                return;
            setSelectedConversation({
                kind: 'dm',
                id: cid,
                pubkey: pk as PublicKeyHex,
                displayName: dmDisplayNameByPubkey.get(pk as PublicKeyHex) || PRIVATE_CONTACT_DISPLAY_NAME,
                lastMessage: '',
                unreadCount: 0,
                lastMessageTime: new Date()
            });
        }}/>) : null;
    const activeChatView = selectedConversationView ? (<ChatView conversation={selectedConversationView} groupMemberCount={selectedGroupMemberCount} groupMemberCountSource={selectedGroupMemberCountSource} groupMemberCountFetchedAtMs={selectedGroupMemberCountFetchedAtMs} groupOnlineMemberCount={selectedGroupOnlineMemberCount} groupLastActivityAtMs={selectedGroupLastActivityAtMs} isPeerOnline={selectedConversationView.kind === "dm"
            ? isPeerOnlineByEvidence(selectedConversationView.pubkey)
            : undefined} interactionStatus={interactionByConversationId[selectedConversationView.id]} messages={visibleMessages} renderMetaMessages={visibleMessages} inviteResponseStatusByMessageId={inviteResponseStatusByMessageId} rawMessagesCount={visibleMessages.length} hasHydrated={hasHydrated || conversationHasHydrated} hasEarlierMessages={hasEarlierMessages} onLoadEarlier={handleLoadEarlier} nowMs={nowMs} flashMessageId={flashMessageId} onCopyPubkey={(pk) => {
            navigator.clipboard.writeText(pk);
            toast.success(t("messaging.pubkeyCopied"));
        }} onOpenMedia={() => setIsMediaGalleryOpen(true)} onToggleConversationNotifications={({ conversation, enabled }) => {
            const entityLabel = conversation.kind === "group" ? "group" : "chat";
            toast.success(enabled
                ? `Notifications enabled for this ${entityLabel}.`
                : `Notifications muted for this ${entityLabel}.`);
        }} onOpenInfo={selectedConversationView.kind === "group"
            ? () => {
                router.push(getPublicGroupHref(selectedConversationView.groupId, selectedConversationView.relayUrl));
            }
            : undefined} onOpenProfile={selectedConversationView.kind === "dm"
            ? (pubkey) => {
                router.push(getPublicProfileHref(pubkey));
            }
            : undefined} onSendVoiceCallInvite={REALTIME_VOICE_CALLS_ENABLED && selectedConversationView.kind === "dm"
            ? () => {
                void handleSendVoiceCallInvite("voice");
            }
            : undefined} canSendVoiceCallInvite={REALTIME_VOICE_CALLS_ENABLED && selectedConversationView.kind === "dm" && !!dmController} isSendingVoiceCallInvite={REALTIME_VOICE_CALLS_ENABLED ? isSendingVoiceCallInvite : false} onSendVideoCallInvite={REALTIME_VOICE_CALLS_ENABLED && selectedConversationView.kind === "dm"
            ? () => {
                void handleSendVoiceCallInvite("video");
            }
            : undefined} canSendVideoCallInvite={REALTIME_VOICE_CALLS_ENABLED && selectedConversationView.kind === "dm" && !!dmController} onJoinVoiceCallInvite={REALTIME_VOICE_CALLS_ENABLED ? (params) => {
            handleJoinVoiceCallInvite(params);
        } : undefined} onRequestVoiceCallCallback={REALTIME_VOICE_CALLS_ENABLED ? () => {
            void handleSendVoiceCallInvite("voice");
        } : undefined} joiningVoiceCallInviteMessageId={REALTIME_VOICE_CALLS_ENABLED ? joiningVoiceCallInviteMessageId : null} activeVoiceCallState={REALTIME_VOICE_CALLS_ENABLED ? activeVoiceCallForSelectedConversation : null} voiceCallStatus={REALTIME_VOICE_CALLS_ENABLED ? voiceCallStatusForSelectedConversation : null} onLeaveVoiceCall={REALTIME_VOICE_CALLS_ENABLED ? handleLeaveVoiceCall : undefined} onAcceptIncomingVoiceCall={REALTIME_VOICE_CALLS_ENABLED ? handleAcceptIncomingVoiceInvite : undefined} onDeclineIncomingVoiceCall={REALTIME_VOICE_CALLS_ENABLED ? handleDeclineIncomingVoiceInvite : undefined} groupAdmins={groupState.admins} communityBotTriggerSummary={selectedCommunityBotTriggerSummary} groupRelayUrl={selectedConversationView.kind === "group" ? selectedConversationView.relayUrl : null} messageMenu={messageMenu} setMessageMenu={setMessageMenu} messageMenuRef={messageMenuRef} onCopyText={(text) => {
            navigator.clipboard.writeText(text);
            toast.success(t("messaging.textCopied"));
        }} onCopyAttachmentUrl={(url) => {
            navigator.clipboard.writeText(url);
            toast.success(t("messaging.urlCopied"));
        }} onReferenceMessage={(m) => setReplyTo({ messageId: m.id, previewText: m.content })} onDeleteMessageForMe={(message) => deleteMessageForMe({ conversationId: selectedConversationView.id, message })} onDeleteMessageForEveryone={(message, options) => deleteMessageForEveryone({
            conversationId: selectedConversationView.id,
            message,
            suppressManagedWorkspaceToast: options?.suppressManagedWorkspaceToast,
        })} accountPublicKeyHex={identity.state.publicKeyHex ?? null} onShowMessageOnDeviceAgain={(message) => showMessageOnDeviceAgain({
            conversationId: selectedConversationView.id,
            message,
        })} onShowAllHiddenMessagesOnDevice={(messages) => showAllHiddenMessagesOnDevice({
            conversationId: selectedConversationView.id,
            messages,
        })} reactionPicker={reactionPicker} setReactionPicker={setReactionPicker} reactionPickerRef={reactionPickerRef} onToggleReaction={(message, emoji) => toggleReaction({ conversationId: selectedConversationView.id, message, emoji })} onRetryMessage={(m) => dmController.retryFailedMessage(m.id)} messageInput={messageInput} setMessageInput={setMessageInput} handleSendMessage={handleSendMessage} onSendDirectMessage={async (params: SendDirectMessageParams): Promise<SendDirectMessageResult> => {
            if (dmController) {
                return await dmController.sendDm({
                    peerPublicKeyInput: params.recipientPubkey,
                    plaintext: params.content,
                    replyTo: params.replyTo
                });
            }
            return { success: false, messageId: '', relayResults: [], error: 'DM Controller not ready' };
        }} isUploadingAttachment={isUploadingAttachment} uploadStage={uploadStage} pendingAttachments={pendingAttachments} pendingAttachmentPreviewUrls={pendingAttachmentPreviewUrls} attachmentError={attachmentError} replyTo={replyTo} setReplyTo={setReplyTo} onPickAttachments={(files) => files && handleFilesSelected(files)} onSelectFiles={pickAttachments} onSendVoiceNote={(file) => {
            void handleFilesSelected([file]);
        }} removePendingAttachment={removePendingAttachment} clearPendingAttachment={clearPendingAttachments} relayStatus={relayStatus} composerTextareaRef={composerTextareaRef} isProcessingMedia={isProcessingMedia} mediaProcessingProgress={mediaProcessingProgress} pendingEventCount={pendingEventCount} isPeerAccepted={(() => {
            if (selectedConversationView.kind !== 'dm')
                return true;
            return resolvePeerEstablishedForUi(selectedConversationView.pubkey);
        })()} isPublicKeyAccepted={(publicKeyHex) => peerTrust.isAccepted({ publicKeyHex: publicKeyHex as PublicKeyHex })} contactRequestComposeMode={(() => {
            if (selectedConversationView.kind !== "dm")
                return "full" as const;
            const pk = selectedConversationView.pubkey;
            return resolveContactRequestComposeMode({
                isPeerAcceptedByTrust: peerTrust.isAccepted({ publicKeyHex: pk }),
                requestStatus: resolveEffectiveRequestStatusForPeer(pk),
            });
        })()} isInitiator={(() => {
            if (selectedConversationView.kind !== 'dm')
                return false;
            const pk = selectedConversationView.pubkey;
            return resolveDmPeerOutgoingWaitInitiatorForUi({
                requestStatus: resolveEffectiveRequestStatusForPeer(pk),
            });
        })()} outgoingResendEligible={(() => {
            if (selectedConversationView.kind !== "dm")
                return false;
            const pk = selectedConversationView.pubkey;
            if (blocklist.isBlocked({ publicKeyHex: pk }))
                return false;
            return resolveDmPeerOutgoingResendEligibleForUi({
                requestStatus: resolveEffectiveRequestStatusForPeer(pk),
            });
        })()} requestEventId={selectedConversationView.kind === "dm"
            ? requestsInbox.state.items.find((item) => item.peerPublicKeyHex === selectedConversationView.pubkey)?.eventId
            : undefined} onAcceptPeer={selectedConversationView.kind === "dm"
            ? () => handleAcceptContactRequest(selectedConversationView.pubkey)
            : undefined} onDeclinePeer={selectedConversationView.kind === "dm"
            ? () => handleDeclineContactRequest(selectedConversationView.pubkey)
            : undefined} onCancelOutgoingRequest={selectedConversationView.kind === "dm"
            ? () => handleCancelOutgoingRequest(selectedConversationView.pubkey)
            : undefined} onResendConnectionRequest={selectedConversationView.kind === "dm"
            ? () => handleResendConnectionRequest(selectedConversationView.pubkey)
            : undefined} acceptRelayReady={relayStatus.openCount > 0} relayPending={selectedConversationView.kind === "dm"
            ? acceptRelayPendingPeers.has(selectedConversationView.pubkey)
            || pendingAcceptRelayQueue.hasPending(selectedConversationView.pubkey)
            : false} onRetryRelayNotification={selectedConversationView.kind === "dm"
            ? () => handleRetryAcceptRelayNotification(selectedConversationView.pubkey)
            : undefined} onBlockPeer={() => selectedConversationView.kind === 'dm' && blocklist.addBlocked({ publicKeyInput: selectedConversationView.pubkey })} relayOverlap={selectedConversationView.kind === 'dm' ? contactRelayOverlap : undefined} deliveryRisk={selectedConversationView.kind === 'dm' ? contactRelayOverlap.status : null} onAddRelay={(url) => { relayList.addRelay({ url }); }} onNavigateToRelaySettings={() => { void router.push("/settings?tab=relays"); }} hideDesktopChatHeader={isMobileDmShell}/>) : null;
    const syncStatusBannerNode = isMobileDmShell ? (<MobileShellStatusStrip items={mobileShellStatusItems} onOpenProfiles={() => {
            void router.push("/profiles");
        }}/>) : (syncStatusBanners);
    if (isMobileDmShell) {
        // Chat list renders inline in MobileDmShellLayout — do not portal (drawer stays empty / steals the node).
        return (<>
        {syncStatusBannerNode}
        <SendCeremonyDialog
          isOpen={Boolean(sendCeremonyViewModel)}
          ceremony={sendCeremonyViewModel}
          onClose={cancelSendCeremony}
          onConfirm={confirmSendCeremony}
        />
        <MobileDmShellLayout>
          {!selectedConversationView ? (<div className="flex min-h-0 flex-1 flex-col">
              {sidebarNode ?? (<EmptyConversationView onNewChat={() => setIsNewChatOpen(true)} showWelcome={showWelcome} myPublicKeyHex={myPublicKeyHex ?? ""} relayStatus={relayStatus} onCopyMyPubkey={handleCopyMyPubkey} onCopyChatLink={handleCopyChatLink} showHistorySyncNotice={showHistorySyncNotice}/>)}
            </div>) : (<>
              <MobileDmThreadHeader conversation={selectedConversationView} onBack={handleLeaveMobileThread} displayNameHint={selectedConversationView.kind === "dm"
                    ? dmDisplayNameByPubkey.get(selectedConversationView.pubkey) ?? null
                    : null} isPeerOnline={selectedConversationView.kind === "dm"
                    ? isPeerOnlineByEvidence(selectedConversationView.pubkey)
                    : undefined} groupMemberCount={selectedGroupMemberCount} onOpenMedia={() => setIsMediaGalleryOpen(true)} onOpenProfile={selectedConversationView.kind === "dm"
                    ? (pubkey) => {
                        void router.push(getPublicProfileHref(pubkey));
                    }
                    : undefined} onOpenInfo={selectedConversationView.kind === "group"
                    ? () => {
                        void router.push(getPublicGroupHref(selectedConversationView.groupId, selectedConversationView.relayUrl));
                    }
                    : undefined} onSendVoiceCallInvite={REALTIME_VOICE_CALLS_ENABLED && selectedConversationView.kind === "dm"
                    ? () => {
                        void handleSendVoiceCallInvite("voice");
                    }
                    : undefined} canSendVoiceCallInvite={REALTIME_VOICE_CALLS_ENABLED
                    && selectedConversationView.kind === "dm"
                    && Boolean(dmController)} onSendVideoCallInvite={REALTIME_VOICE_CALLS_ENABLED && selectedConversationView.kind === "dm"
                    ? () => {
                        void handleSendVoiceCallInvite("video");
                    }
                    : undefined} canSendVideoCallInvite={REALTIME_VOICE_CALLS_ENABLED
                    && selectedConversationView.kind === "dm"
                    && Boolean(dmController)}/>
              <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
                {activeChatView}
              </main>
            </>)}
        </MobileDmShellLayout>
        <audio ref={voiceRemoteAudioElementRef} autoPlay playsInline className="hidden"/>
        <MediaDeviceConsentDialog
          isOpen={voiceMicConsentOpen}
          kind="microphone"
          purpose={voiceMediaConsentPurpose}
          onClose={() => closeVoiceMicConsent(null)}
          onGranted={(stream) => closeVoiceMicConsent(stream)}
        />
        <DevPanel dmController={dmController}/>
      </>);
    }
    return (<>
      {isIdentityUnlocked ? <ChatSidebarPortal>{sidebarNode}</ChatSidebarPortal> : null}
      {syncStatusBannerNode}
      <SendCeremonyDialog
        isOpen={Boolean(sendCeremonyViewModel)}
        ceremony={sendCeremonyViewModel}
        onClose={cancelSendCeremony}
        onConfirm={confirmSendCeremony}
      />
      <MediaDeviceConsentDialog
        isOpen={voiceMicConsentOpen}
        kind="microphone"
        purpose={voiceMediaConsentPurpose}
        onClose={() => closeVoiceMicConsent(null)}
        onGranted={(stream) => closeVoiceMicConsent(stream)}
      />
      <main className="flex flex-1 flex-col min-h-0 overflow-hidden bg-transparent">
        {!selectedConversationView ? (<EmptyConversationView onNewChat={() => setIsNewChatOpen(true)} showWelcome={showWelcome} myPublicKeyHex={myPublicKeyHex ?? ""} relayStatus={relayStatus} onCopyMyPubkey={handleCopyMyPubkey} onCopyChatLink={handleCopyChatLink} showHistorySyncNotice={showHistorySyncNotice}/>) : (activeChatView)}
      </main>
      <audio ref={voiceRemoteAudioElementRef} autoPlay playsInline className="hidden"/>
      <DevPanel dmController={dmController}/>
    </>);
}
export default function NostrMessenger() {
    return (<Suspense fallback={<AppLoadingScreen title="Loading messages" detail="Rebuilding chat workspace..."/>}>
      <NostrMessengerContent />
    </Suspense>);
}
