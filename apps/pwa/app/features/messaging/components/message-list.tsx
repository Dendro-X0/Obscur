"use client";
import React from "react";
import { OptimizedImage } from "../../../components/optimized-image";
import { AlertTriangle, Check, CheckCheck, Clock, X, Reply, ChevronDown, RefreshCw, FileText, ExternalLink, Music2, ChevronLeft, ChevronRight, Smile, MoreHorizontal, HardDrive } from "lucide-react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Button } from "../../../components/ui/button";
import { EmptyState } from "../../../components/ui/empty-state";
import { MessageContent } from "../../../components/message-content";
import { MessageLinkPreview } from "../../../components/message-link-preview";
import { AudioPlayer } from "./audio-player";
import { VideoPlayer } from "./video-player";
import { VoiceNoteCard } from "./voice-note-card";
import { cn } from "../../../lib/cn";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { formatTime } from "../utils/formatting";
import type { Message, ReactionEmoji, MessageStatus, StatusUi, SendDirectMessageParams, SendDirectMessageResult, Attachment, VoiceCallInvitePayload } from "../types";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { UserAvatar } from "../../profile/components/user-avatar";
import { useProfileMetadata } from "../../profile/hooks/use-profile-metadata";
import { CommunityInviteCard } from "../../groups/components/community-invite-card";
import { CommunityInviteResponseCard } from "../../groups/components/community-invite-response-card";
import { resolveCommunityInviteDisplayViewerRoleFromMessage } from "../../groups/services/community-invite-display-boundary";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { getLocalMediaIndexSnapshot } from "@/app/features/vault/services/local-media-store";
import { canSaveChatAttachmentsToLocalVault, saveChatAttachmentToLocalVault } from "@/app/features/vault/services/save-chat-attachment-to-vault";
import { PrivacySettingsService } from "../../settings/services/privacy-settings-service";
import { detectSwipeDirection, nextMediaIndex, prevMediaIndex } from "./media-viewer-interactions";
import { canMessageListAutoScrollToBottom, isMessageListAwayFromBottom, isMessageListFastScroll, type MessageListScrollMode, isMessageListUserAwayFromBottom, shouldMessageListLockToUserHistoryOnUpwardScroll, shouldAutoScrollOnNewMessage, shouldMessageListAutoLoadEarlier, shouldPinMessageListToLatestDuringInitialLanding, } from "./message-list-scroll";
import { usePreferNativeTouchScroll } from "@/app/features/runtime/use-prefer-native-touch-scroll";
import { useMobileThreadCompactCards } from "@/app/features/runtime/use-mobile-thread-compact-cards";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";
import { formatStructuredMessagePreview } from "@/app/features/messaging/services/format-structured-message-preview";
import { MESSAGE_BUBBLE_ACTION_DOCK_HIDE_DELAY_MS, MESSAGE_BUBBLE_SUSTAIN_HOVER_DELAY_MS, shouldCancelMessageBubbleSustainHover, } from "./message-list-touch";
import { buildAttachmentBuckets, buildAttachmentPresentation } from "./message-attachment-layout";
import { AttachmentContextMenu, type AttachmentContextMenuState } from "./attachment-context-menu";
import { getAttachmentContextMenuTriggerProps } from "./attachment-context-menu-handlers";
import { logAppEvent } from "@/app/shared/log-app-event";
import { messageMatchesSearchJumpTarget, resolveSearchJumpDomResolution, resolveSearchJumpStep, } from "./message-search-jump";
import { VoiceCallInviteCard } from "./voice-call-invite-card";
import { buildMessageRenderCaches, parseMessagePayloadForRender, type ParsedMessagePayload, type InviteResponseStatus, type VoiceCallRoomRenderSummary, } from "./message-list-render-meta";
import { useNativeCallRecordIndex } from "../hooks/use-native-call-record-index";
import { mergeVoiceCallRoomSummaries } from "../services/call-record-sqlite-store";
interface MessageListProps {
    conversationId?: string;
    hasHydrated: boolean;
    messages: ReadonlyArray<Message>;
    renderMetaMessages?: ReadonlyArray<Message>;
    inviteResponseStatusByMessageId?: ReadonlyMap<string, InviteResponseStatus>;
    rawMessagesCount: number; // to check if empty
    hasEarlierMessages: boolean;
    onLoadEarlier: () => void;
    nowMs: number | null;
    flashMessageId: string | null;
    jumpToMessageId?: string | null;
    jumpToMessageTimestampMs?: number | null;
    onJumpToMessageHandled?: (messageId: string) => void;
    onOpenMessageMenu: (params: {
        messageId: string;
        x: number;
        y: number;
    }) => void;
    openMessageMenuMessageId?: string | null;
    openReactionPickerMessageId?: string | null;
    batchDeleteMode?: boolean;
    selectedMessageIds?: ReadonlySet<string>;
    onToggleSelectMessage?: (params: Readonly<{
        messageId: string;
        shiftKey: boolean;
    }>) => void;
    onMessageMenuAnchorHoverChange?: (params: {
        messageId: string;
        isHovered: boolean;
    }) => void;
    onOpenReactionPicker: (params: {
        messageId: string;
        x: number;
        y: number;
    }) => void;
    onToggleReaction: (message: Message, emoji: ReactionEmoji) => void;
    onRetryMessage: (message: Message) => void;
    onComposerFocus: () => void;
    onReply?: (message: Message) => void;
    onImageClick?: (url: string) => void;
    isGroup?: boolean;
    admins?: ReadonlyArray<Readonly<{
        pubkey: string;
        roles: ReadonlyArray<string>;
    }>>;
    pendingEventCount?: number;
    onSendDirectMessage?: (params: SendDirectMessageParams) => Promise<SendDirectMessageResult>;
    onJoinVoiceCallInvite?: (params: Readonly<{
        invite: VoiceCallInvitePayload;
        messageId: string;
    }>) => void;
    onRequestVoiceCallCallback?: () => void;
    joiningVoiceCallInviteMessageId?: string | null;
    voiceCallStatus?: Readonly<{
        roomId: string;
        peerPubkey: string;
        phase: "ringing_outgoing" | "ringing_incoming" | "connecting" | "connected" | "interrupted" | "ended";
    }> | null;
    onRefresh?: () => Promise<void>;
}
type MessageListScrollBehavior = "auto" | "smooth";
const EMPTY_SELECTED_MESSAGE_IDS: ReadonlySet<string> = new Set<string>();
const INITIAL_LATEST_LANDING_STABLE_DELAY_MS = 320;
type MessageListPrependAnchor = Readonly<{
    messageId: string;
    topOffsetPx: number;
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
type MessageListScrollViewportProps = Readonly<{
    preferNativeTouchScroll: boolean;
    parentRef: React.RefObject<HTMLDivElement | null>;
    scrollRegionClassName: string;
    enablePullToRefreshDrag: boolean;
    isRefreshing: boolean;
    y: ReturnType<typeof useMotionValue<number>>;
    onDragEnd: () => void | Promise<void>;
    onScroll: React.UIEventHandler<HTMLDivElement>;
    onWheel: React.WheelEventHandler<HTMLDivElement>;
    onTouchStart: React.TouchEventHandler<HTMLDivElement>;
    onTouchMove: React.TouchEventHandler<HTMLDivElement>;
    onTouchEndClear: () => void;
    children: React.ReactNode;
}>;
function MessageListScrollViewport({ preferNativeTouchScroll, parentRef, scrollRegionClassName, enablePullToRefreshDrag, isRefreshing, y, onDragEnd, onScroll, onWheel, onTouchStart, onTouchMove, onTouchEndClear, children, }: MessageListScrollViewportProps): React.JSX.Element {
    if (preferNativeTouchScroll) {
        return (<div ref={parentRef} className={scrollRegionClassName} onScroll={onScroll} onWheel={onWheel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEndClear}>
                {children}
            </div>);
    }
    return (<motion.div ref={parentRef} drag={enablePullToRefreshDrag ? "y" : false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.5 }} onDragEnd={onDragEnd} style={{ y: isRefreshing ? 20 : y }} className={scrollRegionClassName} onScroll={onScroll} onWheel={onWheel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEndClear}>
            {children}
        </motion.div>);
}
function MessageListImpl({ conversationId, hasHydrated, messages, renderMetaMessages, inviteResponseStatusByMessageId, rawMessagesCount, hasEarlierMessages, onLoadEarlier, nowMs, flashMessageId, jumpToMessageId, jumpToMessageTimestampMs, onJumpToMessageHandled, onOpenMessageMenu, openMessageMenuMessageId, openReactionPickerMessageId, batchDeleteMode = false, selectedMessageIds = EMPTY_SELECTED_MESSAGE_IDS, onToggleSelectMessage, onMessageMenuAnchorHoverChange, onOpenReactionPicker, onToggleReaction, onRetryMessage, onComposerFocus, onReply, onImageClick, admins, pendingEventCount = 0, onSendDirectMessage, onJoinVoiceCallInvite, onRequestVoiceCallCallback, joiningVoiceCallInviteMessageId, voiceCallStatus, onRefresh, }: MessageListProps) {
    const { t } = useTranslation();
    const preferNativeTouchScroll = usePreferNativeTouchScroll();
    const compactThreadCards = useMobileThreadCompactCards();
    const parentRef = React.useRef<HTMLDivElement>(null);
    const [chatPerformanceV2Enabled, setChatPerformanceV2Enabled] = React.useState<boolean>(() => PrivacySettingsService.getSettings().chatPerformanceV2);
    const [chatUxV083Enabled, setChatUxV083Enabled] = React.useState<boolean>(() => PrivacySettingsService.getSettings().chatUxV083);
    const [fastScrollMode, setFastScrollMode] = React.useState(false);
    const fastScrollModeRef = React.useRef(false);
    const lastScrollTopRef = React.useRef(0);
    const lastScrollTsRef = React.useRef(0);
    const fastScrollTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollFrameRef = React.useRef<number | null>(null);
    const autoBottomFrameRef = React.useRef<number | null>(null);
    const pendingScrollMetricsRef = React.useRef<Readonly<{
        scrollTop: number;
        scrollHeight: number;
        clientHeight: number;
    }> | null>(null);
    const showScrollBottomRef = React.useRef(false);
    const scrollModeRef = React.useRef<MessageListScrollMode>("follow_bottom");
    const [scrollMode, setScrollMode] = React.useState<MessageListScrollMode>("follow_bottom");
    const hasUserUpwardScrollIntentRef = React.useRef(false);
    const initialLatestPinActiveRef = React.useRef(true);
    const pendingPrependAnchorRef = React.useRef<MessageListPrependAnchor | null>(null);
    const virtualizerRecoveryAttemptRef = React.useRef(0);
    const loadEarlierInFlightRef = React.useRef(false);
    const hasEarlierMessagesRef = React.useRef(hasEarlierMessages);
    React.useEffect(() => {
        hasEarlierMessagesRef.current = hasEarlierMessages;
    }, [hasEarlierMessages]);
    React.useEffect(() => {
        const onPrivacySettingsChanged = () => {
            const next = PrivacySettingsService.getSettings();
            setChatPerformanceV2Enabled(next.chatPerformanceV2);
            setChatUxV083Enabled(next.chatUxV083);
        };
        if (typeof window !== "undefined") {
            window.addEventListener("privacy-settings-changed", onPrivacySettingsChanged);
            return () => window.removeEventListener("privacy-settings-changed", onPrivacySettingsChanged);
        }
        return;
    }, []);
    React.useEffect(() => {
        fastScrollModeRef.current = fastScrollMode;
    }, [fastScrollMode]);
    const updateScrollMode = React.useCallback((nextMode: MessageListScrollMode): void => {
        if (scrollModeRef.current === nextMode) {
            return;
        }
        scrollModeRef.current = nextMode;
        setScrollMode(nextMode);
    }, []);
    React.useEffect(() => {
        updateScrollMode("follow_bottom");
        hasUserUpwardScrollIntentRef.current = false;
        initialLatestPinActiveRef.current = true;
        didInitialAutoScrollRef.current = false;
        initialLatestLandingCancelledRef.current = false;
        virtualizerRecoveryAttemptRef.current = 0;
        if (initialLatestLandingTimerRef.current !== null) {
            clearTimeout(initialLatestLandingTimerRef.current);
            initialLatestLandingTimerRef.current = null;
        }
        pendingPrependAnchorRef.current = null;
    }, [conversationId, updateScrollMode]);
    const highLoadMode = chatPerformanceV2Enabled && (messages.length >= 100 || pendingEventCount >= 20 || fastScrollMode);
    const suspendDynamicMeasurement = chatPerformanceV2Enabled
        && (fastScrollMode || scrollMode === "user_reading_history" || scrollMode === "loading_earlier");
    const virtualizerOverscan = suspendDynamicMeasurement ? 2 : highLoadMode ? 4 : 8;
    const virtualizer = useVirtualizer({
        count: messages.length,
        getItemKey: (index) => messages[index]?.id ?? index,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 156,
        overscan: virtualizerOverscan,
    });
    const messagesRef = React.useRef(messages);
    messagesRef.current = messages;
    const [showScrollBottom, setShowScrollBottom] = React.useState(false);
    const prevLastId = React.useRef<string | null>(null);
    const prevLength = React.useRef(0);
    const didInitialAutoScrollRef = React.useRef(false);
    const initialLatestLandingCancelledRef = React.useRef(false);
    const initialLatestLandingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchStartYRef = React.useRef<number | null>(null);
    const scrollToBottom = React.useCallback((behavior: MessageListScrollBehavior = "auto") => {
        if (messages.length === 0) {
            return;
        }
        const container = parentRef.current;
        if (!container) {
            return;
        }
        if (behavior === "auto" && !canMessageListAutoScrollToBottom(scrollModeRef.current)) {
            return;
        }
        if (behavior === "smooth") {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: "smooth",
            });
            return;
        }
        if (autoBottomFrameRef.current !== null) {
            return;
        }
        autoBottomFrameRef.current = requestAnimationFrame(() => {
            autoBottomFrameRef.current = null;
            const nextContainer = parentRef.current;
            if (!nextContainer) {
                return;
            }
            nextContainer.scrollTo({
                top: nextContainer.scrollHeight,
                behavior: "auto",
            });
        });
    }, [messages.length]);
    const clearInitialLatestLandingTimer = React.useCallback((): void => {
        if (initialLatestLandingTimerRef.current !== null) {
            clearTimeout(initialLatestLandingTimerRef.current);
            initialLatestLandingTimerRef.current = null;
        }
    }, []);
    const markUserHistoryIntent = React.useCallback((nextMode: MessageListScrollMode = "user_reading_history"): void => {
        hasUserUpwardScrollIntentRef.current = true;
        initialLatestPinActiveRef.current = false;
        initialLatestLandingCancelledRef.current = true;
        clearInitialLatestLandingTimer();
        updateScrollMode(nextMode);
    }, [clearInitialLatestLandingTimer, updateScrollMode]);
    const releaseInitialLatestPin = React.useCallback((): void => {
        initialLatestPinActiveRef.current = false;
    }, []);
    const shouldPinToLatestDuringInitialLanding = React.useCallback((): boolean => (shouldPinMessageListToLatestDuringInitialLanding({
        initialPinActive: initialLatestPinActiveRef.current,
        userRequestedHistory: hasUserUpwardScrollIntentRef.current,
        scrollMode: scrollModeRef.current,
    })), []);
    React.useEffect(() => {
        if (!shouldPinToLatestDuringInitialLanding() || messages.length === 0) {
            return;
        }
        scrollToBottom("auto");
    }, [messages, scrollToBottom, shouldPinToLatestDuringInitialLanding]);
    const isNearBottom = React.useCallback((thresholdPx = 24): boolean => {
        const container = parentRef.current;
        if (!container) {
            return false;
        }
        return (container.scrollHeight - container.scrollTop - container.clientHeight) <= thresholdPx;
    }, []);
    const resolveUserAwayFromBottom = React.useCallback((): boolean => {
        const container = parentRef.current;
        if (!container) {
            return scrollModeRef.current === "user_reading_history";
        }
        return isMessageListUserAwayFromBottom({
            scrollTop: container.scrollTop,
            scrollHeight: container.scrollHeight,
            clientHeight: container.clientHeight,
        });
    }, []);
    const resolveInitialLandingSignal = React.useCallback((): string => {
        const firstId = messages[0]?.id ?? "none";
        const lastId = messages[messages.length - 1]?.id ?? "none";
        return [
            hasHydrated ? "hydrated" : "pending",
            messages.length,
            firstId,
            lastId,
            pendingEventCount,
            hasEarlierMessages ? "earlier" : "latest",
        ].join(":");
    }, [hasEarlierMessages, hasHydrated, messages, pendingEventCount]);
    const capturePrependAnchor = React.useCallback((): void => {
        const container = parentRef.current;
        if (!container || messages.length === 0) {
            pendingPrependAnchorRef.current = null;
            return;
        }
        const viewportTop = container.scrollTop;
        const virtualItems = virtualizer.getVirtualItems();
        if (virtualItems.length === 0) {
            pendingPrependAnchorRef.current = null;
            return;
        }
        let anchorItem = virtualItems[0];
        for (const item of virtualItems) {
            if (item.start <= viewportTop) {
                anchorItem = item;
            }
            else {
                break;
            }
        }
        const anchorMessage = messages[anchorItem.index];
        if (!anchorMessage) {
            pendingPrependAnchorRef.current = null;
            return;
        }
        pendingPrependAnchorRef.current = {
            messageId: anchorMessage.id,
            topOffsetPx: Math.max(0, Math.floor(viewportTop - anchorItem.start)),
        };
    }, [messages, virtualizer]);
    const requestLoadEarlier = React.useCallback((): void => {
        if (loadEarlierInFlightRef.current || !hasEarlierMessagesRef.current) {
            return;
        }
        loadEarlierInFlightRef.current = true;
        capturePrependAnchor();
        markUserHistoryIntent("loading_earlier");
        void Promise.resolve(onLoadEarlier()).finally(() => {
            loadEarlierInFlightRef.current = false;
        });
    }, [capturePrependAnchor, markUserHistoryIntent, onLoadEarlier]);
    React.useEffect(() => {
        if (messages.length === 0) {
            didInitialAutoScrollRef.current = false;
            initialLatestLandingCancelledRef.current = false;
            virtualizerRecoveryAttemptRef.current = 0;
            if (initialLatestLandingTimerRef.current !== null) {
                clearTimeout(initialLatestLandingTimerRef.current);
                initialLatestLandingTimerRef.current = null;
            }
        }
    }, [messages.length]);
    React.useEffect(() => {
        if (!hasHydrated || messages.length === 0) {
            return;
        }
        const currentVirtualItems = virtualizer.getVirtualItems();
        if (currentVirtualItems.length > 0) {
            virtualizerRecoveryAttemptRef.current = 0;
            return;
        }
        if (virtualizerRecoveryAttemptRef.current >= 2) {
            return;
        }
        virtualizerRecoveryAttemptRef.current += 1;
        const attempt = virtualizerRecoveryAttemptRef.current;
        logAppEvent({
            name: "messaging.message_list_virtualizer_recovery_attempt",
            level: "warn",
            scope: { feature: "messaging", action: "message_list_virtualizer_recovery" },
            context: {
                conversationIdHint: toIdHint(conversationId ?? "unknown"),
                messageCount: messages.length,
                attempt,
            },
        });
        const frameId = requestAnimationFrame(() => {
            virtualizer.measure();
            if (canMessageListAutoScrollToBottom(scrollModeRef.current)) {
                try {
                    virtualizer.scrollToIndex(Math.max(0, messages.length - 1), { align: "end", behavior: "auto" });
                }
                catch {
                    // Best-effort recovery only.
                }
            }
        });
        return () => {
            cancelAnimationFrame(frameId);
        };
    }, [conversationId, hasHydrated, messages.length, virtualizer]);
    React.useEffect(() => {
        clearInitialLatestLandingTimer();
        if (!hasHydrated || messages.length === 0 || didInitialAutoScrollRef.current || initialLatestLandingCancelledRef.current) {
            return;
        }
        const scheduledSignal = resolveInitialLandingSignal();
        initialLatestLandingTimerRef.current = setTimeout(() => {
            initialLatestLandingTimerRef.current = null;
            if (didInitialAutoScrollRef.current
                || initialLatestLandingCancelledRef.current
                || hasUserUpwardScrollIntentRef.current
                || !canMessageListAutoScrollToBottom(scrollModeRef.current)) {
                return;
            }
            const signalChanged = resolveInitialLandingSignal() !== scheduledSignal;
            if (signalChanged && !shouldPinToLatestDuringInitialLanding()) {
                return;
            }
            if (!isNearBottom() || shouldPinToLatestDuringInitialLanding()) {
                scrollToBottom("auto");
            }
            if (!signalChanged || !shouldPinToLatestDuringInitialLanding()) {
                didInitialAutoScrollRef.current = true;
                releaseInitialLatestPin();
            }
        }, INITIAL_LATEST_LANDING_STABLE_DELAY_MS);
        return () => {
            if (initialLatestLandingTimerRef.current !== null) {
                clearTimeout(initialLatestLandingTimerRef.current);
                initialLatestLandingTimerRef.current = null;
            }
        };
    }, [
        clearInitialLatestLandingTimer,
        hasHydrated,
        isNearBottom,
        messages.length,
        releaseInitialLatestPin,
        resolveInitialLandingSignal,
        scrollToBottom,
        shouldPinToLatestDuringInitialLanding,
    ]);
    // Scroll to bottom and anchoring logic
    React.useEffect(() => {
        if (hasHydrated && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const isNewMessage = lastMessage.id !== prevLastId.current;
            // Check if messages were prepended (e.g., from onLoadEarlier).
            // Guard against first-load false positives when previous length is zero.
            const isPrepended = prevLength.current > 0
                && messages.length > prevLength.current
                && messages[0].id !== prevFirstId.current;
            if (isPrepended && parentRef.current) {
                const container = parentRef.current;
                const anchor = pendingPrependAnchorRef.current;
                if (anchor) {
                    const anchorIndex = messages.findIndex((message) => message.id === anchor.messageId);
                    if (anchorIndex >= 0) {
                        try {
                            virtualizer.scrollToIndex(anchorIndex, { align: "start", behavior: "auto" });
                        }
                        catch {
                            // best effort; fallback below anchors by delta.
                        }
                        requestAnimationFrame(() => {
                            const nextContainer = parentRef.current;
                            if (!nextContainer) {
                                return;
                            }
                            const anchorItem = virtualizer.getVirtualItems().find((item) => item.index === anchorIndex);
                            if (anchorItem) {
                                nextContainer.scrollTop = anchorItem.start + anchor.topOffsetPx;
                            }
                        });
                        pendingPrependAnchorRef.current = null;
                    }
                    else {
                        pendingPrependAnchorRef.current = null;
                    }
                    updateScrollMode("user_reading_history");
                }
                else if (shouldPinToLatestDuringInitialLanding()
                    || (canMessageListAutoScrollToBottom(scrollModeRef.current) && !hasUserUpwardScrollIntentRef.current)) {
                    // Non-user prepend while still in follow mode: keep the viewport anchored to newest.
                    scrollToBottom("auto");
                }
                else {
                    // Fallback anchor when prepend occurs while user is reading history.
                    const oldHeight = container.scrollHeight;
                    requestAnimationFrame(() => {
                        const nextContainer = parentRef.current;
                        if (!nextContainer) {
                            return;
                        }
                        const newHeight = nextContainer.scrollHeight;
                        const heightDiff = newHeight - oldHeight;
                        if (heightDiff > 0) {
                            nextContainer.scrollTop += heightDiff;
                        }
                    });
                    updateScrollMode("user_reading_history");
                }
            }
            else if (isNewMessage) {
                // Scroll if:
                // 1. Initial load (prevLastId was null)
                // 2. We are already at the bottom
                // 3. Fresh outgoing messages should return the viewport to latest.
                const shouldAutoScroll = shouldAutoScrollOnNewMessage({
                    hasPreviousLastMessage: prevLastId.current !== null,
                    isAwayFromBottom: resolveUserAwayFromBottom(),
                    isOutgoing: lastMessage.isOutgoing,
                    messageTimestampMs: lastMessage.timestamp.getTime(),
                    nowMs: Date.now(),
                });
                if (shouldAutoScroll && lastMessage.isOutgoing) {
                    hasUserUpwardScrollIntentRef.current = false;
                    updateScrollMode("follow_bottom");
                    scrollToBottom("smooth");
                }
                else if (canMessageListAutoScrollToBottom(scrollModeRef.current) && shouldAutoScroll) {
                    scrollToBottom();
                }
            }
            prevLastId.current = lastMessage.id;
            prevFirstId.current = messages[0]?.id || null;
            prevLength.current = messages.length;
        }
    }, [hasHydrated, isNearBottom, messages, resolveUserAwayFromBottom, scrollToBottom, shouldPinToLatestDuringInitialLanding, updateScrollMode, virtualizer]);
    const prevFirstId = React.useRef<string | null>(null);
    const jumpResolveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const jumpInFlightMessageIdRef = React.useRef<string | null>(null);
    const jumpLoadAttemptCountRef = React.useRef(0);
    const jumpRenderResolveAttemptCountRef = React.useRef(0);
    React.useEffect(() => {
        return () => {
            if (jumpResolveTimerRef.current) {
                clearTimeout(jumpResolveTimerRef.current);
                jumpResolveTimerRef.current = null;
            }
        };
    }, []);
    React.useEffect(() => {
        if (!jumpToMessageId) {
            jumpInFlightMessageIdRef.current = null;
            jumpLoadAttemptCountRef.current = 0;
            jumpRenderResolveAttemptCountRef.current = 0;
            return;
        }
        if (jumpInFlightMessageIdRef.current !== jumpToMessageId) {
            jumpLoadAttemptCountRef.current = 0;
            jumpRenderResolveAttemptCountRef.current = 0;
        }
        updateScrollMode("search_jump");
        jumpInFlightMessageIdRef.current = jumpToMessageId;
        let cancelled = false;
        const maxLoadAttempts = 36;
        const maxRenderResolveAttempts = 20;
        const targetTimestampMs = (typeof jumpToMessageTimestampMs === "number" && Number.isFinite(jumpToMessageTimestampMs)
            ? jumpToMessageTimestampMs
            : null);
        const settleJump = (): void => {
            if (cancelled) {
                return;
            }
            const scheduleSettle = (delayMs: number): void => {
                jumpResolveTimerRef.current = setTimeout(() => {
                    settleJump();
                }, delayMs);
            };
            const finalizeJump = (): void => {
                onJumpToMessageHandled?.(jumpToMessageId);
                jumpInFlightMessageIdRef.current = null;
                jumpLoadAttemptCountRef.current = 0;
                jumpRenderResolveAttemptCountRef.current = 0;
                updateScrollMode("user_reading_history");
            };
            const nextStep = resolveSearchJumpStep({
                messages: messagesRef.current,
                jumpToMessageId,
                jumpToMessageTimestampMs: targetTimestampMs,
                loadAttemptCount: jumpLoadAttemptCountRef.current,
                maxLoadAttempts,
            });
            if (nextStep.kind === "found_by_id") {
                try {
                    virtualizer.scrollToIndex(nextStep.targetMessageIndex, { align: "center", behavior: "auto" });
                }
                catch {
                    // Best-effort jump; DOM fallback below handles older browsers/layouts.
                }
                const target = document.getElementById(`msg-${nextStep.resolvedMessageId}`);
                const domResolution = resolveSearchJumpDomResolution({
                    targetElement: target,
                    renderResolveAttemptCount: jumpRenderResolveAttemptCountRef.current,
                    maxRenderResolveAttempts,
                });
                if (domResolution === "resolved") {
                    target?.scrollIntoView({ behavior: "auto", block: "center" });
                    logAppEvent({
                        name: "messaging.search_jump_resolved",
                        level: "info",
                        scope: { feature: "messaging", action: "search_jump" },
                        context: {
                            resolutionMode: "id",
                            conversationIdHint: toIdHint(conversationId ?? "unknown"),
                            targetMessageIdHint: toIdHint(jumpToMessageId),
                            resolvedMessageIdHint: toIdHint(nextStep.resolvedMessageId),
                            loadAttemptCount: jumpLoadAttemptCountRef.current,
                            renderResolveAttemptCount: jumpRenderResolveAttemptCountRef.current,
                            messageWindowCount: messagesRef.current.length,
                        },
                    });
                    finalizeJump();
                    return;
                }
                if (domResolution === "retry") {
                    jumpRenderResolveAttemptCountRef.current += 1;
                    scheduleSettle(70);
                    return;
                }
                logAppEvent({
                    name: "messaging.search_jump_unresolved",
                    level: "warn",
                    scope: { feature: "messaging", action: "search_jump" },
                    context: {
                        reasonCode: "target_dom_not_resolved_after_index_match",
                        conversationIdHint: toIdHint(conversationId ?? "unknown"),
                        targetMessageIdHint: toIdHint(jumpToMessageId),
                        loadAttemptCount: jumpLoadAttemptCountRef.current,
                        renderResolveAttemptCount: jumpRenderResolveAttemptCountRef.current,
                        messageWindowCount: messagesRef.current.length,
                    },
                });
                finalizeJump();
                return;
            }
            if (nextStep.kind === "timestamp_fallback") {
                try {
                    virtualizer.scrollToIndex(nextStep.targetMessageIndex, { align: "center", behavior: "auto" });
                }
                catch {
                    // Best-effort scroll to approximate timestamp position.
                }
                const target = document.getElementById(`msg-${nextStep.resolvedMessageId}`);
                const domResolution = resolveSearchJumpDomResolution({
                    targetElement: target,
                    renderResolveAttemptCount: jumpRenderResolveAttemptCountRef.current,
                    maxRenderResolveAttempts,
                });
                if (domResolution === "retry") {
                    jumpRenderResolveAttemptCountRef.current += 1;
                    scheduleSettle(70);
                    return;
                }
                if (domResolution === "unresolved") {
                    logAppEvent({
                        name: "messaging.search_jump_unresolved",
                        level: "warn",
                        scope: { feature: "messaging", action: "search_jump" },
                        context: {
                            reasonCode: "timestamp_fallback_dom_not_resolved",
                            conversationIdHint: toIdHint(conversationId ?? "unknown"),
                            targetMessageIdHint: toIdHint(jumpToMessageId),
                            loadAttemptCount: jumpLoadAttemptCountRef.current,
                            renderResolveAttemptCount: jumpRenderResolveAttemptCountRef.current,
                            messageWindowCount: messagesRef.current.length,
                        },
                    });
                    finalizeJump();
                    return;
                }
                target?.scrollIntoView({ behavior: "auto", block: "center" });
                logAppEvent({
                    name: "messaging.search_jump_resolved",
                    level: "info",
                    scope: { feature: "messaging", action: "search_jump" },
                    context: {
                        resolutionMode: "timestamp_fallback",
                        conversationIdHint: toIdHint(conversationId ?? "unknown"),
                        targetMessageIdHint: toIdHint(jumpToMessageId),
                        resolvedMessageIdHint: toIdHint(nextStep.resolvedMessageId),
                        loadAttemptCount: jumpLoadAttemptCountRef.current,
                        renderResolveAttemptCount: jumpRenderResolveAttemptCountRef.current,
                        messageWindowCount: messagesRef.current.length,
                    },
                });
                finalizeJump();
                return;
            }
            if (nextStep.kind === "load_earlier_for_timestamp" || nextStep.kind === "load_earlier_for_id") {
                jumpLoadAttemptCountRef.current += 1;
                jumpRenderResolveAttemptCountRef.current = 0;
                requestLoadEarlier();
                scheduleSettle(180);
                return;
            }
            if (nextStep.kind === "unresolved") {
                logAppEvent({
                    name: "messaging.search_jump_unresolved",
                    level: "warn",
                    scope: { feature: "messaging", action: "search_jump" },
                    context: {
                        reasonCode: nextStep.reasonCode,
                        conversationIdHint: toIdHint(conversationId ?? "unknown"),
                        targetMessageIdHint: toIdHint(jumpToMessageId),
                        loadAttemptCount: jumpLoadAttemptCountRef.current,
                        renderResolveAttemptCount: jumpRenderResolveAttemptCountRef.current,
                        messageWindowCount: messagesRef.current.length,
                    },
                });
                finalizeJump();
                return;
            }
        };
        settleJump();
        return () => {
            cancelled = true;
            if (jumpResolveTimerRef.current) {
                clearTimeout(jumpResolveTimerRef.current);
                jumpResolveTimerRef.current = null;
            }
        };
    }, [conversationId, jumpToMessageId, jumpToMessageTimestampMs, messages, onJumpToMessageHandled, requestLoadEarlier, updateScrollMode, virtualizer]);
    const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const isTrustedUserScroll = e.isTrusted;
        pendingScrollMetricsRef.current = { scrollTop, scrollHeight, clientHeight };
        if (scrollFrameRef.current !== null) {
            return;
        }
        scrollFrameRef.current = requestAnimationFrame(() => {
            scrollFrameRef.current = null;
            const nextMetrics = pendingScrollMetricsRef.current;
            if (!nextMetrics) {
                return;
            }
            pendingScrollMetricsRef.current = null;
            const isAwayFromBottom = isMessageListAwayFromBottom(nextMetrics);
            if (isAwayFromBottom !== showScrollBottomRef.current) {
                showScrollBottomRef.current = isAwayFromBottom;
                setShowScrollBottom(isAwayFromBottom);
            }
            const deltaY = nextMetrics.scrollTop - lastScrollTopRef.current;
            const shouldLockToHistory = shouldMessageListLockToUserHistoryOnUpwardScroll({
                mode: scrollModeRef.current,
                deltaY,
                isTrustedUserScroll,
            });
            if (shouldLockToHistory) {
                markUserHistoryIntent("user_reading_history");
            }
            const now = performance.now();
            const previousScrollTop = lastScrollTopRef.current;
            const previousScrollTimestampMs = lastScrollTsRef.current;
            lastScrollTopRef.current = nextMetrics.scrollTop;
            lastScrollTsRef.current = now;
            if (chatPerformanceV2Enabled) {
                const isFastScroll = isMessageListFastScroll({
                    previousScrollTop,
                    previousScrollTimestampMs,
                    nextScrollTop: nextMetrics.scrollTop,
                    nextScrollTimestampMs: now,
                });
                if (isFastScroll) {
                    if (!fastScrollModeRef.current) {
                        fastScrollModeRef.current = true;
                        setFastScrollMode(true);
                    }
                    if (fastScrollTimeoutRef.current) {
                        clearTimeout(fastScrollTimeoutRef.current);
                    }
                    fastScrollTimeoutRef.current = setTimeout(() => {
                        fastScrollModeRef.current = false;
                        setFastScrollMode(false);
                        fastScrollTimeoutRef.current = null;
                    }, 200);
                }
            }
            const userRequestedHistory = (hasUserUpwardScrollIntentRef.current
                || scrollModeRef.current === "user_reading_history"
                || scrollModeRef.current === "loading_earlier");
            if (shouldMessageListAutoLoadEarlier({
                scrollTop: nextMetrics.scrollTop,
                hasEarlierMessages: hasEarlierMessagesRef.current,
                isLoadingEarlier: loadEarlierInFlightRef.current,
                userRequestedHistory,
            })) {
                requestLoadEarlier();
            }
        });
    }, [chatPerformanceV2Enabled, markUserHistoryIntent, requestLoadEarlier]);
    const handleWheel = React.useCallback((event: React.WheelEvent<HTMLDivElement>) => {
        if (!event.isTrusted) {
            return;
        }
        if (event.deltaY < 0) {
            markUserHistoryIntent("user_reading_history");
        }
    }, [markUserHistoryIntent]);
    const handleTouchStart = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
        touchStartYRef.current = event.touches[0]?.clientY ?? null;
    }, []);
    const handleTouchMove = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
        if (!event.isTrusted) {
            return;
        }
        const startY = touchStartYRef.current;
        const currentY = event.touches[0]?.clientY ?? null;
        if (startY === null || currentY === null) {
            return;
        }
        if ((currentY - startY) < -6) {
            markUserHistoryIntent("user_reading_history");
        }
    }, [markUserHistoryIntent]);
    React.useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        const isEditableTarget = (target: EventTarget | null): boolean => {
            if (!(target instanceof HTMLElement)) {
                return false;
            }
            const tagName = target.tagName.toLowerCase();
            if (tagName === "input" || tagName === "textarea" || tagName === "select") {
                return true;
            }
            return target.isContentEditable;
        };
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (!event.isTrusted || isEditableTarget(event.target)) {
                return;
            }
            if (event.key === "ArrowUp" || event.key === "PageUp" || event.key === "Home") {
                markUserHistoryIntent("user_reading_history");
            }
        };
        window.addEventListener("keydown", handleKeyDown, { passive: true });
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [markUserHistoryIntent]);
    const y = useMotionValue(0);
    const refreshOpacity = useTransform(y, [0, 80], [0, 1]);
    const refreshRotate = useTransform(y, [0, 80], [0, 180]);
    const refreshScale = useTransform(y, [0, 80], [0.5, 1]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const { localAttachmentUrlSet, localAttachmentFileNameByUrl, } = React.useMemo(() => {
        const localIndex = getLocalMediaIndexSnapshot();
        const urls = new Set<string>();
        const fileNames: Record<string, string> = {};
        messages.forEach((message) => {
            message.attachments?.forEach((attachment) => {
                const entry = localIndex[attachment.url];
                if (!entry) {
                    return;
                }
                urls.add(attachment.url);
                if (entry.fileName) {
                    fileNames[attachment.url] = entry.fileName;
                }
            });
        });
        return {
            localAttachmentUrlSet: urls as ReadonlySet<string>,
            localAttachmentFileNameByUrl: fileNames as Readonly<Record<string, string>>,
        };
    }, [messages]);
    const [expandedRelayUrlsByMessageId, setExpandedRelayUrlsByMessageId] = React.useState<ReadonlySet<string>>(new Set());
    const [usedVoiceCallCallbackRoomIds, setUsedVoiceCallCallbackRoomIds] = React.useState<ReadonlySet<string>>(new Set());
    React.useEffect(() => {
        return () => {
            if (fastScrollTimeoutRef.current) {
                clearTimeout(fastScrollTimeoutRef.current);
            }
            if (scrollFrameRef.current !== null) {
                cancelAnimationFrame(scrollFrameRef.current);
                scrollFrameRef.current = null;
            }
            if (autoBottomFrameRef.current !== null) {
                cancelAnimationFrame(autoBottomFrameRef.current);
                autoBottomFrameRef.current = null;
            }
            if (initialLatestLandingTimerRef.current !== null) {
                clearTimeout(initialLatestLandingTimerRef.current);
                initialLatestLandingTimerRef.current = null;
            }
            pendingScrollMetricsRef.current = null;
            touchStartYRef.current = null;
        };
    }, []);
    const handleDragEnd = async () => {
        if (y.get() > 80 && !isRefreshing && onRefresh) {
            setIsRefreshing(true);
            try {
                await onRefresh();
            }
            finally {
                setIsRefreshing(false);
            }
        }
    };
    const enablePullToRefreshDrag = Boolean(onRefresh && !isRefreshing && !highLoadMode && !preferNativeTouchScroll);
    const scrollRegionClassName = cn("flex-1 min-h-0 overflow-y-auto p-4 scrollbar-custom relative z-10 [overflow-anchor:none]", preferNativeTouchScroll && "mobile-scroll-region");
    const toggleAttachmentRelayUrls = React.useCallback((messageId: string): void => {
        setExpandedRelayUrlsByMessageId((prev) => {
            const next = new Set(prev);
            if (next.has(messageId)) {
                next.delete(messageId);
            }
            else {
                next.add(messageId);
            }
            return next;
        });
    }, []);
    const nativeCallRecordSummaryByRoomId = useNativeCallRecordIndex();
    const { inviteResponseStatusByMessageId: resolvedInviteResponseStatusByMessageId, renderMetaByMessageId, voiceCallRoomSummaryByRoomId, } = React.useMemo(() => buildMessageRenderCaches({
        messages: renderMetaMessages ?? messages,
        expandedRelayUrlsByMessageId,
        conversationId,
        profileId: getResolvedProfileId(),
        inviteResponseStatusByMessageId,
    }), [conversationId, expandedRelayUrlsByMessageId, inviteResponseStatusByMessageId, messages, renderMetaMessages]);
    const handleRequestVoiceCallCallback = React.useCallback((roomId: string | null): void => {
        if (typeof onRequestVoiceCallCallback !== "function") {
            return;
        }
        if (roomId && usedVoiceCallCallbackRoomIds.has(roomId)) {
            return;
        }
        onRequestVoiceCallCallback();
        if (roomId) {
            setUsedVoiceCallCallbackRoomIds((prev) => {
                if (prev.has(roomId)) {
                    return prev;
                }
                const next = new Set(prev);
                next.add(roomId);
                return next;
            });
        }
    }, [onRequestVoiceCallCallback, usedVoiceCallCallbackRoomIds]);
    return (<div className="flex-1 min-h-0 relative flex flex-col pt-1">
            <motion.div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center h-10 w-10 bg-white dark:bg-zinc-800 rounded-full shadow-lg border border-black/5 dark:border-white/5" style={{
            opacity: isRefreshing ? 1 : refreshOpacity,
            scale: isRefreshing ? 1 : refreshScale,
            y: isRefreshing ? 20 : y
        }}>
                <motion.div animate={isRefreshing ? { rotate: 360 } : undefined} transition={isRefreshing ? { repeat: Infinity, duration: 1, ease: "linear" } : undefined} style={{ rotate: isRefreshing ? 0 : refreshRotate }}>
                    <RefreshCw className="h-5 w-5 text-purple-500"/>
                </motion.div>
            </motion.div>

            <MessageListScrollViewport preferNativeTouchScroll={preferNativeTouchScroll} parentRef={parentRef} scrollRegionClassName={scrollRegionClassName} enablePullToRefreshDrag={enablePullToRefreshDrag} isRefreshing={isRefreshing} y={y} onDragEnd={handleDragEnd} onScroll={handleScroll} onWheel={handleWheel} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEndClear={() => {
            touchStartYRef.current = null;
        }}>
                {!hasHydrated && messages.length === 0 ? (<div className="space-y-3">
                        {Array.from({ length: 8 }).map((_, i) => (<div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                                <div className="h-10 w-56 rounded-2xl bg-zinc-200 dark:bg-zinc-800"/>
                            </div>))}
                    </div>) : rawMessagesCount === 0 ? (<EmptyState type="chats" actions={[
                {
                    label: t("messaging.writeAMessage"),
                    onClick: onComposerFocus,
                    variant: "primary"
                }
            ]}/>) : (<>
                        {hasEarlierMessages ? (<div className="mb-4 flex justify-center">
                                <Button type="button" variant="secondary" onClick={requestLoadEarlier} data-testid="message-list-load-more">
                                    {t("messaging.loadMore")}
                                </Button>
                            </div>) : null}
                        <div style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
            }}>
                            {virtualizer.getVirtualItems().map((virtualItem) => {
                const message = messages[virtualItem.index];
                if (!message) {
                    return null;
                }
                const prevMessage = virtualItem.index > 0 ? messages[virtualItem.index - 1] : null;
                const nextMessage = virtualItem.index < messages.length - 1 ? messages[virtualItem.index + 1] : null;
                const isGroupStart = !prevMessage || prevMessage.isOutgoing !== message.isOutgoing || (message.timestamp.getTime() - prevMessage.timestamp.getTime() > 60000);
                const isGroupEnd = !nextMessage || nextMessage.isOutgoing !== message.isOutgoing || (nextMessage.timestamp.getTime() - message.timestamp.getTime() > 60000);
                const isMiddle = !isGroupStart && !isGroupEnd;
                const renderMeta = renderMetaByMessageId.get(message.id);
                const attachmentUrlsExpanded = renderMeta?.attachmentUrlsExpanded ?? false;
                const hasVisualAttachments = renderMeta?.hasVisualAttachments ?? false;
                const hasAttachmentRelayUrlsInContent = renderMeta?.hasAttachmentRelayUrlsInContent ?? false;
                // Fallback: if renderMeta is missing, parse payload directly from message.content
                // This ensures community invites are correctly identified even when renderMeta lookup fails
                const fallbackParsedPayload = (() => {
                    const parsed = parseMessagePayloadForRender(message.content);
                    if (parsed?.type === "community-invite"
                        || parsed?.type === "community-invite-response"
                        || parsed?.type === "voice-call-invite") {
                        return parsed;
                    }
                    return null;
                })();
                const isCommunityMessage = fallbackParsedPayload?.type === "community-invite" || fallbackParsedPayload?.type === "community-invite-response";
                const textContentResult = renderMeta?.textContentResult ?? (isCommunityMessage
                    ? { content: "", hasHiddenAttachmentRelayUrls: false } // Suppress raw JSON for community messages
                    : { content: message.content, hasHiddenAttachmentRelayUrls: false });
                const parsedPayload = renderMeta?.parsedPayload ?? fallbackParsedPayload;
                const voiceCallRoomSummary = (parsedPayload?.type === "voice-call-invite" && typeof parsedPayload.roomId === "string")
                    ? mergeVoiceCallRoomSummaries(voiceCallRoomSummaryByRoomId.get(parsedPayload.roomId) ?? null, nativeCallRecordSummaryByRoomId.get(parsedPayload.roomId) ?? null)
                    : null;
                const timeLabel = formatTime(message.timestamp, nowMs);
                return (<MemoizedMessageRow key={virtualItem.key} virtualIndex={virtualItem.index} virtualStart={virtualItem.start} measureElement={suspendDynamicMeasurement ? undefined : virtualizer.measureElement} message={message} admins={admins} timeLabel={timeLabel} nowUnixMs={nowMs} isGroupStart={isGroupStart} isGroupEnd={isGroupEnd} isMiddle={isMiddle} highLoadMode={highLoadMode} chatUxV083Enabled={chatUxV083Enabled} isFlashing={!!flashMessageId && messageMatchesSearchJumpTarget(message, flashMessageId)} attachmentUrlsExpanded={attachmentUrlsExpanded} hasVisualAttachments={hasVisualAttachments} hasAttachmentRelayUrlsInContent={hasAttachmentRelayUrlsInContent} textContent={textContentResult.content} parsedPayload={parsedPayload} voiceCallRoomSummary={voiceCallRoomSummary} localAttachmentUrlSet={localAttachmentUrlSet} localAttachmentFileNameByUrl={localAttachmentFileNameByUrl} inviteResponseStatus={resolvedInviteResponseStatusByMessageId.get(message.id)} conversationMessages={messages} onOpenReactionPicker={onOpenReactionPicker} onOpenMessageMenu={onOpenMessageMenu} isMessageMenuAnchored={openMessageMenuMessageId === message.id} isReactionPickerAnchored={openReactionPickerMessageId === message.id} batchDeleteMode={batchDeleteMode} isBatchSelected={selectedMessageIds.has(message.id)} onToggleSelectMessage={onToggleSelectMessage} onMessageMenuAnchorHoverChange={onMessageMenuAnchorHoverChange} onToggleReaction={onToggleReaction} onRetryMessage={onRetryMessage} onReply={onReply} onImageClick={onImageClick} onToggleAttachmentRelayUrls={toggleAttachmentRelayUrls} onSendDirectMessage={onSendDirectMessage} onJoinVoiceCallInvite={onJoinVoiceCallInvite} onRequestVoiceCallCallback={handleRequestVoiceCallCallback} usedVoiceCallCallbackRoomIds={usedVoiceCallCallbackRoomIds} joiningVoiceCallInviteMessageId={joiningVoiceCallInviteMessageId} voiceCallStatus={voiceCallStatus} compactThreadCards={compactThreadCards}/>);
            })}
                        </div>
                    </>)}
            </MessageListScrollViewport>

            <AnimatePresence>
                {showScrollBottom && (<motion.div initial={{ opacity: 0, y: 20, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.8 }} className={cn("absolute z-30", preferNativeTouchScroll ? "bottom-24 right-4" : "bottom-6 right-6")}>
                        <Button size="icon" variant="secondary" className="h-10 w-10 rounded-full shadow-2xl ring-1 ring-black/10 bg-white/95 dark:bg-zinc-800/95 backdrop-blur-md hover:scale-110 active:scale-95 transition-transform" onClick={() => {
                updateScrollMode("follow_bottom");
                hasUserUpwardScrollIntentRef.current = false;
                scrollToBottom("smooth");
            }}>
                            <ChevronDown className="h-5 w-5 text-purple-600 dark:text-purple-400"/>
                        </Button>
                        <div className="absolute -top-1 -right-1 h-3 w-3 bg-purple-500 rounded-full border-2 border-white dark:border-zinc-800 animate-pulse"/>
                    </motion.div>)}
            </AnimatePresence>
        </div>);
}
const messageListPropsAreEqual = (prev: MessageListProps, next: MessageListProps): boolean => {
    return (prev.conversationId === next.conversationId &&
        prev.hasHydrated === next.hasHydrated &&
        prev.messages === next.messages &&
        prev.renderMetaMessages === next.renderMetaMessages &&
        prev.inviteResponseStatusByMessageId === next.inviteResponseStatusByMessageId &&
        prev.rawMessagesCount === next.rawMessagesCount &&
        prev.hasEarlierMessages === next.hasEarlierMessages &&
        prev.onLoadEarlier === next.onLoadEarlier &&
        prev.nowMs === next.nowMs &&
        prev.flashMessageId === next.flashMessageId &&
        prev.jumpToMessageId === next.jumpToMessageId &&
        prev.jumpToMessageTimestampMs === next.jumpToMessageTimestampMs &&
        prev.onJumpToMessageHandled === next.onJumpToMessageHandled &&
        prev.onOpenMessageMenu === next.onOpenMessageMenu &&
        prev.openMessageMenuMessageId === next.openMessageMenuMessageId &&
        prev.openReactionPickerMessageId === next.openReactionPickerMessageId &&
        prev.batchDeleteMode === next.batchDeleteMode &&
        prev.selectedMessageIds === next.selectedMessageIds &&
        prev.onToggleSelectMessage === next.onToggleSelectMessage &&
        prev.onMessageMenuAnchorHoverChange === next.onMessageMenuAnchorHoverChange &&
        prev.onOpenReactionPicker === next.onOpenReactionPicker &&
        prev.onToggleReaction === next.onToggleReaction &&
        prev.onRetryMessage === next.onRetryMessage &&
        prev.onComposerFocus === next.onComposerFocus &&
        prev.onReply === next.onReply &&
        prev.onImageClick === next.onImageClick &&
        prev.isGroup === next.isGroup &&
        prev.admins === next.admins &&
        prev.pendingEventCount === next.pendingEventCount &&
        prev.onSendDirectMessage === next.onSendDirectMessage &&
        prev.onJoinVoiceCallInvite === next.onJoinVoiceCallInvite &&
        prev.onRequestVoiceCallCallback === next.onRequestVoiceCallCallback &&
        prev.joiningVoiceCallInviteMessageId === next.joiningVoiceCallInviteMessageId &&
        prev.voiceCallStatus === next.voiceCallStatus &&
        prev.onRefresh === next.onRefresh);
};
export const MessageList = React.memo(MessageListImpl, messageListPropsAreEqual);
MessageList.displayName = "MessageList";
type MessageRowProps = Readonly<{
    virtualIndex: number;
    virtualStart: number;
    measureElement?: (node: Element | null) => void;
    message: Message;
    admins?: ReadonlyArray<Readonly<{
        pubkey: string;
        roles: ReadonlyArray<string>;
    }>>;
    timeLabel: string;
    nowUnixMs: number | null;
    isGroupStart: boolean;
    isGroupEnd: boolean;
    isMiddle: boolean;
    highLoadMode: boolean;
    chatUxV083Enabled: boolean;
    isFlashing: boolean;
    attachmentUrlsExpanded: boolean;
    hasVisualAttachments: boolean;
    hasAttachmentRelayUrlsInContent: boolean;
    textContent: string;
    parsedPayload: ParsedMessagePayload | null;
    voiceCallRoomSummary: VoiceCallRoomRenderSummary | null;
    localAttachmentUrlSet: ReadonlySet<string>;
    localAttachmentFileNameByUrl: Readonly<Record<string, string>>;
    inviteResponseStatus?: InviteResponseStatus;
    conversationMessages?: ReadonlyArray<Message>;
    onOpenMessageMenu: (params: {
        messageId: string;
        x: number;
        y: number;
    }) => void;
    isMessageMenuAnchored: boolean;
    isReactionPickerAnchored: boolean;
    batchDeleteMode: boolean;
    isBatchSelected: boolean;
    onToggleSelectMessage?: (params: Readonly<{
        messageId: string;
        shiftKey: boolean;
    }>) => void;
    onMessageMenuAnchorHoverChange?: (params: {
        messageId: string;
        isHovered: boolean;
    }) => void;
    onOpenReactionPicker: (params: {
        messageId: string;
        x: number;
        y: number;
    }) => void;
    onToggleReaction: (message: Message, emoji: ReactionEmoji) => void;
    onRetryMessage: (message: Message) => void;
    onReply?: (message: Message) => void;
    onImageClick?: (url: string) => void;
    onToggleAttachmentRelayUrls: (messageId: string) => void;
    onSendDirectMessage?: (params: SendDirectMessageParams) => Promise<SendDirectMessageResult>;
    onJoinVoiceCallInvite?: (params: Readonly<{
        invite: VoiceCallInvitePayload;
        messageId: string;
    }>) => void;
    onRequestVoiceCallCallback?: (roomId: string | null) => void;
    usedVoiceCallCallbackRoomIds: ReadonlySet<string>;
    joiningVoiceCallInviteMessageId?: string | null;
    voiceCallStatus?: Readonly<{
        roomId: string;
        peerPubkey: string;
        phase: "ringing_outgoing" | "ringing_incoming" | "connecting" | "connected" | "interrupted" | "ended";
        reasonCode?: "left_by_user" | "remote_left" | "network_interrupted" | "session_closed";
    }> | null;
    compactThreadCards?: boolean;
}>;
const MemoizedMessageRow = React.memo(function MessageRow(props: MessageRowProps): React.JSX.Element {
    const { t } = useTranslation();
    const { state: identityState } = useIdentity();
    const localMemberPubkey = identityState.publicKeyHex ?? identityState.stored?.publicKeyHex ?? null;
    const { virtualIndex, virtualStart, measureElement, message, admins, timeLabel, nowUnixMs, isGroupStart, isGroupEnd, isMiddle, highLoadMode, chatUxV083Enabled, isFlashing, attachmentUrlsExpanded, hasVisualAttachments, hasAttachmentRelayUrlsInContent, textContent, parsedPayload, voiceCallRoomSummary, localAttachmentUrlSet, localAttachmentFileNameByUrl, inviteResponseStatus, conversationMessages = [], onOpenMessageMenu, isMessageMenuAnchored, isReactionPickerAnchored, batchDeleteMode, isBatchSelected, onToggleSelectMessage, onMessageMenuAnchorHoverChange, onOpenReactionPicker, onToggleReaction, onRetryMessage, onReply, onImageClick, onToggleAttachmentRelayUrls, onSendDirectMessage, onJoinVoiceCallInvite, onRequestVoiceCallCallback, usedVoiceCallCallbackRoomIds, joiningVoiceCallInviteMessageId, voiceCallStatus, compactThreadCards = false, } = props;
    const mobileCompact = useMobileCompactLayout();
    const preferNativeTouchScroll = usePreferNativeTouchScroll();
    const menuAnchoredToThisMessage = isMessageMenuAnchored;
    const reactionAnchoredToThisMessage = isReactionPickerAnchored;
    const [hoverDockVisible, setHoverDockVisible] = React.useState(false);
    const bubbleRef = React.useRef<HTMLDivElement | null>(null);
    const actionDockRef = React.useRef<HTMLDivElement | null>(null);
    const sustainHoverTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const hoverDockHideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const sustainHoverStartRef = React.useRef<Readonly<{
        x: number;
        y: number;
    }> | null>(null);
    const sustainHoverEngagedRef = React.useRef(false);
    const actionDockPinned = !batchDeleteMode && (menuAnchoredToThisMessage
        || reactionAnchoredToThisMessage
        || hoverDockVisible);
    const voiceCallInvitePayload = parsedPayload?.type === "voice-call-invite"
        ? (parsedPayload as VoiceCallInvitePayload)
        : null;
    const voiceCallInviteRoomId = typeof voiceCallInvitePayload?.roomId === "string"
        ? voiceCallInvitePayload.roomId
        : null;
    const isEmbeddedCommunityCard = (parsedPayload?.type === "community-invite"
        || parsedPayload?.type === "community-invite-response");
    const communityInviteViewerRole = React.useMemo(
        () => resolveCommunityInviteDisplayViewerRoleFromMessage(localMemberPubkey, message),
        [localMemberPubkey, message],
    );
    const isEmbeddedThreadCard = (isEmbeddedCommunityCard
        || parsedPayload?.type === "voice-call-invite");
    const renderedTextContent = compactThreadCards && textContent.trim().startsWith("{")
        ? (formatStructuredMessagePreview(textContent) ?? textContent)
        : textContent;
    const avatarPubkey = (message.senderPubkey?.trim()
        || (message.isOutgoing ? localMemberPubkey : null)
        || "");
    const markMenuAnchorHover = React.useCallback((isHovered: boolean): void => {
        onMessageMenuAnchorHoverChange?.({ messageId: message.id, isHovered });
    }, [message.id, onMessageMenuAnchorHoverChange]);
    const handleOpenMessageMenu = React.useCallback((clientX: number, clientY: number): void => {
        if (batchDeleteMode) {
            return;
        }
        if (hoverDockHideTimerRef.current !== null) {
            clearTimeout(hoverDockHideTimerRef.current);
            hoverDockHideTimerRef.current = null;
        }
        setHoverDockVisible(true);
        markMenuAnchorHover(true);
        onOpenMessageMenu({ messageId: message.id, x: clientX, y: clientY });
    }, [batchDeleteMode, markMenuAnchorHover, message.id, onOpenMessageMenu]);
    const clearSustainHoverTimer = React.useCallback((): void => {
        if (sustainHoverTimerRef.current !== null) {
            clearTimeout(sustainHoverTimerRef.current);
            sustainHoverTimerRef.current = null;
        }
    }, []);
    const clearHoverDockHideTimer = React.useCallback((): void => {
        if (hoverDockHideTimerRef.current !== null) {
            clearTimeout(hoverDockHideTimerRef.current);
            hoverDockHideTimerRef.current = null;
        }
    }, []);
    const showHoverDock = React.useCallback((): void => {
        clearHoverDockHideTimer();
        setHoverDockVisible(true);
    }, [clearHoverDockHideTimer]);
    const scheduleHoverDockHide = React.useCallback((): void => {
        clearHoverDockHideTimer();
        hoverDockHideTimerRef.current = setTimeout(() => {
            hoverDockHideTimerRef.current = null;
            setHoverDockVisible(false);
        }, MESSAGE_BUBBLE_ACTION_DOCK_HIDE_DELAY_MS);
    }, [clearHoverDockHideTimer]);
    const handleBubblePointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
        if (batchDeleteMode || !preferNativeTouchScroll || event.pointerType !== "touch") {
            return;
        }
        clearSustainHoverTimer();
        sustainHoverEngagedRef.current = false;
        sustainHoverStartRef.current = {
            x: event.clientX,
            y: event.clientY,
        };
        sustainHoverTimerRef.current = setTimeout(() => {
            sustainHoverTimerRef.current = null;
            sustainHoverEngagedRef.current = true;
            const start = sustainHoverStartRef.current;
            if (start) {
                handleOpenMessageMenu(start.x, start.y);
            } else {
                showHoverDock();
            }
        }, MESSAGE_BUBBLE_SUSTAIN_HOVER_DELAY_MS);
    }, [batchDeleteMode, clearSustainHoverTimer, handleOpenMessageMenu, preferNativeTouchScroll, showHoverDock]);
    const handleBubblePointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
        if (batchDeleteMode || !preferNativeTouchScroll || event.pointerType !== "touch") {
            return;
        }
        if (sustainHoverEngagedRef.current) {
            return;
        }
        const start = sustainHoverStartRef.current;
        if (!start) {
            return;
        }
        if (shouldCancelMessageBubbleSustainHover({
            startX: start.x,
            startY: start.y,
            currentX: event.clientX,
            currentY: event.clientY,
        })) {
            clearSustainHoverTimer();
            sustainHoverStartRef.current = null;
        }
    }, [batchDeleteMode, clearSustainHoverTimer, preferNativeTouchScroll]);
    const handleBubblePointerUp = React.useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
        if (!preferNativeTouchScroll || event.pointerType !== "touch") {
            return;
        }
        clearSustainHoverTimer();
        sustainHoverStartRef.current = null;
        if (sustainHoverEngagedRef.current) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, [clearSustainHoverTimer, preferNativeTouchScroll]);
    const handleBubblePointerLeave = React.useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
        if (!preferNativeTouchScroll || event.pointerType !== "touch") {
            return;
        }
        if (sustainHoverEngagedRef.current) {
            return;
        }
        clearSustainHoverTimer();
        sustainHoverStartRef.current = null;
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && actionDockRef.current?.contains(nextTarget)) {
            return;
        }
        scheduleHoverDockHide();
    }, [clearSustainHoverTimer, preferNativeTouchScroll, scheduleHoverDockHide]);
    const handleBubbleMouseEnter = React.useCallback((): void => {
        showHoverDock();
        if (menuAnchoredToThisMessage) {
            markMenuAnchorHover(true);
        }
    }, [markMenuAnchorHover, menuAnchoredToThisMessage, showHoverDock]);
    const handleBubbleMouseLeave = React.useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
        if (menuAnchoredToThisMessage) {
            markMenuAnchorHover(false);
        }
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && actionDockRef.current?.contains(nextTarget)) {
            return;
        }
        scheduleHoverDockHide();
    }, [markMenuAnchorHover, menuAnchoredToThisMessage, scheduleHoverDockHide]);
    const handleActionDockMouseEnter = React.useCallback((): void => {
        showHoverDock();
        if (menuAnchoredToThisMessage) {
            markMenuAnchorHover(true);
        }
    }, [markMenuAnchorHover, menuAnchoredToThisMessage, showHoverDock]);
    const handleActionDockMouseLeave = React.useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && bubbleRef.current?.contains(nextTarget)) {
            return;
        }
        scheduleHoverDockHide();
    }, [scheduleHoverDockHide]);
    React.useEffect(() => {
        if (!preferNativeTouchScroll || !hoverDockVisible || typeof window === "undefined") {
            return;
        }
        const handlePointerDown = (event: PointerEvent): void => {
            const target = event.target;
            if (!(target instanceof Node)) {
                sustainHoverEngagedRef.current = false;
                setHoverDockVisible(false);
                return;
            }
            if (bubbleRef.current?.contains(target) || actionDockRef.current?.contains(target)) {
                return;
            }
            sustainHoverEngagedRef.current = false;
            setHoverDockVisible(false);
        };
        window.addEventListener("pointerdown", handlePointerDown, { capture: true });
        return () => {
            window.removeEventListener("pointerdown", handlePointerDown, { capture: true });
        };
    }, [hoverDockVisible, preferNativeTouchScroll]);
    React.useEffect(() => {
        if (!batchDeleteMode) {
            return;
        }
        clearHoverDockHideTimer();
        clearSustainHoverTimer();
        sustainHoverEngagedRef.current = false;
        setHoverDockVisible(false);
    }, [batchDeleteMode, clearHoverDockHideTimer, clearSustainHoverTimer]);
    React.useEffect(() => {
        return () => {
            clearSustainHoverTimer();
            clearHoverDockHideTimer();
        };
    }, [clearHoverDockHideTimer, clearSustainHoverTimer]);
    if (parsedPayload?.type === "voice-call-signal") {
        return (<div data-index={virtualIndex} ref={measureElement} style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualStart}px)`,
            }} className="hidden" aria-hidden="true"/>);
    }
    return (<div data-index={virtualIndex} ref={measureElement} style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${virtualStart}px)`,
        }} className={cn("flex relative items-end gap-2 w-full", message.isOutgoing ? "flex-row-reverse" : "flex-row", isGroupEnd ? "pb-8" : "pb-3")}>
            <div className="w-8 flex-shrink-0 flex justify-center">
                {isGroupEnd && avatarPubkey ? (<UserAvatar pubkey={avatarPubkey} metadataLive={false} size="sm" className="h-8 w-8 ring-1 ring-black/5 dark:ring-white/5 shadow-sm rounded-full"/>) : null}
            </div>

            {batchDeleteMode ? (<div className="w-8 flex-shrink-0 flex items-center justify-center">
                    <button type="button" onClick={(event) => onToggleSelectMessage?.({
                messageId: message.id,
                shiftKey: event.shiftKey,
            })} className={cn("flex h-6 w-6 items-center justify-center rounded-full border transition-colors", isBatchSelected
                ? "border-purple-500 bg-purple-500 text-white dark:border-purple-300 dark:bg-purple-300 dark:text-zinc-900"
                : "border-zinc-300 bg-white text-transparent hover:border-purple-400 hover:text-purple-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-purple-300 dark:hover:text-purple-300")} aria-label={isBatchSelected ? t("common.deselect") : t("common.select")}>
                        <Check className="h-3.5 w-3.5"/>
                    </button>
                </div>) : null}

            <SwipeReplyWrapper message={message} onReply={onReply} isOutgoing={message.isOutgoing} enableSwipeReply={!highLoadMode && !batchDeleteMode}>
                <div className={cn("flex min-w-0 flex-col w-full", message.isOutgoing ? "items-end" : "items-start")}>
                    {isGroupStart && (<div className={cn("flex items-center gap-2 mb-1 px-1", message.isOutgoing ? "flex-row-reverse" : "flex-row")}>
                            {!message.isOutgoing ? (<SenderName pubkey={message.senderPubkey!} admins={admins}/>) : (<span className="text-[10px] font-black uppercase tracking-widest opacity-40">
                                    {t("common.you")}
                                </span>)}
                        </div>)}

                    <div ref={bubbleRef} id={`msg-${message.id}`} onContextMenu={(e) => {
            e.preventDefault();
            if (batchDeleteMode) {
                return;
            }
            handleOpenMessageMenu(e.clientX, e.clientY);
        }} onClickCapture={(event) => {
            if (!batchDeleteMode) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            onToggleSelectMessage?.({
                messageId: message.id,
                shiftKey: event.shiftKey,
            });
        }} onMouseEnter={() => {
            if (!batchDeleteMode && !preferNativeTouchScroll) {
                handleBubbleMouseEnter();
            }
        }} onMouseLeave={(event) => {
            if (!batchDeleteMode && !preferNativeTouchScroll) {
                handleBubbleMouseLeave(event);
            }
        }} onPointerDown={handleBubblePointerDown} onPointerMove={handleBubblePointerMove} onPointerUp={handleBubblePointerUp} onPointerCancel={handleBubblePointerUp} onPointerLeave={handleBubblePointerLeave} style={{ touchAction: preferNativeTouchScroll ? "manipulation" : undefined }} className={cn("relative min-w-0 group", highLoadMode ? "transition-none" : "transition-all duration-200", mobileCompact && actionDockPinned && "mb-11", compactThreadCards && isEmbeddedThreadCard
            ? "max-w-full w-full"
            : "max-w-[90%] sm:max-w-[80%]", hasVisualAttachments && !(compactThreadCards && isEmbeddedThreadCard) && "min-w-[300px] sm:min-w-[420px] max-w-[95%] sm:max-w-[88%]", isEmbeddedThreadCard
            ? "bg-transparent border-0 shadow-none text-inherit"
            : message.isOutgoing
                ? "bg-gradient-to-tr from-purple-600 to-indigo-500 text-white shadow-md shadow-purple-500/20 dark:from-zinc-100 dark:to-zinc-200 dark:text-zinc-900 dark:shadow-none"
                : "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 shadow-sm border border-black/5 dark:border-white/[0.03]", message.isOutgoing
            ? cn("rounded-[20px]", isGroupStart && isGroupEnd ? "rounded-br-md" : "", isGroupStart && !isGroupEnd ? "rounded-br-md rounded-bl-[20px]" : "", !isGroupStart && isGroupEnd ? "rounded-tr-md rounded-br-md" : "", isMiddle ? "rounded-tr-md rounded-br-md" : "")
            : cn("rounded-[20px]", isGroupStart && isGroupEnd ? "rounded-bl-md" : "", isGroupStart && !isGroupEnd ? "rounded-bl-md rounded-br-[20px]" : "", !isGroupStart && isGroupEnd ? "rounded-tl-md rounded-bl-md" : "", isMiddle ? "rounded-tl-md rounded-bl-md" : ""), isBatchSelected && "ring-2 ring-purple-400/45 dark:ring-purple-300/45", isFlashing && "ring-4 ring-purple-500/20 dark:ring-purple-400/20 animate-pulse")}>
                        {!batchDeleteMode ? (<div ref={actionDockRef} data-testid={`message-action-dock-${message.id}`} data-visible={actionDockPinned ? "true" : "false"} onMouseEnter={handleActionDockMouseEnter} onMouseLeave={handleActionDockMouseLeave} className={cn("absolute z-20 flex gap-1.5 transition-all duration-150", mobileCompact
                ? cn("top-full mt-1.5 left-0 right-0 flex-row", message.isOutgoing ? "justify-end" : "justify-start")
                : cn("top-1 flex-col", message.isOutgoing ? "-left-12" : "-right-12"), actionDockPinned
                ? "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto")}>
                                <Button variant="ghost" size="icon" aria-label={t("messaging.openReactionPicker")} className={cn("h-8 w-8 rounded-full bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm shadow-sm ring-1 ring-black/5 dark:ring-white/5 hover:scale-110 transition-transform", reactionAnchoredToThisMessage && "ring-2 ring-purple-500/50 bg-white dark:bg-zinc-900")} onClick={(e) => {
                showHoverDock();
                onOpenReactionPicker({ messageId: message.id, x: e.clientX, y: e.clientY });
            }}>
                                    <Smile className="h-4 w-4"/>
                                </Button>
                                <Button variant="ghost" size="icon" aria-label={t("messaging.openMessageMenu")} className={cn("h-8 w-8 rounded-full bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm shadow-sm ring-1 ring-black/5 dark:ring-white/5 hover:scale-110 transition-transform", menuAnchoredToThisMessage && "ring-2 ring-purple-500/50 bg-white dark:bg-zinc-900")} onClick={(e) => handleOpenMessageMenu(e.clientX, e.clientY)}>
                                    <MoreHorizontal className="h-4 w-4"/>
                                </Button>
                            </div>) : null}

                        <div className={cn("px-4 py-2.5", isEmbeddedThreadCard && "px-1.5 py-1")}>
                            {message.deletedAt ? (<div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">
                                    <X className="h-3 w-3"/> {t("messaging.messageDeleted")}
                                </div>) : (<>
                                    {message.replyTo && (<div className={cn("mb-2 rounded-xl border p-2.5 text-xs transition-colors cursor-pointer", message.isOutgoing ? "border-white/10 bg-white/5 hover:bg-white/10" : "border-black/5 bg-black/5 hover:bg-black/10")} onClick={() => {
                    const el = document.getElementById(`msg-${message.replyTo?.messageId}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-0.5 h-3 bg-purple-500 rounded-full"/>
                                                <span className="text-[10px] font-black uppercase tracking-widest opacity-50">{t("common.reply")}</span>
                                            </div>
                                            <div className="truncate opacity-80 italic">{message.replyTo.previewText}</div>
                                        </div>)}

                                    {!message.deletedAt && message.reactions && (<div className="absolute -bottom-3 left-2 flex flex-wrap gap-1 z-10">
                                            {(Object.entries(message.reactions) as ReadonlyArray<readonly [
                    ReactionEmoji,
                    number
                ]>)
                    .filter(([, count]) => count > 0)
                    .map(([emoji, count]) => (<button key={emoji} type="button" className={cn("rounded-full border px-2 py-1 text-sm font-bold flex items-center gap-1 shadow-sm transition-transform active:scale-90", message.isOutgoing
                        ? "border-white/20 bg-white/10 text-white dark:border-black/10 dark:bg-white dark:text-zinc-900"
                        : "border-black/5 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100")} onClick={() => onToggleReaction(message, emoji)}>
                                                        <span className="text-base">{emoji}</span>
                                                        <span className="opacity-70 text-[10px]">{count}</span>
                                                    </button>))}
                                        </div>)}

                                    {message.attachments && message.attachments.length > 0 ? (<MessageAttachmentLayout attachments={message.attachments} isOutgoing={message.isOutgoing} localAttachmentUrlSet={localAttachmentUrlSet} localAttachmentFileNameByUrl={localAttachmentFileNameByUrl} onImageClick={onImageClick} chatUxV083Enabled={chatUxV083Enabled}/>) : null}

                                    <div className="min-w-0 max-w-full text-[15px] leading-relaxed break-words [overflow-wrap:anywhere] [word-break:break-word]">
                                        {parsedPayload?.type === "community-invite" ? (<CommunityInviteCard invite={parsedPayload as any} viewerRole={communityInviteViewerRole} message={message} messages={conversationMessages} responseStatus={inviteResponseStatus} onSendDirectMessage={onSendDirectMessage} compact={compactThreadCards}/>) : parsedPayload?.type === "community-invite-response" ? (<CommunityInviteResponseCard response={parsedPayload as any} viewerRole={communityInviteViewerRole} compact={compactThreadCards}/>) : parsedPayload?.type === "voice-call-invite" ? (voiceCallInvitePayload ? (<VoiceCallInviteCard invite={voiceCallInvitePayload} isOutgoing={message.isOutgoing} compact={compactThreadCards} isJoining={joiningVoiceCallInviteMessageId === message.id} onJoinCall={onJoinVoiceCallInvite
                    ? (invite) => {
                        onJoinVoiceCallInvite({
                            invite,
                            messageId: message.id,
                        });
                    }
                    : undefined} onRequestCallback={voiceCallInviteRoomId
                    ? () => onRequestVoiceCallCallback?.(voiceCallInviteRoomId)
                    : undefined} callbackConsumed={voiceCallInviteRoomId
                    ? usedVoiceCallCallbackRoomIds.has(voiceCallInviteRoomId)
                    : false} callSummary={voiceCallRoomSummary} nowUnixMs={nowUnixMs} liveStatusPhase={voiceCallStatus?.roomId === voiceCallInviteRoomId
                    ? voiceCallStatus.phase
                    : null} liveReasonCode={voiceCallStatus?.roomId === voiceCallInviteRoomId
                    ? voiceCallStatus.reasonCode ?? null
                    : null}/>) : null) : (<>
                                                <MessageContent content={renderedTextContent} isOutgoing={message.isOutgoing}/>
                                                {renderedTextContent ? <MessageLinkPreview content={renderedTextContent} isOutgoing={message.isOutgoing}/> : null}
                                                {hasAttachmentRelayUrlsInContent ? (<button type="button" className={cn("mt-2 inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold tracking-wide transition-colors", message.isOutgoing
                        ? "border-white/25 bg-white/15 text-white hover:bg-white/25 dark:border-zinc-300 dark:bg-zinc-200 dark:text-zinc-800 dark:hover:bg-zinc-300"
                        : "border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700")} onClick={() => onToggleAttachmentRelayUrls(message.id)}>
                                                        {attachmentUrlsExpanded
                        ? t("messaging.hideRelayUrls")
                        : t("messaging.showRelayUrls")}
                                                    </button>) : null}
                                            </>)}
                                    </div>
                                </>)}

                            <div className={cn("mt-1.5 flex items-center justify-end gap-1.5 text-[10px] font-medium select-none", isEmbeddedCommunityCard
            ? "text-zinc-500 dark:text-zinc-400"
            : message.isOutgoing
                ? "text-white/60 dark:text-zinc-900/60"
                : "text-zinc-500 dark:text-zinc-500")}>
                                {timeLabel ? <span>{timeLabel}</span> : null}

                                {message.isOutgoing ? (<div className="flex items-center gap-1">
                                        {((): React.JSX.Element | null => {
                const uiByStatus: Readonly<Record<MessageStatus, StatusUi>> = {
                    sending: { label: t("messaging.status.sending"), icon: (p) => <Clock className={cn("animate-pulse", p.className)}/> },
                    accepted: { label: t("messaging.status.sent"), icon: (p) => <Check className={p.className}/> },
                    rejected: { label: t("messaging.status.failed"), icon: (p) => <AlertTriangle className={p.className}/> },
                    delivered: { label: t("messaging.status.delivered"), icon: (p) => <CheckCheck className={p.className}/> },
                    queued: { label: t("messaging.status.queued"), icon: (p) => <Clock className={p.className}/> },
                    failed: { label: t("messaging.status.failed"), icon: (p) => <AlertTriangle className={p.className}/> },
                };
                const ui = uiByStatus[message.status];
                const Icon = ui.icon;
                return <Icon className="h-3 w-3"/>;
            })()}
                                    </div>) : null}
                            </div>
                        </div>

                        {(message.status === "rejected" || message.status === "failed") ? (<div className={cn(mobileCompact
                ? "relative mt-2 flex justify-end"
                : "absolute -right-16 top-1/2 -translate-y-1/2")}>
                                <Button type="button" variant="secondary" size="sm" className="h-8 px-3 rounded-full bg-rose-500 text-white border-none text-[10px] font-bold" onClick={() => onRetryMessage(message)}>
                                    {t("common.retry")}
                                </Button>
                            </div>) : null}
                    </div>
                </div>
            </SwipeReplyWrapper>
        </div>);
}, (prev, next) => {
    return (prev.virtualStart === next.virtualStart &&
        prev.measureElement === next.measureElement &&
        prev.message === next.message &&
        prev.timeLabel === next.timeLabel &&
        prev.nowUnixMs === next.nowUnixMs &&
        prev.isGroupStart === next.isGroupStart &&
        prev.isGroupEnd === next.isGroupEnd &&
        prev.isMiddle === next.isMiddle &&
        prev.highLoadMode === next.highLoadMode &&
        prev.chatUxV083Enabled === next.chatUxV083Enabled &&
        prev.isFlashing === next.isFlashing &&
        prev.attachmentUrlsExpanded === next.attachmentUrlsExpanded &&
        prev.hasVisualAttachments === next.hasVisualAttachments &&
        prev.hasAttachmentRelayUrlsInContent === next.hasAttachmentRelayUrlsInContent &&
        prev.textContent === next.textContent &&
        prev.parsedPayload === next.parsedPayload &&
        prev.voiceCallRoomSummary === next.voiceCallRoomSummary &&
        prev.inviteResponseStatus === next.inviteResponseStatus &&
        prev.conversationMessages === next.conversationMessages &&
        prev.localAttachmentUrlSet === next.localAttachmentUrlSet &&
        prev.localAttachmentFileNameByUrl === next.localAttachmentFileNameByUrl &&
        prev.isMessageMenuAnchored === next.isMessageMenuAnchored &&
        prev.isReactionPickerAnchored === next.isReactionPickerAnchored &&
        prev.batchDeleteMode === next.batchDeleteMode &&
        prev.isBatchSelected === next.isBatchSelected &&
        prev.onToggleSelectMessage === next.onToggleSelectMessage &&
        prev.usedVoiceCallCallbackRoomIds === next.usedVoiceCallCallbackRoomIds &&
        prev.compactThreadCards === next.compactThreadCards &&
        prev.admins === next.admins);
});
function MessageAttachmentLayout({ attachments, isOutgoing, localAttachmentUrlSet, localAttachmentFileNameByUrl, onImageClick, chatUxV083Enabled }: {
    readonly attachments: ReadonlyArray<Attachment>;
    readonly isOutgoing: boolean;
    readonly localAttachmentUrlSet: ReadonlySet<string>;
    readonly localAttachmentFileNameByUrl: Readonly<Record<string, string>>;
    readonly onImageClick?: (url: string) => void;
    readonly chatUxV083Enabled: boolean;
}): React.JSX.Element {
    const { t } = useTranslation();
    const fileLabel = t("common.file");
    const { visualMedia, imageMedia, videoMedia, audios, others, } = React.useMemo(() => buildAttachmentBuckets(attachments), [attachments]);
    const { displayNameByUrl, hostByUrl, voiceNoteMetadataByUrl, } = React.useMemo(() => buildAttachmentPresentation({
        attachments,
        localAttachmentFileNameByUrl,
        fallbackFileLabel: fileLabel,
    }), [attachments, fileLabel, localAttachmentFileNameByUrl]);
    const [activeVisualIndex, setActiveVisualIndex] = React.useState(0);
    const [attachmentContextMenu, setAttachmentContextMenu] = React.useState<AttachmentContextMenuState>(null);
    const [savingAttachmentUrl, setSavingAttachmentUrl] = React.useState<string | null>(null);
    const touchStartXRef = React.useRef<number | null>(null);
    const skipNextVisualSwipeRef = React.useRef(false);
    const canSaveToVault = canSaveChatAttachmentsToLocalVault();
    const openAttachmentContextMenu = React.useCallback((params: NonNullable<AttachmentContextMenuState>): void => {
        skipNextVisualSwipeRef.current = true;
        setAttachmentContextMenu(params);
    }, []);
    const attachmentMenuProps = React.useCallback(
        (attachment: Attachment) => getAttachmentContextMenuTriggerProps(attachment, openAttachmentContextMenu),
        [openAttachmentContextMenu],
    );
    React.useEffect(() => {
        if (visualMedia.length === 0) {
            setActiveVisualIndex(0);
            return;
        }
        setActiveVisualIndex((prev) => Math.min(prev, visualMedia.length - 1));
    }, [visualMedia.length]);
    const goPrevVisual = React.useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (visualMedia.length <= 1)
            return;
        setActiveVisualIndex((prev) => prevMediaIndex(prev, visualMedia.length));
    }, [visualMedia.length]);
    const goNextVisual = React.useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (visualMedia.length <= 1)
            return;
        setActiveVisualIndex((prev) => nextMediaIndex(prev, visualMedia.length));
    }, [visualMedia.length]);
    const handleVisualKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (visualMedia.length <= 1)
            return;
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            goPrevVisual();
            return;
        }
        if (event.key === "ArrowRight") {
            event.preventDefault();
            goNextVisual();
        }
    }, [goNextVisual, goPrevVisual, visualMedia.length]);
    const activeVisual = visualMedia[activeVisualIndex];
    const imageGridClass = imageMedia.length <= 1
        ? "grid-cols-1"
        : imageMedia.length === 2
            ? "grid-cols-2"
            : "grid-cols-2 sm:grid-cols-3";
    const deriveDisplayFileName = (attachment: Attachment): string => displayNameByUrl[attachment.url] ?? fileLabel;
    const handleQuickSaveToVault = React.useCallback(async (
        event: React.MouseEvent<HTMLElement>,
        attachment: Attachment,
    ): Promise<void> => {
        event.preventDefault();
        event.stopPropagation();
        if (!canSaveToVault || localAttachmentUrlSet.has(attachment.url)) {
            return;
        }
        if (savingAttachmentUrl === attachment.url) {
            return;
        }
        setSavingAttachmentUrl(attachment.url);
        try {
            await saveChatAttachmentToLocalVault(attachment, t);
        } finally {
            setSavingAttachmentUrl((current) => (current === attachment.url ? null : current));
        }
    }, [canSaveToVault, localAttachmentUrlSet, savingAttachmentUrl, t]);
    return (<div className="mb-2 space-y-2 sm:mb-3 sm:space-y-3">
            {!chatUxV083Enabled && (<>
                    {imageMedia.length > 0 ? (<div className={cn("grid gap-1.5", imageGridClass)}>
                            {imageMedia.map((attachment, index) => (<div key={`legacy-img-${attachment.url}-${index}`} className={cn("relative overflow-hidden rounded-xl bg-black/5 dark:bg-white/5", imageMedia.length === 1 ? "aspect-video max-h-[520px]" : "aspect-square")} {...attachmentMenuProps(attachment)}>
                                    {localAttachmentUrlSet.has(attachment.url) ? (<div className="absolute top-2 left-2 z-10 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-emerald-500/90 text-black">
                                            Vault
                                        </div>) : null}
                                    {canSaveToVault && !localAttachmentUrlSet.has(attachment.url) ? (<button type="button" className="absolute right-2 top-2 z-10 rounded-md border border-white/15 bg-black/55 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-50" disabled={savingAttachmentUrl === attachment.url} onClick={(event) => { void handleQuickSaveToVault(event, attachment); }} title={t("vault.saveFromChat")} aria-label={t("vault.saveFromChat")}>
                                            <HardDrive className="h-3.5 w-3.5"/>
                                        </button>) : null}
                                    <OptimizedImage src={attachment.url} alt={attachment.fileName} containerClassName="h-full w-full" className="h-full w-full object-cover cursor-zoom-in hover:scale-[1.02] transition-transform duration-500" onClick={() => onImageClick?.(attachment.url)}/>
                                </div>))}
                        </div>) : null}
                    {videoMedia.length > 0 ? (<div className="space-y-2 sm:space-y-3">
                            {videoMedia.map((attachment, index) => (<div key={`legacy-vid-${attachment.url}-${index}`} className="relative overflow-hidden rounded-xl bg-black/5 dark:bg-white/5" {...attachmentMenuProps(attachment)}>
                                    {localAttachmentUrlSet.has(attachment.url) ? (<div className="absolute top-2 left-2 z-10 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-emerald-500/90 text-black">
                                            Vault
                                        </div>) : null}
                                    {canSaveToVault && !localAttachmentUrlSet.has(attachment.url) ? (<button type="button" className="absolute right-2 top-2 z-10 rounded-md border border-white/15 bg-black/55 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-50" disabled={savingAttachmentUrl === attachment.url} onClick={(event) => { void handleQuickSaveToVault(event, attachment); }} title={t("vault.saveFromChat")} aria-label={t("vault.saveFromChat")}>
                                            <HardDrive className="h-3.5 w-3.5"/>
                                        </button>) : null}
                                    <VideoPlayer src={attachment.url} isOutgoing={isOutgoing} className="w-full rounded-xl aspect-[16/10] sm:aspect-video"/>
                                </div>))}
                        </div>) : null}
                </>)}

            {chatUxV083Enabled && visualMedia.length > 0 && activeVisual ? (<div className="group relative overflow-hidden rounded-[24px] bg-zinc-950 shadow-[0_30px_60px_rgba(0,0,0,0.5)] ring-1 ring-white/10 inline-flex flex-col items-center justify-center max-w-full" tabIndex={visualMedia.length > 1 ? 0 : -1} onKeyDown={handleVisualKeyDown} {...attachmentMenuProps(activeVisual.attachment)} onTouchStart={(event) => {
                touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
            }} onTouchEnd={(event) => {
                if (skipNextVisualSwipeRef.current) {
                    skipNextVisualSwipeRef.current = false;
                    return;
                }
                if (visualMedia.length <= 1)
                    return;
                const touchStartX = touchStartXRef.current;
                const touchEndX = event.changedTouches[0]?.clientX ?? null;
                if (touchStartX === null || touchEndX === null)
                    return;
                const direction = detectSwipeDirection(touchEndX - touchStartX, 40);
                if (direction === "prev") {
                    goPrevVisual();
                }
                else if (direction === "next") {
                    goNextVisual();
                }
            }}>
                    {/* Ambient Glow */}
                    <div className="absolute -inset-10 bg-gradient-to-tr from-purple-600/20 via-transparent to-blue-600/20 blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none"/>

                    <AnimatePresence mode="wait">
                        <motion.div key={activeVisual.attachment.url} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2, ease: "easeInOut" }} className="w-full">
                            {activeVisual.kind === "image" ? (<div className="relative flex items-center justify-center bg-zinc-950 w-full" style={{ maxHeight: '480px' }}>
                                    <OptimizedImage src={activeVisual.attachment.url} alt={activeVisual.attachment.fileName} fill={false} containerClassName="overflow-hidden w-auto max-w-full flex items-center justify-center" className="w-auto h-auto max-w-full object-contain cursor-zoom-in group-hover:scale-[1.03] transition-transform duration-[1.5s]" style={{ maxHeight: '480px', maxWidth: '100%' }} onClick={() => onImageClick?.(activeVisual.attachment.url)}/>
                                </div>) : (<VideoPlayer src={activeVisual.attachment.url} isOutgoing={isOutgoing} className="w-full rounded-2xl aspect-[16/10] sm:aspect-video max-h-[62vh] sm:max-h-none"/>)}
                        </motion.div>
                    </AnimatePresence>

                    {/* Metadata Badges */}
                    <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 drop-shadow-lg">
                        <span className="rounded-lg bg-black/40 backdrop-blur-md px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white border border-white/10">
                            {activeVisual.kind}
                        </span>
                        {localAttachmentUrlSet.has(activeVisual.attachment.url) && (<span className="rounded-lg bg-emerald-500/80 backdrop-blur-md px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-black/90">
                                Vault
                            </span>)}
                    </div>
                    {canSaveToVault && !localAttachmentUrlSet.has(activeVisual.attachment.url) ? (<button type="button" className="absolute right-3 top-3 z-20 rounded-lg border border-white/15 bg-black/45 p-2 text-white backdrop-blur-md transition hover:bg-black/65 disabled:opacity-50" disabled={savingAttachmentUrl === activeVisual.attachment.url} onClick={(event) => { void handleQuickSaveToVault(event, activeVisual.attachment); }} title={t("vault.saveFromChat")} aria-label={t("vault.saveFromChat")}>
                            <HardDrive className="h-4 w-4"/>
                        </button>) : null}

                    {/* Navigation Overlays */}
                    {visualMedia.length > 1 && (<>
                            <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/20 to-transparent pointer-events-none opacity-0 hover:opacity-100 transition-opacity"/>
                            <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/20 to-transparent pointer-events-none opacity-0 hover:opacity-100 transition-opacity"/>

                            <button type="button" className="absolute left-3 top-1/2 z-20 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-full border border-white/10 bg-black/20 text-white backdrop-blur hover:bg-black/40 transition-all active:scale-95" onClick={goPrevVisual} aria-label="Previous media">
                                <ChevronLeft className="h-5 w-5"/>
                            </button>
                            <button type="button" className="absolute right-3 top-1/2 z-20 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-full border border-white/10 bg-black/20 text-white backdrop-blur hover:bg-black/40 transition-all active:scale-95" onClick={goNextVisual} aria-label="Next media">
                                <ChevronRight className="h-5 w-5"/>
                            </button>

                            <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1 text-[11px] font-black tracking-widest text-white/90 shadow-xl">
                                {activeVisualIndex + 1} <span className="opacity-40">/</span> {visualMedia.length}
                            </div>
                        </>)}
                </div>) : null}

            {audios.length > 0 && (<div className="space-y-2">
                    {audios.map((attachment, index) => ((() => {
                const voiceMetadata = voiceNoteMetadataByUrl[attachment.url] ?? null;
                const isVoiceNoteAttachment = voiceMetadata?.isVoiceNote || attachment.kind === "voice_note";
                if (isVoiceNoteAttachment) {
                    return (<div key={`voice-note-${attachment.url}-${index}`} {...attachmentMenuProps(attachment)}>
                            <VoiceNoteCard src={attachment.url} isOutgoing={isOutgoing} voiceNoteMetadata={voiceMetadata}/>
                        </div>);
                }
                return (<div key={`aud-${attachment.url}-${index}`} className={cn("rounded-xl border p-3 space-y-2", isOutgoing
                        ? "border-white/15 bg-white/10"
                        : "border-black/10 bg-zinc-50 dark:border-white/10 dark:bg-zinc-800/70")} {...attachmentMenuProps(attachment)}>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest", isOutgoing ? "bg-black/35 text-white" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100")}>
                                                    <Music2 className="h-2.5 w-2.5"/>
                                                    {t("common.audio")}
                                                </span>
                                                {localAttachmentUrlSet.has(attachment.url) ? (<span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-emerald-500/90 text-black">
                                                        Vault
                                                    </span>) : null}
                                            </div>
                                            <div className="mt-1 truncate text-xs font-bold">
                                                {deriveDisplayFileName(attachment)}
                                            </div>
                                            <div className="mt-0.5 truncate text-[10px] opacity-60">
                                                {hostByUrl[attachment.url] ?? attachment.url}
                                            </div>
                                        </div>
                                        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className={cn("h-8 w-8 shrink-0 rounded-lg border flex items-center justify-center transition-colors", isOutgoing
                        ? "border-white/20 hover:bg-white/10"
                        : "border-black/10 hover:bg-zinc-100 dark:border-white/10 dark:hover:bg-zinc-700/80")} aria-label={t("common.openInNewTab")}>
                                            <ExternalLink className="h-4 w-4"/>
                                        </a>
                                    </div>
                                    <AudioPlayer src={attachment.url} isOutgoing={isOutgoing} className="max-w-none min-w-0" voiceNoteMetadata={null}/>
                                </div>);
            })()))}
                </div>)}

            {others.length > 0 && (<div className="space-y-2">
                    {others.map((attachment, index) => (<a key={`file-${attachment.url}-${index}`} href={attachment.url} target="_blank" rel="noopener noreferrer" {...attachmentMenuProps(attachment)} className={cn("flex items-center gap-3 p-4 rounded-2xl transition-all duration-200 w-full group/file", isOutgoing
                    ? "bg-white/10 hover:bg-white/20 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100")}>
                            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", isOutgoing ? "bg-white/20" : "bg-purple-500 text-white")}>
                                <FileText className="h-5 w-5"/>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold truncate">{deriveDisplayFileName(attachment)}</div>
                                <div className="text-[10px] opacity-60 font-medium uppercase tracking-widest mt-0.5">{t("common.download")}</div>
                            </div>
                        </a>))}
                </div>)}
            <AttachmentContextMenu
                state={attachmentContextMenu}
                onClose={() => setAttachmentContextMenu(null)}
            />
        </div>);
}
/**
 * Sub-component to resolve and display sender name with badges
 */
function SenderName({ pubkey, admins }: {
    pubkey: string;
    admins?: MessageListProps['admins'];
}) {
    const metadata = useProfileMetadata(pubkey);
    const admin = admins?.find(a => a.pubkey === pubkey);
    const rolesLower = admin?.roles.map(r => r.toLowerCase()) || [];
    const isOwner = rolesLower.includes("owner") || rolesLower.includes("admin");
    const isMod = rolesLower.includes("moderator") || rolesLower.includes("mod");
    return (<div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-[11px] font-black text-purple-600 dark:text-purple-400 truncate max-w-[120px]">
                {metadata?.displayName || "Unknown sender"}
            </span>
            {(isOwner || isMod) && (<span className={cn("text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-[4px]", isOwner
                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300")}>
                    {isOwner ? "Owner" : "Mod"}
                </span>)}
        </div>);
}
function SwipeReplyWrapper({ message, onReply, isOutgoing, enableSwipeReply, children }: {
    message: Message;
    onReply?: (message: Message) => void;
    isOutgoing: boolean;
    enableSwipeReply: boolean;
    children: React.ReactNode;
}) {
    const x = useMotionValue(0);
    // When swiping right (x > 0), the icon appears on the left.
    const opacity = useTransform(x, [0, 60], [0, 1]);
    const scale = useTransform(x, [0, 60], [0.5, 1.2]);
    const handleDragEnd = () => {
        if (x.get() > 60) {
            onReply?.(message);
        }
        // Snap back
        x.set(0);
    };
    return (<div className="relative flex min-w-0 flex-1 w-full" style={{ justifyContent: isOutgoing ? 'flex-end' : 'flex-start' }}>
            {enableSwipeReply ? (<motion.div className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-600 dark:text-purple-400" style={{ opacity, scale }}>
                    <Reply className="h-6 w-6"/>
                </motion.div>) : null}
            <motion.div drag={enableSwipeReply ? "x" : false} dragConstraints={{ left: 0, right: 100 }} dragElastic={0.1} onDragEnd={enableSwipeReply ? handleDragEnd : undefined} style={{ x }} className="flex min-w-0 flex-1">
                <div className="flex min-w-0 flex-1" style={{ justifyContent: isOutgoing ? 'flex-end' : 'flex-start' }}>
                    {children}
                </div>
            </motion.div>
        </div>);
}
