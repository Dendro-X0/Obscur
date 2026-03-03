"use client";

import React from "react";
import { OptimizedImage } from "../../../components/optimized-image";
import { AlertTriangle, Check, CheckCheck, Clock, X, Reply, ChevronDown, RefreshCw, FileText } from "lucide-react";
import { motion, useMotionValue, useTransform, AnimatePresence, useAnimation } from "framer-motion";
import { Button } from "../../../components/ui/button";
import { EmptyState } from "../../../components/ui/empty-state";
import { MessageContent } from "../../../components/message-content";
import { MessageLinkPreview } from "../../../components/message-link-preview";
import { AudioPlayer } from "./audio-player";
import { VideoPlayer } from "./video-player";
import { cn } from "../../../lib/cn";
import { formatTime } from "../utils/formatting";
import type { Message, ReactionEmoji, MessageStatus, StatusUi, SendDirectMessageParams, SendDirectMessageResult } from "../types";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { UserAvatar } from "../../profile/components/user-avatar";
import { useProfileMetadata } from "../../profile/hooks/use-profile-metadata";
import { CommunityInviteCard } from "../../groups/components/community-invite-card";
import { CommunityInviteResponseCard } from "../../groups/components/community-invite-response-card";
import { inferAttachmentKind } from "../utils/logic";
import { getLocalMediaIndexEntryByRemoteUrl } from "@/app/features/vault/services/local-media-store";

interface MessageListProps {
    hasHydrated: boolean;
    messages: ReadonlyArray<Message>;
    rawMessagesCount: number; // to check if empty
    hasEarlierMessages: boolean;
    onLoadEarlier: () => void;
    nowMs: number | null;
    flashMessageId: string | null;
    onOpenMessageMenu: (params: { messageId: string; x: number; y: number }) => void;
    onOpenReactionPicker: (params: { messageId: string; x: number; y: number }) => void;
    onToggleReaction: (message: Message, emoji: ReactionEmoji) => void;
    onRetryMessage: (message: Message) => void;
    onComposerFocus: () => void;
    onReply?: (message: Message) => void;
    onImageClick?: (url: string) => void;
    isGroup?: boolean;
    admins?: ReadonlyArray<Readonly<{ pubkey: string; roles: ReadonlyArray<string> }>>;
    onSendDirectMessage?: (params: SendDirectMessageParams) => Promise<SendDirectMessageResult>;
    onRefresh?: () => Promise<void>;
}

