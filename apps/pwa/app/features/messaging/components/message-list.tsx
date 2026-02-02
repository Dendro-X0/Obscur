
import React from "react";
import Image from "next/image";
import { AlertTriangle, Check, CheckCheck, Clock, X, UploadCloud } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { EmptyState } from "../../../components/ui/empty-state";
import { MessageContent } from "../../../components/message-content";
import { MessageLinkPreview } from "../../../components/message-link-preview";
import { cn } from "../../../lib/cn";
import { formatTime } from "../utils/formatting";
import type { Message, ReactionEmoji, MessageStatus, StatusUi, StatusIcon } from "../types";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";

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
    onToggleReaction: (messageId: string, emoji: ReactionEmoji) => void;
    onRetryMessage: (message: Message) => void;
    onComposerFocus: () => void;
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
    onComposerFocus
}: MessageListProps) {
    const { t } = useTranslation();

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

    const parentRef = React.useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: messages.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 100, // Average message height
        overscan: 5,
    });

    return (
        <div ref={parentRef} className="flex-1 overflow-y-auto p-4">
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
                                        "flex",
                                        message.isOutgoing ? "justify-end" : "justify-start",
                                        isGroupEnd ? "mb-4" : "mb-0.5"
                                    )}
                                >
                                    <div
                                        id={`msg-${message.id}`}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            onOpenMessageMenu({ messageId: message.id, x: e.clientX, y: e.clientY });
                                        }}
                                        className={cn(
                                            "relative max-w-[85%] sm:max-w-[70%] group transition-all duration-200",
                                            message.isOutgoing
                                                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                                : "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 shadow-sm border border-black/[0.03] dark:border-white/[0.03]",
                                            // Dynamic Border Radius for grouping
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
                                        {/* Interaction Hover Menu */}
                                        <div className={cn(
                                            "absolute opacity-0 group-hover:opacity-100 transition-opacity z-20 top-1",
                                            message.isOutgoing ? "-left-12" : "-right-12"
                                        )}>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-full bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm shadow-sm ring-1 ring-black/5 dark:ring-white/5"
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
                                                                // Could trigger flash here too
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <div className="w-0.5 h-3 bg-purple-500 rounded-full" />
                                                                <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Reply</span>
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
                                                                            "rounded-full border px-1.5 py-0.5 text-[10px] font-bold flex items-center gap-1 shadow-sm transition-transform active:scale-90",
                                                                            message.isOutgoing
                                                                                ? "border-white/20 bg-zinc-800 text-white dark:border-black/10 dark:bg-white dark:text-zinc-900"
                                                                                : "border-black/5 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100"
                                                                        )}
                                                                        onClick={() => onToggleReaction(message.id, emoji)}
                                                                    >
                                                                        <span>{emoji}</span>
                                                                        <span className="opacity-70">{count}</span>
                                                                    </button>
                                                                ))}
                                                        </div>
                                                    )}

                                                    {message.attachment && (
                                                        <div className="mb-2 relative rounded-xl overflow-hidden shadow-sm">
                                                            {message.attachment.kind === "image" ? (
                                                                <Image
                                                                    src={message.attachment.url}
                                                                    alt={message.attachment.fileName}
                                                                    width={800}
                                                                    height={600}
                                                                    unoptimized
                                                                    className="max-h-80 w-auto object-contain cursor-zoom-in hover:scale-[1.02] transition-transform duration-500"
                                                                />
                                                            ) : (
                                                                <video src={message.attachment.url} controls className="max-h-80 w-auto" />
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="text-[15px] leading-relaxed break-words">
                                                        <MessageContent content={message.content} isOutgoing={message.isOutgoing} />
                                                    </div>

                                                    {message.content && <MessageLinkPreview content={message.content} isOutgoing={message.isOutgoing} />}
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
                                                                sending: { label: "Sending", icon: (p) => <Clock className={cn("animate-pulse", p.className)} /> },
                                                                accepted: { label: "Sent", icon: (p) => <Check className={p.className} /> },
                                                                rejected: { label: "Failed", icon: (p) => <AlertTriangle className={p.className} /> },
                                                                delivered: { label: "Delivered", icon: (p) => <CheckCheck className={p.className} /> },
                                                                queued: { label: "Queued", icon: (p) => <Clock className={p.className} /> },
                                                                failed: { label: "Failed", icon: (p) => <AlertTriangle className={p.className} /> },
                                                            };
                                                            const ui = uiByStatus[message.status];
                                                            const Icon = ui.icon;
                                                            return <Icon className="h-3 w-3" />;
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {message.status === "rejected" && (
                                            <div className="absolute -right-16 top-1/2 -translate-y-1/2">
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    className="h-8 px-3 rounded-full bg-rose-500 text-white border-none text-[10px] font-bold"
                                                    onClick={() => onRetryMessage(message)}
                                                >
                                                    Retry
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
