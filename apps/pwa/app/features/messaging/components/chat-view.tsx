import React, { useState } from "react";
import { useResolvedProfileMetadata } from "../../profile/hooks/use-resolved-profile-metadata";
import { ChatHeader } from "./chat-header";
import { StrangerWarningBanner } from "./stranger-warning-banner";
import { MessageList } from "./message-list";
import { Composer } from "./composer";
import { MediaGallery } from "./media-gallery";
import { Lightbox } from "./lightbox";
import { MessageMenu } from "./message-menu";
import { ReactionPicker } from "./reaction-picker";
import { Loader2, Lock, Mic, Search, UploadCloud, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
    Conversation, Message, MediaItem, ReactionEmoji, ReplyTo, RelayStatusSummary,
    SendDirectMessageParams, SendDirectMessageResult
} from "../types";
import { chatStateStoreService } from "../services/chat-state-store";
import { formatTime, highlightText } from "../utils/formatting";
import Image from "next/image";
import { cn } from "@/app/lib/utils";
import { getVoiceNoteAttachmentMetadata } from "@/app/features/messaging/services/voice-note-metadata";

type ChatHistorySearchResult = Readonly<{
    messageId: string;
    timestamp: Date;
    preview: string;
    resultKind: "text" | "voice_note";
    voiceDurationLabel: string | null;
}>;

export interface ChatViewProps {
    conversation: Conversation;
    isPeerOnline?: boolean;
    interactionStatus?: Readonly<{ lastActiveAtMs?: number; lastViewedAtMs?: number }>;
    messages: ReadonlyArray<Message>;
    rawMessagesCount: number;
    hasHydrated: boolean;
    hasEarlierMessages: boolean;
    onLoadEarlier: () => void;
    nowMs: number | null;
    flashMessageId: string | null;

    // Header Props
    onCopyPubkey: (pubkey: string) => void;
    onOpenMedia: () => void;
    onOpenInfo?: () => void;

    // Message Menu & Interactions
    messageMenu: { messageId: string; x: number; y: number } | null;
    setMessageMenu: (val: { messageId: string; x: number; y: number } | null) => void;
    messageMenuRef: React.RefObject<HTMLDivElement | null>;

    onCopyText: (text: string) => void;
    onCopyAttachmentUrl: (url: string) => void;
    onReferenceMessage: (message: Message) => void;
    onDeleteMessageForMe: (message: Message) => void;
    onDeleteMessageForEveryone: (message: Message) => void;

    // Reaction Picker
    reactionPicker: { messageId: string; x: number; y: number } | null;
    setReactionPicker: (val: { messageId: string; x: number; y: number } | null) => void;
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

    // Media
    isMediaGalleryOpen: boolean;
    setIsMediaGalleryOpen: (val: boolean) => void;
    selectedConversationMediaItems: ReadonlyArray<MediaItem>;
    lightboxIndex: number | null;
    setLightboxIndex: (val: number | null) => void;
    pendingEventCount?: number;
    recipientStatus?: 'idle' | 'found' | 'not_found' | 'verifying';
    isPeerAccepted?: boolean;
    isInitiator?: boolean;
    onAcceptPeer?: () => void;
    onBlockPeer?: () => void;
    groupAdmins?: ReadonlyArray<Readonly<{ pubkey: string; roles: ReadonlyArray<string> }>>;
}


