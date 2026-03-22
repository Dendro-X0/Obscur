"use client";

import React from "react";
import { OptimizedImage } from "../../../components/optimized-image";
import { AlertTriangle, Check, CheckCheck, Clock, X, Reply, ChevronDown, RefreshCw, FileText, ExternalLink, Music2, ChevronLeft, ChevronRight, Smile, MoreHorizontal } from "lucide-react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Button } from "../../../components/ui/button";
import { EmptyState } from "../../../components/ui/empty-state";
import { MessageContent } from "../../../components/message-content";
import { MessageLinkPreview } from "../../../components/message-link-preview";
import { AudioPlayer } from "./audio-player";
import { VideoPlayer } from "./video-player";
import { cn } from "../../../lib/cn";
import { formatTime } from "../utils/formatting";
import type { Message, ReactionEmoji, MessageStatus, StatusUi, SendDirectMessageParams, SendDirectMessageResult, Attachment } from "../types";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { UserAvatar } from "../../profile/components/user-avatar";
import { useProfileMetadata } from "../../profile/hooks/use-profile-metadata";
import { CommunityInviteCard } from "../../groups/components/community-invite-card";
import { CommunityInviteResponseCard } from "../../groups/components/community-invite-response-card";
import { getLocalMediaIndexSnapshot } from "@/app/features/vault/services/local-media-store";
import { PrivacySettingsService } from "../../settings/services/privacy-settings-service";
import { detectSwipeDirection, nextMediaIndex, prevMediaIndex } from "./media-viewer-interactions";
import { isMessageListAwayFromBottom, isMessageListFastScroll } from "./message-list-scroll";
import { buildAttachmentBuckets, buildAttachmentPresentation } from "./message-attachment-layout";
import {
    buildMessageRenderCaches,
    type ParsedMessagePayload,
    type InviteResponseStatus,
} from "./message-list-render-meta";

interface MessageListProps {
    hasHydrated: boolean;
    messages: ReadonlyArray<Message>;
    rawMessagesCount: number; // to check if empty
    hasEarlierMessages: boolean;
    onLoadEarlier: () => void;
    nowMs: number | null;
    flashMessageId: string | null;
    jumpToMessageId?: string | null;
    onJumpToMessageHandled?: (messageId: string) => void;
    onOpenMessageMenu: (params: { messageId: string; x: number; y: number }) => void;
    openMessageMenuMessageId?: string | null;
    openReactionPickerMessageId?: string | null;
    onMessageMenuAnchorHoverChange?: (params: { messageId: string; isHovered: boolean }) => void;
    onOpenReactionPicker: (params: { messageId: string; x: number; y: number }) => void;
    onToggleReaction: (message: Message, emoji: ReactionEmoji) => void;
    onRetryMessage: (message: Message) => void;
    onComposerFocus: () => void;
    onReply?: (message: Message) => void;
    onImageClick?: (url: string) => void;
    isGroup?: boolean;
    admins?: ReadonlyArray<Readonly<{ pubkey: string; roles: ReadonlyArray<string> }>>;
    pendingEventCount?: number;
    onSendDirectMessage?: (params: SendDirectMessageParams) => Promise<SendDirectMessageResult>;
    onRefresh?: () => Promise<void>;
}

type MessageListScrollBehavior = "auto" | "smooth";

