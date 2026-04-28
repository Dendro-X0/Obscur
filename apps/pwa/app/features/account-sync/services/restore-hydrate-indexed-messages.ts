"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { MessageQueue } from "@/app/features/messaging/lib/message-queue";
import { messagingDB } from "@dweb/storage/indexed-db";
import { toDmConversationId } from "@/app/features/messaging/utils/dm-conversation-id";
import { extractAttachmentsFromContent } from "@/app/features/messaging/utils/logic";
import { isVoiceCallControlPayload } from "@/app/features/messaging/services/realtime-voice-signaling";
import {
  loadMessageDeleteTombstoneEntries,
} from "@/app/features/messaging/services/message-delete-tombstone-store";
import type { Attachment, PersistedChatState, PersistedGroupMessage, PersistedMessage } from "@/app/features/messaging/types";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { getActiveProfileIdSafe } from "@/app/features/profiles/services/profile-scope";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { accountEventStore } from "./account-event-store";
import { replayAccountEvents } from "./account-event-reducer";
import {
  emitBackupPayloadHydrationDiagnostics,
  emitBackupPayloadProjectionFallback,
  emitBackupPayloadProjectionFallbackFailed,
} from "./restore-merge-diagnostics";
import {
  EMPTY_CHAT_STATE_MESSAGE_DIAGNOSTICS,
  EMPTY_MESSAGE_RECORD_DIAGNOSTICS,
  toPrefixedChatStateDiagnosticsContext,
  toPrefixedRecordDiagnosticsContext,
  type ChatStateMessageDiagnostics,
  type MessageRecordDiagnostics,
} from "./restore-diagnostics";
import {
  dedupeAttachments,
  getPersistedOutgoingMessageCount,
  mergePersistedGroupMessages,
  mergePersistedMessages,
  normalizeMessageStatus,
  parseAttachmentCandidate,
  sanitizePersistedChatStateMessagesByDeleteContract,
  toMessageDeleteTombstoneIdSet,
  toPreview,
} from "./restore-merge-chat-state";

const INDEXED_MESSAGE_BACKUP_SCAN_LIMIT = 2_000;
const MESSAGE_QUEUE_BACKUP_SCAN_LIMIT = 2_000;
const INDEXED_DB_READ_TIMEOUT_MS = 750;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("timeout"));
    }, timeoutMs);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
};

export const toTimestampMs = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    const unixMs = value.getTime();
    return Number.isFinite(unixMs) ? unixMs : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
    const dateValue = new Date(value).getTime();
    return Number.isFinite(dateValue) ? dateValue : null;
  }
  return null;
};

