import React, { useState } from "react";
import { useResolvedProfileMetadata } from "../../profile/hooks/use-resolved-profile-metadata";
import { DmKernelTrustBanner, DmKernelTrustInfoStrip } from "@/app/features/dm-kernel/components/dm-kernel-trust-banner";
import { useDmKernelTrustBanner } from "@/app/features/dm-kernel/use-dm-kernel-trust-banner";
import { isDmKernelAuthority } from "@/app/features/dm-kernel/dm-kernel-policy";
import { useContactTrustSensitivity } from "@/app/features/network/hooks/use-contact-trust-sensitivity";
import { CommunityBotPausedBanner } from "@/app/features/groups/components/community-bot-paused-banner";
import type { CommunityBotTriggerSummary } from "@/app/features/groups/services/community-bot-triggers-policy";
import { ChatHeader } from "./chat-header";
import { StrangerWarningBanner } from "./stranger-warning-banner";
import { ContactRequestThreadBanner } from "./contact-request-thread-banner";
import { shouldShowPathBThreadWarningBanner } from "../services/path-b-b5-extension-hooks";
import { RelayOverlapBanner } from "./relay-overlap-banner";
import type { ContactRelayOverlapResult } from "../hooks/use-contact-relay-overlap";
import { MessageList } from "./message-list";
import { Composer } from "./composer";
import { MessageMenu } from "./message-menu";
import { ReactionPicker } from "./reaction-picker";
import { Loader2, Lock, Mic, Search, Trash2, UploadCloud, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Conversation, Message, ReactionEmoji, ReplyTo, RelayStatusSummary, SendDirectMessageParams, SendDirectMessageResult, VoiceCallInvitePayload } from "../types";
import { resolveConversationMessageJumpTarget } from "./message-search-jump";
import { mergeConversationHistorySearchResults, resolveHistorySearchResultsForLiveMessages, searchLiveConversationMessages, } from "../services/conversation-history-search";
import { searchConversationPersistedHistory } from "../services/conversation-history-persisted-search-port";
import { formatTime, highlightText } from "../utils/formatting";
import Image from "next/image";
import { cn } from "@/app/lib/utils";
import { logAppEvent } from "@/app/shared/log-app-event";
import { toast } from "@dweb/ui-kit";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import {
    canSaveChatAttachmentsToLocalVault,
    saveChatAttachmentsToLocalVault,
} from "@/app/features/vault/services/save-chat-attachment-to-vault";
import { useMessaging } from "../providers/messaging-provider";
import { useMediaPreviewScope } from "../services/media-preview-scope";
import { SEARCH_TARGET_FLASH_CLASS, SEARCH_TARGET_FLASH_MS } from "@/app/shared/search-target-highlight";
import { applyBatchMessageSelectionToggle } from "../utils/batch-message-selection";
import { isStrictManagedWorkspaceRelay } from "@/app/features/groups/services/strict-managed-workspace";
import { MANAGED_WORKSPACE_DELETE_COPY } from "@/app/features/groups/services/managed-workspace-delete-copy";
import { DM_LOCAL_VISIBILITY_COPY, DM_RECALL_FOR_EVERYONE_UI_ENABLED, } from "../config/dm-local-visibility-product";
import { DmHiddenMessagesPanel } from "./dm-hidden-messages-panel";
import { useDmThreadHiddenMessages } from "../hooks/use-dm-thread-hidden-messages";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { usePreferNativeTouchScroll } from "@/app/features/runtime/use-prefer-native-touch-scroll";
type ChatHistorySearchResult = Readonly<{
    messageId: string;
    timestamp: Date;
    timestampMs: number;
    preview: string;
    resultKind: "text" | "voice_note";
    voiceDurationLabel: string | null;
}>;
const toIdHint = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
        return "unknown";
    }
    if (trimmed.length <= 20) {
        return trimmed;
    }
    return `${trimmed.slice(0, 8)}...${trimmed.slice(-8)}`;
};
const MESSAGE_MENU_HOVER_DISMISS_DELAY_MS = 320;
export interface ChatViewProps {
    conversation: Conversation;
    groupMemberCount?: number;
    groupOnlineMemberCount?: number;
    groupLastActivityAtMs?: number;
    isPeerOnline?: boolean;
    interactionStatus?: Readonly<{
        lastActiveAtMs?: number;
        lastViewedAtMs?: number;
    }>;
    messages: ReadonlyArray<Message>;
    renderMetaMessages?: ReadonlyArray<Message>;
    inviteResponseStatusByMessageId?: ReadonlyMap<string, import("./message-list-render-meta").InviteResponseStatus>;
    rawMessagesCount: number;
    hasHydrated: boolean;
    hasEarlierMessages: boolean;
    onLoadEarlier: () => void;
    nowMs: number | null;
    flashMessageId: string | null;
    // Header Props
    onCopyPubkey: (pubkey: string) => void;
    onOpenMedia: () => void;
    onToggleConversationNotifications?: (params: Readonly<{
        conversation: Conversation;
        enabled: boolean;
    }>) => void;
    onOpenInfo?: () => void;
    onOpenProfile?: (pubkey: string) => void;
    onSendVoiceCallInvite?: () => void;
    canSendVoiceCallInvite?: boolean;
    isSendingVoiceCallInvite?: boolean;
    onJoinVoiceCallInvite?: (params: Readonly<{
        invite: VoiceCallInvitePayload;
        messageId: string;
    }>) => void;
    onRequestVoiceCallCallback?: () => void;
    joiningVoiceCallInviteMessageId?: string | null;
    activeVoiceCallState?: Readonly<{
        roomId: string;
        peerPubkey: string;
        role: "host" | "joiner";
        connectionState: "new" | "connecting" | "connected" | "disconnected" | "failed" | "closed";
    }> | null;
    voiceCallStatus?: Readonly<{
        roomId: string;
        peerPubkey: string;
        phase: "ringing_outgoing" | "ringing_incoming" | "connecting" | "connected" | "interrupted" | "ended";
        role: "host" | "joiner";
        sinceUnixMs: number;
        reasonCode?: "left_by_user" | "remote_left" | "network_interrupted" | "session_closed";
    }> | null;
    onLeaveVoiceCall?: () => void;
    onAcceptIncomingVoiceCall?: () => void;
    onDeclineIncomingVoiceCall?: () => void;
    // Message Menu & Interactions
    messageMenu: {
        messageId: string;
        x: number;
        y: number;
    } | null;
    setMessageMenu: (val: {
        messageId: string;
        x: number;
        y: number;
    } | null) => void;
    messageMenuRef: React.RefObject<HTMLDivElement | null>;
    onCopyText: (text: string) => void;
    onCopyAttachmentUrl: (url: string) => void;
    onReferenceMessage: (message: Message) => void;
    onDeleteMessageForMe: (message: Message) => void | Promise<void>;
    onDeleteMessageForEveryone: (message: Message, options?: Readonly<{
        suppressManagedWorkspaceToast?: boolean;
    }>) => void | Promise<void>;
    accountPublicKeyHex?: PublicKeyHex | null;
    onShowMessageOnDeviceAgain?: (message: Message) => void | Promise<void>;
    onShowAllHiddenMessagesOnDevice?: (messages: ReadonlyArray<Message>) => void | Promise<void>;
    // Reaction Picker
    reactionPicker: {
        messageId: string;
        x: number;
        y: number;
    } | null;
    setReactionPicker: (val: {
        messageId: string;
        x: number;
        y: number;
    } | null) => void;
    reactionPickerRef: React.RefObject<HTMLDivElement | null>;
    onToggleReaction: (message: Message, emoji: ReactionEmoji) => void;
    onRetryMessage: (message: Message) => void;
    // Composer Props
    messageInput: string;
    setMessageInput: (val: string) => void;
    handleSendMessage: () => void;
    onSendDirectMessage?: (params: SendDirectMessageParams) => Promise<SendDirectMessageResult>;
    isUploadingAttachment: boolean;
    uploadStage: "idle" | "encrypting" | "uploading" | "sending";
    pendingAttachments: ReadonlyArray<File>;
    pendingAttachmentPreviewUrls: ReadonlyArray<string>;
    attachmentError: string | null;
    replyTo: ReplyTo | null;
    setReplyTo: (val: ReplyTo | null) => void;
    onPickAttachments: (files: FileList | null) => void;
    onSelectFiles: () => void;
    removePendingAttachment: (index: number) => void;
    clearPendingAttachment: () => void;
    relayStatus: RelayStatusSummary;
    composerTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
    onSendVoiceNote?: (file: File) => void;
    isProcessingMedia: boolean;
    mediaProcessingProgress: number;
    pendingEventCount?: number;
    recipientStatus?: 'idle' | 'found' | 'not_found' | 'verifying';
    isPeerAccepted?: boolean;
    isPublicKeyAccepted?: (publicKeyHex: string) => boolean;
    isInitiator?: boolean;
    contactRequestComposeMode?: import("@/app/features/messaging/services/contact-request-sandbox-policy").ContactRequestComposeMode;
    requestEventId?: string;
    onAcceptPeer?: () => void | Promise<void>;
    onDeclinePeer?: () => void | Promise<void>;
    onCancelOutgoingRequest?: () => void | Promise<void>;
    onResendConnectionRequest?: () => void | Promise<void>;
    outgoingResendEligible?: boolean;
    onBlockPeer?: () => void;
    groupAdmins?: ReadonlyArray<Readonly<{
        pubkey: string;
        roles: ReadonlyArray<string>;
    }>>;
    /** When set and strict managed workspace, message menu offers D3 remote remove. */
    groupRelayUrl?: string | null;
    relayOverlap?: ContactRelayOverlapResult;
    onAddRelay?: (url: string) => void;
    onNavigateToRelaySettings?: () => void;
    deliveryRisk?: "no_overlap" | "unknown" | "overlap" | null;
    /** Mobile shell thread uses MobileDmThreadHeader; omit desktop ChatHeader block. */
    hideDesktopChatHeader?: boolean;
    /** Managed workspace B2 — show honest paused state when registered bots have no active triggers. */
    communityBotTriggerSummary?: CommunityBotTriggerSummary | null;
}
export function ChatView(props: ChatViewProps) {
    const { t } = useTranslation();
    const {
        isMediaGalleryOpen,
        setIsMediaGalleryOpen,
        lightboxIndex,
        setLightboxIndex,
        setMessageMenu,
        setReactionPicker,
    } = useMessaging();
    const { items: selectedConversationMediaItems } = useMediaPreviewScope();
    const preferNativeTouchScroll = usePreferNativeTouchScroll();
    const hideDesktopChatHeader = props.hideDesktopChatHeader === true;
    const [isDragging, setIsDragging] = useState(false);
    const [isBatchDeleteMode, setIsBatchDeleteMode] = useState(false);
    const [selectedMessageIds, setSelectedMessageIds] = useState<ReadonlySet<string>>(new Set());
    const [isBatchDeleteInFlight, setIsBatchDeleteInFlight] = useState(false);
    const [isHiddenPanelOpen, setIsHiddenPanelOpen] = useState(false);
    const [isRestoreInFlight, setIsRestoreInFlight] = useState(false);
    const batchSelectionAnchorIdRef = React.useRef<string | null>(null);
    const [isHistorySearchOpen, setIsHistorySearchOpen] = useState(false);
    const [historySearchQuery, setHistorySearchQuery] = useState("");
    const [historySearchFilter, setHistorySearchFilter] = useState<"all" | "voice_note">("all");
    const [isHistorySearching, setIsHistorySearching] = useState(false);
    const [historySearchResults, setHistorySearchResults] = useState<ReadonlyArray<ChatHistorySearchResult>>([]);
    const [jumpToMessageId, setJumpToMessageId] = useState<string | null>(null);
    const [jumpToMessageTimestampMs, setJumpToMessageTimestampMs] = useState<number | null>(null);
    const [searchFlashMessageId, setSearchFlashMessageId] = useState<string | null>(null);
    const [historySearchResultFlashId, setHistorySearchResultFlashId] = useState<string | null>(null);
    const searchFlashTimeoutRef = React.useRef<number | null>(null);
    const historySearchResultFlashTimeoutRef = React.useRef<number | null>(null);
    const [messageMenuAnchorHoverId, setMessageMenuAnchorHoverId] = useState<string | null>(null);
    const [isMessageMenuHovered, setIsMessageMenuHovered] = useState(false);
    const [canUseMessageMenuHoverDismiss, setCanUseMessageMenuHoverDismiss] = useState(false);
    const { hiddenMessages, refreshHiddenMessages } = useDmThreadHiddenMessages({
        conversationId: props.conversation.id,
        conversationKind: props.conversation.kind,
        myPublicKeyHex: props.accountPublicKeyHex ?? null,
    });
    const metadata = useResolvedProfileMetadata(props.conversation.kind === "dm" ? props.conversation.pubkey : null);
    const resolvedName = metadata?.displayName || props.conversation.displayName;
    const dmPeerPublicKeyHex = props.conversation.kind === "dm" ? props.conversation.pubkey : null;
    const contactTrustSensitivity = useContactTrustSensitivity(dmPeerPublicKeyHex);
    const connectionRequestPreview = React.useMemo(() => {
        if (props.contactRequestComposeMode !== "sandbox_text" || props.isInitiator) {
            return null;
        }
        const incoming = props.messages.find((message) => (
            !message.isOutgoing && message.content.trim().length > 0
        ));
        if (!incoming) {
            return null;
        }
        return {
            content: incoming.content,
            timestampUnixMs: incoming.timestamp.getTime(),
        };
    }, [props.contactRequestComposeMode, props.isInitiator, props.messages]);
    const dmKernelTrust = useDmKernelTrustBanner({
        conversation: props.conversation,
        peerPublicKeyHex: dmPeerPublicKeyHex ?? undefined,
        isPeerAccepted: props.isPeerAccepted,
        isPublicKeyAccepted: props.isPublicKeyAccepted,
        messages: props.messages,
        contactTrustSensitivity: contactTrustSensitivity.sensitivity,
    });
    const isDeletedRecipient = props.conversation.kind === "dm" && metadata?.isDeleted === true;
    const resolvedNowMs = props.nowMs;
    const normalizedHistorySearchQuery = historySearchQuery.trim().toLowerCase();
    const canSearchHistory = normalizedHistorySearchQuery.length >= 2;
    const voiceNoteSearchResultCount = React.useMemo(() => (historySearchResults.filter((result) => result.resultKind === "voice_note").length), [historySearchResults]);
    const filteredHistorySearchResults = React.useMemo(() => (historySearchFilter === "voice_note"
        ? historySearchResults.filter((result) => result.resultKind === "voice_note")
        : historySearchResults), [historySearchFilter, historySearchResults]);
    const selectedMessages = React.useMemo(() => (props.messages.filter((message) => selectedMessageIds.has(message.id))), [props.messages, selectedMessageIds]);
    const selectedOutgoingMessages = React.useMemo(() => (selectedMessages.filter((message) => message.isOutgoing)), [selectedMessages]);
    const selectedMessageCount = selectedMessages.length;
    const selectedOutgoingMessageCount = selectedOutgoingMessages.length;
    const effectiveFlashMessageId = searchFlashMessageId ?? props.flashMessageId;
    React.useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
            setCanUseMessageMenuHoverDismiss(false);
            return;
        }
        const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
        const apply = (): void => {
            setCanUseMessageMenuHoverDismiss(mediaQuery.matches);
        };
        apply();
        const listener = () => apply();
        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", listener);
            return () => {
                mediaQuery.removeEventListener("change", listener);
            };
        }
        mediaQuery.addListener(listener);
        return () => {
            mediaQuery.removeListener(listener);
        };
    }, []);
    const { onDeleteMessageForMe, onDeleteMessageForEveryone } = props;
    const managedWorkspaceRemoteRemove = React.useMemo(() => props.conversation.kind === "group"
        && isStrictManagedWorkspaceRelay(props.groupRelayUrl ?? null), [props.conversation.kind, props.groupRelayUrl]);
    const getMessageById = (messageId: string): Message | undefined => {
        return props.messages.find(m => m.id === messageId);
    };
    const handleJumpToMessage = React.useCallback((params: Readonly<{
        messageId: string;
        timestampMs: number;
    }>): void => {
        const resolvedTarget = resolveConversationMessageJumpTarget(props.messages, params);
        logAppEvent({
            name: "messaging.search_jump_requested",
            level: "info",
            scope: { feature: "messaging", action: "search_jump" },
            context: {
                conversationIdHint: toIdHint(props.conversation.id),
                conversationKind: props.conversation.kind,
                targetMessageIdHint: toIdHint(resolvedTarget.messageId),
                targetTimestampMs: resolvedTarget.timestampMs,
            },
        });
        setHistorySearchResultFlashId(resolvedTarget.messageId);
        if (historySearchResultFlashTimeoutRef.current) {
            window.clearTimeout(historySearchResultFlashTimeoutRef.current);
        }
        historySearchResultFlashTimeoutRef.current = window.setTimeout(() => {
            setHistorySearchResultFlashId((current) => (current === resolvedTarget.messageId ? null : current));
            historySearchResultFlashTimeoutRef.current = null;
        }, 900);
        setJumpToMessageId(resolvedTarget.messageId);
        setJumpToMessageTimestampMs(resolvedTarget.timestampMs);
        setIsHistorySearchOpen(false);
    }, [props.conversation.id, props.conversation.kind, props.messages]);
    React.useEffect(() => {
        setHistorySearchQuery("");
        setHistorySearchResults([]);
        setIsHistorySearching(false);
        setJumpToMessageId(null);
        setJumpToMessageTimestampMs(null);
        setSearchFlashMessageId(null);
        setIsHistorySearchOpen(false);
        setHistorySearchFilter("all");
        setSelectedMessageIds(new Set());
        setIsBatchDeleteMode(false);
        setIsBatchDeleteInFlight(false);
    }, [props.conversation.id]);
    React.useEffect(() => {
        setSelectedMessageIds((current) => {
            if (current.size === 0) {
                return current;
            }
            const currentMessageIds = new Set(props.messages.map((message) => message.id));
            let changed = false;
            const next = new Set<string>();
            current.forEach((messageId) => {
                if (currentMessageIds.has(messageId)) {
                    next.add(messageId);
                    return;
                }
                changed = true;
            });
            if (!changed && next.size === current.size) {
                return current;
            }
            return next;
        });
    }, [props.messages]);
    React.useEffect(() => {
        if (!canSearchHistory) {
            setHistorySearchResults([]);
            setIsHistorySearching(false);
            return;
        }
        let cancelled = false;
        setIsHistorySearching(true);
        const debounceId = window.setTimeout(async () => {
            try {
                const persistedConversationResults = await searchConversationPersistedHistory(
                    props.conversation.id,
                    normalizedHistorySearchQuery,
                    120,
                );
                if (cancelled) {
                    return;
                }
                const liveConversationResults = searchLiveConversationMessages(props.messages, normalizedHistorySearchQuery, 120);
                const conversationResults = resolveHistorySearchResultsForLiveMessages(mergeConversationHistorySearchResults(persistedConversationResults, liveConversationResults, 50), props.messages).map((result) => ({
                    ...result,
                    timestamp: new Date(result.timestampMs),
                } satisfies ChatHistorySearchResult));
                setHistorySearchResults(conversationResults);
            }
            finally {
                if (!cancelled) {
                    setIsHistorySearching(false);
                }
            }
        }, 250);
        return () => {
            cancelled = true;
            window.clearTimeout(debounceId);
        };
    }, [canSearchHistory, normalizedHistorySearchQuery, props.conversation.id, props.messages]);
    const handleMessageMenuAnchorHoverChange = React.useCallback((params: {
        messageId: string;
        isHovered: boolean;
    }): void => {
        setMessageMenuAnchorHoverId((current) => {
            if (params.isHovered) {
                return params.messageId;
            }
            return current === params.messageId ? null : current;
        });
    }, []);
    const handleJumpToMessageHandled = React.useCallback((messageId: string): void => {
        setJumpToMessageId((current) => (current === messageId ? null : current));
        setJumpToMessageTimestampMs(null);
        setSearchFlashMessageId(messageId);
        if (searchFlashTimeoutRef.current) {
            window.clearTimeout(searchFlashTimeoutRef.current);
            searchFlashTimeoutRef.current = null;
        }
        searchFlashTimeoutRef.current = window.setTimeout(() => {
            setSearchFlashMessageId((current) => (current === messageId ? null : current));
            searchFlashTimeoutRef.current = null;
        }, SEARCH_TARGET_FLASH_MS);
    }, []);
    React.useEffect(() => {
        return () => {
            if (searchFlashTimeoutRef.current) {
                window.clearTimeout(searchFlashTimeoutRef.current);
                searchFlashTimeoutRef.current = null;
            }
            if (historySearchResultFlashTimeoutRef.current) {
                window.clearTimeout(historySearchResultFlashTimeoutRef.current);
                historySearchResultFlashTimeoutRef.current = null;
            }
        };
    }, []);
    const handleCancelBatchDeleteMode = React.useCallback((): void => {
        batchSelectionAnchorIdRef.current = null;
        setIsBatchDeleteMode(false);
        setSelectedMessageIds(new Set());
        setMessageMenu(null);
        setReactionPicker(null);
        setMessageMenuAnchorHoverId(null);
        setIsMessageMenuHovered(false);
    }, [setMessageMenu, setReactionPicker]);
    const handleStartBatchDeleteModeForMessage = React.useCallback((messageId: string): void => {
        batchSelectionAnchorIdRef.current = messageId;
        setIsBatchDeleteMode(true);
        setSelectedMessageIds(new Set([messageId]));
        setMessageMenu(null);
        setReactionPicker(null);
        setMessageMenuAnchorHoverId(null);
        setIsMessageMenuHovered(false);
    }, [setMessageMenu, setReactionPicker]);
    const handleToggleBatchMessageSelection = React.useCallback((params: Readonly<{
        messageId: string;
        shiftKey: boolean;
    }>): void => {
        if (!isBatchDeleteMode) {
            return;
        }
        setSelectedMessageIds((current) => {
            const result = applyBatchMessageSelectionToggle({
                messages: props.messages,
                currentSelectedIds: current,
                anchorMessageId: batchSelectionAnchorIdRef.current,
                toggle: params,
            });
            batchSelectionAnchorIdRef.current = result.anchorMessageId;
            return new Set(result.selectedIds);
        });
    }, [isBatchDeleteMode, props.messages]);
    const handleBatchDeleteForMe = React.useCallback(async (): Promise<void> => {
        if (selectedMessageCount === 0 || isBatchDeleteInFlight) {
            return;
        }
        setIsBatchDeleteInFlight(true);
        try {
            for (const message of selectedMessages) {
                await Promise.resolve(onDeleteMessageForMe(message));
            }
        }
        finally {
            setSelectedMessageIds(new Set());
            setIsBatchDeleteMode(false);
            setIsBatchDeleteInFlight(false);
        }
    }, [isBatchDeleteInFlight, onDeleteMessageForMe, selectedMessageCount, selectedMessages]);
    const handleBatchDeleteForEveryone = React.useCallback(async (): Promise<void> => {
        if (selectedOutgoingMessageCount === 0 || isBatchDeleteInFlight) {
            return;
        }
        setIsBatchDeleteInFlight(true);
        try {
            for (const message of selectedOutgoingMessages) {
                await Promise.resolve(onDeleteMessageForEveryone(message, {
                    suppressManagedWorkspaceToast: managedWorkspaceRemoteRemove,
                }));
            }
            if (managedWorkspaceRemoteRemove && selectedOutgoingMessages.length > 0) {
                toast.success(MANAGED_WORKSPACE_DELETE_COPY.removedFromWorkspaceBatchToast);
            }
        }
        finally {
            setSelectedMessageIds(new Set());
            setIsBatchDeleteMode(false);
            setIsBatchDeleteInFlight(false);
        }
    }, [
        isBatchDeleteInFlight,
        managedWorkspaceRemoteRemove,
        onDeleteMessageForEveryone,
        selectedOutgoingMessageCount,
        selectedOutgoingMessages,
    ]);
    const handleOpenMessageMenu = React.useCallback((params: {
        messageId: string;
        x: number;
        y: number;
    }): void => {
        if (isBatchDeleteMode) {
            return;
        }
        setMessageMenu(params);
    }, [isBatchDeleteMode, setMessageMenu]);
    const handleOpenReactionPicker = React.useCallback((params: {
        messageId: string;
        x: number;
        y: number;
    }): void => {
        if (isBatchDeleteMode) {
            return;
        }
        setReactionPicker(params);
    }, [isBatchDeleteMode, setReactionPicker]);
    const handleImageClick = React.useCallback((url: string): void => {
        const index = selectedConversationMediaItems.findIndex(item => item.attachment.url === url);
        if (index !== -1) {
            setLightboxIndex(index);
        }
    }, [selectedConversationMediaItems, setLightboxIndex]);
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes("Files")) {
            setIsDragging(true);
        }
    };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            props.onPickAttachments(e.dataTransfer.files);
        }
    };
    const { messageMenu, reactionPicker, messageMenuRef, reactionPickerRef, } = props;
    // Close menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (messageMenu && messageMenuRef.current && !messageMenuRef.current.contains(event.target as Node)) {
                setMessageMenu(null);
                setMessageMenuAnchorHoverId(null);
                setIsMessageMenuHovered(false);
            }
            if (reactionPicker && reactionPickerRef.current && !reactionPickerRef.current.contains(event.target as Node)) {
                setReactionPicker(null);
            }
        };
        if (messageMenu || reactionPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [messageMenu, messageMenuRef, reactionPicker, reactionPickerRef, setMessageMenu, setReactionPicker]);
    React.useEffect(() => {
        if (!messageMenu) {
            setMessageMenuAnchorHoverId(null);
            setIsMessageMenuHovered(false);
            return;
        }
        if (!canUseMessageMenuHoverDismiss) {
            return;
        }
        const menuAnchoredToHoveredBubble = messageMenuAnchorHoverId === messageMenu.messageId;
        if (menuAnchoredToHoveredBubble || isMessageMenuHovered) {
            return;
        }
        const timeoutId = window.setTimeout(() => {
            setMessageMenu(null);
        }, MESSAGE_MENU_HOVER_DISMISS_DELAY_MS);
        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [canUseMessageMenuHoverDismiss, isMessageMenuHovered, messageMenu, messageMenuAnchorHoverId, setMessageMenu]);
    React.useEffect(() => {
        const handleEscapeDismiss = (event: KeyboardEvent): void => {
            if (event.key !== "Escape") {
                return;
            }
            let handled = false;
            if (lightboxIndex !== null) {
                setLightboxIndex(null);
                handled = true;
            }
            else if (isMediaGalleryOpen) {
                setIsMediaGalleryOpen(false);
                handled = true;
            }
            else if (messageMenu) {
                setMessageMenu(null);
                setMessageMenuAnchorHoverId(null);
                setIsMessageMenuHovered(false);
                handled = true;
            }
            else if (reactionPicker) {
                setReactionPicker(null);
                handled = true;
            }
            else if (isBatchDeleteMode) {
                setIsBatchDeleteMode(false);
                setSelectedMessageIds(new Set());
                handled = true;
            }
            else if (isHistorySearchOpen) {
                setIsHistorySearchOpen(false);
                handled = true;
            }
            if (!handled) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
        };
        window.addEventListener("keydown", handleEscapeDismiss);
        return () => {
            window.removeEventListener("keydown", handleEscapeDismiss);
        };
    }, [
        isHistorySearchOpen,
        isBatchDeleteMode,
        isMediaGalleryOpen,
        lightboxIndex,
        messageMenu,
        reactionPicker,
        setIsMediaGalleryOpen,
        setLightboxIndex,
        setMessageMenu,
        setReactionPicker,
    ]);
    const dmTrustSensitivityForHeader = (
      props.conversation.kind === "dm"
      && dmPeerPublicKeyHex
      && isDmKernelAuthority()
    ) ? {
      peerPublicKeyHex: dmPeerPublicKeyHex,
      isPeerAccepted: props.isPeerAccepted,
      sensitivity: contactTrustSensitivity.sensitivity,
      onSensitivityChange: contactTrustSensitivity.setSensitivity,
    } : undefined;
    const activeMessage = messageMenu && getMessageById(messageMenu.messageId);
    const activeReactionMessage = reactionPicker && getMessageById(reactionPicker.messageId);
    return (<div className="group/chat-root flex flex-col flex-1 min-h-0 relative overflow-hidden" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            {!hideDesktopChatHeader ? (<ChatHeader conversation={props.conversation} groupMemberCount={props.groupMemberCount} groupOnlineMemberCount={props.groupOnlineMemberCount} groupLastActivityAtMs={props.groupLastActivityAtMs} isOnline={props.isPeerOnline} interactionStatus={props.interactionStatus} nowMs={props.nowMs} onCopyPubkey={props.onCopyPubkey} onOpenMedia={props.onOpenMedia} onToggleConversationNotifications={props.onToggleConversationNotifications} onOpenInfo={props.onOpenInfo} onOpenProfile={props.onOpenProfile} onSendVoiceCallInvite={props.onSendVoiceCallInvite} canSendVoiceCallInvite={isDeletedRecipient ? false : props.canSendVoiceCallInvite} isSendingVoiceCallInvite={props.isSendingVoiceCallInvite} activeVoiceCallState={props.activeVoiceCallState} voiceCallStatus={props.voiceCallStatus} onLeaveVoiceCall={props.onLeaveVoiceCall} onAcceptIncomingVoiceCall={props.onAcceptIncomingVoiceCall} onDeclineIncomingVoiceCall={props.onDeclineIncomingVoiceCall} contactTrustSensitivity={dmTrustSensitivityForHeader}/>) : null}

            {props.conversation.kind === "dm"
            && dmPeerPublicKeyHex
            && (props.contactRequestComposeMode === "sandbox_text" || props.outgoingResendEligible) ? (
              <ContactRequestThreadBanner
                displayName={resolvedName}
                peerPublicKeyHex={dmPeerPublicKeyHex}
                isInitiator={props.isInitiator === true}
                resendEligible={props.outgoingResendEligible === true}
                requestEventId={props.requestEventId}
                requestPreviewContent={connectionRequestPreview?.content}
                requestPreviewTimestampUnixMs={connectionRequestPreview?.timestampUnixMs}
                onAcceptConfirm={async () => {
                  await props.onAcceptPeer?.();
                }}
                onDecline={async () => {
                  await props.onDeclinePeer?.();
                }}
                onCancelOutgoing={props.isInitiator ? async () => {
                  await props.onCancelOutgoingRequest?.();
                } : undefined}
                onResendRequest={props.onResendConnectionRequest
                  ? async () => { await props.onResendConnectionRequest?.(); }
                  : undefined}
              />
            ) : shouldShowPathBThreadWarningBanner({
            conversationKind: props.conversation.kind,
            isPeerAccepted: props.isPeerAccepted,
        }) && props.contactRequestComposeMode !== "sandbox_text" && (<StrangerWarningBanner displayName={resolvedName} isInitiator={props.isInitiator} onAccept={() => props.onAcceptPeer?.()} onIgnore={() => {
                // For ignore, we can just close the banner by setting a local state or 
                // by treating it as a "soft ignore" - for now, just same as accept but don't persist trust?
                // Actually, implementation plan says Ignore should just hide it.
                // We'll pass it to props if we want persistence.
            }} onBlock={() => props.onBlockPeer?.()}/>)}
            {dmKernelTrust.showBanner && dmKernelTrust.assessment && props.contactRequestComposeMode !== "sandbox_text" ? (<DmKernelTrustBanner assessment={dmKernelTrust.assessment} expanded={dmKernelTrust.expanded} onToggleExpanded={() => dmKernelTrust.setExpanded(!dmKernelTrust.expanded)} onDismiss={dmKernelTrust.dismiss}/>) : null}
            {dmKernelTrust.showInfoStrip && dmKernelTrust.assessment && props.contactRequestComposeMode !== "sandbox_text" ? (<DmKernelTrustInfoStrip assessment={dmKernelTrust.assessment} onDismiss={dmKernelTrust.dismiss}/>) : null}
            {props.communityBotTriggerSummary ? (<CommunityBotPausedBanner summary={props.communityBotTriggerSummary}/>) : null}
            {props.conversation.kind === 'dm' && props.relayOverlap && props.relayOverlap.status !== 'overlap' && (<RelayOverlapBanner overlap={props.relayOverlap} contactDisplayName={resolvedName} onAddRelay={props.onAddRelay} onNavigateToRelaySettings={props.onNavigateToRelaySettings}/>)}
            {isDeletedRecipient && (<div className="mx-4 mt-3 rounded-2xl border border-amber-500/25 bg-amber-50/65 px-4 py-3 text-xs font-semibold text-amber-800 dark:border-amber-500/35 dark:bg-amber-900/20 dark:text-amber-200">
                    This contact account has been removed. You can still browse this chat, but new messages and calls cannot be delivered.
                </div>)}

            {props.conversation.kind === "dm"
            && props.onShowMessageOnDeviceAgain
            && props.onShowAllHiddenMessagesOnDevice ? (<DmHiddenMessagesPanel hiddenMessages={hiddenMessages} isOpen={isHiddenPanelOpen} onOpenChange={setIsHiddenPanelOpen} isRestoring={isRestoreInFlight} onShowAgain={async (message) => {
                setIsRestoreInFlight(true);
                try {
                    await props.onShowMessageOnDeviceAgain?.(message);
                    refreshHiddenMessages();
                }
                finally {
                    setIsRestoreInFlight(false);
                }
            }} onShowAllAgain={async () => {
                setIsRestoreInFlight(true);
                try {
                    await props.onShowAllHiddenMessagesOnDevice?.(hiddenMessages);
                    refreshHiddenMessages();
                    setIsHiddenPanelOpen(false);
                }
                finally {
                    setIsRestoreInFlight(false);
                }
            }}/>) : null}

            <div className={cn("pointer-events-none absolute z-40 flex w-[min(24rem,calc(100%-2rem))] flex-col items-end gap-2", preferNativeTouchScroll ? "bottom-36 right-3" : "bottom-[108px] right-4")}>
                <button type="button" onClick={() => setIsHistorySearchOpen((current) => !current)} className={cn("inline-flex h-9 items-center gap-2 rounded-xl border border-black/10 bg-white/80 px-3 text-[11px] font-bold text-zinc-700 shadow-sm backdrop-blur transition-all dark:border-white/10 dark:bg-zinc-900/80 dark:text-zinc-200", isHistorySearchOpen
            ? "pointer-events-auto opacity-100 translate-y-0 hover:bg-white dark:hover:bg-zinc-900"
            : "pointer-events-none translate-y-2 opacity-0 group-hover/chat-root:pointer-events-auto group-hover/chat-root:translate-y-0 group-hover/chat-root:opacity-100 group-focus-within/chat-root:pointer-events-auto group-focus-within/chat-root:translate-y-0 group-focus-within/chat-root:opacity-100 hover:bg-white dark:hover:bg-zinc-900")}>
                    <Search className="h-3.5 w-3.5"/>
                    {t("messaging.searchMessagesInChat")}
                </button>

                {isBatchDeleteMode ? (<div data-escape-layer="open" className="pointer-events-auto w-full rounded-2xl border border-rose-400/20 bg-white/85 p-3 shadow-lg backdrop-blur dark:border-rose-300/20 dark:bg-zinc-950/85">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                                {selectedMessageCount > 0
                ? t("messaging.selectedMessagesCount", { count: selectedMessageCount })
                : t("messaging.selectMessagesPrompt")}
                            </p>
                            <button type="button" onClick={handleCancelBatchDeleteMode} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white/70 text-zinc-500 transition-colors hover:text-zinc-800 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:text-zinc-100" aria-label={t("common.close")}>
                                <X className="h-4 w-4"/>
                            </button>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button type="button" onClick={handleBatchDeleteForMe} disabled={selectedMessageCount === 0 || isBatchDeleteInFlight} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
                                <Trash2 className="h-3.5 w-3.5"/>
                                {t("messaging.hideOnThisDeviceWithCount", DM_LOCAL_VISIBILITY_COPY.hideOnThisDeviceWithCount, { count: selectedMessageCount })}
                            </button>
                            {managedWorkspaceRemoteRemove || DM_RECALL_FOR_EVERYONE_UI_ENABLED ? (<button type="button" onClick={handleBatchDeleteForEveryone} disabled={selectedOutgoingMessageCount === 0 || isBatchDeleteInFlight} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-400/35 bg-rose-500/10 px-3 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-300/35 dark:bg-rose-400/15 dark:text-rose-200 dark:hover:bg-rose-400/25">
                                    <Trash2 className="h-3.5 w-3.5"/>
                                    {managedWorkspaceRemoteRemove
                    ? t("messaging.removeFromWorkspaceWithCount", MANAGED_WORKSPACE_DELETE_COPY.removeFromWorkspaceWithCount, { count: selectedOutgoingMessageCount })
                    : t("messaging.recallForEveryoneWithCount", DM_LOCAL_VISIBILITY_COPY.recallForEveryoneWithCount, { count: selectedOutgoingMessageCount })}
                                </button>) : null}
                        </div>

                        <div className="mt-2 rounded-xl border border-black/5 bg-zinc-50/80 p-2 dark:border-white/10 dark:bg-zinc-900/70">
                            <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                                {t("messaging.deletePermissionsIntro")}
                            </p>
                            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                                {t("messaging.batchDeleteShiftHint")}
                            </p>
                            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                                {t("messaging.hideOnThisDeviceScopeDescription", DM_LOCAL_VISIBILITY_COPY.batchScopeHelper)}
                            </p>
                            {managedWorkspaceRemoteRemove ? (<p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                                    {t("messaging.removeFromWorkspaceScopeDescription", MANAGED_WORKSPACE_DELETE_COPY.removeScopeHelper)}
                                </p>) : DM_RECALL_FOR_EVERYONE_UI_ENABLED ? (<p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                                    {t("messaging.recallForEveryoneScopeDescription", DM_LOCAL_VISIBILITY_COPY.recallScopeHelper)}
                                </p>) : null}
                        </div>

                        {(managedWorkspaceRemoteRemove || DM_RECALL_FOR_EVERYONE_UI_ENABLED)
                && selectedMessageCount > 0
                && selectedOutgoingMessageCount !== selectedMessageCount ? (<p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                                {managedWorkspaceRemoteRemove
                    ? t("messaging.removeFromWorkspaceOutgoingOnlyHint")
                    : t("messaging.deleteForEveryoneOutgoingOnlyHint")}
                            </p>) : null}
                    </div>) : null}

                {isHistorySearchOpen ? (<div data-escape-layer="open" className="pointer-events-auto w-full rounded-2xl border border-black/10 bg-white/85 p-2 shadow-lg backdrop-blur dark:border-white/10 dark:bg-zinc-950/85">
                        <div className="mb-2 flex items-center justify-end">
                            <button type="button" onClick={() => {
                setHistorySearchQuery("");
                setHistorySearchResults([]);
                setIsHistorySearchOpen(false);
            }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white/70 text-zinc-500 transition-colors hover:text-zinc-800 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:text-zinc-100" aria-label={t("common.close")}>
                                <X className="h-4 w-4"/>
                            </button>
                        </div>

                        <div className="space-y-2">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"/>
                                <input value={historySearchQuery} onChange={(event) => {
                setHistorySearchQuery(event.target.value);
                setHistorySearchFilter("all");
            }} placeholder={t("messaging.searchMessagesInChatPlaceholder")} className="h-10 w-full rounded-xl border border-black/10 bg-white/70 pl-9 pr-9 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none ring-purple-500/20 transition focus:border-purple-400/50 focus:ring-2 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-100 dark:placeholder:text-zinc-500" suppressHydrationWarning/>
                                {isHistorySearching ? (<Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-purple-500/70"/>) : null}
                            </div>

                            {canSearchHistory ? (<div className="space-y-2">
                                    <div className="flex items-center gap-2 px-0.5">
                                        <button type="button" onClick={() => setHistorySearchFilter("all")} className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors", historySearchFilter === "all"
                    ? "border-zinc-400/30 bg-zinc-900/10 text-zinc-800 dark:border-zinc-300/30 dark:bg-zinc-100/10 dark:text-zinc-100"
                    : "border-black/10 bg-white/70 text-zinc-500 hover:text-zinc-800 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:text-zinc-100")}>
                                            {t("common.all")}
                                        </button>
                                        <button type="button" onClick={() => setHistorySearchFilter("voice_note")} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors", historySearchFilter === "voice_note"
                    ? "border-purple-400/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                    : "border-black/10 bg-white/70 text-zinc-500 hover:text-zinc-800 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:text-zinc-100")}>
                                            <Mic className="h-2.5 w-2.5"/>
                                            {t("messaging.voiceNotes")}
                                            <span className="text-[9px] opacity-80">{voiceNoteSearchResultCount}</span>
                                        </button>
                                    </div>

                                    <div className="max-h-44 overflow-y-auto rounded-xl border border-black/5 bg-white/70 p-1 dark:border-white/5 dark:bg-zinc-900/70">
                                    {filteredHistorySearchResults.length === 0 && !isHistorySearching ? (<p className="px-3 py-4 text-xs text-zinc-500">
                                            {historySearchFilter === "voice_note"
                        ? t("messaging.noMatchingVoiceNotes")
                        : t("messaging.noMatchingMessages")}
                                        </p>) : (filteredHistorySearchResults.map((result) => (<button key={result.messageId} type="button" onClick={() => handleJumpToMessage({
                        messageId: result.messageId,
                        timestampMs: result.timestampMs,
                    })} className={cn("flex w-full flex-col items-start gap-1 rounded-lg px-3 py-2 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]", historySearchResultFlashId === result.messageId && SEARCH_TARGET_FLASH_CLASS)}>
                                                <div className="flex w-full items-center justify-between gap-2">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                                                        {formatTime(result.timestamp, resolvedNowMs)}
                                                    </span>
                                                    {result.resultKind === "voice_note" ? (<span className="inline-flex items-center gap-1 rounded-full border border-purple-400/30 bg-purple-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-300">
                                                            <Mic className="h-2.5 w-2.5"/>
                                                            {result.voiceDurationLabel
                            ? `Voice Note ${result.voiceDurationLabel}`
                            : "Voice Note"}
                                                        </span>) : null}
                                                </div>
                                                <span className="line-clamp-2 text-xs text-zinc-800 dark:text-zinc-100">
                                                    {highlightText({ text: result.preview, query: historySearchQuery })}
                                                </span>
                                            </button>)))}
                                    </div>
                                </div>) : null}
                        </div>
                    </div>) : null}
            </div>

            {props.messages.length === 0 && props.hasHydrated ? (<div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6 text-center opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-forwards delay-200">
                    <div className="relative">
                        <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center shadow-2xl shadow-purple-500/10 ring-1 ring-black/5 dark:ring-white/5">
                            <span className="relative text-4xl font-black text-zinc-300 dark:text-zinc-600 select-none overflow-hidden h-full w-full flex items-center justify-center rounded-3xl">
                                {metadata?.avatarUrl ? (<Image src={metadata.avatarUrl} alt={resolvedName} fill unoptimized className="object-cover"/>) : (resolvedName[0]?.toUpperCase())}
                            </span>
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-full ring-4 ring-white dark:ring-black">
                            <Lock className="h-5 w-5"/>
                        </div>
                    </div>

                    <div className="space-y-2 max-w-sm">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                            {resolvedName}
                        </h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                            {t("messaging.chatStart")}
                            {props.conversation.kind === 'dm' && !props.isPeerAccepted && (<span className="block mt-1 text-purple-600 dark:text-purple-400 font-medium">
                                    {t("messaging.connectionRequestsNote")}
                                </span>)}
                        </p>
                    </div>
                </div>) : (<MessageList conversationId={props.conversation.id} key={props.conversation.id} hasHydrated={props.hasHydrated} messages={props.messages} renderMetaMessages={props.renderMetaMessages ?? props.messages} inviteResponseStatusByMessageId={props.inviteResponseStatusByMessageId} rawMessagesCount={props.rawMessagesCount} hasEarlierMessages={props.hasEarlierMessages} onLoadEarlier={props.onLoadEarlier} nowMs={props.nowMs} flashMessageId={effectiveFlashMessageId} jumpToMessageId={jumpToMessageId} jumpToMessageTimestampMs={jumpToMessageTimestampMs} onJumpToMessageHandled={handleJumpToMessageHandled} onOpenMessageMenu={handleOpenMessageMenu} openMessageMenuMessageId={props.messageMenu?.messageId ?? null} openReactionPickerMessageId={props.reactionPicker?.messageId ?? null} batchDeleteMode={isBatchDeleteMode} selectedMessageIds={selectedMessageIds} onToggleSelectMessage={handleToggleBatchMessageSelection} onMessageMenuAnchorHoverChange={handleMessageMenuAnchorHoverChange} onOpenReactionPicker={handleOpenReactionPicker} onToggleReaction={props.onToggleReaction} onRetryMessage={props.onRetryMessage} onComposerFocus={() => props.composerTextareaRef.current?.focus()} onReply={props.onReferenceMessage} onImageClick={handleImageClick} isGroup={props.conversation.kind === "group"} admins={props.groupAdmins} onSendDirectMessage={props.onSendDirectMessage} onJoinVoiceCallInvite={props.onJoinVoiceCallInvite} onRequestVoiceCallCallback={props.onRequestVoiceCallCallback} joiningVoiceCallInviteMessageId={props.joiningVoiceCallInviteMessageId} voiceCallStatus={props.voiceCallStatus} pendingEventCount={props.pendingEventCount ?? 0}/>)}

            <Composer messageInput={props.messageInput} setMessageInput={props.setMessageInput} handleSendMessage={props.handleSendMessage} isUploadingAttachment={props.isUploadingAttachment} uploadStage={props.uploadStage} pendingAttachments={props.pendingAttachments} pendingAttachmentPreviewUrls={props.pendingAttachmentPreviewUrls} attachmentError={props.attachmentError} replyTo={props.replyTo} setReplyTo={props.setReplyTo} onPickAttachments={props.onPickAttachments} onSelectFiles={props.onSelectFiles} removePendingAttachment={props.removePendingAttachment} clearPendingAttachment={props.clearPendingAttachment} relayStatus={props.relayStatus} textareaRef={props.composerTextareaRef} recipientStatus={props.recipientStatus} isPeerAccepted={props.isPeerAccepted} isInitiator={props.isInitiator} contactRequestComposeMode={props.contactRequestComposeMode} recipientRemoved={isDeletedRecipient} onSendVoiceNote={props.onSendVoiceNote} isProcessingMedia={props.isProcessingMedia} mediaProcessingProgress={props.mediaProcessingProgress} deliveryRisk={props.deliveryRisk}/>

            {!isBatchDeleteMode && props.messageMenu && activeMessage && (<MessageMenu x={props.messageMenu.x} y={props.messageMenu.y} activeMessage={activeMessage} onCopyText={() => {
                props.onCopyText(activeMessage.content);
                props.setMessageMenu(null);
            }} onCopyAttachmentUrl={() => {
                const firstAttachment = activeMessage.attachments?.[0];
                if (firstAttachment) {
                    props.onCopyAttachmentUrl(firstAttachment.url);
                }
                props.setMessageMenu(null);
            }} onSaveToVault={canSaveChatAttachmentsToLocalVault() ? () => {
                void (async () => {
                    const attachments = activeMessage.attachments ?? [];
                    await saveChatAttachmentsToLocalVault(attachments, t);
                    props.setMessageMenu(null);
                })();
            } : undefined} onReply={() => {
                props.onReferenceMessage(activeMessage);
                props.setMessageMenu(null);
            }} onStartMultiSelect={() => {
                handleStartBatchDeleteModeForMessage(activeMessage.id);
            }} onDeleteForMe={() => {
                props.onDeleteMessageForMe(activeMessage);
                props.setMessageMenu(null);
            }} onDeleteForEveryone={() => {
                props.onDeleteMessageForEveryone(activeMessage);
                props.setMessageMenu(null);
            }} managedWorkspaceRemoteRemove={managedWorkspaceRemoteRemove} menuRef={props.messageMenuRef} onHoverChange={setIsMessageMenuHovered} onRequestClose={() => {
                props.setMessageMenu(null);
                setMessageMenuAnchorHoverId(null);
                setIsMessageMenuHovered(false);
            }}/>)}

            {!isBatchDeleteMode && props.reactionPicker && (<ReactionPicker messageId={props.reactionPicker.messageId} isOutgoing={activeReactionMessage?.isOutgoing ?? false} x={props.reactionPicker.x} y={props.reactionPicker.y} onSelect={(emoji) => {
                const msg = getMessageById(props.reactionPicker!.messageId);
                if (msg) {
                    props.onToggleReaction(msg, emoji);
                }
                props.setReactionPicker(null);
            }} pickerRef={props.reactionPickerRef} onRequestClose={() => props.setReactionPicker(null)}/>)}

            {isDragging && (<div className="absolute inset-0 z-[100] bg-purple-600/10 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200 pointer-events-none">
                    <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-12 border-2 border-dashed border-purple-500 flex flex-col items-center gap-4 shadow-2xl scale-110 transition-transform">
                        <div className="h-20 w-20 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                            <UploadCloud className="h-10 w-10"/>
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{t("messaging.dropToUpload")}</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t("messaging.dropToUploadDesc")}</p>
                        </div>
                    </div>
                </div>)}
        </div>);
}