export function MessageList({
    hasHydrated,
    messages,
    rawMessagesCount,
    hasEarlierMessages,
    onLoadEarlier,
    nowMs,
    flashMessageId,
    onOpenMessageMenu,
    onOpenReactionPicker,
    onToggleReaction,
    onRetryMessage,
    onComposerFocus,
    onReply,
    onImageClick,
    isGroup,
    admins,
    onSendDirectMessage,
    onRefresh
}: MessageListProps) {
    const { t } = useTranslation();

    const isReactableMessageId = (messageId: string): boolean => {
        void messageId;
        return true;
    };

    const parentRef = React.useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: messages.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 160, // Increased estimate for padding
        overscan: 10,
    });

    const [showScrollBottom, setShowScrollBottom] = React.useState(false);
    const prevLastId = React.useRef<string | null>(null);
    const prevLength = React.useRef(0);

    const scrollToBottom = React.useCallback((behavior: ScrollBehavior = 'auto') => {
        if (messages.length > 0) {
            virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: behavior as any });
        }
    }, [messages.length, virtualizer]);

    // Scroll to bottom and anchoring logic
    React.useEffect(() => {
        if (hasHydrated && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const isNewMessage = lastMessage.id !== prevLastId.current;

            // Check if messages were prepended (e.g., from onLoadEarlier)
            const isPrepended = messages.length > prevLength.current && messages[0].id !== prevFirstId.current;

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
    }, [hasHydrated, messages, showScrollBottom, scrollToBottom]);

    const prevFirstId = React.useRef<string | null>(null);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        // Show button if we are more than 300px away from the bottom
        const isAwayFromBottom = scrollHeight - scrollTop - clientHeight > 300;
        setShowScrollBottom(isAwayFromBottom);
    };

    const y = useMotionValue(0);
    const refreshOpacity = useTransform(y, [0, 80], [0, 1]);
    const refreshRotate = useTransform(y, [0, 80], [0, 180]);
    const refreshScale = useTransform(y, [0, 80], [0.5, 1]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [localAttachmentUrlSet, setLocalAttachmentUrlSet] = React.useState<ReadonlySet<string>>(new Set());

    React.useEffect(() => {
        const urls = new Set<string>();
        messages.forEach((message) => {
            message.attachments?.forEach((attachment) => {
                if (getLocalMediaIndexEntryByRemoteUrl(attachment.url)) {
                    urls.add(attachment.url);
                }
            });
        });
        setLocalAttachmentUrlSet(urls);
    }, [messages]);

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
                drag={onRefresh && !isRefreshing ? "y" : false}
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
                                >
                                    {t("messaging.loadEarlier")}
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

                                return (
                                    <div
                                        key={virtualItem.key}
                                        data-index={virtualItem.index}
                                        ref={virtualizer.measureElement}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            transform: `translateY(${virtualItem.start}px)`,
                                        }}
                                        className={cn(
                                            "flex relative items-end gap-2 w-full",
                                            message.isOutgoing ? "flex-row-reverse" : "flex-row",
                                            isGroupEnd ? "pb-8" : "pb-3"
                                        )}>
                                        {/* Avatar Side */}
                                        <div className="w-8 flex-shrink-0 flex justify-center">
                                            {isGroupEnd && (
                                                <UserAvatar
                                                    pubkey={message.senderPubkey!}
                                                    size="sm"
                                                    className="h-8 w-8 ring-1 ring-black/5 dark:ring-white/5 shadow-sm rounded-full"
                                                />
                                            )}
                                        </div>

                                        <SwipeReplyWrapper
                                            message={message}
                                            onReply={onReply}
                                            isOutgoing={message.isOutgoing}
                                        >
                                            <div className={cn(
                                                "flex flex-col w-full",
                                                message.isOutgoing ? "items-end" : "items-start"
                                            )}>
                                                {isGroupStart && (
                                                    <div className={cn(
                                                        "flex items-center gap-2 mb-1 px-1",
                                                        message.isOutgoing ? "flex-row-reverse" : "flex-row"
                                                    )}>
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
                                                        onOpenMessageMenu({ messageId: message.id, x: e.clientX, y: e.clientY });
                                                    }}
                                                    className={cn(
                                                        "relative max-w-[90%] sm:max-w-[80%] group transition-all duration-200",
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
                                                        flashMessageId === message.id && "ring-4 ring-purple-500/20 dark:ring-purple-400/20 animate-pulse"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "absolute opacity-0 group-hover:opacity-100 transition-opacity z-20 top-1 flex flex-col gap-1.5",
                                                        message.isOutgoing ? "-left-12" : "-right-12"
                                                    )}>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-full bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm shadow-sm ring-1 ring-black/5 dark:ring-white/5 hover:scale-110 transition-transform"
                                                            onClick={(e) => onOpenReactionPicker({ messageId: message.id, x: e.clientX, y: e.clientY })}
                                                        >
                                                            <span className="text-sm leading-none">☺</span>
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-full bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm shadow-sm ring-1 ring-black/5 dark:ring-white/5 hover:scale-110 transition-transform"
                                                            onClick={(e) => onOpenMessageMenu({ messageId: message.id, x: e.clientX, y: e.clientY })}
                                                        >
                                                            <span className="text-lg leading-none mt-[-4px]">⋯</span>
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
                                                                    <div className={cn(
                                                                        "mb-2 rounded-xl border p-2.5 text-xs transition-colors cursor-pointer",
                                                                        message.isOutgoing
                                                                            ? "border-white/10 bg-white/5 hover:bg-white/10"
                                                                            : "border-black/5 bg-black/5 hover:bg-black/10"
                                                                    )}
                                                                        onClick={() => {
                                                                            const el = document.getElementById(`msg-${message.replyTo?.messageId}`);
                                                                            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

                                                                {(message.attachments && message.attachments.length > 0) && (
                                                                    <div className="mb-2 grid gap-1 grid-cols-2">
                                                                        {message.attachments.map((attachment, index) => {
                                                                            const effectiveKind = inferAttachmentKind(attachment);
                                                                            return (
                                                                            <div
                                                                                key={`${attachment.url}-${index}`}
                                                                                className={cn(
                                                                                    "relative bg-black/5 dark:bg-white/5",
                                                                                    (message.attachments!.length === 1 || (index === message.attachments!.length - 1 && message.attachments!.length % 2 !== 0))
                                                                                        ? "col-span-2 aspect-video max-h-[480px]"
                                                                                        : "aspect-square"
                                                                                )}
                                                                            >
                                                                                {localAttachmentUrlSet.has(attachment.url) ? (
                                                                                    <div className="absolute top-2 left-2 z-10 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-emerald-500/90 text-black">
                                                                                        Vault
                                                                                    </div>
                                                                                ) : null}
                                                                                {effectiveKind === "image" ? (
                                                                                    <OptimizedImage
                                                                                        src={attachment.url}
                                                                                        alt={attachment.fileName}
                                                                                        containerClassName="h-full w-full rounded-xl"
                                                                                        className="h-full w-full object-cover cursor-zoom-in hover:scale-[1.02] transition-transform duration-500"
                                                                                        onClick={() => onImageClick?.(attachment.url)}
                                                                                    />
                                                                                ) : effectiveKind === "audio" ? (
                                                                                    <div className="h-full w-full flex items-center justify-center p-2">
                                                                                        <AudioPlayer src={attachment.url} isOutgoing={message.isOutgoing} />
                                                                                    </div>
                                                                                ) : effectiveKind === "video" ? (
                                                                                    <VideoPlayer
                                                                                        src={attachment.url}
                                                                                        isOutgoing={message.isOutgoing}
                                                                                        className="h-full w-full rounded-xl"
                                                                                    />
                                                                                ) : (
                                                                                    <div className="h-full w-full flex items-center justify-center p-4">
                                                                                        <a
                                                                                            href={attachment.url}
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                            className={cn(
                                                                                                "flex items-center gap-3 p-4 rounded-2xl transition-all duration-200 w-full group/file",
                                                                                                message.isOutgoing
                                                                                                    ? "bg-white/10 hover:bg-white/20 text-white"
                                                                                                    : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                                                                                            )}
                                                                                        >
                                                                                            <div className={cn(
                                                                                                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                                                                                                message.isOutgoing ? "bg-white/20" : "bg-purple-500 text-white"
                                                                                            )}>
                                                                                                <FileText className="h-5 w-5" />
                                                                                            </div>
                                                                                            <div className="flex-1 min-w-0">
                                                                                                <div className="text-xs font-bold truncate">{attachment.fileName || t("common.file", "File")}</div>
                                                                                                <div className="text-[10px] opacity-60 font-medium uppercase tracking-widest mt-0.5">{t("common.download")}</div>
                                                                                            </div>
                                                                                        </a>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )})}
                                                                    </div>
                                                                )}

                                                                <div className="text-[15px] leading-relaxed break-words">
                                                                    {(() => {
                                                                        try {
                                                                            const parsed = JSON.parse(message.content);
                                                                            if (parsed.type === "community-invite") {
                                                                                return <CommunityInviteCard
                                                                                    invite={parsed}
                                                                                    isOutgoing={message.isOutgoing}
                                                                                    message={message}
                                                                                    messages={messages}
                                                                                    onSendDirectMessage={onSendDirectMessage}
                                                                                />;
                                                                            }
                                                                            if (parsed.type === "community-invite-response") {
                                                                                return <CommunityInviteResponseCard
                                                                                    response={parsed}
                                                                                    isOutgoing={message.isOutgoing}
                                                                                />;
                                                                            }
                                                                        } catch (e) {
                                                                            // Not JSON or not an invite, fall through
                                                                        }
                                                                        return (
                                                                            <>
                                                                                <MessageContent content={message.content} isOutgoing={message.isOutgoing} />
                                                                                {message.content && <MessageLinkPreview content={message.content} isOutgoing={message.isOutgoing} />}
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </>
                                                        )}

                                                        <div
                                                            className={cn(
                                                                "mt-1.5 flex items-center justify-end gap-1.5 text-[10px] font-medium select-none",
                                                                message.isOutgoing
                                                                    ? "text-white/60 dark:text-zinc-900/60"
                                                                    : "text-zinc-500 dark:text-zinc-500"
                                                            )}
                                                        >
                                                            {formatTime(message.timestamp, nowMs) && (
                                                                <span>{formatTime(message.timestamp, nowMs)}</span>
                                                            )}

                                                            {message.isOutgoing && (
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
                                                            )}
                                                        </div>
                                                    </div>

                                                    {(message.status === "rejected" || message.status === "failed") && (
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
                                                    )}
                                                </div>
                                            </div>
                                        </SwipeReplyWrapper>
                                    </div>
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

/**
 * Sub-component to resolve and display sender name with badges
 */
function SenderName({ pubkey, admins }: { pubkey: string, admins?: MessageListProps['admins'] }) {
    const metadata = useProfileMetadata(pubkey);
    const { t } = useTranslation();

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
    children
}: {
    message: Message;
    onReply?: (message: Message) => void;
    isOutgoing: boolean;
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
            <motion.div
                className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-600 dark:text-purple-400"
                style={{ opacity, scale }}
            >
                <Reply className="h-6 w-6" />
            </motion.div>
            <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 100 }}
                dragElastic={0.1}
                onDragEnd={handleDragEnd}
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
