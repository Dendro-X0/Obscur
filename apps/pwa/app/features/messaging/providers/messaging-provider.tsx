"use client";

import React, { createContext, useContext, useState, useMemo, useEffect } from "react";
import { useIdentity } from "../../auth/hooks/use-identity";
import { messageBus } from "../services/message-bus";
import { messagePersistenceService } from "../services/message-persistence-service";
import type {
    Conversation,
    UnreadByConversationId,
    ConnectionOverridesByConnectionId,
    MessagesByConversationId,
    ReplyTo,
    DmConversation,
    Message,
    PersistedDmConversation,
    PersistedGroupMessage,
    PublicKeyHex
} from "../types";
import { chatStateStoreService } from "../services/chat-state-store";
import {
    toPersistedDmConversation,
    fromPersistedDmConversation,
    fromPersistedMessagesByConversationId,
    toPersistedMessagesByConversationId,
    fromPersistedOverridesByConnectionId,
    toPersistedOverridesByConnectionId,
} from "../utils/persistence";

interface MessagingContextType {
    createdConnections: ReadonlyArray<DmConversation>;
    setCreatedConnections: React.Dispatch<React.SetStateAction<ReadonlyArray<DmConversation>>>;
    selectedConversation: Conversation | null;
    setSelectedConversation: (conv: Conversation | null) => void;
    unreadByConversationId: UnreadByConversationId;
    setUnreadByConversationId: React.Dispatch<React.SetStateAction<UnreadByConversationId>>;
    connectionOverridesByConnectionId: ConnectionOverridesByConnectionId;
    setConnectionOverridesByConnectionId: React.Dispatch<React.SetStateAction<ConnectionOverridesByConnectionId>>;
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
    isProcessingMedia: boolean;
    setIsProcessingMedia: (processing: boolean) => void;
    mediaProcessingProgress: number;
    setMediaProcessingProgress: (progress: number) => void;

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

    pinnedChatIds: ReadonlyArray<string>;
    togglePin: (conversationId: string) => void;
    hiddenChatIds: ReadonlyArray<string>;
    hideConversation: (conversationId: string) => void;
    unhideConversation: (conversationId: string) => void;
    deleteConversation: (conversationId: string) => void;
    clearHistory: (conversationId: string) => void;

    // Derived
    chatsUnreadCount: number;
}

const MessagingContext = createContext<MessagingContextType | null>(null);

