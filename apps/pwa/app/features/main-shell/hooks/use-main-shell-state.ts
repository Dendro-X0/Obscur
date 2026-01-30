
import { useState, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRouter, useSearchParams } from "next/navigation";
import type { Conversation, DmConversation, GroupConversation, Message, UnreadByConversationId, ContactOverridesByContactId, MessagesByConversationId, ReplyTo } from "@/app/features/messaging/types";

export function useMainShellState() {
    const { t } = useTranslation();
    const didHydrateFromStorageRef = useRef<boolean>(false);
    const handledIncomingDmIdsRef = useRef<Set<string>>(new Set<string>());
    const handledAcceptedOutgoingDmIdsRef = useRef<Set<string>>(new Set<string>());
    const handledRejectedOutgoingDmIdsRef = useRef<Set<string>>(new Set<string>());
    const handledSearchParamPubkeyRef = useRef<string | null>(null);

    const messageMenuRef = useRef<HTMLDivElement | null>(null);
    const reactionPickerRef = useRef<HTMLDivElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);

    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messageInput, setMessageInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [hasHydrated, setHasHydrated] = useState<boolean>(false);

    const [isNewChatOpen, setIsNewChatOpen] = useState<boolean>(false);
    const [newChatPubkey, setNewChatPubkey] = useState<string>("");
    const [newChatDisplayName, setNewChatDisplayName] = useState<string>("");

    const [isNewGroupOpen, setIsNewGroupOpen] = useState<boolean>(false);
    const [newGroupName, setNewGroupName] = useState<string>("");
    const [newGroupMemberPubkeys, setNewGroupMemberPubkeys] = useState<string>("");

    const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
    const [unreadByConversationId, setUnreadByConversationId] = useState<UnreadByConversationId>({});
    const [contactOverridesByContactId, setContactOverridesByContactId] = useState<ContactOverridesByContactId>({});
    const [messagesByConversationId, setMessagesByConversationId] = useState<MessagesByConversationId>({});
    const [visibleMessageCountByConversationId, setVisibleMessageCountByConversationId] = useState<Readonly<Record<string, number>>>({});

    const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
    const [pendingAttachmentPreviewUrl, setPendingAttachmentPreviewUrl] = useState<string | null>(null);
    const [isUploadingAttachment, setIsUploadingAttachment] = useState<boolean>(false);
    const [attachmentError, setAttachmentError] = useState<string | null>(null);

    const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
    const [messageMenu, setMessageMenu] = useState<Readonly<{ messageId: string; x: number; y: number }> | null>(null);
    const [reactionPicker, setReactionPicker] = useState<Readonly<{ messageId: string; x: number; y: number }> | null>(null);
    const [pendingScrollTarget, setPendingScrollTarget] = useState<Readonly<{ conversationId: string; messageId: string }> | null>(null);
    const [flashMessageId, setFlashMessageId] = useState<string | null>(null);

    const [isMediaGalleryOpen, setIsMediaGalleryOpen] = useState<boolean>(false);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [sidebarTab, setSidebarTab] = useState<"chats" | "requests">("chats");

    const [createdContacts, setCreatedContacts] = useState<ReadonlyArray<DmConversation>>([]);
    const [createdGroups, setCreatedGroups] = useState<ReadonlyArray<GroupConversation>>([]);
    const [recipientVerificationStatus, setRecipientVerificationStatus] = useState<Readonly<Record<string, 'idle' | 'found' | 'not_found' | 'verifying'>>>({});

    return {
        refs: {
            didHydrateFromStorageRef,
            handledIncomingDmIdsRef,
            handledAcceptedOutgoingDmIdsRef,
            handledRejectedOutgoingDmIdsRef,
            handledSearchParamPubkeyRef,
            messageMenuRef,
            reactionPickerRef,
            searchInputRef,
            composerTextareaRef,
        },
        state: {
            selectedConversation,
            messageInput,
            searchQuery,
            hasHydrated,
            isNewChatOpen,
            newChatPubkey,
            newChatDisplayName,
            isNewGroupOpen,
            newGroupName,
            newGroupMemberPubkeys,
            showOnboarding,
            unreadByConversationId,
            contactOverridesByContactId,
            messagesByConversationId,
            visibleMessageCountByConversationId,
            pendingAttachment,
            pendingAttachmentPreviewUrl,
            isUploadingAttachment,
            attachmentError,
            replyTo,
            messageMenu,
            reactionPicker,
            pendingScrollTarget,
            flashMessageId,
            isMediaGalleryOpen,
            lightboxIndex,
            sidebarTab,
            createdContacts,
            createdGroups,
            recipientVerificationStatus,
        },
        setters: {
            setSelectedConversation,
            setMessageInput,
            setSearchQuery,
            setHasHydrated,
            setIsNewChatOpen,
            setNewChatPubkey,
            setNewChatDisplayName,
            setIsNewGroupOpen,
            setNewGroupName,
            setNewGroupMemberPubkeys,
            setShowOnboarding,
            setUnreadByConversationId,
            setContactOverridesByContactId,
            setMessagesByConversationId,
            setVisibleMessageCountByConversationId,
            setPendingAttachment,
            setPendingAttachmentPreviewUrl,
            setIsUploadingAttachment,
            setAttachmentError,
            setReplyTo,
            setMessageMenu,
            setReactionPicker,
            setPendingScrollTarget,
            setFlashMessageId,
            setIsMediaGalleryOpen,
            setLightboxIndex,
            setSidebarTab,
            setCreatedContacts,
            setCreatedGroups,
            setRecipientVerificationStatus,
        }
    };
}