function MessageListImpl({
    hasHydrated,
    messages,
    rawMessagesCount,
    hasEarlierMessages,
    onLoadEarlier,
    nowMs,
    flashMessageId,
    jumpToMessageId,
    onJumpToMessageHandled,
    onOpenMessageMenu,
    openMessageMenuMessageId,
    openReactionPickerMessageId,
    onMessageMenuAnchorHoverChange,
    onOpenReactionPicker,
    onToggleReaction,
    onRetryMessage,
    onComposerFocus,
    onReply,
    onImageClick,
    admins,
    pendingEventCount = 0,
    onSendDirectMessage,
    onRefresh
}: MessageListProps) {
    const { t } = useTranslation();

    const parentRef = React.useRef<HTMLDivElement>(null);
    const [chatPerformanceV2Enabled, setChatPerformanceV2Enabled] = React.useState<boolean>(() => PrivacySettingsService.getSettings().chatPerformanceV2);
    const [chatUxV083Enabled, setChatUxV083Enabled] = React.useState<boolean>(() => PrivacySettingsService.getSettings().chatUxV083);
    const [fastScrollMode, setFastScrollMode] = React.useState(false);
    const fastScrollModeRef = React.useRef(false);
    const lastScrollTopRef = React.useRef(0);
    const lastScrollTsRef = React.useRef(0);
    const fastScrollTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollFrameRef = React.useRef<number | null>(null);
    const pendingScrollMetricsRef = React.useRef<Readonly<{ scrollTop: number; scrollHeight: number; clientHeight: number }> | null>(null);
    const showScrollBottomRef = React.useRef(false);

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

    const highLoadMode = chatPerformanceV2Enabled && (messages.length >= 100 || pendingEventCount >= 20 || fastScrollMode);
    const suspendDynamicMeasurement = chatPerformanceV2Enabled && fastScrollMode;
    const virtualizerOverscan = suspendDynamicMeasurement ? 2 : highLoadMode ? 4 : 8;

    const virtualizer = useVirtualizer({
        count: messages.length,
        getItemKey: (index) => messages[index]?.id ?? index,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 156,
        overscan: virtualizerOverscan,
    });

    const [showScrollBottom, setShowScrollBottom] = React.useState(false);
    const prevLastId = React.useRef<string | null>(null);
    const prevLength = React.useRef(0);
    const didInitialAutoScrollRef = React.useRef(false);
    const autoStickBottomUntilUnixMsRef = React.useRef<number>(0);

    const scrollToBottom = React.useCallback((behavior: MessageListScrollBehavior = "auto") => {
        if (messages.length === 0) {
            return;
        }

        const container = parentRef.current;
        if (!container) {
            return;
        }

        try {
            virtualizer.scrollToIndex(messages.length - 1, { align: "end", behavior });
        } catch {
            // Fallback to container anchoring below.
        }

        const scrollNow = (scrollBehavior: MessageListScrollBehavior) => {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: scrollBehavior,
            });
        };

        // Virtualizer index-scrolling is noisy with dynamic row heights; anchor by container offset instead.
        if (behavior === "smooth") {
            scrollNow("smooth");
            return;
        }

        scrollNow("auto");
        requestAnimationFrame(() => {
            const nextContainer = parentRef.current;
            if (!nextContainer) {
                return;
            }
            nextContainer.scrollTop = nextContainer.scrollHeight;
            requestAnimationFrame(() => {
                const settledContainer = parentRef.current;
                if (settledContainer) {
                    settledContainer.scrollTop = settledContainer.scrollHeight;
                }
            });
        });
    }, [messages.length, virtualizer]);

    const isNearBottom = React.useCallback((thresholdPx = 24): boolean => {
        const container = parentRef.current;
        if (!container) {
            return false;
        }
        return (container.scrollHeight - container.scrollTop - container.clientHeight) <= thresholdPx;
    }, []);

    React.useEffect(() => {
        if (messages.length === 0) {
            didInitialAutoScrollRef.current = false;
        }
    }, [messages.length]);

    React.useEffect(() => {
        if (!hasHydrated || messages.length === 0 || didInitialAutoScrollRef.current) {
            return;
        }
        didInitialAutoScrollRef.current = true;
        autoStickBottomUntilUnixMsRef.current = Date.now() + 3000;
        scrollToBottom("auto");

        // Virtualized rows can finish measuring after initial paint.
        // Retry a few frames so initial load reliably lands on latest messages.
        let attempts = 0;
        const settleToBottom = () => {
            attempts += 1;
            if (!isNearBottom() && attempts <= 8) {
                scrollToBottom("auto");
                requestAnimationFrame(settleToBottom);
            }
        };
        requestAnimationFrame(settleToBottom);
    }, [hasHydrated, isNearBottom, messages.length, scrollToBottom]);

    React.useEffect(() => {
        if (!hasHydrated || messages.length === 0) {
            return;
        }
        if (Date.now() > autoStickBottomUntilUnixMsRef.current) {
            return;
        }
        if (!isNearBottom()) {
            scrollToBottom("auto");
        }
    }, [hasHydrated, isNearBottom, messages.length, scrollToBottom]);

    // Scroll to bottom and anchoring logic
    React.useEffect(() => {
        if (hasHydrated && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const isNewMessage = lastMessage.id !== prevLastId.current;

            // Check if messages were prepended (e.g., from onLoadEarlier).
            // Guard against first-load false positives when previous length is zero.
            const isPrepended =
                prevLength.current > 0
                && messages.length > prevLength.current
                && messages[0].id !== prevFirstId.current;

            if (isPrepended && parentRef.current) {
                // Record the current scroll bottom position relative to the last message
                // This is a simple but effective scroll anchoring for pagination
                const container = parentRef.current;
                const oldHeight = container.scrollHeight;

                // We use a small delay to let the virtualizer finish its layout
                requestAnimationFrame(() => {
                    if (container) {
                        const newHeight = container.scrollHeight;
                        const heightDiff = newHeight - oldHeight;
                        if (heightDiff > 0) {
                            container.scrollTop += heightDiff;
                        }
                    }
                });
            } else if (isNewMessage) {
                // Scroll if:
                // 1. Initial load (prevLastId was null)
                // 2. We are already at the bottom
                // 3. It's our own message
                if (!prevLastId.current || !showScrollBottom || lastMessage.isOutgoing) {
                    scrollToBottom();
                }
            }

            prevLastId.current = lastMessage.id;
            prevFirstId.current = messages[0]?.id || null;
            prevLength.current = messages.length;
        }
    }, [hasHydrated, isNearBottom, messages, showScrollBottom, scrollToBottom]);

    const prevFirstId = React.useRef<string | null>(null);
    const jumpResolveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const jumpInFlightMessageIdRef = React.useRef<string | null>(null);

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
            return;
        }

        if (jumpInFlightMessageIdRef.current === jumpToMessageId) {
            return;
        }

        jumpInFlightMessageIdRef.current = jumpToMessageId;
        let attempts = 0;
        let cancelled = false;

        const settleJump = (): void => {
            if (cancelled) {
                return;
            }

            const target = document.getElementById(`msg-${jumpToMessageId}`);
            if (target) {
                target.scrollIntoView({ behavior: "smooth", block: "center" });
                onJumpToMessageHandled?.(jumpToMessageId);
                jumpInFlightMessageIdRef.current = null;
                return;
            }

            if (hasEarlierMessages && attempts < 12) {
                attempts += 1;
                onLoadEarlier();
                jumpResolveTimerRef.current = setTimeout(() => {
                    settleJump();
                }, 140);
                return;
            }

            onJumpToMessageHandled?.(jumpToMessageId);
            jumpInFlightMessageIdRef.current = null;
        };

        settleJump();

        return () => {
            cancelled = true;
            if (jumpResolveTimerRef.current) {
                clearTimeout(jumpResolveTimerRef.current);
                jumpResolveTimerRef.current = null;
            }
        };
    }, [hasEarlierMessages, jumpToMessageId, onJumpToMessageHandled, onLoadEarlier]);

    const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
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
            if (isAwayFromBottom) {
                // User intentionally moved away from newest messages; stop auto-stick.
                autoStickBottomUntilUnixMsRef.current = 0;
            }

            if (chatPerformanceV2Enabled) {
                const now = performance.now();
                const isFastScroll = isMessageListFastScroll({
                    previousScrollTop: lastScrollTopRef.current,
                    previousScrollTimestampMs: lastScrollTsRef.current,
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

                lastScrollTopRef.current = nextMetrics.scrollTop;
                lastScrollTsRef.current = now;
            }
        });
    }, [chatPerformanceV2Enabled]);

    const y = useMotionValue(0);
    const refreshOpacity = useTransform(y, [0, 80], [0, 1]);
    const refreshRotate = useTransform(y, [0, 80], [0, 180]);
    const refreshScale = useTransform(y, [0, 80], [0.5, 1]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const {
        localAttachmentUrlSet,
        localAttachmentFileNameByUrl,
    } = React.useMemo(() => {
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

    React.useEffect(() => {
        return () => {
            if (fastScrollTimeoutRef.current) {
                clearTimeout(fastScrollTimeoutRef.current);
            }
            if (scrollFrameRef.current !== null) {
                cancelAnimationFrame(scrollFrameRef.current);
                scrollFrameRef.current = null;
            }
            pendingScrollMetricsRef.current = null;
        };
    }, []);

    const handleDragEnd = async () => {
        if (y.get() > 80 && !isRefreshing && onRefresh) {
            setIsRefreshing(true);
            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
            }
        }
    };

    const toggleAttachmentRelayUrls = React.useCallback((messageId: string): void => {
        setExpandedRelayUrlsByMessageId((prev) => {
            const next = new Set(prev);
            if (next.has(messageId)) {
                next.delete(messageId);
            } else {
                next.add(messageId);
            }
            return next;
        });
    }, []);

    const {
        inviteResponseStatusByMessageId,
        renderMetaByMessageId,
    } = React.useMemo(() => buildMessageRenderCaches({
        messages,
        expandedRelayUrlsByMessageId,
    }), [expandedRelayUrlsByMessageId, messages]);

    return (
        <div className="flex-1 min-h-0 relative flex flex-col pt-1">
            <motion.div
                className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center h-10 w-10 bg-white dark:bg-zinc-800 rounded-full shadow-lg border border-black/5 dark:border-white/5"
                style={{
                    opacity: isRefreshing ? 1 : refreshOpacity,
                    scale: isRefreshing ? 1 : refreshScale,
                    y: isRefreshing ? 20 : y
                }}
            >
                <motion.div
                    animate={isRefreshing ? { rotate: 360 } : undefined}
                    transition={isRefreshing ? { repeat: Infinity, duration: 1, ease: "linear" } : undefined}
                    style={{ rotate: isRefreshing ? 0 : refreshRotate }}
                >
                    <RefreshCw className="h-5 w-5 text-purple-500" />
                </motion.div>
            </motion.div>

            <motion.div
                ref={parentRef}
                drag={onRefresh && !isRefreshing && !highLoadMode ? "y" : false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.5 }}
                onDragEnd={handleDragEnd}
                style={{ y: isRefreshing ? 20 : y }}
                className="flex-1 min-h-0 overflow-y-auto p-4 scrollbar-custom relative z-10"
                onScroll={handleScroll}
            >
                {!hasHydrated ? (
                    <div className="space-y-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                                <div className="h-10 w-56 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
                            </div>
                        ))}
                    </div>
                ) : rawMessagesCount === 0 ? (
                    <EmptyState
                        type="chats"
                        actions={[
                            {
                                label: t("messaging.writeAMessage"),
                                onClick: onComposerFocus,
                                variant: "primary"
                            }
                        ]}
                    />
                ) : (
                    <>
                        {hasEarlierMessages ? (
                            <div className="mb-4 flex justify-center">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={onLoadEarlier}
                                    data-testid="message-list-load-more"
                                >
                                    {t("messaging.loadMore", "Load More")}
                                </Button>
                            </div>
                        ) : null}
                        <div
                            style={{
                                height: `${virtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative',
                            }}
                        >
                            {virtualizer.getVirtualItems().map((virtualItem) => {
                                const message = messages[virtualItem.index];
                                const prevMessage = virtualItem.index > 0 ? messages[virtualItem.index - 1] : null;
                                const nextMessage = virtualItem.index < messages.length - 1 ? messages[virtualItem.index + 1] : null;

                                const isGroupStart = !prevMessage || prevMessage.isOutgoing !== message.isOutgoing || (message.timestamp.getTime() - prevMessage.timestamp.getTime() > 60000);
                                const isGroupEnd = !nextMessage || nextMessage.isOutgoing !== message.isOutgoing || (nextMessage.timestamp.getTime() - message.timestamp.getTime() > 60000);
                                const isMiddle = !isGroupStart && !isGroupEnd;
                                const renderMeta = renderMetaByMessageId.get(message.id);
                                const attachmentUrlsExpanded = renderMeta?.attachmentUrlsExpanded ?? false;
                                const hasVisualAttachments = renderMeta?.hasVisualAttachments ?? false;
                                const hasAttachmentRelayUrlsInContent = renderMeta?.hasAttachmentRelayUrlsInContent ?? false;
                                const textContentResult = renderMeta?.textContentResult ?? { content: message.content, hasHiddenAttachmentRelayUrls: false };
                                const parsedPayload = renderMeta?.parsedPayload ?? null;
                                const timeLabel = formatTime(message.timestamp, nowMs);

                                return (
                                    <MemoizedMessageRow
                                        key={virtualItem.key}
                                        virtualIndex={virtualItem.index}
                                        virtualStart={virtualItem.start}
                                        measureElement={suspendDynamicMeasurement ? undefined : virtualizer.measureElement}
                                        message={message}
                                        admins={admins}
                                        timeLabel={timeLabel}
                                        isGroupStart={isGroupStart}
                                        isGroupEnd={isGroupEnd}
                                        isMiddle={isMiddle}
                                        highLoadMode={highLoadMode}
                                        chatUxV083Enabled={chatUxV083Enabled}
                                        isFlashing={flashMessageId === message.id}
                                        attachmentUrlsExpanded={attachmentUrlsExpanded}
                                        hasVisualAttachments={hasVisualAttachments}
                                        hasAttachmentRelayUrlsInContent={hasAttachmentRelayUrlsInContent}
                                        textContent={textContentResult.content}
                                        parsedPayload={parsedPayload}
                                        localAttachmentUrlSet={localAttachmentUrlSet}
                                        localAttachmentFileNameByUrl={localAttachmentFileNameByUrl}
                                        inviteResponseStatus={inviteResponseStatusByMessageId.get(message.id)}
                                        onOpenReactionPicker={onOpenReactionPicker}
                                        onOpenMessageMenu={onOpenMessageMenu}
                                        isMessageMenuAnchored={openMessageMenuMessageId === message.id}
                                        isReactionPickerAnchored={openReactionPickerMessageId === message.id}
                                        onMessageMenuAnchorHoverChange={onMessageMenuAnchorHoverChange}
                                        onToggleReaction={onToggleReaction}
                                        onRetryMessage={onRetryMessage}
                                        onReply={onReply}
                                        onImageClick={onImageClick}
                                        onToggleAttachmentRelayUrls={toggleAttachmentRelayUrls}
                                        onSendDirectMessage={onSendDirectMessage}
                                    />
                                );
                            })}
                        </div>
                    </>
                )}
            </motion.div>

            <AnimatePresence>
                {showScrollBottom && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.8 }}
                        className="absolute bottom-6 right-6 z-30"
                    >
                        <Button
                            size="icon"
                            variant="secondary"
                            className="h-10 w-10 rounded-full shadow-2xl ring-1 ring-black/10 bg-white/95 dark:bg-zinc-800/95 backdrop-blur-md hover:scale-110 active:scale-95 transition-transform"
                            onClick={() => scrollToBottom('smooth')}
                        >
                            <ChevronDown className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </Button>
                        <div className="absolute -top-1 -right-1 h-3 w-3 bg-purple-500 rounded-full border-2 border-white dark:border-zinc-800 animate-pulse" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

const messageListPropsAreEqual = (prev: MessageListProps, next: MessageListProps): boolean => {
    return (
        prev.hasHydrated === next.hasHydrated &&
        prev.messages === next.messages &&
        prev.rawMessagesCount === next.rawMessagesCount &&
        prev.hasEarlierMessages === next.hasEarlierMessages &&
        prev.onLoadEarlier === next.onLoadEarlier &&
        prev.nowMs === next.nowMs &&
        prev.flashMessageId === next.flashMessageId &&
        prev.jumpToMessageId === next.jumpToMessageId &&
        prev.onJumpToMessageHandled === next.onJumpToMessageHandled &&
        prev.onOpenMessageMenu === next.onOpenMessageMenu &&
        prev.openMessageMenuMessageId === next.openMessageMenuMessageId &&
        prev.openReactionPickerMessageId === next.openReactionPickerMessageId &&
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
        prev.onRefresh === next.onRefresh
    );
};

export const MessageList = React.memo(MessageListImpl, messageListPropsAreEqual);
MessageList.displayName = "MessageList";

type MessageRowProps = Readonly<{
    virtualIndex: number;
    virtualStart: number;
    measureElement?: (node: Element | null) => void;
    message: Message;
    admins?: ReadonlyArray<Readonly<{ pubkey: string; roles: ReadonlyArray<string> }>>;
    timeLabel: string;
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
    localAttachmentUrlSet: ReadonlySet<string>;
    localAttachmentFileNameByUrl: Readonly<Record<string, string>>;
    inviteResponseStatus?: InviteResponseStatus;
    onOpenMessageMenu: (params: { messageId: string; x: number; y: number }) => void;
    isMessageMenuAnchored: boolean;
    isReactionPickerAnchored: boolean;
    onMessageMenuAnchorHoverChange?: (params: { messageId: string; isHovered: boolean }) => void;
    onOpenReactionPicker: (params: { messageId: string; x: number; y: number }) => void;
    onToggleReaction: (message: Message, emoji: ReactionEmoji) => void;
    onRetryMessage: (message: Message) => void;
    onReply?: (message: Message) => void;
    onImageClick?: (url: string) => void;
    onToggleAttachmentRelayUrls: (messageId: string) => void;
    onSendDirectMessage?: (params: SendDirectMessageParams) => Promise<SendDirectMessageResult>;
}>;

const MemoizedMessageRow = React.memo(function MessageRow(props: MessageRowProps): React.JSX.Element {
    const { t } = useTranslation();
    const {
        virtualIndex,
        virtualStart,
        measureElement,
        message,
        admins,
        timeLabel,
        isGroupStart,
        isGroupEnd,
        isMiddle,
        highLoadMode,
        chatUxV083Enabled,
        isFlashing,
        attachmentUrlsExpanded,
        hasVisualAttachments,
        hasAttachmentRelayUrlsInContent,
        textContent,
        parsedPayload,
        localAttachmentUrlSet,
        localAttachmentFileNameByUrl,
        inviteResponseStatus,
        onOpenMessageMenu,
        isMessageMenuAnchored,
        isReactionPickerAnchored,
        onMessageMenuAnchorHoverChange,
        onOpenReactionPicker,
        onToggleReaction,
        onRetryMessage,
        onReply,
        onImageClick,
        onToggleAttachmentRelayUrls,
        onSendDirectMessage,
    } = props;
    const menuAnchoredToThisMessage = isMessageMenuAnchored;
    const reactionAnchoredToThisMessage = isReactionPickerAnchored;
    const actionDockPinned = menuAnchoredToThisMessage || reactionAnchoredToThisMessage;

    const markMenuAnchorHover = React.useCallback((isHovered: boolean): void => {
        onMessageMenuAnchorHoverChange?.({ messageId: message.id, isHovered });
    }, [message.id, onMessageMenuAnchorHoverChange]);

    const handleOpenMessageMenu = React.useCallback((clientX: number, clientY: number): void => {
        markMenuAnchorHover(true);
        onOpenMessageMenu({ messageId: message.id, x: clientX, y: clientY });
    }, [markMenuAnchorHover, message.id, onOpenMessageMenu]);

    return (
        <div
            data-index={virtualIndex}
            ref={measureElement}
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualStart}px)`,
            }}
            className={cn(
                "flex relative items-end gap-2 w-full",
                message.isOutgoing ? "flex-row-reverse" : "flex-row",
                isGroupEnd ? "pb-8" : "pb-3"
            )}
        >
            <div className="w-8 flex-shrink-0 flex justify-center">
                {isGroupEnd && (
                    <UserAvatar
                        pubkey={message.senderPubkey!}
                        metadataLive={false}
                        size="sm"
                        className="h-8 w-8 ring-1 ring-black/5 dark:ring-white/5 shadow-sm rounded-full"
                    />
                )}
            </div>

            <SwipeReplyWrapper
                message={message}
                onReply={onReply}
                isOutgoing={message.isOutgoing}
                enableSwipeReply={!highLoadMode}
            >
                <div className={cn("flex flex-col w-full", message.isOutgoing ? "items-end" : "items-start")}>
                    {isGroupStart && (
                        <div className={cn("flex items-center gap-2 mb-1 px-1", message.isOutgoing ? "flex-row-reverse" : "flex-row")}>
                            {!message.isOutgoing ? (
                                <SenderName pubkey={message.senderPubkey!} admins={admins} />
                            ) : (
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">
                                    {t("common.you", "You")}
                                </span>
                            )}
                        </div>
                    )}

                    <div
                        id={`msg-${message.id}`}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            handleOpenMessageMenu(e.clientX, e.clientY);
                        }}
                        onMouseEnter={() => {
                            if (menuAnchoredToThisMessage) {
                                markMenuAnchorHover(true);
                            }
                        }}
                        onMouseLeave={() => {
                            if (menuAnchoredToThisMessage) {
                                markMenuAnchorHover(false);
                            }
                        }}
                        className={cn(
                            "relative max-w-[90%] sm:max-w-[80%] group",
                            highLoadMode ? "transition-none" : "transition-all duration-200",
                            hasVisualAttachments && "min-w-[300px] sm:min-w-[420px] max-w-[95%] sm:max-w-[88%]",
                            message.isOutgoing
                                ? "bg-gradient-to-tr from-purple-600 to-indigo-500 text-white shadow-md shadow-purple-500/20 dark:from-zinc-100 dark:to-zinc-200 dark:text-zinc-900 dark:shadow-none"
                                : "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 shadow-sm border border-black/5 dark:border-white/[0.03]",
                            message.isOutgoing
                                ? cn(
                                    "rounded-[20px]",
                                    isGroupStart && isGroupEnd ? "rounded-br-md" : "",
                                    isGroupStart && !isGroupEnd ? "rounded-br-md rounded-bl-[20px]" : "",
                                    !isGroupStart && isGroupEnd ? "rounded-tr-md rounded-br-md" : "",
                                    isMiddle ? "rounded-tr-md rounded-br-md" : ""
                                )
                                : cn(
                                    "rounded-[20px]",
                                    isGroupStart && isGroupEnd ? "rounded-bl-md" : "",
                                    isGroupStart && !isGroupEnd ? "rounded-bl-md rounded-br-[20px]" : "",
                                    !isGroupStart && isGroupEnd ? "rounded-tl-md rounded-bl-md" : "",
                                    isMiddle ? "rounded-tl-md rounded-bl-md" : ""
                                ),
                            isFlashing && "ring-4 ring-purple-500/20 dark:ring-purple-400/20 animate-pulse"
                        )}
                    >
                        <div
                            className={cn(
                                "absolute z-20 top-1 flex flex-col gap-1.5 transition-all duration-150",
                                actionDockPinned
                                    ? "opacity-100 translate-y-0"
                                    : "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0",
                                message.isOutgoing ? "-left-12" : "-right-12",
                            )}
                        >
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-8 w-8 rounded-full bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm shadow-sm ring-1 ring-black/5 dark:ring-white/5 hover:scale-110 transition-transform",
                                    reactionAnchoredToThisMessage && "ring-2 ring-purple-500/50 bg-white dark:bg-zinc-900",
                                )}
                                onClick={(e) => onOpenReactionPicker({ messageId: message.id, x: e.clientX, y: e.clientY })}
                            >
                                <Smile className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-8 w-8 rounded-full bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm shadow-sm ring-1 ring-black/5 dark:ring-white/5 hover:scale-110 transition-transform",
                                    menuAnchoredToThisMessage && "ring-2 ring-purple-500/50 bg-white dark:bg-zinc-900",
                                )}
                                onClick={(e) => handleOpenMessageMenu(e.clientX, e.clientY)}
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="px-4 py-2.5">
                            {message.deletedAt ? (
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">
                                    <X className="h-3 w-3" /> {t("messaging.messageDeleted")}
                                </div>
                            ) : (
                                <>
                                    {message.replyTo && (
                                        <div
                                            className={cn(
                                                "mb-2 rounded-xl border p-2.5 text-xs transition-colors cursor-pointer",
                                                message.isOutgoing ? "border-white/10 bg-white/5 hover:bg-white/10" : "border-black/5 bg-black/5 hover:bg-black/10"
                                            )}
                                            onClick={() => {
                                                const el = document.getElementById(`msg-${message.replyTo?.messageId}`);
                                                el?.scrollIntoView({ behavior: "smooth", block: "center" });
                                            }}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-0.5 h-3 bg-purple-500 rounded-full" />
                                                <span className="text-[10px] font-black uppercase tracking-widest opacity-50">{t("common.reply")}</span>
                                            </div>
                                            <div className="truncate opacity-80 italic">{message.replyTo.previewText}</div>
                                        </div>
                                    )}

                                    {!message.deletedAt && message.reactions && (
                                        <div className="absolute -bottom-3 left-2 flex flex-wrap gap-1 z-10">
                                            {(Object.entries(message.reactions) as ReadonlyArray<readonly [ReactionEmoji, number]>)
                                                .filter(([, count]) => count > 0)
                                                .map(([emoji, count]) => (
                                                    <button
                                                        key={emoji}
                                                        type="button"
                                                        className={cn(
                                                            "rounded-full border px-2 py-1 text-sm font-bold flex items-center gap-1 shadow-sm transition-transform active:scale-90",
                                                            message.isOutgoing
                                                                ? "border-white/20 bg-white/10 text-white dark:border-black/10 dark:bg-white dark:text-zinc-900"
                                                                : "border-black/5 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100"
                                                        )}
                                                        onClick={() => onToggleReaction(message, emoji)}
                                                    >
                                                        <span className="text-base">{emoji}</span>
                                                        <span className="opacity-70 text-[10px]">{count}</span>
                                                    </button>
                                                ))}
                                        </div>
                                    )}

                                    {message.attachments && message.attachments.length > 0 ? (
                                        <MessageAttachmentLayout
                                            attachments={message.attachments}
                                            isOutgoing={message.isOutgoing}
                                            localAttachmentUrlSet={localAttachmentUrlSet}
                                            localAttachmentFileNameByUrl={localAttachmentFileNameByUrl}
                                            onImageClick={onImageClick}
                                            chatUxV083Enabled={chatUxV083Enabled}
                                        />
                                    ) : null}

                                    <div className="text-[15px] leading-relaxed break-words">
                                        {parsedPayload?.type === "community-invite" ? (
                                            <CommunityInviteCard
                                                invite={parsedPayload as any}
                                                isOutgoing={message.isOutgoing}
                                                message={message}
                                                responseStatus={inviteResponseStatus}
                                                onSendDirectMessage={onSendDirectMessage}
                                            />
                                        ) : parsedPayload?.type === "community-invite-response" ? (
                                            <CommunityInviteResponseCard
                                                response={parsedPayload as any}
                                                isOutgoing={message.isOutgoing}
                                            />
                                        ) : (
                                            <>
                                                <MessageContent content={textContent} isOutgoing={message.isOutgoing} />
                                                {textContent ? <MessageLinkPreview content={textContent} isOutgoing={message.isOutgoing} /> : null}
                                                {hasAttachmentRelayUrlsInContent ? (
                                                    <button
                                                        type="button"
                                                        className={cn(
                                                            "mt-2 inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold tracking-wide transition-colors",
                                                            message.isOutgoing
                                                                ? "border-white/25 bg-white/15 text-white hover:bg-white/25 dark:border-zinc-300 dark:bg-zinc-200 dark:text-zinc-800 dark:hover:bg-zinc-300"
                                                                : "border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                                                        )}
                                                        onClick={() => onToggleAttachmentRelayUrls(message.id)}
                                                    >
                                                        {attachmentUrlsExpanded
                                                            ? t("messaging.hideRelayUrls", "Hide relay URLs")
                                                            : t("messaging.showRelayUrls", "Show relay URLs")}
                                                    </button>
                                                ) : null}
                                            </>
                                        )}
                                    </div>
                                </>
                            )}

                            <div
                                className={cn(
                                    "mt-1.5 flex items-center justify-end gap-1.5 text-[10px] font-medium select-none",
                                    message.isOutgoing ? "text-white/60 dark:text-zinc-900/60" : "text-zinc-500 dark:text-zinc-500"
                                )}
                            >
                                {timeLabel ? <span>{timeLabel}</span> : null}

                                {message.isOutgoing ? (
                                    <div className="flex items-center gap-1">
                                        {((): React.JSX.Element | null => {
                                            const uiByStatus: Readonly<Record<MessageStatus, StatusUi>> = {
                                                sending: { label: t("messaging.status.sending"), icon: (p) => <Clock className={cn("animate-pulse", p.className)} /> },
                                                accepted: { label: t("messaging.status.sent"), icon: (p) => <Check className={p.className} /> },
                                                rejected: { label: t("messaging.status.failed"), icon: (p) => <AlertTriangle className={p.className} /> },
                                                delivered: { label: t("messaging.status.delivered"), icon: (p) => <CheckCheck className={p.className} /> },
                                                queued: { label: t("messaging.status.queued"), icon: (p) => <Clock className={p.className} /> },
                                                failed: { label: t("messaging.status.failed"), icon: (p) => <AlertTriangle className={p.className} /> },
                                            };
                                            const ui = uiByStatus[message.status];
                                            const Icon = ui.icon;
                                            return <Icon className="h-3 w-3" />;
                                        })()}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {(message.status === "rejected" || message.status === "failed") ? (
                            <div className="absolute -right-16 top-1/2 -translate-y-1/2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="h-8 px-3 rounded-full bg-rose-500 text-white border-none text-[10px] font-bold"
                                    onClick={() => onRetryMessage(message)}
                                >
                                    {t("common.retry")}
                                </Button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </SwipeReplyWrapper>
        </div>
    );
}, (prev, next) => {
    return (
        prev.virtualStart === next.virtualStart &&
        prev.measureElement === next.measureElement &&
        prev.message === next.message &&
        prev.timeLabel === next.timeLabel &&
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
        prev.inviteResponseStatus === next.inviteResponseStatus &&
        prev.localAttachmentUrlSet === next.localAttachmentUrlSet &&
        prev.localAttachmentFileNameByUrl === next.localAttachmentFileNameByUrl &&
        prev.isMessageMenuAnchored === next.isMessageMenuAnchored &&
        prev.isReactionPickerAnchored === next.isReactionPickerAnchored &&
        prev.admins === next.admins
    );
});

function MessageAttachmentLayout({
    attachments,
    isOutgoing,
    localAttachmentUrlSet,
    localAttachmentFileNameByUrl,
    onImageClick,
    chatUxV083Enabled
}: {
    readonly attachments: ReadonlyArray<Attachment>;
    readonly isOutgoing: boolean;
    readonly localAttachmentUrlSet: ReadonlySet<string>;
    readonly localAttachmentFileNameByUrl: Readonly<Record<string, string>>;
    readonly onImageClick?: (url: string) => void;
    readonly chatUxV083Enabled: boolean;
}): React.JSX.Element {
    const { t } = useTranslation();
    const fileLabel = t("common.file", "File");
    const {
        visualMedia,
        imageMedia,
        videoMedia,
        audios,
        others,
    } = React.useMemo(() => buildAttachmentBuckets(attachments), [attachments]);
    const {
        displayNameByUrl,
        hostByUrl,
    } = React.useMemo(() => buildAttachmentPresentation({
        attachments,
        localAttachmentFileNameByUrl,
        fallbackFileLabel: fileLabel,
    }), [attachments, fileLabel, localAttachmentFileNameByUrl]);

    const [activeVisualIndex, setActiveVisualIndex] = React.useState(0);
    const touchStartXRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        if (visualMedia.length === 0) {
            setActiveVisualIndex(0);
            return;
        }
        setActiveVisualIndex((prev) => Math.min(prev, visualMedia.length - 1));
    }, [visualMedia.length]);

    const goPrevVisual = React.useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (visualMedia.length <= 1) return;
        setActiveVisualIndex((prev) => prevMediaIndex(prev, visualMedia.length));
    }, [visualMedia.length]);

    const goNextVisual = React.useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (visualMedia.length <= 1) return;
        setActiveVisualIndex((prev) => nextMediaIndex(prev, visualMedia.length));
    }, [visualMedia.length]);

    const handleVisualKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (visualMedia.length <= 1) return;
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

    return (
        <div className="mb-3 space-y-3">
            {!chatUxV083Enabled && (
                <>
                    {imageMedia.length > 0 ? (
                        <div className={cn("grid gap-1.5", imageGridClass)}>
                            {imageMedia.map((attachment, index) => (
                                <div
                                    key={`legacy-img-${attachment.url}-${index}`}
                                    className={cn(
                                        "relative overflow-hidden rounded-xl bg-black/5 dark:bg-white/5",
                                        imageMedia.length === 1 ? "aspect-video max-h-[520px]" : "aspect-square"
                                    )}
                                >
                                    {localAttachmentUrlSet.has(attachment.url) ? (
                                        <div className="absolute top-2 left-2 z-10 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-emerald-500/90 text-black">
                                            Vault
                                        </div>
                                    ) : null}
                                    <OptimizedImage
                                        src={attachment.url}
                                        alt={attachment.fileName}
                                        containerClassName="h-full w-full"
                                        className="h-full w-full object-cover cursor-zoom-in hover:scale-[1.02] transition-transform duration-500"
                                        onClick={() => onImageClick?.(attachment.url)}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : null}
                    {videoMedia.length > 0 ? (
                        <div className="space-y-2">
                            {videoMedia.map((attachment, index) => (
                                <div key={`legacy-vid-${attachment.url}-${index}`} className="relative overflow-hidden rounded-xl bg-black/5 dark:bg-white/5">
                                    {localAttachmentUrlSet.has(attachment.url) ? (
                                        <div className="absolute top-2 left-2 z-10 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-emerald-500/90 text-black">
                                            Vault
                                        </div>
                                    ) : null}
                                    <VideoPlayer
                                        src={attachment.url}
                                        isOutgoing={isOutgoing}
                                        className="w-full rounded-xl"
                                    />
                                </div>
                            ))}
                        </div>
                    ) : null}
                </>
            )}

            {chatUxV083Enabled && visualMedia.length > 0 && activeVisual ? (
                <div
                    className="group relative overflow-hidden rounded-[24px] bg-zinc-950 shadow-[0_30px_60px_rgba(0,0,0,0.5)] ring-1 ring-white/10 inline-flex flex-col items-center justify-center max-w-full"
                    tabIndex={visualMedia.length > 1 ? 0 : -1}
                    onKeyDown={handleVisualKeyDown}
                    onTouchStart={(event) => {
                        touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
                    }}
                    onTouchEnd={(event) => {
                        if (visualMedia.length <= 1) return;
                        const touchStartX = touchStartXRef.current;
                        const touchEndX = event.changedTouches[0]?.clientX ?? null;
                        if (touchStartX === null || touchEndX === null) return;
                        const direction = detectSwipeDirection(touchEndX - touchStartX, 40);
                        if (direction === "prev") {
                            goPrevVisual();
                        } else if (direction === "next") {
                            goNextVisual();
                        }
                    }}
                >
                    {/* Ambient Glow */}
                    <div className="absolute -inset-10 bg-gradient-to-tr from-purple-600/20 via-transparent to-blue-600/20 blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeVisual.attachment.url}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="w-full"
                        >
                            {activeVisual.kind === "image" ? (
                                <div className="relative flex items-center justify-center bg-zinc-950 w-full" style={{ maxHeight: '480px' }}>
                                    <OptimizedImage
                                        src={activeVisual.attachment.url}
                                        alt={activeVisual.attachment.fileName}
                                        fill={false}
                                        containerClassName="overflow-hidden w-auto max-w-full flex items-center justify-center"
                                        className="w-auto h-auto max-w-full object-contain cursor-zoom-in group-hover:scale-[1.03] transition-transform duration-[1.5s]"
                                        style={{ maxHeight: '480px', maxWidth: '100%' }}
                                        onClick={() => onImageClick?.(activeVisual.attachment.url)}
                                    />
                                </div>
                            ) : (
                                <VideoPlayer
                                    src={activeVisual.attachment.url}
                                    isOutgoing={isOutgoing}
                                    className="w-full rounded-2xl aspect-video"
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Metadata Badges */}
                    <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 drop-shadow-lg">
                        <span className="rounded-lg bg-black/40 backdrop-blur-md px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white border border-white/10">
                            {activeVisual.kind}
                        </span>
                        {localAttachmentUrlSet.has(activeVisual.attachment.url) && (
                            <span className="rounded-lg bg-emerald-500/80 backdrop-blur-md px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-black/90">
                                Vault
                            </span>
                        )}
                    </div>

                    {/* Navigation Overlays */}
                    {visualMedia.length > 1 && (
                        <>
                            <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/20 to-transparent pointer-events-none opacity-0 hover:opacity-100 transition-opacity" />
                            <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/20 to-transparent pointer-events-none opacity-0 hover:opacity-100 transition-opacity" />

                            <button
                                type="button"
                                className="absolute left-3 top-1/2 z-20 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-full border border-white/10 bg-black/20 text-white backdrop-blur hover:bg-black/40 transition-all active:scale-95"
                                onClick={goPrevVisual}
                                aria-label="Previous media"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 z-20 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-full border border-white/10 bg-black/20 text-white backdrop-blur hover:bg-black/40 transition-all active:scale-95"
                                onClick={goNextVisual}
                                aria-label="Next media"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>

                            <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1 text-[11px] font-black tracking-widest text-white/90 shadow-xl">
                                {activeVisualIndex + 1} <span className="opacity-40">/</span> {visualMedia.length}
                            </div>
                        </>
                    )}
                </div>
            ) : null}

            {audios.length > 0 && (
                <div className="space-y-2">
                    {audios.map((attachment, index) => (
                        <div
                            key={`aud-${attachment.url}-${index}`}
                            className={cn(
                                "rounded-xl border p-3 space-y-2",
                                isOutgoing
                                    ? "border-white/15 bg-white/10"
                                    : "border-black/10 bg-zinc-50 dark:border-white/10 dark:bg-zinc-800/70"
                            )}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className={cn(
                                            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest",
                                            isOutgoing ? "bg-black/35 text-white" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100"
                                        )}>
                                            <Music2 className="h-2.5 w-2.5" />
                                            Audio
                                        </span>
                                        {localAttachmentUrlSet.has(attachment.url) ? (
                                            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-emerald-500/90 text-black">
                                                Vault
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mt-1 truncate text-xs font-bold">
                                        {deriveDisplayFileName(attachment)}
                                    </div>
                                    <div className="mt-0.5 truncate text-[10px] opacity-60">
                                        {hostByUrl[attachment.url] ?? attachment.url}
                                    </div>
                                </div>
                                <a
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                        "h-8 w-8 shrink-0 rounded-lg border flex items-center justify-center transition-colors",
                                        isOutgoing
                                            ? "border-white/20 hover:bg-white/10"
                                            : "border-black/10 hover:bg-zinc-100 dark:border-white/10 dark:hover:bg-zinc-700/80"
                                    )}
                                    aria-label={t("common.openInNewTab", "Open in new tab")}
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </a>
                            </div>
                            <AudioPlayer src={attachment.url} isOutgoing={isOutgoing} className="max-w-none min-w-0" />
                        </div>
                    ))}
                </div>
            )}

            {others.length > 0 && (
                <div className="space-y-2">
                    {others.map((attachment, index) => (
                        <a
                            key={`file-${attachment.url}-${index}`}
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                                "flex items-center gap-3 p-4 rounded-2xl transition-all duration-200 w-full group/file",
                                isOutgoing
                                    ? "bg-white/10 hover:bg-white/20 text-white"
                                    : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                            )}
                        >
                            <div className={cn(
                                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                                isOutgoing ? "bg-white/20" : "bg-purple-500 text-white"
                            )}>
                                <FileText className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold truncate">{deriveDisplayFileName(attachment)}</div>
                                <div className="text-[10px] opacity-60 font-medium uppercase tracking-widest mt-0.5">{t("common.download")}</div>
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Sub-component to resolve and display sender name with badges
 */
function SenderName({ pubkey, admins }: { pubkey: string, admins?: MessageListProps['admins'] }) {
    const metadata = useProfileMetadata(pubkey, { live: false });

    const admin = admins?.find(a => a.pubkey === pubkey);
    const rolesLower = admin?.roles.map(r => r.toLowerCase()) || [];
    const isOwner = rolesLower.includes("owner") || rolesLower.includes("admin");
    const isMod = rolesLower.includes("moderator") || rolesLower.includes("mod");

    return (
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-[11px] font-black text-purple-600 dark:text-purple-400 truncate max-w-[120px]">
                {metadata?.displayName || (pubkey ? pubkey.slice(0, 8) : "???")}
            </span>
            {(isOwner || isMod) && (
                <span className={cn(
                    "text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-[4px]",
                    isOwner
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                )}>
                    {isOwner ? "Owner" : "Mod"}
                </span>
            )}
        </div>
    );
}

function SwipeReplyWrapper({
    message,
    onReply,
    isOutgoing,
    enableSwipeReply,
    children
}: {
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

    return (
        <div className="relative flex-1 flex w-full" style={{ justifyContent: isOutgoing ? 'flex-end' : 'flex-start' }}>
            {enableSwipeReply ? (
                <motion.div
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-600 dark:text-purple-400"
                    style={{ opacity, scale }}
                >
                    <Reply className="h-6 w-6" />
                </motion.div>
            ) : null}
            <motion.div
                drag={enableSwipeReply ? "x" : false}
                dragConstraints={{ left: 0, right: 100 }}
                dragElastic={0.1}
                onDragEnd={enableSwipeReply ? handleDragEnd : undefined}
                style={{ x }}
                className="flex-1 flex"
            >
                <div className="flex-1 flex" style={{ justifyContent: isOutgoing ? 'flex-end' : 'flex-start' }}>
                    {children}
                </div>
            </motion.div>
        </div>
    );
}



