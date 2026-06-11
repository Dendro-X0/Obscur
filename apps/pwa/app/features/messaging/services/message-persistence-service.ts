import { messageBus, type MessageBusEvent } from "./message-bus";
import type { Message } from "../types";
import { PrivacySettingsService } from "../../settings/services/privacy-settings-service";
import { performanceMonitor } from "../lib/performance-monitor";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { normalizePublicKeyHex } from "../../profile/utils/normalize-public-key-hex";
import { chatStateStoreService } from "./chat-state-store";
import { fromPersistedMessagesByConversationId } from "../utils/persistence";
import { toDmConversationId } from "../utils/dm-conversation-id";
import { isGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { normalizeCommunityInvitePayload } from "@/app/features/groups/utils/community-invite-payload";
import { pinCommunityInviteMessageSnapshot } from "@/app/features/groups/utils/community-invite-message-snapshot";
import type { PersistedMessage } from "../types";
import { logAppEvent } from "@/app/shared/log-app-event";
import { getProfileRuntimeScope, getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";
import { isTauri, dbInsertMessage, dbInsertTombstone, dbDeleteMessages, dbUpsertConversation } from "@dweb/db";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import {
  isDmKernelWriteOwner,
  writeDmKernelConversation,
  writeDmKernelMessage,
} from "@/app/features/dm-kernel/dm-kernel-write-port";
import { linkLocalMediaIndexToMessageEvent } from "@/app/features/vault/services/local-media-store";
import type { MessageRecord, TombstoneRecord, ConversationRecord } from "@dweb/db";
import type { ChatStateReplacedEventDetail } from "./chat-state-store";
import { createMicrotaskCoalescedHandler } from "@/app/features/profiles/services/profile-bus-coalesce";
import { messagingClientOperations } from "./messaging-client-operations";
import { toConversationIdDiagnosticLabel } from "@dweb/client-gateway/messaging-diagnostics";
import { toAccountEventPlaintextPreview } from "@/app/features/account-sync/services/account-event-plaintext-preview";

export const MESSAGES_INDEX_REBUILT_EVENT = "obscur:messages-index-rebuilt";
export type MessagesIndexRebuiltEventDetail = Readonly<{
    publicKeyHex: string;
    profileId: string;
    messageCount: number;
}>;

export function dispatchMessagesIndexRebuiltEvent(detail: MessagesIndexRebuiltEventDetail): void {
    const scope = getProfileRuntimeScope();
    if (scope?.bus && scope.profileId === detail.profileId) {
        scope.bus.publish({
            type: "messages-index-rebuilt",
            detail,
        });
    }
}

const inferPeerFromConversationId = (params: Readonly<{
    conversationId: string;
    myPublicKeyHex: PublicKeyHex;
}>): PublicKeyHex | null => {
    const directPeer = normalizePublicKeyHex(params.conversationId.trim());
    if (directPeer && directPeer !== params.myPublicKeyHex) {
        return directPeer;
    }

    const parts = params.conversationId.split(":");
    if (parts.length !== 2) {
        return null;
    }
    const left = normalizePublicKeyHex(parts[0]);
    const right = normalizePublicKeyHex(parts[1]);
    if (!left || !right) {
        return null;
    }
    if (left === params.myPublicKeyHex && right !== params.myPublicKeyHex) {
        return right;
    }
    if (right === params.myPublicKeyHex && left !== params.myPublicKeyHex) {
        return left;
    }
    return null;
};

const canonicalizeDmConversationId = (params: Readonly<{
    conversationId: string;
    myPublicKeyHex: PublicKeyHex;
}>): string => {
    const inferredPeer = inferPeerFromConversationId(params);
    if (!inferredPeer) {
        return params.conversationId;
    }
    return toDmConversationId({
        myPublicKeyHex: params.myPublicKeyHex,
        peerPublicKeyHex: inferredPeer,
    }) ?? params.conversationId;
};

const resolveAccountPublicKeyHex = (message: Message): PublicKeyHex | null => {
    if (message.isOutgoing) {
        return normalizePublicKeyHex(message.senderPubkey ?? "");
    }
    return normalizePublicKeyHex(message.recipientPubkey ?? "");
};

const toPersistedChatStateMessage = (
    message: Message,
    canonicalId: string,
): PersistedMessage => ({
    id: canonicalId,
    ...(typeof message.eventId === "string" && message.eventId.trim().length > 0
        ? { eventId: message.eventId.trim() }
        : {}),
    ...(message.kind !== "user" ? { kind: message.kind } : {}),
    pubkey: message.senderPubkey,
    content: message.content,
    timestampMs: message.timestamp.getTime(),
    isOutgoing: message.isOutgoing,
    status: message.status,
    ...(message.attachments ? { attachments: message.attachments } : {}),
    ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    ...(message.reactions ? { reactions: message.reactions } : {}),
    ...(message.deletedAt ? { deletedAtMs: message.deletedAt.getTime() } : {}),
});

const mirrorMessageToChatState = (conversationId: string, message: Message, canonicalId: string): void => {
    if (requiresSqlitePersistence()) {
        return;
    }
    if (isGroupConversationId(conversationId)) {
        return;
    }
    const accountPublicKeyHex = resolveAccountPublicKeyHex(message);
    if (!accountPublicKeyHex) {
        return;
    }
    const canonicalConversationId = canonicalizeDmConversationId({
        conversationId,
        myPublicKeyHex: accountPublicKeyHex,
    });
    const persistedMessage = toPersistedChatStateMessage(message, canonicalId);
    chatStateStoreService.update(accountPublicKeyHex, (previous) => {
        const existing = previous.messagesByConversationId[canonicalConversationId] ?? [];
        const merged = [...existing];
        const existingIndex = merged.findIndex((entry) => (
            entry.id === persistedMessage.id
            || (persistedMessage.eventId && entry.eventId === persistedMessage.eventId)
        ));
        if (existingIndex >= 0) {
            merged[existingIndex] = { ...merged[existingIndex], ...persistedMessage };
        } else {
            merged.push(persistedMessage);
        }
        merged.sort((left, right) => left.timestampMs - right.timestampMs);
        return {
            ...previous,
            messagesByConversationId: {
                ...previous.messagesByConversationId,
                [canonicalConversationId]: merged,
            },
        };
    }, { silent: true });
    try {
        const invitePayload = normalizeCommunityInvitePayload(JSON.parse(message.content));
        if (invitePayload?.type === "community-invite") {
            pinCommunityInviteMessageSnapshot(canonicalId, invitePayload);
        }
    } catch {
        // Normal chat plaintext is expected for most messages.
    }
};

const summarizeSourceDmConversationIds = (
    source: Readonly<Record<string, unknown>> | undefined,
    myPublicKeyHex: PublicKeyHex
): Readonly<{
    sourceConversationCount: number;
    canonicalConversationCount: number;
    canonicalMismatchConversationCount: number;
    canonicalCollisionCount: number;
    canonicalCollisionSample: string | null;
}> => {
    const sourceConversationIds = Object.keys(source ?? {});
    if (sourceConversationIds.length === 0) {
        return {
            sourceConversationCount: 0,
            canonicalConversationCount: 0,
            canonicalMismatchConversationCount: 0,
            canonicalCollisionCount: 0,
            canonicalCollisionSample: null,
        };
    }
    const canonicalSources = new Map<string, Set<string>>();
    let canonicalMismatchConversationCount = 0;
    sourceConversationIds.forEach((sourceConversationId) => {
        const canonicalConversationId = canonicalizeDmConversationId({
            conversationId: sourceConversationId,
            myPublicKeyHex,
        });
        if (canonicalConversationId !== sourceConversationId) {
            canonicalMismatchConversationCount += 1;
        }
        const existing = canonicalSources.get(canonicalConversationId) ?? new Set<string>();
        existing.add(sourceConversationId);
        canonicalSources.set(canonicalConversationId, existing);
    });

    const collisions = Array.from(canonicalSources.entries())
        .filter(([, sourceIds]) => sourceIds.size > 1);
    const canonicalCollisionSample = collisions.length === 0
        ? null
        : collisions.slice(0, 3).map(([canonicalConversationId, sourceIds]) => (
            `${toConversationIdDiagnosticLabel(canonicalConversationId)}<=${Array.from(sourceIds).slice(0, 3).map(toConversationIdDiagnosticLabel).join("|")}`
        )).join(",");
    return {
        sourceConversationCount: sourceConversationIds.length,
        canonicalConversationCount: canonicalSources.size,
        canonicalMismatchConversationCount,
        canonicalCollisionCount: collisions.length,
        canonicalCollisionSample,
    };
};

const summarizeMigratedMessages = (
    migratedMessages: ReadonlyArray<Record<string, unknown>>,
    myPublicKeyHex: PublicKeyHex,
): Readonly<{
    migratedConversationCount: number;
    migratedMessageCount: number;
    migratedOutgoingCount: number;
    migratedIncomingCount: number;
    incomingOnlyConversationCount: number;
}> => {
    if (migratedMessages.length === 0) {
        return {
            migratedConversationCount: 0,
            migratedMessageCount: 0,
            migratedOutgoingCount: 0,
            migratedIncomingCount: 0,
            incomingOnlyConversationCount: 0,
        };
    }
    const byConversation = new Map<string, Readonly<{ outgoing: number; incoming: number }>>();
    migratedMessages.forEach((message) => {
        const conversationId = typeof message.conversationId === "string" ? message.conversationId : "";
        if (!conversationId) {
            return;
        }
        const senderPubkey = normalizePublicKeyHex(
            typeof message.senderPubkey === "string"
                ? message.senderPubkey
                : typeof message.pubkey === "string"
                    ? message.pubkey
                    : undefined
        );
        const isOutgoing = message.isOutgoing === true || senderPubkey === myPublicKeyHex;
        const existing = byConversation.get(conversationId) ?? { outgoing: 0, incoming: 0 };
        byConversation.set(conversationId, isOutgoing
            ? { outgoing: existing.outgoing + 1, incoming: existing.incoming }
            : { outgoing: existing.outgoing, incoming: existing.incoming + 1 });
    });

    let migratedOutgoingCount = 0;
    let migratedIncomingCount = 0;
    let incomingOnlyConversationCount = 0;
    byConversation.forEach((stats) => {
        migratedOutgoingCount += stats.outgoing;
        migratedIncomingCount += stats.incoming;
        if (stats.incoming > 0 && stats.outgoing === 0) {
            incomingOnlyConversationCount += 1;
        }
    });

    return {
        migratedConversationCount: byConversation.size,
        migratedMessageCount: migratedMessages.length,
        migratedOutgoingCount,
        migratedIncomingCount,
        incomingOnlyConversationCount,
    };
};

const collectPersistedConversationIds = (dbState: Record<string, unknown>): ReadonlyArray<string> => {
    const collected: string[] = [];
    const pushIds = (value: unknown): void => {
        if (!Array.isArray(value)) {
            return;
        }
        value.forEach((entry) => {
            if (!entry || typeof entry !== "object") {
                return;
            }
            const id = (entry as { id?: unknown }).id;
            if (typeof id === "string" && id.trim().length > 0) {
                collected.push(id.trim());
            }
        });
    };
    pushIds(dbState.createdConnections);
    pushIds(dbState.createdGroups);
    return collected;
};

const hasLegacyChatTimelineDomains = (value: unknown): boolean => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const candidate = value as Readonly<{
        messagesByConversationId?: Readonly<Record<string, unknown>>;
        groupMessages?: Readonly<Record<string, unknown>>;
    }>;
    const dmConversationCount = Object.keys(candidate.messagesByConversationId ?? {}).length;
    if (dmConversationCount > 0) {
        return true;
    }
    const groupConversationCount = Object.keys(candidate.groupMessages ?? {}).length;
    return groupConversationCount > 0;
};

/**
 * MessagePersistenceService
 *
 * Canonical durable owner for DM bus events: SQLite on native (Tauri),
 * batched IndexedDB on web. Listens to {@link messageBus} only.
 */
export class MessagePersistenceService {
    private isInitialized = false;
    private readonly flushIntervalMs = 32;
    private readonly immediateFlushThreshold = 50;
    private readonly deleteTombstoneTtlMs = 2 * 60 * 1000;
    private pendingUpserts = new Map<string, Record<string, unknown>>();
    private pendingDeletes = new Set<string>();
    private pendingSupersededIds = new Set<string>();
    private recentlyDeletedMessageIds = new Map<string, number>();
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private isFlushing = false;
    private batchedEventCount = 0;
    private currentBatchStartMs: number | null = null;
    private activeMessageStoreScopeKey: string | null = null;
    private static readonly MIGRATION_DONE_KEY_PREFIX = "obscur:msg_migration_done::";
    private unsubscribeMessageBus: (() => void) | null = null;
    private readonly onVisibilityChange = (): void => {
        if (typeof document === "undefined") return;
        if (document.visibilityState === "hidden") {
            void this.flushPendingNow();
        }
    };
    private readonly onBeforeUnload = (): void => {
        void this.flushPendingNow();
    };
    private chatPerformanceV2Enabled = false;
    private boundProfileId: string | null = null;

    /** Bind once the desktop/profile window scope is known — required before sqlite writes on native. */
    bindProfileScope(profileId: string): void {
        const normalized = profileId.trim();
        if (!normalized) {
            return;
        }
        this.boundProfileId = normalized;
        if (!this.isInitialized) {
            this.init();
        }
    }

    private canPersistForBoundProfileScope(): boolean {
        const boundProfileId = this.boundProfileId?.trim();
        if (!boundProfileId) {
            return false;
        }
        const activeProfileId = getResolvedProfileId()?.trim();
        return Boolean(activeProfileId && activeProfileId === boundProfileId);
    }

    /** Native always batches to SQLite; web uses the privacy flag only. */
    private usesBatchedPersistence(): boolean {
        return this.chatPerformanceV2Enabled || isTauri();
    }
    private readonly onPrivacySettingsChanged = (): void => {
        this.chatPerformanceV2Enabled = PrivacySettingsService.getSettings().chatPerformanceV2;
    };
    private chatReplacePendingDetail: Readonly<Partial<ChatStateReplacedEventDetail>> | undefined;
    private readonly flushChatReplaceDetail = createMicrotaskCoalescedHandler((): void => {
        const detail = this.chatReplacePendingDetail;
        this.chatReplacePendingDetail = undefined;
        const restoredPublicKeyHex = normalizePublicKeyHex(detail?.publicKeyHex);
        if (!restoredPublicKeyHex) {
            return;
        }
        const restoredProfileId = typeof detail?.profileId === "string"
            ? detail.profileId.trim()
            : "";
        if (restoredProfileId.length > 0 && restoredProfileId !== getResolvedProfileId()) {
            return;
        }
        void this.migrateFromLegacy(restoredPublicKeyHex, {
            profileId: restoredProfileId || undefined,
        });
    });

    private readonly queueChatReplaceDetail = (detail: Readonly<Partial<ChatStateReplacedEventDetail>> | undefined): void => {
        this.chatReplacePendingDetail = detail;
        this.flushChatReplaceDetail();
    };

    private chatStateBusUnsubscribe: (() => void) | null = null;

    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        this.chatPerformanceV2Enabled = PrivacySettingsService.getSettings().chatPerformanceV2;

        this.unsubscribeMessageBus = messageBus.subscribe((event: MessageBusEvent) => {
            if (!this.canPersistForBoundProfileScope()) {
                return;
            }
            switch (event.type) {
                case 'new_message':
                case 'message_updated':
                    if (event.message.kind === "command") {
                        break;
                    }
                    this.saveMessage(event.conversationId, event.message, event.type);
                    break;
                case 'message_deleted':
                    if (event.messageId === 'all') {
                        // Handled by chatStateStoreService.deleteConversationMessages usually,
                        // but we can also handle it here if we want absolute decoupling.
                    } else {
                        this.deleteMessage(event.messageId, event.messageIdentityIds, event.conversationId);
                    }
                    break;
            }
        });

        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", this.onVisibilityChange);
        }
        if (typeof window !== "undefined") {
            window.addEventListener("beforeunload", this.onBeforeUnload);
            window.addEventListener("privacy-settings-changed", this.onPrivacySettingsChanged);
        }
    }

    /**
     * Chat-state replaces are observed via {@link bindProfileBusChatStateReplaced} (profile bus).
     */
    bindProfileBusChatStateReplaced(bus: ProfileMessageBus | null): void {
        this.chatStateBusUnsubscribe?.();
        this.chatStateBusUnsubscribe = null;
        if (!bus) {
            return;
        }
        this.chatStateBusUnsubscribe = bus.subscribeTo("chat-state-replaced", (ev) => {
            this.queueChatReplaceDetail({
                publicKeyHex: ev.publicKeyHex,
                profileId: ev.profileId,
            });
        });
    }

    /** Flush batched message bus writes immediately (native SQLite durability). */
    async flushPendingNow(): Promise<void> {
        await this.flushQueue();
    }

    dispose(): void {
        if (!this.isInitialized) return;
        this.isInitialized = false;

        if (this.unsubscribeMessageBus) {
            this.unsubscribeMessageBus();
            this.unsubscribeMessageBus = null;
        }

        if (typeof document !== "undefined") {
            document.removeEventListener("visibilitychange", this.onVisibilityChange);
        }
        if (typeof window !== "undefined") {
            window.removeEventListener("beforeunload", this.onBeforeUnload);
            window.removeEventListener("privacy-settings-changed", this.onPrivacySettingsChanged);
        }
        this.chatStateBusUnsubscribe?.();
        this.chatStateBusUnsubscribe = null;

        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        this.pendingUpserts.clear();
        this.pendingDeletes.clear();
        this.pendingSupersededIds.clear();
        this.batchedEventCount = 0;
        this.currentBatchStartMs = null;
        this.pruneDeleteTombstones();
        this.recentlyDeletedMessageIds.clear();
        this.isFlushing = false;
        this.boundProfileId = null;
    }

    private scheduleFlush(): void {
        if (this.flushTimer) return;
        this.flushTimer = setTimeout(() => {
            void this.flushQueue();
        }, this.flushIntervalMs);
    }

    private getQueuedOperationCount(): number {
        return this.pendingUpserts.size + this.pendingDeletes.size;
    }

    private pruneDeleteTombstones(nowMs: number = Date.now()): void {
        if (this.recentlyDeletedMessageIds.size === 0) return;
        for (const [id, deletedAt] of this.recentlyDeletedMessageIds.entries()) {
            if (nowMs - deletedAt > this.deleteTombstoneTtlMs) {
                this.recentlyDeletedMessageIds.delete(id);
            }
        }
    }

    private markMessageDeleted(messageId: string, deletedAtMs: number = Date.now()): void {
        this.pruneDeleteTombstones(deletedAtMs);
        this.recentlyDeletedMessageIds.set(messageId, deletedAtMs);
    }

    private normalizeDeletedMessageIds(
        messageId: string | undefined,
        messageIdentityIds?: ReadonlyArray<string>,
    ): ReadonlyArray<string> {
        const ids = new Set<string>();
        const primaryId = messageId?.trim() ?? "";
        if (primaryId.length > 0) {
            ids.add(primaryId);
        }
        (messageIdentityIds ?? []).forEach((value) => {
            const normalized = typeof value === "string" ? value.trim() : "";
            if (normalized.length > 0) {
                ids.add(normalized);
            }
        });
        return Array.from(ids);
    }

    private isRecentlyDeleted(messageId: string, nowMs: number = Date.now()): boolean {
        const deletedAt = this.recentlyDeletedMessageIds.get(messageId);
        if (typeof deletedAt !== "number") return false;
        if (nowMs - deletedAt > this.deleteTombstoneTtlMs) {
            this.recentlyDeletedMessageIds.delete(messageId);
            return false;
        }
        return true;
    }

    private queueMessageUpsert(conversationId: string, message: Message): void {
        const nowMs = performance.now();
        // Use eventId as canonical key when available so v2 optimistic writes
        // (id=UUID, eventId=nostrId) land on the same DB row as legacy-migrated
        // messages (id=nostrId). Without this, two different keys produce two rows.
        const canonicalId = (typeof message.eventId === "string" && message.eventId.trim().length > 0)
            ? message.eventId.trim()
            : message.id;
        if (this.isRecentlyDeleted(canonicalId, Date.now()) || this.isRecentlyDeleted(message.id, Date.now())) {
            return;
        }
        if (this.currentBatchStartMs === null) {
            this.currentBatchStartMs = nowMs;
        }
        this.batchedEventCount += 1;
        if (performanceMonitor.isEnabled()) {
            performanceMonitor.recordMessageBusEvents(1);
        }

        const persistedRecord: Record<string, unknown> = {
            ...message,
            id: canonicalId,
            conversationId,
            timestampMs: message.timestamp.getTime(),
        };
        // Remove any prior UUID-keyed entry for the same message and queue
        // deletion of any already-flushed UUID row in IndexedDB.
        const hasConfirmedEventId = typeof message.eventId === "string" && message.eventId.trim().length > 0;
        if (canonicalId !== message.id) {
            this.pendingDeletes.delete(message.id);
            this.pendingUpserts.delete(message.id);
            this.pendingSupersededIds.add(message.id);
        } else if (isTauri() && !hasConfirmedEventId) {
            // On Tauri, SQLite uses INSERT OR IGNORE — the first write is permanent.
            // Never write the optimistic UUID row; wait until eventId is confirmed.
            return;
        }
        this.pendingDeletes.delete(canonicalId);
        this.pendingUpserts.set(canonicalId, persistedRecord);
        mirrorMessageToChatState(conversationId, message, canonicalId);

        if (isTauri()) {
            void this.flushPendingNow();
            return;
        }

        const queued = this.getQueuedOperationCount();
        if (queued >= this.immediateFlushThreshold) {
            void this.flushQueue();
            return;
        }
        this.scheduleFlush();
    }

    private queueMessageDelete(messageId: string): void {
        const nowMs = performance.now();
        this.markMessageDeleted(messageId);
        if (this.currentBatchStartMs === null) {
            this.currentBatchStartMs = nowMs;
        }
        this.batchedEventCount += 1;
        if (performanceMonitor.isEnabled()) {
            performanceMonitor.recordMessageBusEvents(1);
        }

        this.pendingUpserts.delete(messageId);
        this.pendingDeletes.add(messageId);

        const queued = this.getQueuedOperationCount();
        if (queued >= this.immediateFlushThreshold) {
            void this.flushQueue();
            return;
        }
        this.scheduleFlush();
    }

    private async flushQueue(): Promise<void> {
        if (this.isFlushing) return;
        if (this.getQueuedOperationCount() === 0) return;

        this.isFlushing = true;
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        const upserts = Array.from(this.pendingUpserts.values());
        const deletes = Array.from(this.pendingDeletes.values());
        const superseded = Array.from(this.pendingSupersededIds);
        const mergedCount = this.batchedEventCount - (upserts.length + deletes.length);
        const batchStartMs = this.currentBatchStartMs ?? performance.now();
        const flushStartMs = performance.now();

        this.pendingUpserts.clear();
        this.pendingDeletes.clear();
        this.pendingSupersededIds.clear();
        this.batchedEventCount = 0;
        this.currentBatchStartMs = null;

        try {
            if (upserts.length > 0) {
                if (isTauri()) {
                    const profileId = getResolvedProfileId()?.trim();
                    if (!profileId) {
                        logAppEvent({
                            name: "messaging.native_sqlite_write_skipped_no_profile",
                            level: "error",
                            scope: { feature: "messaging", action: "sqlite_persist" },
                            context: { queuedUpsertCount: upserts.length },
                        });
                    } else {
                    const latestByConversation = new Map<string, Record<string, unknown>>();
                    const sqliteWritePromises: Array<Promise<unknown>> = [];
                    for (const raw of upserts) {
                        // raw.id is now canonicalId (eventId when known, else UUID).
                        // The queueMessageUpsert guard already blocks UUID-only entries on Tauri,
                        // but apply the same check here as a safety net.
                        const eventId = typeof raw.id === "string" ? raw.id
                            : typeof raw.eventId === "string" ? raw.eventId : "";
                        if (!eventId) continue;
                        // Skip if id looks like a UUID (no eventId available yet) — belt-and-suspenders
                        const hasRealEventId = typeof raw.eventId === "string" && raw.eventId.trim().length > 0;
                        const idLooksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
                        if (idLooksLikeUuid && !hasRealEventId) continue;
                        const conversationId = typeof raw.conversationId === "string" ? raw.conversationId : "";
                        const attachments = Array.isArray(raw.attachments) ? raw.attachments : [];
                        const rec: MessageRecord = {
                            event_id: eventId,
                            profile_id: profileId,
                            conversation_id: conversationId,
                            sender_pubkey: typeof raw.senderPubkey === "string" ? raw.senderPubkey : "",
                            recipient_pubkey: typeof raw.recipientPubkey === "string" ? raw.recipientPubkey : "",
                            plaintext: typeof raw.content === "string" ? raw.content : "",
                            kind: typeof raw.kind === "number" ? raw.kind : 4,
                            created_at: typeof raw.timestampMs === "number" ? Math.floor(raw.timestampMs / 1000) : 0,
                            received_at: typeof raw.timestampMs === "number" ? raw.timestampMs : Date.now(),
                            is_outgoing: raw.isOutgoing === true,
                            reply_to_event_id: null,
                            has_attachment: attachments.length > 0,
                        };
                        sqliteWritePromises.push((async () => {
                            if (isDmKernelWriteOwner()) {
                                const writeResult = await writeDmKernelMessage(rec);
                                if (!writeResult.ok) {
                                    throw new Error(writeResult.errorMessage ?? writeResult.reason);
                                }
                            } else {
                                await dbInsertMessage(rec);
                            }
                            if (attachments.length > 0) {
                                const attachmentUrls = attachments
                                    .map((attachment) => (
                                        attachment && typeof attachment === "object" && typeof (attachment as { url?: string }).url === "string"
                                            ? (attachment as { url: string }).url.trim()
                                            : ""
                                    ))
                                    .filter((url) => url.length > 0);
                                if (attachmentUrls.length > 0) {
                                    linkLocalMediaIndexToMessageEvent({
                                        messageEventId: eventId,
                                        attachmentUrls,
                                    });
                                }
                            }
                        })());
                        if (conversationId) {
                            const existing = latestByConversation.get(conversationId);
                            const existingTs = typeof existing?.timestampMs === "number" ? existing.timestampMs : 0;
                            const rawTs = typeof raw.timestampMs === "number" ? raw.timestampMs : 0;
                            if (!existing || rawTs >= existingTs) {
                                latestByConversation.set(conversationId, raw);
                            }
                        }
                    }
                    for (const [conversationId, raw] of latestByConversation) {
                        const senderPubkey = typeof raw.senderPubkey === "string" ? raw.senderPubkey : "";
                        const recipientPubkey = typeof raw.recipientPubkey === "string" ? raw.recipientPubkey : "";
                        const peerPubkey = raw.isOutgoing === true ? recipientPubkey : senderPubkey;
                        const convRec: ConversationRecord = {
                            id: conversationId,
                            profile_id: profileId,
                            peer_pubkey: peerPubkey,
                            last_event_id: typeof raw.id === "string" ? raw.id
                                : typeof raw.eventId === "string" ? raw.eventId : null,
                            last_message_at: typeof raw.timestampMs === "number" ? raw.timestampMs : null,
                            last_plaintext_preview: typeof raw.content === "string"
                                ? toAccountEventPlaintextPreview(raw.content)
                                : null,
                            unread_count: 0,
                        };
                        sqliteWritePromises.push((async () => {
                            if (isDmKernelWriteOwner()) {
                                const writeResult = await writeDmKernelConversation(convRec);
                                if (!writeResult.ok) {
                                    throw new Error(writeResult.errorMessage ?? writeResult.reason);
                                }
                            } else {
                                await dbUpsertConversation(convRec);
                            }
                        })());
                    }
                    await Promise.all(sqliteWritePromises);
                    }
                }
            }
            if (deletes.length > 0) {
                if (isTauri()) {
                    const profileId = getResolvedProfileId();
                    if (profileId) {
                        const nowMs = Date.now();
                        await dbDeleteMessages(deletes, profileId).catch(() => undefined);
                        await Promise.all(deletes.map((deleteId) => dbInsertTombstone({
                            event_id: deleteId,
                            profile_id: profileId,
                            deleted_at: nowMs,
                            deleted_by: "",
                        }).catch(() => undefined)));
                    }
                }
            }
            if (performanceMonitor.isEnabled()) {
                const flushLatencyMs = performance.now() - flushStartMs;
                const mergedOrDroppedCount = mergedCount > 0 ? mergedCount : 0;
                performanceMonitor.recordBatchFlush(
                    upserts.length + deletes.length,
                    mergedOrDroppedCount,
                    flushLatencyMs,
                    mergedOrDroppedCount
                );
                performanceMonitor.recordUIUpdateLatency(performance.now() - batchStartMs);
            }
            if (mergedCount > 0) {
                console.debug("[MessagePersistenceService] Merged duplicate events:", mergedCount);
            }
            this.notifyMessagesIndexRebuilt(upserts.length, deletes.length, upserts);
        } catch (e) {
            console.error("[MessagePersistenceService] Failed to flush queued message operations:", e);
        } finally {
            this.isFlushing = false;
            if (this.getQueuedOperationCount() > 0) {
                this.scheduleFlush();
            }
        }
    }

    private async saveMessage(conversationId: string, message: Message, eventType: "new_message" | "message_updated") {
        if (performanceMonitor.isEnabled()) {
            performanceMonitor.recordMessageSent();
        }
        // Use eventId as canonical key when available (same logic as queueMessageUpsert)
        const canonicalId = (typeof message.eventId === "string" && message.eventId.trim().length > 0)
            ? message.eventId.trim()
            : message.id;
        if (this.isRecentlyDeleted(canonicalId, Date.now()) || this.isRecentlyDeleted(message.id, Date.now())) {
            return;
        }

        if (this.usesBatchedPersistence()) {
            this.queueMessageUpsert(conversationId, message);
            return;
        }

        if (!isTauri()) {
            mirrorMessageToChatState(conversationId, message, canonicalId);
            if (performanceMonitor.isEnabled()) {
                performanceMonitor.recordMessageLatency(eventType === "new_message" ? 0 : 1);
            }
        }
    }

    private async deleteMessage(messageId: string, messageIdentityIds?: ReadonlyArray<string>, conversationId?: string) {
        const deleteIds = this.normalizeDeletedMessageIds(messageId, messageIdentityIds);
        const activeProfile = getResolvedProfileId() || undefined;
        const nowMs = Date.now();
        deleteIds.forEach((deleteId) => {
            this.markMessageDeleted(deleteId);
        });
        if (conversationId?.trim()) {
            await messagingClientOperations.persistDmSuppressionOnly({
                conversationId,
                messageIdentityIds: deleteIds,
                deletedAtUnixMs: nowMs,
                profileId: activeProfile,
            });
        }
        if (this.usesBatchedPersistence()) {
            deleteIds.forEach((deleteId) => {
                this.queueMessageDelete(deleteId);
            });
            return;
        }

        void deleteIds;
    }

    private notifyMessagesIndexRebuilt(
        upsertCount: number,
        deleteCount: number,
        upserts: ReadonlyArray<Record<string, unknown>>,
    ): void {
        if (!isTauri() || (upsertCount === 0 && deleteCount === 0)) {
            return;
        }
        const profileId = getResolvedProfileId().trim();
        if (!profileId) {
            return;
        }
        const firstUpsert = upserts[0];
        const senderPubkey = typeof firstUpsert?.senderPubkey === "string" ? firstUpsert.senderPubkey : "";
        const recipientPubkey = typeof firstUpsert?.recipientPubkey === "string" ? firstUpsert.recipientPubkey : "";
        const publicKeyHex = (
            firstUpsert?.isOutgoing === true ? senderPubkey : recipientPubkey
        ) || senderPubkey || recipientPubkey || "";
        dispatchMessagesIndexRebuiltEvent({
            publicKeyHex,
            profileId,
            messageCount: upsertCount + deleteCount,
        });
    }

    /**
     * Initial migration: Call this if we want to move messages from the 
     * legacy 'chatState' blob to the 'messages' store.
     */
    /** Legacy IndexedDB migration disabled — chat-state + SQLite are the only durable paths. */
    async migrateFromLegacy(_publicKeyHex: string, _options?: Readonly<{ profileId?: string }>): Promise<void> {
        return;
    }
}

export const messagePersistenceService = new MessagePersistenceService();