export function ChatView(props: ChatViewProps) {
    const { t } = useTranslation();
    const [isDragging, setIsDragging] = useState(false);
    const [isHistorySearchOpen, setIsHistorySearchOpen] = useState(false);
    const [historySearchQuery, setHistorySearchQuery] = useState("");
    const [historySearchFilter, setHistorySearchFilter] = useState<"all" | "voice_note">("all");
    const [isHistorySearching, setIsHistorySearching] = useState(false);
    const [historySearchResults, setHistorySearchResults] = useState<ReadonlyArray<ChatHistorySearchResult>>([]);
    const [jumpToMessageId, setJumpToMessageId] = useState<string | null>(null);
    const [searchFlashMessageId, setSearchFlashMessageId] = useState<string | null>(null);
    const searchFlashTimeoutRef = React.useRef<number | null>(null);
    const [messageMenuAnchorHoverId, setMessageMenuAnchorHoverId] = useState<string | null>(null);
    const [isMessageMenuHovered, setIsMessageMenuHovered] = useState(false);
    const metadata = useResolvedProfileMetadata(props.conversation.kind === "dm" ? props.conversation.pubkey : null);
    const resolvedName = metadata?.displayName || props.conversation.displayName;
    const resolvedNowMs = props.nowMs ?? Date.now();
    const normalizedHistorySearchQuery = historySearchQuery.trim().toLowerCase();
    const canSearchHistory = normalizedHistorySearchQuery.length >= 2;
    const voiceNoteSearchResultCount = React.useMemo(() => (
        historySearchResults.filter((result) => result.resultKind === "voice_note").length
    ), [historySearchResults]);
    const filteredHistorySearchResults = React.useMemo(() => (
        historySearchFilter === "voice_note"
            ? historySearchResults.filter((result) => result.resultKind === "voice_note")
            : historySearchResults
    ), [historySearchFilter, historySearchResults]);
    const effectiveFlashMessageId = searchFlashMessageId ?? props.flashMessageId;
    const {
        isMediaGalleryOpen,
        lightboxIndex,
        selectedConversationMediaItems,
        setIsMediaGalleryOpen,
        setLightboxIndex,
        setMessageMenu,
        setReactionPicker,
    } = props;

    const getMessageById = (messageId: string): Message | undefined => {
        return props.messages.find(m => m.id === messageId);
    };

    const handleJumpToMessage = React.useCallback((messageId: string): void => {
        setJumpToMessageId(messageId);
        setIsHistorySearchOpen(false);
    }, []);

    React.useEffect(() => {
        setHistorySearchQuery("");
        setHistorySearchResults([]);
        setIsHistorySearching(false);
        setJumpToMessageId(null);
        setSearchFlashMessageId(null);
        setIsHistorySearchOpen(false);
        setHistorySearchFilter("all");
    }, [props.conversation.id]);

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
                const searchResults = await chatStateStoreService.searchMessages(normalizedHistorySearchQuery, 120);
                if (cancelled) {
                    return;
                }

                const conversationResults = searchResults
                    .filter((result) => result.conversationId === props.conversation.id)
                    .map((result) => {
                        const messageAttachments = Array.isArray(result.message.attachments)
                            ? result.message.attachments
                            : [];
                        const voiceNoteMetadata = messageAttachments
                            .map((attachment) => getVoiceNoteAttachmentMetadata({
                                kind: typeof attachment.kind === "string" ? attachment.kind : null,
                                fileName: typeof attachment.fileName === "string" ? attachment.fileName : null,
                                contentType: typeof attachment.contentType === "string" ? attachment.contentType : null,
                            }))
                            .find((metadata) => metadata.isVoiceNote);
                        const contentPreview = typeof result.message.content === "string"
                            ? result.message.content
                            : "";

                        return {
                            messageId: result.message.id,
                            timestamp: new Date(result.message.timestampMs),
                            preview: contentPreview.trim().length > 0
                                ? contentPreview
                                : (voiceNoteMetadata?.isVoiceNote ? "Voice note" : ""),
                            resultKind: voiceNoteMetadata?.isVoiceNote ? "voice_note" : "text",
                            voiceDurationLabel: voiceNoteMetadata?.durationLabel ?? null,
                        } satisfies ChatHistorySearchResult;
                    })
                    .slice(0, 50);

                setHistorySearchResults(conversationResults);
            } finally {
                if (!cancelled) {
                    setIsHistorySearching(false);
                }
            }
        }, 250);

        return () => {
            cancelled = true;
            window.clearTimeout(debounceId);
        };
    }, [canSearchHistory, normalizedHistorySearchQuery, props.conversation.id]);

    const handleMessageMenuAnchorHoverChange = React.useCallback((params: { messageId: string; isHovered: boolean }): void => {
        setMessageMenuAnchorHoverId((current) => {
            if (params.isHovered) {
                return params.messageId;
            }
            return current === params.messageId ? null : current;
        });
    }, []);
    const handleJumpToMessageHandled = React.useCallback((messageId: string): void => {
        setJumpToMessageId((current) => (current === messageId ? null : current));
        setSearchFlashMessageId(messageId);
        if (searchFlashTimeoutRef.current) {
            window.clearTimeout(searchFlashTimeoutRef.current);
            searchFlashTimeoutRef.current = null;
        }
        searchFlashTimeoutRef.current = window.setTimeout(() => {
            setSearchFlashMessageId((current) => (current === messageId ? null : current));
            searchFlashTimeoutRef.current = null;
        }, 2200);
    }, []);

    React.useEffect(() => {
        return () => {
            if (searchFlashTimeoutRef.current) {
                window.clearTimeout(searchFlashTimeoutRef.current);
                searchFlashTimeoutRef.current = null;
            }
        };
    }, []);
    const handleOpenMessageMenu = React.useCallback((params: { messageId: string; x: number; y: number }): void => {
        setMessageMenu(params);
    }, [setMessageMenu]);
    const handleOpenReactionPicker = React.useCallback((params: { messageId: string; x: number; y: number }): void => {
        setReactionPicker(params);
    }, [setReactionPicker]);
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

    const {
        messageMenu,
        reactionPicker,
        messageMenuRef,
        reactionPickerRef,
    } = props;

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

        const menuAnchoredToHoveredBubble = messageMenuAnchorHoverId === messageMenu.messageId;
        if (menuAnchoredToHoveredBubble || isMessageMenuHovered) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setMessageMenu(null);
        }, 120);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [isMessageMenuHovered, messageMenu, messageMenuAnchorHoverId, setMessageMenu]);

    React.useEffect(() => {
        const handleEscapeDismiss = (event: KeyboardEvent): void => {
            if (event.key !== "Escape") {
                return;
            }

            let handled = false;

            if (lightboxIndex !== null) {
                setLightboxIndex(null);
                handled = true;
            } else if (isMediaGalleryOpen) {
                setIsMediaGalleryOpen(false);
                handled = true;
            } else if (messageMenu) {
                setMessageMenu(null);
                setMessageMenuAnchorHoverId(null);
                setIsMessageMenuHovered(false);
                handled = true;
            } else if (reactionPicker) {
                setReactionPicker(null);
                handled = true;
            } else if (isHistorySearchOpen) {
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
        isMediaGalleryOpen,
        lightboxIndex,
        messageMenu,
        reactionPicker,
        setIsMediaGalleryOpen,
        setLightboxIndex,
        setMessageMenu,
        setReactionPicker,
    ]);


    const activeMessage = messageMenu && getMessageById(messageMenu.messageId);
    const activeReactionMessage = reactionPicker && getMessageById(reactionPicker.messageId);

    return (
        <div
            className="group/chat-root flex flex-col flex-1 min-h-0 relative overflow-hidden"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <ChatHeader
                conversation={props.conversation}
                isOnline={props.isPeerOnline}
                interactionStatus={props.interactionStatus}
                nowMs={props.nowMs}
                onCopyPubkey={props.onCopyPubkey}
                onOpenMedia={props.onOpenMedia}
                onOpenInfo={props.onOpenInfo}
            />

            {props.conversation.kind === 'dm' && props.isPeerAccepted === false && (
                <StrangerWarningBanner
                    displayName={resolvedName}
                    isInitiator={props.isInitiator}
                    onAccept={() => props.onAcceptPeer?.()}
                    onIgnore={() => {
                        // For ignore, we can just close the banner by setting a local state or 
                        // by treating it as a "soft ignore" - for now, just same as accept but don't persist trust?
                        // Actually, implementation plan says Ignore should just hide it.
                        // We'll pass it to props if we want persistence.
                    }}
                    onBlock={() => props.onBlockPeer?.()}
                />
            )}

            <div className="pointer-events-none absolute bottom-[108px] right-4 z-40 flex w-[min(24rem,calc(100%-2rem))] flex-col items-end gap-2">
                <button
                    type="button"
                    onClick={() => setIsHistorySearchOpen((current) => !current)}
                    className={cn(
                        "inline-flex h-9 items-center gap-2 rounded-xl border border-black/10 bg-white/80 px-3 text-[11px] font-bold text-zinc-700 shadow-sm backdrop-blur transition-all dark:border-white/10 dark:bg-zinc-900/80 dark:text-zinc-200",
                        isHistorySearchOpen
                            ? "pointer-events-auto opacity-100 translate-y-0 hover:bg-white dark:hover:bg-zinc-900"
                            : "pointer-events-none translate-y-2 opacity-0 group-hover/chat-root:pointer-events-auto group-hover/chat-root:translate-y-0 group-hover/chat-root:opacity-100 group-focus-within/chat-root:pointer-events-auto group-focus-within/chat-root:translate-y-0 group-focus-within/chat-root:opacity-100 hover:bg-white dark:hover:bg-zinc-900",
                    )}
                >
                    <Search className="h-3.5 w-3.5" />
                    {t("messaging.searchMessagesInChat", "Search Messages")}
                </button>

                {isHistorySearchOpen ? (
                    <div
                        data-escape-layer="open"
                        className="pointer-events-auto w-full rounded-2xl border border-black/10 bg-white/85 p-2 shadow-lg backdrop-blur dark:border-white/10 dark:bg-zinc-950/85"
                    >
                        <div className="mb-2 flex items-center justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    setHistorySearchQuery("");
                                    setHistorySearchResults([]);
                                    setIsHistorySearchOpen(false);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white/70 text-zinc-500 transition-colors hover:text-zinc-800 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:text-zinc-100"
                                aria-label={t("common.close", "Close")}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                                <input
                                    value={historySearchQuery}
                                    onChange={(event) => {
                                        setHistorySearchQuery(event.target.value);
                                        setHistorySearchFilter("all");
                                    }}
                                    placeholder={t("messaging.searchMessagesInChatPlaceholder", "Search message history in this chat...")}
                                    className="h-10 w-full rounded-xl border border-black/10 bg-white/70 pl-9 pr-9 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none ring-purple-500/20 transition focus:border-purple-400/50 focus:ring-2 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                                    suppressHydrationWarning
                                />
                                {isHistorySearching ? (
                                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-purple-500/70" />
                                ) : null}
                            </div>

                            {canSearchHistory ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 px-0.5">
                                        <button
                                            type="button"
                                            onClick={() => setHistorySearchFilter("all")}
                                            className={cn(
                                                "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors",
                                                historySearchFilter === "all"
                                                    ? "border-zinc-400/30 bg-zinc-900/10 text-zinc-800 dark:border-zinc-300/30 dark:bg-zinc-100/10 dark:text-zinc-100"
                                                    : "border-black/10 bg-white/70 text-zinc-500 hover:text-zinc-800 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:text-zinc-100"
                                            )}
                                        >
                                            {t("common.all", "All")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHistorySearchFilter("voice_note")}
                                            className={cn(
                                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors",
                                                historySearchFilter === "voice_note"
                                                    ? "border-purple-400/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                                                    : "border-black/10 bg-white/70 text-zinc-500 hover:text-zinc-800 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:text-zinc-100"
                                            )}
                                        >
                                            <Mic className="h-2.5 w-2.5" />
                                            {t("messaging.voiceNotes", "Voice Notes")}
                                            <span className="text-[9px] opacity-80">{voiceNoteSearchResultCount}</span>
                                        </button>
                                    </div>

                                    <div className="max-h-44 overflow-y-auto rounded-xl border border-black/5 bg-white/70 p-1 dark:border-white/5 dark:bg-zinc-900/70">
                                    {filteredHistorySearchResults.length === 0 && !isHistorySearching ? (
                                        <p className="px-3 py-4 text-xs text-zinc-500">
                                            {historySearchFilter === "voice_note"
                                                ? t("messaging.noMatchingVoiceNotes", "No matching voice notes")
                                                : t("messaging.noMatchingMessages")}
                                        </p>
                                    ) : (
                                        filteredHistorySearchResults.map((result) => (
                                            <button
                                                key={result.messageId}
                                                type="button"
                                                onClick={() => handleJumpToMessage(result.messageId)}
                                                className="flex w-full flex-col items-start gap-1 rounded-lg px-3 py-2 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                                            >
                                                <div className="flex w-full items-center justify-between gap-2">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                                                        {formatTime(result.timestamp, resolvedNowMs)}
                                                    </span>
                                                    {result.resultKind === "voice_note" ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/30 bg-purple-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-300">
                                                            <Mic className="h-2.5 w-2.5" />
                                                            {result.voiceDurationLabel
                                                                ? `Voice Note ${result.voiceDurationLabel}`
                                                                : "Voice Note"}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <span className="line-clamp-2 text-xs text-zinc-800 dark:text-zinc-100">
                                                    {highlightText({ text: result.preview, query: historySearchQuery })}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </div>

            {props.messages.length === 0 && props.hasHydrated ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6 text-center opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-forwards delay-200">
                    <div className="relative">
                        <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center shadow-2xl shadow-purple-500/10 ring-1 ring-black/5 dark:ring-white/5">
                            <span className="relative text-4xl font-black text-zinc-300 dark:text-zinc-600 select-none overflow-hidden h-full w-full flex items-center justify-center rounded-3xl">
                                {metadata?.avatarUrl ? (
                                    <Image src={metadata.avatarUrl} alt={resolvedName} fill unoptimized className="object-cover" />
                                ) : (
                                    resolvedName[0]?.toUpperCase()
                                )}
                            </span>
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-full ring-4 ring-white dark:ring-black">
                            <Lock className="h-5 w-5" />
                        </div>
                    </div>

                    <div className="space-y-2 max-w-sm">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                            {resolvedName}
                        </h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                            {t("messaging.chatStart")}
                            {props.conversation.kind === 'dm' && !props.isPeerAccepted && (
                                <span className="block mt-1 text-purple-600 dark:text-purple-400 font-medium">
                                    {t("messaging.connectionRequestsNote")}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
            ) : (
                <MessageList
                    key={props.conversation.id}
                    hasHydrated={props.hasHydrated}
                    messages={props.messages}
                    rawMessagesCount={props.rawMessagesCount}
                    hasEarlierMessages={props.hasEarlierMessages}
                    onLoadEarlier={props.onLoadEarlier}
                    nowMs={props.nowMs}
                    flashMessageId={effectiveFlashMessageId}
                    jumpToMessageId={jumpToMessageId}
                    onJumpToMessageHandled={handleJumpToMessageHandled}
                    onOpenMessageMenu={handleOpenMessageMenu}
                    openMessageMenuMessageId={props.messageMenu?.messageId ?? null}
                    openReactionPickerMessageId={props.reactionPicker?.messageId ?? null}
                    onMessageMenuAnchorHoverChange={handleMessageMenuAnchorHoverChange}
                    onOpenReactionPicker={handleOpenReactionPicker}
                    onToggleReaction={props.onToggleReaction}
                    onRetryMessage={props.onRetryMessage}
                    onComposerFocus={() => props.composerTextareaRef.current?.focus()}
                    onReply={props.onReferenceMessage}
                    onImageClick={handleImageClick}
                    isGroup={props.conversation.kind === "group"}
                    admins={props.groupAdmins}
                    onSendDirectMessage={props.onSendDirectMessage}
                    pendingEventCount={props.pendingEventCount ?? 0}
                />
            )}

            <Composer
                messageInput={props.messageInput}
                setMessageInput={props.setMessageInput}
                handleSendMessage={props.handleSendMessage}
                isUploadingAttachment={props.isUploadingAttachment}
                uploadStage={props.uploadStage}
                pendingAttachments={props.pendingAttachments}
                pendingAttachmentPreviewUrls={props.pendingAttachmentPreviewUrls}
                attachmentError={props.attachmentError}
                replyTo={props.replyTo}
                setReplyTo={props.setReplyTo}
                onPickAttachments={props.onPickAttachments}
                onSelectFiles={props.onSelectFiles}
                removePendingAttachment={props.removePendingAttachment}
                clearPendingAttachment={props.clearPendingAttachment}
                relayStatus={props.relayStatus}
                textareaRef={props.composerTextareaRef}
                recipientStatus={props.recipientStatus}
                isPeerAccepted={props.isPeerAccepted}
                isInitiator={props.isInitiator}
                onSendVoiceNote={props.onSendVoiceNote}
                isProcessingMedia={props.isProcessingMedia}
                mediaProcessingProgress={props.mediaProcessingProgress}
            />

            {props.messageMenu && activeMessage && (
                <MessageMenu
                    x={props.messageMenu.x}
                    y={props.messageMenu.y}
                    activeMessage={activeMessage}
                    onCopyText={() => {
                        props.onCopyText(activeMessage.content);
                        props.setMessageMenu(null);
                    }}
                    onCopyAttachmentUrl={() => {
                        const firstAttachment = activeMessage.attachments?.[0];
                        if (firstAttachment) {
                            props.onCopyAttachmentUrl(firstAttachment.url);
                        }
                        props.setMessageMenu(null);
                    }}
                    onReply={() => {
                        props.onReferenceMessage(activeMessage);
                        props.setMessageMenu(null);
                    }}
                    onDeleteForMe={() => {
                        props.onDeleteMessageForMe(activeMessage);
                        props.setMessageMenu(null);
                    }}
                    onDeleteForEveryone={() => {
                        props.onDeleteMessageForEveryone(activeMessage);
                        props.setMessageMenu(null);
                    }}
                    menuRef={props.messageMenuRef}
                    onHoverChange={setIsMessageMenuHovered}
                    onRequestClose={() => {
                        props.setMessageMenu(null);
                        setMessageMenuAnchorHoverId(null);
                        setIsMessageMenuHovered(false);
                    }}
                />
            )}

            {props.reactionPicker && (
                <ReactionPicker
                    messageId={props.reactionPicker.messageId}
                    isOutgoing={activeReactionMessage?.isOutgoing ?? false}
                    x={props.reactionPicker.x}
                    y={props.reactionPicker.y}
                    onSelect={(emoji) => {
                        const msg = getMessageById(props.reactionPicker!.messageId);
                        if (msg) {
                            props.onToggleReaction(msg, emoji);
                        }
                        props.setReactionPicker(null);
                    }}
                    pickerRef={props.reactionPickerRef}
                    onRequestClose={() => props.setReactionPicker(null)}
                />
            )}

            <MediaGallery
                isOpen={props.isMediaGalleryOpen}
                onClose={() => props.setIsMediaGalleryOpen(false)}
                conversationDisplayName={resolvedName}
                mediaItems={props.selectedConversationMediaItems}
                onSelect={props.setLightboxIndex}
            />

            {props.lightboxIndex !== null && (
                <Lightbox
                    item={props.selectedConversationMediaItems[props.lightboxIndex]}
                    onClose={() => props.setLightboxIndex(null)}
                    onPrev={() => props.setLightboxIndex(props.lightboxIndex! - 1)}
                    onNext={() => props.setLightboxIndex(props.lightboxIndex! + 1)}
                    hasPrev={props.lightboxIndex > 0}
                    hasNext={props.lightboxIndex < props.selectedConversationMediaItems.length - 1}
                />
            )}

            {isDragging && (
                <div className="absolute inset-0 z-[100] bg-purple-600/10 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200 pointer-events-none">
                    <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-12 border-2 border-dashed border-purple-500 flex flex-col items-center gap-4 shadow-2xl scale-110 transition-transform">
                        <div className="h-20 w-20 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                            <UploadCloud className="h-10 w-10" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{t("messaging.dropToUpload")}</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t("messaging.dropToUploadDesc")}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
