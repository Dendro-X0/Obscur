
import React, { useState } from "react";
import { ChatHeader } from "./chat-header";
import { StrangerWarningBanner } from "./stranger-warning-banner";
import { MessageList } from "./message-list";
import { Composer } from "./composer";
import { MediaGallery } from "./media-gallery";
import { Lightbox } from "./lightbox";
import { MessageMenu } from "./message-menu";
import { ReactionPicker } from "./reaction-picker";
import { Lock, UploadCloud } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Conversation, Message, MediaItem, ReactionEmoji, ReplyTo, RelayStatusSummary } from "../types";

export interface ChatViewProps {
    conversation: Conversation;
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
    onDeleteMessage: (messageId: string) => void;

    // Reaction Picker
    reactionPicker: { messageId: string; x: number; y: number } | null;
    setReactionPicker: (val: { messageId: string; x: number; y: number } | null) => void;
    reactionPickerRef: React.RefObject<HTMLDivElement | null>;
    onToggleReaction: (messageId: string, emoji: ReactionEmoji) => void;

    onRetryMessage: (message: Message) => void;

    // Composer Props
    messageInput: string;
    setMessageInput: (val: string) => void;
    handleSendMessage: () => void;
    isUploadingAttachment: boolean;
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

    // Media
    isMediaGalleryOpen: boolean;
    setIsMediaGalleryOpen: (val: boolean) => void;
    selectedConversationMediaItems: ReadonlyArray<MediaItem>;
    lightboxIndex: number | null;
    setLightboxIndex: (val: number | null) => void;
    recipientStatus?: 'idle' | 'found' | 'not_found' | 'verifying';
    isPeerAccepted?: boolean;
    onAcceptPeer?: () => void;
    onBlockPeer?: () => void;
}

export function ChatView(props: ChatViewProps) {
    const { t } = useTranslation();
    const [isDragging, setIsDragging] = useState(false);

    const getMessageById = (messageId: string): Message | undefined => {
        return props.messages.find(m => m.id === messageId);
    };

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

    const activeMessage = props.messageMenu && getMessageById(props.messageMenu.messageId);

    return (
        <div
            className="flex flex-col h-full h-[100dvh] relative overflow-hidden"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <ChatHeader
                conversation={props.conversation}
                onCopyPubkey={props.onCopyPubkey}
                onOpenMedia={props.onOpenMedia}
                onOpenInfo={props.onOpenInfo}
            />

            {props.conversation.kind === 'dm' && props.isPeerAccepted === false && (
                <StrangerWarningBanner
                    displayName={props.conversation.displayName}
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

            {props.messages.length === 0 && props.hasHydrated ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6 text-center opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-forwards delay-200">
                    <div className="relative">
                        <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center shadow-2xl shadow-purple-500/10 ring-1 ring-black/5 dark:ring-white/5">
                            <span className="text-4xl font-black text-zinc-300 dark:text-zinc-600 select-none">
                                {props.conversation.displayName?.[0]?.toUpperCase()}
                            </span>
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-full ring-4 ring-white dark:ring-black">
                            <Lock className="h-4 w-4" />
                        </div>
                    </div>

                    <div className="space-y-2 max-w-sm">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                            {props.conversation.displayName}
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
                    hasHydrated={props.hasHydrated}
                    messages={props.messages}
                    rawMessagesCount={props.rawMessagesCount}
                    hasEarlierMessages={props.hasEarlierMessages}
                    onLoadEarlier={props.onLoadEarlier}
                    nowMs={props.nowMs}
                    flashMessageId={props.flashMessageId}
                    onOpenMessageMenu={(params) => props.setMessageMenu(params)}
                    onOpenReactionPicker={(params) => props.setReactionPicker(params)}
                    onToggleReaction={props.onToggleReaction}
                    onRetryMessage={props.onRetryMessage}
                    onComposerFocus={() => props.composerTextareaRef.current?.focus()}
                    onReply={props.onReferenceMessage}
                    isGroup={props.conversation.kind === "group"}
                />
            )}

            <Composer
                messageInput={props.messageInput}
                setMessageInput={props.setMessageInput}
                handleSendMessage={props.handleSendMessage}
                isUploadingAttachment={props.isUploadingAttachment}
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
                    onDelete={() => {
                        props.onDeleteMessage(activeMessage.id);
                        props.setMessageMenu(null);
                    }}
                    menuRef={props.messageMenuRef}
                />
            )}

            {props.reactionPicker && (
                <ReactionPicker
                    x={props.reactionPicker.x}
                    y={props.reactionPicker.y}
                    onSelect={(emoji) => {
                        props.onToggleReaction(props.reactionPicker!.messageId, emoji);
                        props.setReactionPicker(null);
                    }}
                    pickerRef={props.reactionPickerRef}
                />
            )}

            <MediaGallery
                isOpen={props.isMediaGalleryOpen}
                onClose={() => props.setIsMediaGalleryOpen(false)}
                conversationDisplayName={props.conversation.displayName}
                mediaItems={props.selectedConversationMediaItems}
                onSelect={props.setLightboxIndex}
            />

            {props.lightboxIndex !== null && (
                <Lightbox
                    item={props.selectedConversationMediaItems[props.lightboxIndex]}
                    onClose={() => props.setLightboxIndex(null)}
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
