"use client";

import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from "react";
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
    PersistedChatState,
    PersistedDmConversation,
    PersistedGroupMessage,
    PublicKeyHex
} from "../types";
import {
    chatStateStoreService,
    CHAT_STATE_REPLACED_EVENT,
    type ChatStateReplacedEventDetail,
} from "../services/chat-state-store";
import { isGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { useOptionalProfileMessageBus, useResolvedClientGateway } from "@/app/features/profiles/providers/profile-runtime-provider";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { subscribeChatStateReplacedDual } from "@/app/features/profiles/services/subscribe-chat-state-replaced-dual";
import { subscribeMessagesIndexRebuiltDual } from "@/app/features/profiles/services/subscribe-messages-index-rebuilt-dual";
import { useAccountProjectionSnapshot } from "@/app/features/account-sync/hooks/use-account-projection-snapshot";
import { resolveProjectionReadAuthority } from "@/app/features/account-sync/services/account-projection-read-authority";
import { selectProjectionDmConversations } from "@/app/features/account-sync/services/account-projection-selectors";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
    scheduleExperimentIdleWork,
    shouldDeferExperimentHeavyWork,
} from "@/app/features/runtime/experiment-shell-policy";
import {
    toPersistedDmConversation,
    fromPersistedDmConversation,
    fromPersistedMessagesByConversationId,
    toPersistedMessagesByConversationId,
    fromPersistedOverridesByConnectionId,
    toPersistedOverridesByConnectionId,
    getLastSeenStorageKey,
    loadLastSeen,
    updateLastSeen,
} from "../utils/persistence";
import { replaceProjectionUnreadByConversationId, unreadByConversationIdEqual } from "./projection-unread";
import { applySelectedConversationUnreadIsolation } from "./unread-isolation";
import {
    buildDmConnectionsFromPersistedChatState,
    computePersistedMessageHistoryRevision,
    mergeDmConversationLists,
    touchDmConversationFromMessage,
} from "../utils/dm-conversation-list-merge";
import {
    removeConversationIdFromHidden,
    removeGroupConversationIdsFromHidden,
    sanitizeDmConversationIdList,
} from "../utils/conversation-visibility";
import { resolveConversationListAuthority } from "../services/conversation-list-authority";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { isTauri, dbGetConversations } from "@dweb/db";
import type { ConversationRecord } from "@dweb/db";

const hasMeaningfulMessagingState = (value: PersistedChatState | null | undefined): value is PersistedChatState => {
    if (!value) {
        return false;
    }
    return (
        value.createdConnections.length > 0
        || value.createdGroups.length > 0
        || Object.keys(value.messagesByConversationId ?? {}).length > 0
        || Object.keys(value.groupMessages ?? {}).length > 0
        || (value.connectionRequests?.length ?? 0) > 0
    );
};