const inferPeerFromConversationId = (params: Readonly<{
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
}>): PublicKeyHex | null => {
  const directPeer = normalizePublicKeyHex(params.conversationId);
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

const isLikelyGroupConversationId = (conversationId: string): boolean => {
  const trimmed = conversationId.trim();
  return trimmed.startsWith("community:") || trimmed.startsWith("group:") || trimmed.includes("@");
};

export const toPersistedGroupMessageFromIndexedRecord = (params: Readonly<{
  record: Readonly<Record<string, unknown>>;
  myPublicKeyHex: PublicKeyHex;
}>): Readonly<{
  conversationId: string;
  persistedMessage: PersistedGroupMessage;
}> | null => {
  const conversationIdRaw = params.record.conversationId;
  if (typeof conversationIdRaw !== "string") {
    return null;
  }
  const conversationId = conversationIdRaw.trim();
  if (!conversationId || !isLikelyGroupConversationId(conversationId)) {
    return null;
  }

  const idRaw = params.record.id;
  const eventIdRaw = params.record.eventId;
  const normalizedEventId = typeof eventIdRaw === "string" && eventIdRaw.trim().length > 0
    ? eventIdRaw.trim()
    : null;
  const normalizedId = typeof idRaw === "string" && idRaw.trim().length > 0
    ? idRaw.trim()
    : null;
  const messageId = normalizedEventId ?? normalizedId;
  if (!messageId) {
    return null;
  }

  const timestampMs = toTimestampMs(params.record.timestampMs)
    ?? toTimestampMs(params.record.timestamp)
    ?? toTimestampMs(params.record.eventCreatedAt)
    ?? (
      typeof params.record.content === "string" && isVoiceCallControlPayload(params.record.content)
        ? null
        : Date.now()
    );
  if (!timestampMs || timestampMs <= 0) {
    return null;
  }
  const createdAtUnixSeconds = Math.max(0, Math.floor(timestampMs / 1000));

  const senderPubkey = normalizePublicKeyHex(
    typeof params.record.senderPubkey === "string" ? params.record.senderPubkey : undefined
  ) ?? normalizePublicKeyHex(
    typeof params.record.pubkey === "string" ? params.record.pubkey : undefined
  ) ?? (
    params.record.isOutgoing === true ? params.myPublicKeyHex : null
  );
  if (!senderPubkey) {
    return null;
  }

  const content = typeof params.record.content === "string"
    ? params.record.content
    : "";

  return {
    conversationId,
    persistedMessage: {
      id: messageId,
      pubkey: senderPubkey,
      content,
      created_at: createdAtUnixSeconds,
    },
  };
};

const extractPersistedAttachmentsFromRecord = (
  record: Readonly<Record<string, unknown>>,
  content: string,
): ReadonlyArray<Attachment> => {
  const fromArray = Array.isArray(record.attachments)
    ? record.attachments
      .map((value) => parseAttachmentCandidate(value))
      .filter((value): value is Attachment => value !== null)
    : [];
  const fromLegacySingle = parseAttachmentCandidate(record.attachment);
  const fromRecord = dedupeAttachments([
    ...fromArray,
    ...(fromLegacySingle ? [fromLegacySingle] : []),
  ]);
  if (fromRecord.length > 0) {
    return fromRecord;
  }
  return dedupeAttachments(extractAttachmentsFromContent(content));
};

const resolveDmRecordDirection = (params: Readonly<{
  record: Readonly<Record<string, unknown>>;
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
}>): Readonly<{
  isOutgoing: boolean;
  senderPubkey: PublicKeyHex | null;
  recipientPubkey: PublicKeyHex | null;
  peerPublicKeyHex: PublicKeyHex | null;
}> => {
  const senderPubkeyFromRecord = normalizePublicKeyHex(
    typeof params.record.senderPubkey === "string" ? params.record.senderPubkey : undefined
  ) ?? normalizePublicKeyHex(
    typeof params.record.pubkey === "string" ? params.record.pubkey : undefined
  );
  const recipientPubkey = normalizePublicKeyHex(
    typeof params.record.recipientPubkey === "string" ? params.record.recipientPubkey : undefined
  );
  const inferredPeerPublicKeyHex = inferPeerFromConversationId({
    conversationId: params.conversationId,
    myPublicKeyHex: params.myPublicKeyHex,
  });

  let isOutgoing = typeof params.record.isOutgoing === "boolean"
    ? params.record.isOutgoing
    : false;
  let peerPublicKeyHex: PublicKeyHex | null = null;

  if (
    senderPubkeyFromRecord === params.myPublicKeyHex
    && recipientPubkey
    && recipientPubkey !== params.myPublicKeyHex
  ) {
    isOutgoing = true;
    peerPublicKeyHex = recipientPubkey;
  } else if (senderPubkeyFromRecord === params.myPublicKeyHex) {
    isOutgoing = true;
    peerPublicKeyHex = inferredPeerPublicKeyHex;
  } else if (
    recipientPubkey === params.myPublicKeyHex
    && senderPubkeyFromRecord
    && senderPubkeyFromRecord !== params.myPublicKeyHex
  ) {
    isOutgoing = false;
    peerPublicKeyHex = senderPubkeyFromRecord;
  } else if (
    !senderPubkeyFromRecord
    && recipientPubkey
    && recipientPubkey !== params.myPublicKeyHex
    && inferredPeerPublicKeyHex
    && recipientPubkey === inferredPeerPublicKeyHex
  ) {
    // Legacy records can omit senderPubkey/isOutgoing while still carrying
    // recipient and canonical conversation context.
    isOutgoing = true;
    peerPublicKeyHex = recipientPubkey;
  } else {
    peerPublicKeyHex = inferredPeerPublicKeyHex;
  }

  const senderPubkey = senderPubkeyFromRecord ?? (
    isOutgoing
      ? params.myPublicKeyHex
      : peerPublicKeyHex
  );

  return {
    isOutgoing,
    senderPubkey,
    recipientPubkey,
    peerPublicKeyHex,
  };
};

export const toPersistedMessageFromIndexedRecord = (params: Readonly<{
  record: Readonly<Record<string, unknown>>;
  myPublicKeyHex: PublicKeyHex;
}>): Readonly<{
  conversationId: string;
  persistedMessage: PersistedMessage;
  peerPublicKeyHex: PublicKeyHex | null;
}> | null => {
  const conversationIdRaw = params.record.conversationId;
  if (typeof conversationIdRaw !== "string") {
    return null;
  }
  const conversationId = conversationIdRaw.trim();
  if (conversationId.length === 0) {
    return null;
  }

  const idRaw = params.record.id;
  const eventIdRaw = params.record.eventId;
  const normalizedEventId = typeof eventIdRaw === "string" && eventIdRaw.trim().length > 0
    ? eventIdRaw.trim()
    : null;
  const normalizedId = typeof idRaw === "string" && idRaw.trim().length > 0
    ? idRaw.trim()
    : null;
  const messageId = normalizedEventId ?? normalizedId;
  if (!messageId) {
    return null;
  }

  const timestampMs = toTimestampMs(params.record.timestampMs)
    ?? toTimestampMs(params.record.timestamp)
    ?? toTimestampMs(params.record.eventCreatedAt)
    ?? (
      typeof params.record.content === "string" && isVoiceCallControlPayload(params.record.content)
        ? null
        : Date.now()
    );
  if (!timestampMs || timestampMs <= 0) {
    return null;
  }
  const { isOutgoing, senderPubkey, peerPublicKeyHex } = resolveDmRecordDirection({
    record: params.record,
    conversationId,
    myPublicKeyHex: params.myPublicKeyHex,
  });

  const content = typeof params.record.content === "string"
    ? params.record.content
    : "";
  const attachments = extractPersistedAttachmentsFromRecord(params.record, content);

  const kind = params.record.kind === "command" ? "command" : undefined;

  return {
    conversationId,
    persistedMessage: {
      id: messageId,
      ...(normalizedEventId ? { eventId: normalizedEventId } : {}),
      ...(kind ? { kind } : {}),
      ...(senderPubkey ? { pubkey: senderPubkey } : {}),
      content,
      timestampMs,
      isOutgoing,
      status: normalizeMessageStatus(params.record.status),
      ...(attachments.length > 0 ? { attachments } : {}),
    },
    peerPublicKeyHex,
  };
};

const loadMessageQueueRecords = async (
  publicKeyHex: PublicKeyHex
): Promise<ReadonlyArray<Readonly<Record<string, unknown>>>> => {
  try {
    const messageQueue = new MessageQueue(publicKeyHex);
    const messages = await withTimeout(
      messageQueue.getAllMessages(MESSAGE_QUEUE_BACKUP_SCAN_LIMIT),
      INDEXED_DB_READ_TIMEOUT_MS,
    );
    return messages as unknown as ReadonlyArray<Readonly<Record<string, unknown>>>;
  } catch {
    return [];
  }
};

const loadIndexedMessageRecords = async (): Promise<ReadonlyArray<Readonly<Record<string, unknown>>>> => {
  try {
    return await withTimeout(
      messagingDB.getAllByIndex<Readonly<Record<string, unknown>>>(
        "messages",
        "timestampMs",
        undefined,
        INDEXED_MESSAGE_BACKUP_SCAN_LIMIT,
        "prev",
      ),
      INDEXED_DB_READ_TIMEOUT_MS,
    );
  } catch {
    // Fallback for legacy environments/tests without index support.
    try {
      return await withTimeout(
        messagingDB.getAll<Readonly<Record<string, unknown>>>("messages"),
        INDEXED_DB_READ_TIMEOUT_MS,
      );
    } catch {
      return [];
    }
  }
};

const hasOutgoingMessageEvidence = (
  record: Readonly<Record<string, unknown>>,
  myPublicKeyHex: PublicKeyHex
): boolean => {
  const conversationId = typeof record.conversationId === "string"
    ? record.conversationId.trim()
    : "";
  return resolveDmRecordDirection({
    record,
    conversationId,
    myPublicKeyHex,
  }).isOutgoing;
};

const toConversationIdDiagnosticLabel = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "unknown";
  }
  if (trimmed.length <= 20) {
    return trimmed;
  }
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-8)}`;
};

const toCanonicalDmConversationId = (params: Readonly<{
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

export const summarizePersistedChatStateMessages = (
  chatState: PersistedChatState | null | undefined,
  myPublicKeyHex: PublicKeyHex,
): ChatStateMessageDiagnostics => {
  if (!chatState) {
    return EMPTY_CHAT_STATE_MESSAGE_DIAGNOSTICS;
  }
  const conversationStatsById = new Map<string, Readonly<{ outgoing: number; incoming: number }>>();
  const canonicalSourceIds = new Map<string, Set<string>>();
  let dmCanonicalConversationIdMismatchCount = 0;
  let dmMessageCount = 0;
  let dmOutgoingCount = 0;
  let dmIncomingCount = 0;
  let dmMessageWithAttachmentsCount = 0;
  let dmAttachmentCount = 0;

  Object.entries(chatState.messagesByConversationId ?? {}).forEach(([conversationId, messages]) => {
    const canonicalConversationId = toCanonicalDmConversationId({
      conversationId,
      myPublicKeyHex,
    });
    if (canonicalConversationId !== conversationId) {
      dmCanonicalConversationIdMismatchCount += 1;
    }
    const canonicalSources = canonicalSourceIds.get(canonicalConversationId) ?? new Set<string>();
    canonicalSources.add(conversationId);
    canonicalSourceIds.set(canonicalConversationId, canonicalSources);

    let outgoing = 0;
    let incoming = 0;
    messages.forEach((message) => {
      const senderPubkey = normalizePublicKeyHex(message.pubkey);
      const isOutgoing = message.isOutgoing === true || senderPubkey === myPublicKeyHex;
      const attachmentCount = Array.isArray(message.attachments) ? message.attachments.length : 0;
      if (isOutgoing) {
        outgoing += 1;
      } else {
        incoming += 1;
      }
      if (attachmentCount > 0) {
        dmMessageWithAttachmentsCount += 1;
        dmAttachmentCount += attachmentCount;
      }
    });

    dmMessageCount += messages.length;
    dmOutgoingCount += outgoing;
    dmIncomingCount += incoming;
    conversationStatsById.set(conversationId, { outgoing, incoming });
  });

  const collisionEntries = Array.from(canonicalSourceIds.entries())
    .filter(([, sourceIds]) => sourceIds.size > 1);
  const dmCanonicalCollisionSample = collisionEntries.length === 0
    ? null
    : collisionEntries.slice(0, 3).map(([canonicalId, sourceIds]) => (
      `${toConversationIdDiagnosticLabel(canonicalId)}<=${Array.from(sourceIds).slice(0, 3).map(toConversationIdDiagnosticLabel).join("|")}`
    )).join(",");

  const dmIncomingOnlyConversationCount = Array.from(conversationStatsById.values())
    .filter((entry) => entry.incoming > 0 && entry.outgoing === 0).length;
  const dmOutgoingOnlyConversationCount = Array.from(conversationStatsById.values())
    .filter((entry) => entry.outgoing > 0 && entry.incoming === 0).length;

  const groupMessages = chatState.groupMessages ?? {};
  let groupMessageCount = 0;
  let groupSelfAuthoredCount = 0;
  let groupMessageWithAttachmentsCount = 0;
  let groupAttachmentCount = 0;
  Object.values(groupMessages).forEach((messages) => {
    groupMessageCount += messages.length;
    messages.forEach((message) => {
      if (normalizePublicKeyHex(message.pubkey) === myPublicKeyHex) {
        groupSelfAuthoredCount += 1;
      }
      const attachmentCandidate = (message as Readonly<Record<string, unknown>>).attachments;
      const attachmentCount = Array.isArray(attachmentCandidate) ? attachmentCandidate.length : 0;
      if (attachmentCount > 0) {
        groupMessageWithAttachmentsCount += 1;
        groupAttachmentCount += attachmentCount;
      }
    });
  });

  return {
    dmConversationCount: conversationStatsById.size,
    dmCanonicalConversationCount: canonicalSourceIds.size,
    dmMessageCount,
    dmOutgoingCount,
    dmIncomingCount,
    dmMessageWithAttachmentsCount,
    dmAttachmentCount,
    dmIncomingOnlyConversationCount,
    dmOutgoingOnlyConversationCount,
    dmCanonicalConversationIdMismatchCount,
    dmCanonicalCollisionCount: collisionEntries.length,
    dmCanonicalCollisionSample,
    groupConversationCount: Object.keys(groupMessages).length,
    groupMessageCount,
    groupSelfAuthoredCount,
    groupMessageWithAttachmentsCount,
    groupAttachmentCount,
  };
};

export const summarizeMessageRecords = (
  records: ReadonlyArray<Readonly<Record<string, unknown>>>,
  myPublicKeyHex: PublicKeyHex,
): MessageRecordDiagnostics => {
  if (records.length === 0) {
    return EMPTY_MESSAGE_RECORD_DIAGNOSTICS;
  }

  const canonicalSourceIds = new Map<string, Set<string>>();
  const rawConversationStats = new Map<string, Readonly<{ outgoing: number; incoming: number }>>();
  let canonicalConversationIdMismatchCount = 0;
  let outgoingRecordCount = 0;

  records.forEach((record) => {
    const rawConversationId = typeof record.conversationId === "string" ? record.conversationId.trim() : "";
    if (!rawConversationId) {
      return;
    }

    const canonicalConversationId = toCanonicalDmConversationId({
      conversationId: rawConversationId,
      myPublicKeyHex,
    });
    if (canonicalConversationId !== rawConversationId) {
      canonicalConversationIdMismatchCount += 1;
    }
    const canonicalSources = canonicalSourceIds.get(canonicalConversationId) ?? new Set<string>();
    canonicalSources.add(rawConversationId);
    canonicalSourceIds.set(canonicalConversationId, canonicalSources);

    const hasOutgoingEvidence = hasOutgoingMessageEvidence(record, myPublicKeyHex);
    if (hasOutgoingEvidence) {
      outgoingRecordCount += 1;
    }
    const existingStats = rawConversationStats.get(rawConversationId) ?? { outgoing: 0, incoming: 0 };
    rawConversationStats.set(rawConversationId, hasOutgoingEvidence
      ? { outgoing: existingStats.outgoing + 1, incoming: existingStats.incoming }
      : { outgoing: existingStats.outgoing, incoming: existingStats.incoming + 1 });
  });

  const collisionEntries = Array.from(canonicalSourceIds.entries())
    .filter(([, sourceIds]) => sourceIds.size > 1);
  const canonicalCollisionSample = collisionEntries.length === 0
    ? null
    : collisionEntries.slice(0, 3).map(([canonicalId, sourceIds]) => (
      `${toConversationIdDiagnosticLabel(canonicalId)}<=${Array.from(sourceIds).slice(0, 3).map(toConversationIdDiagnosticLabel).join("|")}`
    )).join(",");

  const incomingOnlyRawConversationCount = Array.from(rawConversationStats.values())
    .filter((stats) => stats.incoming > 0 && stats.outgoing === 0).length;
  const outgoingOnlyRawConversationCount = Array.from(rawConversationStats.values())
    .filter((stats) => stats.outgoing > 0 && stats.incoming === 0).length;

  return {
    recordCount: records.length,
    rawConversationCount: rawConversationStats.size,
    canonicalConversationCount: canonicalSourceIds.size,
    canonicalConversationIdMismatchCount,
    canonicalCollisionCount: collisionEntries.length,
    canonicalCollisionSample,
    outgoingRecordCount,
    incomingRecordCount: Math.max(0, records.length - outgoingRecordCount),
    incomingOnlyRawConversationCount,
    outgoingOnlyRawConversationCount,
  };
};

export const hydrateChatStateFromIndexedMessages = async (
  publicKeyHex: PublicKeyHex,
  chatState: PersistedChatState | null
): Promise<PersistedChatState | null> => {
  const baseState: PersistedChatState = chatState ?? {
    version: 2,
    createdConnections: [],
    createdGroups: [],
    unreadByConversationId: {},
    connectionOverridesByConnectionId: {},
    messagesByConversationId: {},
    groupMessages: {},
    connectionRequests: [],
    pinnedChatIds: [],
    hiddenChatIds: [],
  };

  const indexedRecords = await loadIndexedMessageRecords();
  const convergenceGuardEnabled = PrivacySettingsService.getSettings().accountSyncConvergenceV091 === true;
  const indexedConversationIds = new Set<string>();
  const indexedConversationsWithOutgoingEvidence = new Set<string>();
  indexedRecords.forEach((record) => {
    const conversationId = typeof record.conversationId === "string" ? record.conversationId.trim() : "";
    if (!conversationId) {
      return;
    }
    indexedConversationIds.add(conversationId);
    if (hasOutgoingMessageEvidence(record, publicKeyHex)) {
      indexedConversationsWithOutgoingEvidence.add(conversationId);
    }
  });
  const hasIndexedConversationWithoutOutgoingEvidence = Array.from(indexedConversationIds).some(
    (conversationId) => !indexedConversationsWithOutgoingEvidence.has(conversationId),
  );
  const shouldScanQueueRecords = convergenceGuardEnabled
    || indexedRecords.length === 0
    || hasIndexedConversationWithoutOutgoingEvidence;
  const queueRecords = shouldScanQueueRecords
    ? await loadMessageQueueRecords(publicKeyHex)
    : [];
  const records = [...indexedRecords, ...queueRecords];
  const recordDiagnostics = summarizeMessageRecords(records, publicKeyHex);

  // Diagnostic: Track outgoing message identification in raw records
  let rawOutgoingCount = 0;
  let rawIncomingCount = 0;
  records.forEach((record) => {
    const direction = resolveDmRecordDirection({
      record,
      conversationId: typeof record.conversationId === "string" ? record.conversationId : "",
      myPublicKeyHex: publicKeyHex,
    });
    if (direction.isOutgoing) {
      rawOutgoingCount++;
    } else {
      rawIncomingCount++;
    }
  });
  if (records.length > 0) {
    console.log("[HydrateFromIndexed] Directionality check:", {
      total: records.length,
      outgoing: rawOutgoingCount,
      incoming: rawIncomingCount,
      outgoingRatio: rawOutgoingCount / records.length,
      source: "indexed_records",
    });
  }

  if (records.length === 0) {
    return baseState;
  }

  const messagesByConversationId: Record<string, ReadonlyArray<PersistedMessage>> = {
    ...baseState.messagesByConversationId,
  };
  const groupMessagesByConversationId: Record<string, ReadonlyArray<PersistedGroupMessage>> = {
    ...(baseState.groupMessages ?? {}),
  };
  const conversationById = new Map<string, PersistedChatState["createdConnections"][number]>(
    baseState.createdConnections.map((entry) => [entry.id, entry] as const)
  );

  records.forEach((record) => {
    const ownerPubkey = normalizePublicKeyHex(
      typeof record.ownerPubkey === "string" ? record.ownerPubkey : undefined
    );
    if (ownerPubkey && ownerPubkey !== publicKeyHex) {
      return;
    }
    const parsedGroup = toPersistedGroupMessageFromIndexedRecord({
      record,
      myPublicKeyHex: publicKeyHex,
    });
    if (parsedGroup) {
      const existingGroupMessages = groupMessagesByConversationId[parsedGroup.conversationId] ?? [];
      groupMessagesByConversationId[parsedGroup.conversationId] = mergePersistedGroupMessages(
        existingGroupMessages,
        [parsedGroup.persistedMessage],
      );
      return;
    }
    const parsed = toPersistedMessageFromIndexedRecord({
      record,
      myPublicKeyHex: publicKeyHex,
    });
    if (!parsed) {
      return;
    }

    const existingMessages = messagesByConversationId[parsed.conversationId] ?? [];
    messagesByConversationId[parsed.conversationId] = mergePersistedMessages(existingMessages, [parsed.persistedMessage]);

    if (!parsed.peerPublicKeyHex) {
      return;
    }
    const existingConversation = conversationById.get(parsed.conversationId);
    const nextLastMessageAtUnixMs = Math.max(
      existingConversation?.lastMessageTimeMs ?? 0,
      parsed.persistedMessage.timestampMs,
    );
    const nextConversation = {
      id: parsed.conversationId,
      displayName: existingConversation?.displayName ?? parsed.peerPublicKeyHex.slice(0, 8),
      pubkey: parsed.peerPublicKeyHex,
      lastMessage: toPreview(parsed.persistedMessage.content || existingConversation?.lastMessage || ""),
      unreadCount: existingConversation?.unreadCount ?? 0,
      lastMessageTimeMs: nextLastMessageAtUnixMs,
    };
    conversationById.set(parsed.conversationId, nextConversation);
  });

  let nextState: PersistedChatState = {
    ...baseState,
    createdConnections: Array.from(conversationById.values()),
    messagesByConversationId,
    groupMessages: groupMessagesByConversationId,
  };

  const outgoingCountBeforeProjectionFallback = getPersistedOutgoingMessageCount(nextState, publicKeyHex);
  const hasOutgoingHistory = outgoingCountBeforeProjectionFallback > 0;
  const sparseOutgoingEvidenceThreshold = Math.max(1, Math.floor(recordDiagnostics.recordCount * 0.03));
  const hasSparseOutgoingEvidence = (
    recordDiagnostics.recordCount >= 12
    && recordDiagnostics.incomingRecordCount >= 8
    && recordDiagnostics.outgoingRecordCount <= sparseOutgoingEvidenceThreshold
  );
  const hasOutgoingOnlyConversationSkew = recordDiagnostics.outgoingOnlyRawConversationCount > 0;
  const hasIncomingOnlyConversationSkew = recordDiagnostics.incomingOnlyRawConversationCount > 0;
  const shouldRunProjectionFallback = (
    !hasOutgoingHistory
    || hasSparseOutgoingEvidence
    || hasOutgoingOnlyConversationSkew
    || hasIncomingOnlyConversationSkew
  );

  console.log("[HydrateFromIndexed] Projection fallback check:", {
    outgoingCountBefore: outgoingCountBeforeProjectionFallback,
    hasOutgoingHistory,
    hasSparseOutgoingEvidence,
    hasOutgoingOnlyConversationSkew,
    hasIncomingOnlyConversationSkew,
    shouldRunProjectionFallback,
    recordCount: recordDiagnostics.recordCount,
    outgoingRecordCount: recordDiagnostics.outgoingRecordCount,
    incomingRecordCount: recordDiagnostics.incomingRecordCount,
  });

  if (shouldRunProjectionFallback) {
    try {
      const profileId = getActiveProfileIdSafe();
      const eventLogEntries = await accountEventStore.loadEvents({
        profileId,
        accountPublicKeyHex: publicKeyHex,
      });
      const projection = replayAccountEvents(eventLogEntries);
      if (projection) {
        const mergedMessagesByConversationId: Record<string, ReadonlyArray<PersistedMessage>> = {
          ...nextState.messagesByConversationId,
        };
        const mergedConversationsById = new Map<string, PersistedChatState["createdConnections"][number]>(
          nextState.createdConnections.map((conversation) => [conversation.id, conversation] as const),
        );
        Object.entries(projection.messagesByConversationId).forEach(([conversationId, timeline]) => {
          if (timeline.length === 0) {
            return;
          }
          const mappedMessages: ReadonlyArray<PersistedMessage> = timeline.map((entry) => {
            const isOutgoing = entry.direction === "outgoing";
            const fallbackAttachments = extractAttachmentsFromContent(entry.plaintextPreview, {
              includeGenericLinksAsFiles: true,
            });
            return {
              id: entry.messageId,
              content: entry.plaintextPreview,
              timestampMs: entry.eventCreatedAtUnixSeconds * 1000,
              isOutgoing,
              status: "delivered",
              pubkey: isOutgoing ? publicKeyHex : entry.peerPublicKeyHex,
              ...(fallbackAttachments.length > 0 ? { attachments: fallbackAttachments } : {}),
            };
          });
          const existingMessages = mergedMessagesByConversationId[conversationId] ?? [];
          const mergedMessages = mergePersistedMessages(existingMessages, mappedMessages);
          mergedMessagesByConversationId[conversationId] = mergedMessages;
          const lastMessage = mergedMessages[mergedMessages.length - 1];
          const peerPublicKeyHex = projection.conversationsById[conversationId]?.peerPublicKeyHex
            ?? timeline[timeline.length - 1]?.peerPublicKeyHex;
          if (!lastMessage || !peerPublicKeyHex) {
            return;
          }
          const existingConversation = mergedConversationsById.get(conversationId);
          mergedConversationsById.set(conversationId, {
            id: conversationId,
            displayName: existingConversation?.displayName ?? peerPublicKeyHex.slice(0, 8),
            pubkey: peerPublicKeyHex,
            lastMessage: toPreview(lastMessage.content || existingConversation?.lastMessage || ""),
            unreadCount: existingConversation?.unreadCount ?? 0,
            lastMessageTimeMs: Math.max(
              existingConversation?.lastMessageTimeMs ?? 0,
              lastMessage.timestampMs,
            ),
          });
        });
        nextState = {
          ...nextState,
          createdConnections: Array.from(mergedConversationsById.values()),
          messagesByConversationId: mergedMessagesByConversationId,
        };
        emitBackupPayloadProjectionFallback({
          profileId,
          reasonNoOutgoingHistory: !hasOutgoingHistory,
          reasonSparseOutgoingEvidence: hasSparseOutgoingEvidence,
          reasonOutgoingOnlyConversationSkew: hasOutgoingOnlyConversationSkew,
          reasonIncomingOnlyConversationSkew: hasIncomingOnlyConversationSkew,
          sparseOutgoingEvidenceThreshold,
          eventLogCount: eventLogEntries.length,
          outgoingCountBeforeFallback: outgoingCountBeforeProjectionFallback,
          outgoingCountAfterFallback: getPersistedOutgoingMessageCount(nextState, publicKeyHex),
          sourceRecordCount: recordDiagnostics.recordCount,
          sourceOutgoingRecordCount: recordDiagnostics.outgoingRecordCount,
          sourceIncomingRecordCount: recordDiagnostics.incomingRecordCount,
          sourceIncomingOnlyRawConversationCount: recordDiagnostics.incomingOnlyRawConversationCount,
          sourceOutgoingOnlyRawConversationCount: recordDiagnostics.outgoingOnlyRawConversationCount,
          indexedRecordCount: indexedRecords.length,
          queueRecordCount: queueRecords.length,
        });
      }
    } catch (error) {
      emitBackupPayloadProjectionFallbackFailed({
        reason: error instanceof Error ? error.message : String(error),
        indexedRecordCount: indexedRecords.length,
        queueRecordCount: queueRecords.length,
      });
    }
  }

  nextState = sanitizePersistedChatStateMessagesByDeleteContract(nextState, {
    durableDeleteIds: toMessageDeleteTombstoneIdSet(loadMessageDeleteTombstoneEntries()),
  }) ?? nextState;

  const hydratedChatStateDiagnostics = summarizePersistedChatStateMessages(nextState, publicKeyHex);
  const finalOutgoingCount = getPersistedOutgoingMessageCount(nextState, publicKeyHex);
  console.log("[HydrateFromIndexed] Final state:", {
    outgoing: finalOutgoingCount,
    total: hydratedChatStateDiagnostics.dmMessageCount,
    outgoingRatio: hydratedChatStateDiagnostics.dmMessageCount > 0
      ? finalOutgoingCount / hydratedChatStateDiagnostics.dmMessageCount
      : 0,
  });
  emitBackupPayloadHydrationDiagnostics({
    publicKeyHex,
    indexedRecordCount: indexedRecords.length,
    queueRecordCount: queueRecords.length,
    shouldScanQueueRecords,
    convergenceGuardEnabled,
    hasIndexedConversationWithoutOutgoingEvidence,
    recordDiagnostics,
    hydratedChatStateDiagnostics,
    toPrefixedRecordDiagnosticsContext,
    toPrefixedChatStateDiagnosticsContext,
  });

  return nextState;
};
