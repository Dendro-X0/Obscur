"use client";

import React, { createContext, useContext, useState, useMemo, useEffect, useRef } from "react";
import type {
    Conversation,
    UnreadByConversationId,
    ContactOverridesByContactId,
    MessagesByConversationId,
    ReplyTo,
    DmConversation,
    PersistedDmConversation
} from "../types";
import {
    loadPersistedChatState,
    fromPersistedDmConversation,
    fromPersistedMessagesByConversationId,
    fromPersistedOverridesByContactId,
} from "../utils/persistence";

interface MessagingContextType {
    createdContacts: ReadonlyArray<DmConversation>;
    setCreatedContacts: React.Dispatch<React.SetStateAction<ReadonlyArray<DmConversation>>>;
    selectedConversation: Conversation | null;
    setSelectedConversation: (conv: Conversation | null) => void;
    unreadByConversationId: UnreadByConversationId;
    setUnreadByConversationId: React.Dispatch<React.SetStateAction<UnreadByConversationId>>;
    contactOverridesByContactId: ContactOverridesByContactId;
    setContactOverridesByContactId: React.Dispatch<React.SetStateAction<ContactOverridesByContactId>>;
    messagesByConversationId: MessagesByConversationId;
    setMessagesByConversationId: React.Dispatch<React.SetStateAction<MessagesByConversationId>>;
    visibleMessageCountByConversationId: Readonly<Record<string, number>>;
    setVisibleMessageCountByConversationId: React.Dispatch<React.SetStateAction<Readonly<Record<string, number>>>>;
    replyTo: ReplyTo | null;
    setReplyTo: (reply: ReplyTo | null) => void;

    // Attachments
    pendingAttachments: ReadonlyArray<File>;
    setPendingAttachments: React.Dispatch<React.SetStateAction<ReadonlyArray<File>>>;
    pendingAttachmentPreviewUrls: ReadonlyArray<string>;
    setPendingAttachmentPreviewUrls: React.Dispatch<React.SetStateAction<ReadonlyArray<string>>>;
    isUploadingAttachment: boolean;
    setIsUploadingAttachment: (uploading: boolean) => void;
    attachmentError: string | null;
    setAttachmentError: (error: string | null) => void;

    // Persistence
    hasHydrated: boolean;

    // UI State
    sidebarTab: "chats" | "requests";
    setSidebarTab: (tab: "chats" | "requests") => void;
    messageInput: string;
    setMessageInput: (input: string) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    isNewChatOpen: boolean;
    setIsNewChatOpen: (open: boolean) => void;
    newChatPubkey: string;
    setNewChatPubkey: (pubkey: string) => void;
    newChatDisplayName: string;
    setNewChatDisplayName: (name: string) => void;
    isMediaGalleryOpen: boolean;
    setIsMediaGalleryOpen: (open: boolean) => void;
    lightboxIndex: number | null;
    setLightboxIndex: (index: number | null) => void;
    flashMessageId: string | null;
    setFlashMessageId: (id: string | null) => void;
    pendingScrollTarget: Readonly<{ conversationId: string; messageId: string }> | null;
    setPendingScrollTarget: (target: Readonly<{ conversationId: string; messageId: string }> | null) => void;
    messageMenu: Readonly<{ messageId: string; x: number; y: number }> | null;
    setMessageMenu: (menu: Readonly<{ messageId: string; x: number; y: number }> | null) => void;
    reactionPicker: Readonly<{ messageId: string; x: number; y: number }> | null;
    setReactionPicker: (picker: Readonly<{ messageId: string; x: number; y: number }> | null) => void;

    // Derived
    chatsUnreadCount: number;
}

const MessagingContext = createContext<MessagingContextType | null>(null);

