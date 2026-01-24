
import React from "react";
import Image from "next/image";
import { AlertTriangle, Check, CheckCheck, Clock } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { EmptyState } from "../../../components/ui/empty-state";
import { MessageContent } from "../../../components/message-content";
import { MessageLinkPreview } from "../../../components/message-link-preview";
import { cn } from "../../../lib/cn";
import { formatTime } from "../utils/formatting";
import type { Message, ReactionEmoji, MessageStatus, StatusUi, StatusIcon } from "../types";
import { useTranslation } from "react-i18next";

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

    return (
        <div className="flex-1 overflow-y-auto p-4">
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
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            id={`msg-${message.id}`}
                            className={cn(
                                "mb-4 flex",
                                message.isOutgoing ? "justify-end" : "justify-start"
                            )}
                        >
                            <div
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    onOpenMessageMenu({ messageId: message.id, x: e.clientX, y: e.clientY });
                                }}
                                className={cn(
                                    "relative max-w-[70%] rounded-lg px-4 py-2",
                                    flashMessageId === message.id && "ring-2 ring-amber-400/70 ring-offset-2 ring-offset-zinc-50 dark:ring-amber-400/40 dark:ring-offset-black",
                                    message.isOutgoing
                                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                        : "bg-white text-zinc-900 dark:bg-zinc-950/60 dark:text-zinc-100"
                                )}
                            >
                                <button
                                    type="button"
                                    aria-label="Message actions"
                                    className={cn(
                                        "absolute right-2 top-2 rounded-md px-2 py-1 text-xs",
                                        message.isOutgoing
                                            ? "text-white/80 hover:bg-white/10 dark:text-zinc-900/80 dark:hover:bg-black/5"
                                            : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5"
                                    )}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onOpenMessageMenu({ messageId: message.id, x: e.clientX, y: e.clientY });
                                    }}
                                >
                                    ⋯
                                </button>
                                <button
                                    type="button"
                                    aria-label="Add reaction"
                                    className={cn(
                                        "absolute right-10 top-2 rounded-md px-2 py-1 text-xs",
                                        message.isOutgoing
                                            ? "text-white/80 hover:bg-white/10 dark:text-zinc-900/80 dark:hover:bg-black/5"
                                            : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5"
                                    )}
                                    disabled={!isReactableMessageId(message.id)}
                                    onClick={(e) => {
                                        if (!isReactableMessageId(message.id)) {
                                            return;
                                        }
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onOpenReactionPicker({ messageId: message.id, x: e.clientX, y: e.clientY });
                                    }}
                                >
                                    +
                                </button>
                                {message.deletedAt ? (
                                    <div className={cn(
                                        "mb-2 rounded-md border px-2 py-1 text-xs italic",
                                        message.isOutgoing
                                            ? "border-white/20 bg-white/10 text-white/80 dark:border-black/10 dark:bg-black/5 dark:text-zinc-900/80"
                                            : "border-black/10 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-black/20 dark:text-zinc-200"
                                    )}>
                                        {t("messaging.messageDeleted")}
                                    </div>
                                ) : message.replyTo ? (
                                    <div className={cn(
                                        "mb-2 rounded-md border px-2 py-1 text-xs",
                                        message.isOutgoing
                                            ? "border-white/20 bg-white/10 text-white/80 dark:border-black/10 dark:bg-black/5 dark:text-zinc-900/80"
                                            : "border-black/10 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-black/20 dark:text-zinc-200"
                                    )}
                                    >
                                        <div className="truncate">Replying to: {message.replyTo.previewText}</div>
                                    </div>
                                ) : null}
                                {!message.deletedAt && message.reactions ? (
                                    <div className="mb-2 flex flex-wrap gap-1">
                                        {(Object.entries(message.reactions) as ReadonlyArray<readonly [ReactionEmoji, number]>)
                                            .filter(([, count]) => count > 0)
                                            .map(([emoji, count]) => (
                                                <button
                                                    key={emoji}
                                                    type="button"
                                                    className={cn(
                                                        "rounded-full border px-2 py-0.5 text-xs",
                                                        message.isOutgoing
                                                            ? "border-white/20 bg-white/10 text-white/90 dark:border-black/10 dark:bg-black/5 dark:text-zinc-900"
                                                            : "border-black/10 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-black/20 dark:text-zinc-200"
                                                    )}
                                                    onClick={() => onToggleReaction(message.id, emoji)}
                                                >
                                                    {emoji} {count}
                                                </button>
                                            ))}
                                    </div>
                                ) : null}
                                {message.attachment ? (
                                    message.attachment.kind === "image" ? (
                                        <Image src={message.attachment.url} alt={message.attachment.fileName} width={640} height={480} unoptimized className="mb-2 max-h-64 w-auto rounded-lg" />
                                    ) : (
                                        <video src={message.attachment.url} controls className="mb-2 max-h-64 w-auto rounded-lg" />
                                    )
                                ) : null}
                                <MessageContent content={message.content} isOutgoing={message.isOutgoing} />
                                {message.content ? <MessageLinkPreview content={message.content} isOutgoing={message.isOutgoing} /> : null}
                                <div
                                    className={cn(
                                        "mt-1 flex items-center justify-end gap-1 text-xs",
                                        message.isOutgoing
                                            ? "text-white/70 dark:text-zinc-900/70"
                                            : "text-zinc-600 dark:text-zinc-400"
                                    )}
                                >
                                    {formatTime(message.timestamp, nowMs) ? (
                                        <span>{formatTime(message.timestamp, nowMs)}</span>
                                    ) : null}
                                    {message.isOutgoing ? (
                                        <div className="flex items-center gap-2">
                                            <span aria-hidden="true">·</span>
                                            {((): React.JSX.Element | null => {
                                                const uiByStatus: Readonly<Record<MessageStatus, StatusUi>> = {
                                                    sending: {
                                                        label: "Sending",
                                                        icon: (iconProps) => (
                                                            <Clock className={iconProps.className} />
                                                        ),
                                                    },
                                                    accepted: {
                                                        label: "Sent",
                                                        icon: (iconProps) => (
                                                            <Check className={iconProps.className} />
                                                        ),
                                                    },
                                                    rejected: {
                                                        label: "Failed",
                                                        icon: (iconProps) => (
                                                            <AlertTriangle className={iconProps.className} />
                                                        ),
                                                    },
                                                    delivered: {
                                                        label: "Delivered",
                                                        icon: (iconProps) => (
                                                            <CheckCheck className={iconProps.className} />
                                                        ),
                                                    },
                                                };
                                                const ui = uiByStatus[message.status];
                                                const Icon = ui.icon;
                                                const successes = message.relayResults?.filter(r => r.success).length ?? 0;
                                                const label = message.status === 'accepted' && successes > 0
                                                    ? `Sent to ${successes} relay${successes > 1 ? 's' : ''}`
                                                    : ui.label;

                                                return (
                                                    <span className="inline-flex items-center gap-1" title={message.status === 'accepted' ? `${successes} relays confirmed receipt` : undefined}>
                                                        <Icon className="h-3.5 w-3.5" />
                                                        <span>{label}</span>
                                                    </span>
                                                );
                                            })()}
                                            {message.status === "rejected" ? (
                                                <button
                                                    type="button"
                                                    className="rounded border border-white/30 px-2 py-0.5 text-xs hover:bg-white/10"
                                                    onClick={() => onRetryMessage(message)}
                                                >
                                                    Retry
                                                </button>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}
