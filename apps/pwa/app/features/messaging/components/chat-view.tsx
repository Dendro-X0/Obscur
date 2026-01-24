
import React from "react";
import { ChatHeader } from "./chat-header";
import { MessageList } from "./message-list";
import { Composer } from "./composer";
import { MediaGallery } from "./media-gallery";
import { Lightbox } from "./lightbox";
import { MessageMenu } from "./message-menu";
import { ReactionPicker } from "./reaction-picker";
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
    pendingAttachment: File | null;
    pendingAttachmentPreviewUrl: string | null;
    attachmentError: string | null;
    replyTo: ReplyTo | null;
    setReplyTo: (val: ReplyTo | null) => void;
    onPickAttachment: (file: File | null) => void;
    clearPendingAttachment: () => void;
    relayStatus: RelayStatusSummary;
    composerTextareaRef: React.RefObject<HTMLTextAreaElement | null>;

    // Media
    isMediaGalleryOpen: boolean;
    setIsMediaGalleryOpen: (val: boolean) => void;
    selectedConversationMediaItems: ReadonlyArray<MediaItem>;
    lightboxIndex: number | null;
    setLightboxIndex: (val: number | null) => void;
}

export function ChatView(props: ChatViewProps) {
    const getMessageById = (messageId: string): Message | undefined => {
        return props.messages.find(m => m.id === messageId);
    };

    const activeMessage = props.messageMenu && getMessageById(props.messageMenu.messageId);

    return (
        <>
            <ChatHeader
                conversation={props.conversation}
                onCopyPubkey={props.onCopyPubkey}
                onOpenMedia={props.onOpenMedia}
            />

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
            />

            <Composer
                messageInput={props.messageInput}
                setMessageInput={props.setMessageInput}
                handleSendMessage={props.handleSendMessage}
                isUploadingAttachment={props.isUploadingAttachment}
                pendingAttachment={props.pendingAttachment}
                pendingAttachmentPreviewUrl={props.pendingAttachmentPreviewUrl}
                attachmentError={props.attachmentError}
                replyTo={props.replyTo}
                setReplyTo={props.setReplyTo}
                onPickAttachment={props.onPickAttachment}
                clearPendingAttachment={props.clearPendingAttachment}
                relayStatus={props.relayStatus}
                textareaRef={props.composerTextareaRef}
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
                        if (activeMessage.attachment) {
                            props.onCopyAttachmentUrl(activeMessage.attachment.url);
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
        </>
    );
}