export const MessagingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [createdContacts, setCreatedContacts] = useState<ReadonlyArray<DmConversation>>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [unreadByConversationId, setUnreadByConversationId] = useState<UnreadByConversationId>({});
    const [contactOverridesByContactId, setContactOverridesByContactId] = useState<ContactOverridesByContactId>({});
    const [messagesByConversationId, setMessagesByConversationId] = useState<MessagesByConversationId>({});
    const [visibleMessageCountByConversationId, setVisibleMessageCountByConversationId] = useState<Readonly<Record<string, number>>>({});
    const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);

    const [hasHydrated, setHasHydrated] = useState(false);
    const didHydrateRef = useRef(false);

    // Attachments
    const [pendingAttachments, setPendingAttachments] = useState<ReadonlyArray<File>>([]);
    const [pendingAttachmentPreviewUrls, setPendingAttachmentPreviewUrls] = useState<ReadonlyArray<string>>([]);
    const [isUploadingAttachment, setIsUploadingAttachment] = useState<boolean>(false);
    const [attachmentError, setAttachmentError] = useState<string | null>(null);

    // UI State
    const [sidebarTab, setSidebarTab] = useState<"chats" | "requests">("chats");
    const [messageInput, setMessageInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [newChatPubkey, setNewChatPubkey] = useState("");
    const [newChatDisplayName, setNewChatDisplayName] = useState("");
    const [isMediaGalleryOpen, setIsMediaGalleryOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [flashMessageId, setFlashMessageId] = useState<string | null>(null);
    const [pendingScrollTarget, setPendingScrollTarget] = useState<Readonly<{ conversationId: string; messageId: string }> | null>(null);
    const [messageMenu, setMessageMenu] = useState<Readonly<{ messageId: string; x: number; y: number }> | null>(null);
    const [reactionPicker, setReactionPicker] = useState<Readonly<{ messageId: string; x: number; y: number }> | null>(null);

    // Persistence: Hydration
    useEffect(() => {
        if (didHydrateRef.current) return;

        const persisted = loadPersistedChatState();
        if (persisted) {
            const nextCreatedContacts: ReadonlyArray<DmConversation> = persisted.createdContacts
                .map((c: PersistedDmConversation): DmConversation | null => fromPersistedDmConversation(c))
                .filter((c: DmConversation | null): c is DmConversation => c !== null);

            queueMicrotask(() => {
                setCreatedContacts(nextCreatedContacts);
                setUnreadByConversationId(persisted.unreadByConversationId);
                setContactOverridesByContactId(fromPersistedOverridesByContactId(persisted.contactOverridesByContactId));
                setMessagesByConversationId(fromPersistedMessagesByConversationId(persisted.messagesByConversationId));
                setHasHydrated(true);
            });
        } else {
            queueMicrotask(() => {
                setHasHydrated(true);
            });
        }
        didHydrateRef.current = true;
    }, []);

    const chatsUnreadCount = useMemo(() => {
        return Object.values(unreadByConversationId).reduce((sum, count) => sum + count, 0);
    }, [unreadByConversationId]);

    const value = useMemo(() => ({
        createdContacts,
        setCreatedContacts,
        selectedConversation,
        setSelectedConversation,
        unreadByConversationId,
        setUnreadByConversationId,
        contactOverridesByContactId,
        setContactOverridesByContactId,
        messagesByConversationId,
        setMessagesByConversationId,
        visibleMessageCountByConversationId,
        setVisibleMessageCountByConversationId,
        replyTo,
        setReplyTo,
        pendingAttachments,
        setPendingAttachments,
        pendingAttachmentPreviewUrls,
        setPendingAttachmentPreviewUrls,
        isUploadingAttachment,
        setIsUploadingAttachment,
        attachmentError,
        setAttachmentError,
        hasHydrated,
        sidebarTab,
        setSidebarTab,
        messageInput,
        setMessageInput,
        searchQuery,
        setSearchQuery,
        isNewChatOpen,
        setIsNewChatOpen,
        newChatPubkey,
        setNewChatPubkey,
        newChatDisplayName,
        setNewChatDisplayName,
        isMediaGalleryOpen,
        setIsMediaGalleryOpen,
        lightboxIndex,
        setLightboxIndex,
        flashMessageId,
        setFlashMessageId,
        pendingScrollTarget,
        setPendingScrollTarget,
        messageMenu,
        setMessageMenu,
        reactionPicker,
        setReactionPicker,
        chatsUnreadCount
    }), [
        createdContacts,
        selectedConversation,
        unreadByConversationId,
        contactOverridesByContactId,
        messagesByConversationId,
        visibleMessageCountByConversationId,
        replyTo,
        pendingAttachments,
        pendingAttachmentPreviewUrls,
        isUploadingAttachment,
        attachmentError,
        hasHydrated,
        sidebarTab,
        messageInput,
        searchQuery,
        isNewChatOpen,
        newChatPubkey,
        newChatDisplayName,
        isMediaGalleryOpen,
        lightboxIndex,
        flashMessageId,
        pendingScrollTarget,
        messageMenu,
        reactionPicker,
        chatsUnreadCount
    ]);

    return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
};

export const useMessaging = () => {
    const context = useContext(MessagingContext);
    if (!context) {
        throw new Error("useMessaging must be used within a MessagingProvider");
    }
    return context;
};