export const MessagingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const identity = useIdentity();
    const [createdConnections, setCreatedConnections] = useState<ReadonlyArray<DmConversation>>([]);
    const [selectedConversationState, setSelectedConversationState] = useState<Conversation | null>(null);
    const [unreadByConversationId, setUnreadByConversationId] = useState<UnreadByConversationId>({});
    const [connectionOverridesByConnectionId, setConnectionOverridesByConnectionId] = useState<ConnectionOverridesByConnectionId>({});
    // Removed: const [messagesByConversationId, setMessagesByConversationId] = useState<MessagesByConversationId>({});
    const [visibleMessageCountByConversationId, setVisibleMessageCountByConversationId] = useState<Readonly<Record<string, number>>>({});
    const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);

    const publicKeyHex = (identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null);

    const setSelectedConversation = React.useCallback((conv: Conversation | null) => {
        setSelectedConversationState(conv);
        if (publicKeyHex) {
            if (conv) {
                localStorage.setItem(`obscur-last-chat-${publicKeyHex}`, conv.id);
            } else {
                localStorage.removeItem(`obscur-last-chat-${publicKeyHex}`);
            }
        }
    }, [publicKeyHex]);

    const selectedConversation = selectedConversationState;
    const [hasHydrated, setHasHydrated] = useState(false);

    // Attachments
    const [pendingAttachments, setPendingAttachments] = useState<ReadonlyArray<File>>([]);
    const [pendingAttachmentPreviewUrls, setPendingAttachmentPreviewUrls] = useState<ReadonlyArray<string>>([]);
    const [isUploadingAttachment, setIsUploadingAttachment] = useState<boolean>(false);
    const [attachmentError, setAttachmentError] = useState<string | null>(null);
    const [isProcessingMedia, setIsProcessingMedia] = useState<boolean>(false);
    const [mediaProcessingProgress, setMediaProcessingProgress] = useState<number>(0);

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

    const [pinnedChatIds, setPinnedChatIds] = useState<ReadonlyArray<string>>([]);
    const [hiddenChatIds, setHiddenChatIds] = useState<ReadonlyArray<string>>([]);

    // Initialize persistence service
    useEffect(() => {
        messagePersistenceService.init();
    }, []);

    const togglePin = (conversationId: string) => {
        setPinnedChatIds(prev => {
            const next = prev.includes(conversationId)
                ? prev.filter(id => id !== conversationId)
                : [...prev, conversationId];
            if (publicKeyHex) chatStateStoreService.updatePinnedChats(publicKeyHex, next);
            return next;
        });
    };

    const hideConversation = (conversationId: string) => {
        setHiddenChatIds(prev => {
            const next = prev.includes(conversationId) ? prev : [...prev, conversationId];
            if (publicKeyHex) chatStateStoreService.updateHiddenChats(publicKeyHex, next);
            return next;
        });
    };

    const unhideConversation = (conversationId: string) => {
        setHiddenChatIds(prev => {
            const next = prev.filter(id => id !== conversationId);
            if (publicKeyHex) chatStateStoreService.updateHiddenChats(publicKeyHex, next);
            return next;
        });
    };

    const clearHistory = (conversationId: string) => {
        chatStateStoreService.deleteConversationMessages(conversationId);
        messageBus.emit({ type: 'message_deleted', conversationId, messageId: 'all' });
        // Also update the conversation list last message preview
        setCreatedConnections(prev => prev.map(c =>
            c.id === conversationId ? { ...c, lastMessage: '', lastMessageTime: new Date() } : c
        ));
    };

    const deleteConversation = (conversationId: string) => {
        hideConversation(conversationId);
        clearHistory(conversationId);
    };

    // Persistence: Hydration
    useEffect(() => {
        if (hasHydrated) return;
        if (!publicKeyHex) return;

        const persisted = chatStateStoreService.load(publicKeyHex);
        if (persisted) {
            const nextCreatedConnections: ReadonlyArray<DmConversation> = persisted.createdConnections
                .map((c: PersistedDmConversation): DmConversation | null => fromPersistedDmConversation(c))
                .filter((c: DmConversation | null): c is DmConversation => c !== null);

            setCreatedConnections(nextCreatedConnections);
            setUnreadByConversationId(persisted.unreadByConversationId);
            setConnectionOverridesByConnectionId(fromPersistedOverridesByConnectionId(persisted.connectionOverridesByConnectionId));

            if (persisted.pinnedChatIds) setPinnedChatIds(persisted.pinnedChatIds);
            if (persisted.hiddenChatIds) setHiddenChatIds(persisted.hiddenChatIds);

            // Trigger migration to new messages store
            messagePersistenceService.migrateFromLegacy(publicKeyHex);
        }

        setHasHydrated(true);
    }, [publicKeyHex, hasHydrated]);

    useEffect(() => {
        if (!selectedConversation || !hasHydrated) {
            return;
        }
        const conversationId = selectedConversation.id;
        queueMicrotask(() => {
            setUnreadByConversationId(prev => {
                if (prev[conversationId] === 0) return prev;
                const next = { ...prev, [conversationId]: 0 };
                if (publicKeyHex) chatStateStoreService.updateUnreadCounts(publicKeyHex, next);
                return next;
            });
        });
    }, [selectedConversation?.id, hasHydrated, publicKeyHex]);

    const updateCreatedConnections: React.Dispatch<React.SetStateAction<ReadonlyArray<DmConversation>>> = (updater) => {
        setCreatedConnections(prev => {
            const next = typeof updater === "function" ? updater(prev) : updater;
            if (publicKeyHex) {
                chatStateStoreService.updateConnections(publicKeyHex, next.map(c => toPersistedDmConversation(c)));
            }
            return next;
        });
    };

    const updateUnreadByConversationId: React.Dispatch<React.SetStateAction<UnreadByConversationId>> = (updater) => {
        setUnreadByConversationId(prev => {
            const next = typeof updater === "function" ? updater(prev) : updater;
            if (publicKeyHex) {
                chatStateStoreService.updateUnreadCounts(publicKeyHex, next);
            }
            return next;
        });
    };

    const updateConnectionOverridesByConnectionId: React.Dispatch<React.SetStateAction<ConnectionOverridesByConnectionId>> = (updater) => {
        setConnectionOverridesByConnectionId(prev => {
            const next = typeof updater === "function" ? updater(prev) : updater;
            if (publicKeyHex) {
                chatStateStoreService.updateConnectionOverrides(publicKeyHex, toPersistedOverridesByConnectionId(next));
            }
            return next;
        });
    };

    // Removed: const updateMessagesByConversationId ...

    const chatsUnreadCount = useMemo(() => {
        return Object.values(unreadByConversationId).reduce((sum, count) => sum + count, 0);
    }, [unreadByConversationId]);

    const value = useMemo(() => ({
        createdConnections,
        setCreatedConnections: updateCreatedConnections,
        selectedConversation,
        setSelectedConversation,
        unreadByConversationId,
        setUnreadByConversationId: updateUnreadByConversationId,
        connectionOverridesByConnectionId,
        setConnectionOverridesByConnectionId: updateConnectionOverridesByConnectionId,
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
        isProcessingMedia,
        setIsProcessingMedia,
        mediaProcessingProgress,
        setMediaProcessingProgress,
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
        pinnedChatIds,
        togglePin,
        hiddenChatIds,
        hideConversation,
        unhideConversation,
        deleteConversation,
        clearHistory,
        chatsUnreadCount
    }), [
        createdConnections,
        selectedConversation,
        unreadByConversationId,
        connectionOverridesByConnectionId,
        visibleMessageCountByConversationId,
        replyTo,
        pendingAttachments,
        pendingAttachmentPreviewUrls,
        isUploadingAttachment,
        attachmentError,
        isProcessingMedia,
        mediaProcessingProgress,
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
        pinnedChatIds,
        hiddenChatIds,
        chatsUnreadCount,
        publicKeyHex,
        clearHistory
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