interface MessagingContextType {
    createdConnections: ReadonlyArray<DmConversation>;
    setCreatedConnections: React.Dispatch<React.SetStateAction<ReadonlyArray<DmConversation>>>;
    selectedConversation: Conversation | null;
    setSelectedConversation: (conv: Conversation | null) => void;
    unreadByConversationId: UnreadByConversationId;
    lastViewedByConversationId: Readonly<Record<string, number>>;
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
    uploadStage: "idle" | "encrypting" | "uploading" | "sending";
    setUploadStage: (stage: "idle" | "encrypting" | "uploading" | "sending") => void;
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
    const publicKeyHex = (identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null);
    const optionalProfileBus = useOptionalProfileMessageBus();
    const messageDeleteTombstonePersistence = useResolvedClientGateway().messageDeleteTombstones;
    const activeProfileId = getResolvedProfileId();
    const hydrationScopeKey = `${activeProfileId}::${publicKeyHex ?? "signed_out"}`;
    const accountProjectionSnapshot = useAccountProjectionSnapshot();
    const projectionReadAuthority = useMemo(() => (
        resolveProjectionReadAuthority({
            projectionSnapshot: accountProjectionSnapshot,
            expectedProfileId: activeProfileId,
            expectedAccountPublicKeyHex: publicKeyHex,
        })
    ), [accountProjectionSnapshot, activeProfileId, publicKeyHex]);
    const [sqliteConversations, setSqliteConversations] = useState<ReadonlyArray<DmConversation>>([]);
    const [createdConnections, setCreatedConnections] = useState<ReadonlyArray<DmConversation>>([]);
    const [selectedConversationState, setSelectedConversationState] = useState<Conversation | null>(null);
    const [unreadByConversationId, setUnreadByConversationId] = useState<UnreadByConversationId>({});
    const [lastViewedByConversationId, setLastViewedByConversationId] = useState<Readonly<Record<string, number>>>({});
    const [connectionOverridesByConnectionId, setConnectionOverridesByConnectionId] = useState<ConnectionOverridesByConnectionId>({});
    const [pinnedChatIds, setPinnedChatIds] = useState<ReadonlyArray<string>>([]);
    const [hiddenChatIds, setHiddenChatIds] = useState<ReadonlyArray<string>>([]);
    // Removed: const [messagesByConversationId, setMessagesByConversationId] = useState<MessagesByConversationId>({});
    const [visibleMessageCountByConversationId, setVisibleMessageCountByConversationId] = useState<Readonly<Record<string, number>>>({});
    const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);

    const setSelectedConversation = React.useCallback((conv: Conversation | null) => {
        if (conv?.kind === "dm") {
            setHiddenChatIds((previous) => removeConversationIdFromHidden(previous, conv.id));
        }
        setSelectedConversationState(conv);
        if (publicKeyHex) {
            const key = getScopedStorageKey(`obscur-last-chat-${publicKeyHex}`, activeProfileId);
            if (conv) {
                localStorage.setItem(key, conv.id);
            } else {
                localStorage.removeItem(key);
            }
        }
    }, [activeProfileId, publicKeyHex]);

    const selectedConversation = selectedConversationState;
    const [hasHydrated, setHasHydrated] = useState(false);
    const [chatStateReplaceTick, setChatStateReplaceTick] = useState(0);

    const sqliteConvToRaw = (rec: ConversationRecord): DmConversation => ({
        kind: "dm",
        id: rec.id,
        pubkey: rec.peer_pubkey as PublicKeyHex,
        displayName: rec.peer_pubkey,
        lastMessage: rec.last_plaintext_preview ?? "",
        unreadCount: rec.unread_count,
        lastMessageTime: rec.last_message_at != null ? new Date(rec.last_message_at) : new Date(0),
    });

    const reloadSqliteConversations = useCallback((): void => {
        if (!isTauri() || !activeProfileId) {
            return;
        }
        void dbGetConversations(activeProfileId).then((recs) => {
            setSqliteConversations(recs.map(sqliteConvToRaw));
        }).catch(() => {});
    }, [activeProfileId]);

    useEffect(() => {
        if (!isTauri() || !activeProfileId) {
            return;
        }
        let cancelled = false;
        const loadConversations = (): void => {
            void dbGetConversations(activeProfileId).then((recs) => {
                if (cancelled) {
                    return;
                }
                setSqliteConversations(recs.map(sqliteConvToRaw));
            }).catch(() => {});
        };
        if (shouldDeferExperimentHeavyWork()) {
            const cancelIdle = scheduleExperimentIdleWork(loadConversations);
            return (): void => {
                cancelled = true;
                cancelIdle();
            };
        }
        loadConversations();
        return (): void => {
            cancelled = true;
        };
    }, [activeProfileId]);

    useEffect(() => {
        if (!isTauri() || !activeProfileId) {
            return;
        }
        return subscribeMessagesIndexRebuiltDual((detail) => {
            if (detail.profileId !== activeProfileId) {
                return;
            }
            reloadSqliteConversations();
        }, optionalProfileBus);
    }, [activeProfileId, optionalProfileBus, reloadSqliteConversations]);

    useEffect(() => {
        if (typeof window === "undefined" || !isTauri() || !activeProfileId) {
            return;
        }
        const hydrateTombstones = (): void => {
            void messageDeleteTombstonePersistence.hydrateMessageDeleteTombstonesFromSqlite(activeProfileId).catch(() => {});
        };
        if (shouldDeferExperimentHeavyWork()) {
            return scheduleExperimentIdleWork(hydrateTombstones);
        }
        hydrateTombstones();
    }, [activeProfileId, messageDeleteTombstonePersistence]);

    useEffect(() => {
        if (typeof window === "undefined" || isTauri()) {
            return;
        }
        void messageDeleteTombstonePersistence.mergeMessageDeleteTombstonesFromIndexedDb(activeProfileId || undefined).catch(() => {});
    }, [activeProfileId, messageDeleteTombstonePersistence]);

    const hydrateStoredMessagingStateFast = useCallback((params: Readonly<{
        publicKeyHex: string;
        profileId: string;
    }>): void => {
        const persisted = chatStateStoreService.load(params.publicKeyHex, { profileId: params.profileId });
        if (persisted) {
            const nextCreatedConnections = buildDmConnectionsFromPersistedChatState(
                persisted,
                params.publicKeyHex,
            );

            setCreatedConnections(nextCreatedConnections);
            setUnreadByConversationId(persisted.unreadByConversationId);
            setConnectionOverridesByConnectionId(fromPersistedOverridesByConnectionId(persisted.connectionOverridesByConnectionId));

            if (persisted.pinnedChatIds) setPinnedChatIds(persisted.pinnedChatIds);
            if (persisted.hiddenChatIds) {
                const sanitizedHiddenChatIds = removeGroupConversationIdsFromHidden(persisted.hiddenChatIds);
                setHiddenChatIds(sanitizedHiddenChatIds);
            }
        }
        const loadedLastSeen = loadLastSeen(params.publicKeyHex as PublicKeyHex, params.profileId);
        setLastViewedByConversationId(loadedLastSeen);
        setHasHydrated(true);
    }, []);

    const hydrateStoredMessagingState = useCallback(async (params: Readonly<{
        publicKeyHex: string;
        profileId: string;
    }>): Promise<void> => {
        const persisted = chatStateStoreService.load(params.publicKeyHex, { profileId: params.profileId });
        if (persisted) {
            const nextCreatedConnections = buildDmConnectionsFromPersistedChatState(
                persisted,
                params.publicKeyHex,
            );

            setCreatedConnections(nextCreatedConnections);
            setUnreadByConversationId(persisted.unreadByConversationId);
            setConnectionOverridesByConnectionId(fromPersistedOverridesByConnectionId(persisted.connectionOverridesByConnectionId));

            if (persisted.pinnedChatIds) setPinnedChatIds(persisted.pinnedChatIds);
            if (persisted.hiddenChatIds) {
                const sanitizedHiddenChatIds = removeGroupConversationIdsFromHidden(persisted.hiddenChatIds);
                setHiddenChatIds(sanitizedHiddenChatIds);
                if (sanitizedHiddenChatIds.length !== persisted.hiddenChatIds.length) {
                    chatStateStoreService.updateHiddenChats(params.publicKeyHex, sanitizedHiddenChatIds);
                }
            }
        }
        await messagePersistenceService.migrateFromLegacy(params.publicKeyHex, {
            profileId: params.profileId,
        });
        const loadedLastSeen = loadLastSeen(params.publicKeyHex as PublicKeyHex, params.profileId);
        setLastViewedByConversationId(loadedLastSeen);
        setHasHydrated(true);
    }, []);

    // Attachments
    const [pendingAttachments, setPendingAttachments] = useState<ReadonlyArray<File>>([]);
    const [pendingAttachmentPreviewUrls, setPendingAttachmentPreviewUrls] = useState<ReadonlyArray<string>>([]);
    const [isUploadingAttachment, setIsUploadingAttachment] = useState<boolean>(false);
    const [uploadStage, setUploadStage] = useState<"idle" | "encrypting" | "uploading" | "sending">("idle");
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

    const createdConnectionsRef = React.useRef(createdConnections);
    const unreadByConversationIdRef = React.useRef(unreadByConversationId);
    const connectionOverridesByConnectionIdRef = React.useRef(connectionOverridesByConnectionId);
    const hydratedScopeKeyRef = React.useRef<string | null>(null);
    const conversationListAuthorityLogKeyRef = React.useRef<string | null>(null);

    useEffect(() => {
        messagePersistenceService.bindProfileBusChatStateReplaced(optionalProfileBus);
    }, [optionalProfileBus]);

    useEffect(() => {
        if (hydratedScopeKeyRef.current === hydrationScopeKey) {
            return;
        }
        hydratedScopeKeyRef.current = hydrationScopeKey;

        createdConnectionsRef.current = [];
        unreadByConversationIdRef.current = {};
        connectionOverridesByConnectionIdRef.current = {};

        setCreatedConnections([]);
        setSelectedConversationState(null);
        setUnreadByConversationId({});
        setLastViewedByConversationId({});
        setConnectionOverridesByConnectionId({});
        setPinnedChatIds([]);
        setHiddenChatIds([]);
        setHasHydrated(false);
        conversationListAuthorityLogKeyRef.current = null;
    }, [hydrationScopeKey]);

    const togglePin = (conversationId: string) => {
        setPinnedChatIds((previous) => (
            previous.includes(conversationId)
                ? previous.filter((id) => id !== conversationId)
                : [...previous, conversationId]
        ));
    };

    const hideConversation = (conversationId: string) => {
        setHiddenChatIds((previous) => (
            previous.includes(conversationId) ? previous : [...previous, conversationId]
        ));
    };

    const unhideConversation = (conversationId: string) => {
        setHiddenChatIds((previous) => previous.filter((id) => id !== conversationId));
    };

    const clearHistory = (conversationId: string) => {
        chatStateStoreService.deleteConversationMessages(conversationId);
        messageBus.emit({ type: "message_deleted", conversationId, messageId: "all" });
        const next = createdConnectionsRef.current.map((connection) => (
            connection.id === conversationId
                ? { ...connection, lastMessage: "", lastMessageTime: new Date() }
                : connection
        ));
        createdConnectionsRef.current = next;
        setCreatedConnections(next);
        if (publicKeyHex) {
            chatStateStoreService.updateConnections(publicKeyHex, next.map((connection) => toPersistedDmConversation(connection)));
        }
    };

    const deleteConversation = (conversationId: string) => {
        if (isGroupConversationId(conversationId)) {
            // Group membership is owned by explicit leave/purge flows, not sidebar chat deletion.
            clearHistory(conversationId);
            return;
        }
        hideConversation(conversationId);
        clearHistory(conversationId);
    };

    // Persistence: Hydration
    useEffect(() => {
        if (hasHydrated) return;
        if (!publicKeyHex) return;

        if (shouldDeferExperimentHeavyWork()) {
            hydrateStoredMessagingStateFast({
                publicKeyHex,
                profileId: activeProfileId,
            });
            return scheduleExperimentIdleWork(() => {
                void hydrateStoredMessagingState({
                    publicKeyHex,
                    profileId: activeProfileId,
                });
            });
        }

        void hydrateStoredMessagingState({
            publicKeyHex,
            profileId: activeProfileId,
        });
    }, [publicKeyHex, hasHydrated, activeProfileId, hydrateStoredMessagingState, hydrateStoredMessagingStateFast]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        const refreshForDetail = (detail?: Partial<ChatStateReplacedEventDetail>): void => {
            if (!publicKeyHex) {
                return;
            }
            if (detail?.publicKeyHex && detail.publicKeyHex !== publicKeyHex) {
                return;
            }
            if (detail?.profileId && detail.profileId !== activeProfileId) {
                return;
            }
            void hydrateStoredMessagingState({
                publicKeyHex,
                profileId: activeProfileId,
            });
        };

        return subscribeChatStateReplacedDual(refreshForDetail, optionalProfileBus);
    }, [activeProfileId, hydrateStoredMessagingState, publicKeyHex, optionalProfileBus]);

    useEffect(() => {
        if (!publicKeyHex || typeof window === "undefined") {
            return;
        }
        const onStorage = (event: StorageEvent): void => {
            if (!event.key || !publicKeyHex) {
                return;
            }
            const expectedKey = getLastSeenStorageKey(publicKeyHex as PublicKeyHex, activeProfileId);
            if (event.key !== expectedKey) {
                return;
            }
            const latest = loadLastSeen(publicKeyHex as PublicKeyHex, activeProfileId);
            setLastViewedByConversationId(latest);
        };
        window.addEventListener("storage", onStorage);
        return () => {
            window.removeEventListener("storage", onStorage);
        };
    }, [publicKeyHex, activeProfileId]);

    const projectionConnections = useMemo(() => {
        if (!publicKeyHex) {
            return [] as ReadonlyArray<DmConversation>;
        }
        return selectProjectionDmConversations({
            projection: accountProjectionSnapshot.projection,
            myPublicKeyHex: publicKeyHex as PublicKeyHex,
        });
    }, [accountProjectionSnapshot.projection, publicKeyHex]);
    const persistedMessageHistoryRevision = useMemo(() => {
        if (!publicKeyHex || !hasHydrated) {
            return "idle";
        }
        const persistedState = chatStateStoreService.load(publicKeyHex as PublicKeyHex, { profileId: activeProfileId });
        return computePersistedMessageHistoryRevision(persistedState);
    }, [
        activeProfileId,
        publicKeyHex,
        hasHydrated,
        chatStateReplaceTick,
        accountProjectionSnapshot.projection?.lastSequence,
        accountProjectionSnapshot.updatedAtUnixMs,
    ]);
    const persistedDmConnections = useMemo(() => {
        if (!publicKeyHex || !hasHydrated) {
            return [] as ReadonlyArray<DmConversation>;
        }
        const persistedState = chatStateStoreService.load(publicKeyHex as PublicKeyHex, { profileId: activeProfileId });
        return buildDmConnectionsFromPersistedChatState(persistedState, publicKeyHex);
    }, [activeProfileId, publicKeyHex, hasHydrated, persistedMessageHistoryRevision]);
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        const onChatStateReplaced = (event: Event): void => {
            const detail = (event as CustomEvent<ChatStateReplacedEventDetail>).detail;
            if (detail?.profileId !== activeProfileId) {
                return;
            }
            if (detail.publicKeyHex !== publicKeyHex) {
                return;
            }
            setChatStateReplaceTick((tick) => tick + 1);
        };
        window.addEventListener(CHAT_STATE_REPLACED_EVENT, onChatStateReplaced);
        return () => {
            window.removeEventListener(CHAT_STATE_REPLACED_EVENT, onChatStateReplaced);
        };
    }, [activeProfileId, publicKeyHex]);
    const conversationListAuthority = useMemo(() => (
        resolveConversationListAuthority({
            isNativeRuntime: hasNativeRuntime(),
            sqliteConversationCount: sqliteConversations.length,
            useProjectionReads: projectionReadAuthority.useProjectionReads,
            projectionConversationCount: projectionConnections.length,
        })
    ), [projectionConnections.length, projectionReadAuthority.useProjectionReads, sqliteConversations.length]);

    useEffect(() => {
        if (!publicKeyHex) {
            conversationListAuthorityLogKeyRef.current = null;
            return;
        }
        const diagnosticKey = [
            activeProfileId,
            publicKeyHex,
            conversationListAuthority.authority,
            conversationListAuthority.reason,
            projectionConnections.length,
            createdConnections.length,
            projectionReadAuthority.reason,
            projectionReadAuthority.criticalDriftCount ?? 0,
            persistedDmConnections.length,
        ].join("::");
        if (conversationListAuthorityLogKeyRef.current === diagnosticKey) {
            return;
        }
        conversationListAuthorityLogKeyRef.current = diagnosticKey;
        logAppEvent({
            name: "messaging.conversation_list_authority_selected",
            level: conversationListAuthority.authority === "projection" ? "info" : "warn",
            scope: { feature: "messaging", action: "conversation_list_authority" },
            context: {
                profileId: activeProfileId,
                publicKeySuffix: publicKeyHex.slice(-8),
                selectedAuthority: conversationListAuthority.authority,
                selectedAuthorityReason: conversationListAuthority.reason,
                projectionConversationCount: projectionConnections.length,
                persistedConversationCount: createdConnections.length,
                persistedDmThreadCount: persistedDmConnections.length,
                projectionReadAuthorityReason: projectionReadAuthority.reason,
                criticalDriftCount: projectionReadAuthority.criticalDriftCount ?? 0,
            },
        });
    }, [
        activeProfileId,
        conversationListAuthority.authority,
        conversationListAuthority.reason,
        createdConnections.length,
        persistedDmConnections.length,
        projectionConnections.length,
        projectionReadAuthority.criticalDriftCount,
        projectionReadAuthority.reason,
        publicKeyHex,
    ]);

    useEffect(() => {
        if (conversationListAuthority.authority !== "sqlite") {
            return;
        }
        const mergedSqliteConnections = mergeDmConversationLists(
            sqliteConversations,
            persistedDmConnections,
        );
        createdConnectionsRef.current = mergedSqliteConnections;
        setCreatedConnections(mergedSqliteConnections);
    }, [conversationListAuthority.authority, persistedDmConnections, sqliteConversations]);

    useEffect(() => {
        if (conversationListAuthority.authority !== "projection") {
            return;
        }
        const mergedProjectionConnections = mergeDmConversationLists(
            projectionConnections,
            persistedDmConnections,
        );
        const allowedProjectionDmConversationIds = new Set(
            mergedProjectionConnections.map((connection) => connection.id)
        );
        createdConnectionsRef.current = mergedProjectionConnections;
        setCreatedConnections(mergedProjectionConnections);
        if (selectedConversation?.kind === "dm") {
            const canonicalSelected = mergedProjectionConnections.find((connection) => (
                connection.pubkey === selectedConversation.pubkey
            ));
            if (canonicalSelected && canonicalSelected.id !== selectedConversation.id) {
                setSelectedConversationState(canonicalSelected);
            }
        }
        setUnreadByConversationId((current) => {
            const next = replaceProjectionUnreadByConversationId({
                currentUnreadByConversationId: current,
                projectionConnections: mergedProjectionConnections,
                selectedConversationId: selectedConversation?.id ?? null,
                selectedConversationKind: selectedConversation?.kind ?? null,
                lastSeenByConversationId: lastViewedByConversationId,
            });
            if (unreadByConversationIdEqual(current, next)) {
                unreadByConversationIdRef.current = current;
                return current;
            }
            unreadByConversationIdRef.current = next;
            return next;
        });
        setPinnedChatIds((current) => {
            const next = sanitizeDmConversationIdList(current, allowedProjectionDmConversationIds);
            return next.length === current.length && next.every((value, index) => value === current[index])
                ? current
                : next;
        });
        setHiddenChatIds((current) => {
            const next = sanitizeDmConversationIdList(current, allowedProjectionDmConversationIds);
            return next.length === current.length && next.every((value, index) => value === current[index])
                ? current
                : next;
        });
    }, [
        conversationListAuthority.authority,
        lastViewedByConversationId,
        persistedDmConnections,
        projectionConnections,
        selectedConversation,
    ]);

    useEffect(() => {
        if (!selectedConversation || !hasHydrated || !publicKeyHex) {
            return;
        }
        if (selectedConversation.kind !== "dm") {
            return;
        }
        const seenAtMs = Date.now();
        const conversationId = selectedConversation.id;
        setLastViewedByConversationId((previous) => {
            if ((previous[conversationId] ?? 0) >= seenAtMs) {
                return previous;
            }
            const nextSeenByConversationId = {
                ...previous,
                [conversationId]: seenAtMs,
            };
            updateLastSeen({
                publicKeyHex: publicKeyHex as PublicKeyHex,
                conversationId,
                seenAtMs,
                profileId: activeProfileId,
            });
            return nextSeenByConversationId;
        });
    }, [selectedConversation?.id, selectedConversation?.kind, hasHydrated, publicKeyHex, activeProfileId]);

    useEffect(() => {
        if (!selectedConversation || !hasHydrated) {
            return;
        }
        const precomputed = applySelectedConversationUnreadIsolation({
            currentUnreadByConversationId: unreadByConversationId,
            selectedConversation,
        });
        if (!precomputed) {
            return;
        }
        queueMicrotask(() => {
            const latestUnread = unreadByConversationIdRef.current;
            const isolated = applySelectedConversationUnreadIsolation({
                currentUnreadByConversationId: latestUnread,
                selectedConversation,
            });
            if (!isolated) {
                return;
            }
            unreadByConversationIdRef.current = isolated;
            setUnreadByConversationId(isolated);
            if (publicKeyHex) chatStateStoreService.updateUnreadCounts(publicKeyHex, isolated);
        });
    }, [selectedConversation, unreadByConversationId, hasHydrated, publicKeyHex]);

    const updateCreatedConnections: React.Dispatch<React.SetStateAction<ReadonlyArray<DmConversation>>> = useCallback((updater) => {
        const current = createdConnectionsRef.current;
        const next = typeof updater === "function"
            ? (updater as (prevState: ReadonlyArray<DmConversation>) => ReadonlyArray<DmConversation>)(current)
            : updater;
        createdConnectionsRef.current = next;
        setCreatedConnections(next);
        if (publicKeyHex) {
            chatStateStoreService.updateConnections(publicKeyHex, next.map(c => toPersistedDmConversation(c)));
        }
    }, [publicKeyHex]);

    const updateUnreadByConversationId: React.Dispatch<React.SetStateAction<UnreadByConversationId>> = useCallback((updater) => {
        const current = unreadByConversationIdRef.current;
        const next = typeof updater === "function"
            ? (updater as (prevState: UnreadByConversationId) => UnreadByConversationId)(current)
            : updater;
        unreadByConversationIdRef.current = next;
        setUnreadByConversationId(next);
        if (publicKeyHex) {
            chatStateStoreService.updateUnreadCounts(publicKeyHex, next);
        }
    }, [publicKeyHex]);

    const updateConnectionOverridesByConnectionId: React.Dispatch<React.SetStateAction<ConnectionOverridesByConnectionId>> = useCallback((updater) => {
        const current = connectionOverridesByConnectionIdRef.current;
        const next = typeof updater === "function"
            ? (updater as (prevState: ConnectionOverridesByConnectionId) => ConnectionOverridesByConnectionId)(current)
            : updater;
        connectionOverridesByConnectionIdRef.current = next;
        setConnectionOverridesByConnectionId(next);
        if (publicKeyHex) {
            chatStateStoreService.updateConnectionOverrides(publicKeyHex, toPersistedOverridesByConnectionId(next));
        }
    }, [publicKeyHex]);

    useEffect(() => {
        if (!publicKeyHex || !hasHydrated) {
            return;
        }
        const unsubscribe = messageBus.subscribe((event) => {
            if (event.type !== "new_message" && event.type !== "message_updated") {
                return;
            }
            if (event.message.kind === "command") {
                return;
            }
            const conversationId = event.conversationId?.trim() ?? "";
            if (!conversationId) {
                return;
            }
            const messagePreview = typeof event.message.content === "string"
                ? event.message.content
                : "";
            updateCreatedConnections((previous) => touchDmConversationFromMessage({
                connections: previous,
                conversationId,
                myPublicKeyHex: publicKeyHex,
                messagePreview,
                messageTime: event.message.timestamp,
                lastMessageIsOutgoing: event.message.isOutgoing,
            }));
        }, { profileId: activeProfileId });
        return unsubscribe;
    }, [activeProfileId, hasHydrated, publicKeyHex, updateCreatedConnections]);

    useEffect(() => {
        createdConnectionsRef.current = createdConnections;
    }, [createdConnections]);

    useEffect(() => {
        unreadByConversationIdRef.current = unreadByConversationId;
    }, [unreadByConversationId]);

    useEffect(() => {
        connectionOverridesByConnectionIdRef.current = connectionOverridesByConnectionId;
    }, [connectionOverridesByConnectionId]);

    useEffect(() => {
        if (!publicKeyHex) {
            return;
        }
        chatStateStoreService.updatePinnedChats(publicKeyHex, pinnedChatIds);
    }, [pinnedChatIds, publicKeyHex]);

    useEffect(() => {
        if (!publicKeyHex) {
            return;
        }
        chatStateStoreService.updateHiddenChats(publicKeyHex, hiddenChatIds);
    }, [hiddenChatIds, publicKeyHex]);

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
        lastViewedByConversationId,
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
        uploadStage,
        setUploadStage,
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
        lastViewedByConversationId,
        connectionOverridesByConnectionId,
        visibleMessageCountByConversationId,
        replyTo,
        pendingAttachments,
        pendingAttachmentPreviewUrls,
        isUploadingAttachment,
        uploadStage,
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
        updateCreatedConnections,
        updateUnreadByConversationId,
        updateConnectionOverridesByConnectionId,
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

/** Optional messaging context — for components that may mount before unlock or outside chat routes. */
export const useMessagingSafe = (): MessagingContextType | null => useContext(MessagingContext);
