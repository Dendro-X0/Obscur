
import { parsePublicKeyInput } from "../../profile/utils/parse-public-key-input";
import type {
    PersistedChatState,
    PersistedDmConversation,
    PersistedGroupConversation,
    PersistedMessage,
    PersistedContactOverride,
    DmConversation,
    GroupConversation,
    Message,
    MessageKind,
    MessageStatus,
    Attachment,
    ReplyTo,
    ReactionEmoji,
    ReactionsByEmoji,
    ContactOverridesByContactId,
    MessagesByConversationId,
    LastSeenByConversationId
} from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const MAX_PERSISTED_MESSAGES_PER_CONVERSATION: number = 500;
const PERSISTED_CHAT_STATE_VERSION: number = 2;
const PERSISTED_CHAT_STATE_STORAGE_KEY: string = "dweb.nostr.pwa.chatState";
const LAST_SEEN_STORAGE_PREFIX: string = "dweb.nostr.pwa.last-seen";

// Helper functions for type checking
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isMessageKind = (value: unknown): value is MessageKind => value === "user" || value === "command";

const isReactionEmoji = (value: unknown): value is ReactionEmoji =>
    value === "👍" || value === "❤️" || value === "😂" || value === "🔥" || value === "👏";

// Parsing functions
const parseAttachment = (value: unknown): Attachment | null => {
    if (!isRecord(value)) return null;
    const kind: unknown = value.kind;
    const url: unknown = value.url;
    const contentType: unknown = value.contentType;
    const fileName: unknown = value.fileName;
    if (kind !== "image" && kind !== "video") return null;
    if (!isString(url) || !isString(contentType) || !isString(fileName)) return null;
    return { kind, url, contentType, fileName };
};

const parseReplyTo = (value: unknown): ReplyTo | null => {
    if (!isRecord(value)) return null;
    const messageId: unknown = value.messageId;
    const previewText: unknown = value.previewText;
    if (!isString(messageId) || !isString(previewText)) return null;
    return { messageId, previewText };
};

const parseReactionsByEmoji = (value: unknown): ReactionsByEmoji | null => {
    if (!isRecord(value)) return null;
    const result: Partial<Record<ReactionEmoji, number>> = {};
    Object.entries(value).forEach(([key, rawCount]: [string, unknown]): void => {
        if (!isReactionEmoji(key) || !isNumber(rawCount) || rawCount <= 0) return;
        result[key] = rawCount;
    });

    const entries = Object.entries(result)
        .filter(([emoji, count]) => isReactionEmoji(emoji) && isNumber(count))
        .map(([emoji, count]) => [emoji as ReactionEmoji, count ?? 0] as const);

    if (entries.length === 0) return null;

    const final: Record<ReactionEmoji, number> = {
        "👍": 0, "❤️": 0, "😂": 0, "🔥": 0, "👏": 0
    };

    entries.forEach(([emoji, count]) => {
        final[emoji] = count;
    });

    return final;
};

const parsePersistedDmConversation = (value: unknown): PersistedDmConversation | null => {
    if (!isRecord(value)) return null;
    const { id, displayName, pubkey, lastMessage, unreadCount, lastMessageTimeMs } = value;

    if (!isString(id) || !isString(displayName) || !isString(pubkey) || !isString(lastMessage)) return null;
    if (!isNumber(unreadCount) || !isNumber(lastMessageTimeMs)) return null;

    return { id, displayName, pubkey, lastMessage, unreadCount, lastMessageTimeMs };
};

const parsePersistedGroupConversation = (value: unknown): PersistedGroupConversation | null => {
    if (!isRecord(value)) return null;
    const { id, groupId, relayUrl, displayName, memberPubkeys, lastMessage, unreadCount, lastMessageTimeMs } = value;
    if (!isString(id) || !isString(groupId) || !isString(relayUrl) || !isString(displayName) || !Array.isArray(memberPubkeys) || !isString(lastMessage)) return null;

    const parsedMemberPubkeys: string[] = memberPubkeys
        .filter((v): v is string => isString(v) && v.trim().length > 0)
        .map(v => v.trim());

    if (parsedMemberPubkeys.length === 0) return null;
    if (!isNumber(unreadCount) || !isNumber(lastMessageTimeMs)) return null;
    return { id, groupId, relayUrl, displayName, memberPubkeys: parsedMemberPubkeys, lastMessage, unreadCount, lastMessageTimeMs };
};

const parsePersistedContactOverride = (value: unknown): PersistedContactOverride | null => {
    if (!isRecord(value)) return null;
    const { lastMessage, lastMessageTimeMs } = value;
    if (!isString(lastMessage) || !isNumber(lastMessageTimeMs)) return null;
    return { lastMessage, lastMessageTimeMs };
};

const parsePersistedMessage = (value: unknown): PersistedMessage | null => {
    if (!isRecord(value)) return null;
    const { id, kind, content, timestampMs, isOutgoing, status, attachment, replyTo, reactions, deletedAtMs } = value;

    if (!isString(id) || !isString(content) || !isNumber(timestampMs) || !isBoolean(isOutgoing)) return null;
    if (kind !== undefined && !isMessageKind(kind)) return null;
    if (status !== "delivered" && status !== "accepted" && status !== "rejected") return null;

    const parsedAttachments = Array.isArray(value.attachments)
        ? value.attachments
            .map(a => parseAttachment(a))
            .filter((a): a is Attachment => a !== null)
        : attachment !== undefined
            ? [parseAttachment(attachment)].filter((a): a is Attachment => a !== null)
            : [];

    const parsedReplyTo = replyTo === undefined ? null : parseReplyTo(replyTo);
    if (replyTo !== undefined && !parsedReplyTo) return null;

    const parsedReactions = reactions === undefined ? null : parseReactionsByEmoji(reactions);
    if (reactions !== undefined && !parsedReactions) return null;

    const parsedDeletedAtMs = isNumber(deletedAtMs) ? deletedAtMs : undefined;

    return {
        id,
        ...(kind ? { kind } : {}),
        content,
        timestampMs,
        isOutgoing,
        status,
        ...(parsedAttachments.length > 0 ? { attachments: parsedAttachments } : {}),
        ...(parsedReplyTo ? { replyTo: parsedReplyTo } : {}),
        ...(parsedReactions ? { reactions: parsedReactions } : {}),
        ...(parsedDeletedAtMs ? { deletedAtMs: parsedDeletedAtMs } : {}),
    } as PersistedMessage;
};

const parsePersistedChatState = (value: unknown): PersistedChatState | null => {
    if (!isRecord(value)) return null;
    const { version, createdContacts, createdGroups, unreadByConversationId, unreadByContactId, contactOverridesByContactId, messagesByConversationId, messagesByContactId } = value;

    if (!isNumber(version) || (version !== 1 && version !== PERSISTED_CHAT_STATE_VERSION)) return null;
    if (!Array.isArray(createdContacts) || !isRecord(contactOverridesByContactId)) return null;

    const parsedCreatedContacts = createdContacts
        .map(c => parsePersistedDmConversation(c))
        .filter((c): c is PersistedDmConversation => c !== null);

    const parsedCreatedGroups = Array.isArray(createdGroups)
        ? createdGroups.map(g => parsePersistedGroupConversation(g)).filter((g): g is PersistedGroupConversation => g !== null)
        : [];

    const parsedUnreadByConversationId: Record<string, number> = {};
    const unreadSource = version === 1 ? unreadByContactId : unreadByConversationId;
    if (isRecord(unreadSource)) {
        Object.entries(unreadSource).forEach(([key, v]) => {
            if (isNumber(v)) parsedUnreadByConversationId[key] = v;
        });
    }

    const parsedOverridesByContactId: Record<string, PersistedContactOverride> = {};
    Object.entries(contactOverridesByContactId).forEach(([key, v]) => {
        const parsed = parsePersistedContactOverride(v);
        if (parsed) parsedOverridesByContactId[key] = parsed;
    });

    const parsedMessagesByConversationId: Record<string, ReadonlyArray<PersistedMessage>> = {};
    const messagesSource = version === 1 ? messagesByContactId : messagesByConversationId;
    if (!isRecord(messagesSource)) return null;

    Object.entries(messagesSource).forEach(([conversationId, listValue]) => {
        if (!Array.isArray(listValue)) return;
        const parsedList = listValue
            .map(m => parsePersistedMessage(m))
            .filter((m): m is PersistedMessage => m !== null);
        parsedMessagesByConversationId[conversationId] = parsedList;
    });

    return {
        version: PERSISTED_CHAT_STATE_VERSION,
        createdContacts: parsedCreatedContacts,
        createdGroups: parsedCreatedGroups,
        unreadByConversationId: parsedUnreadByConversationId,
        contactOverridesByContactId: parsedOverridesByContactId,
        messagesByConversationId: parsedMessagesByConversationId,
    };
};

// Public persistence API
export const loadPersistedChatState = (): PersistedChatState | null => {
    try {
        const raw = localStorage.getItem(PERSISTED_CHAT_STATE_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsePersistedChatState(parsed);
    } catch {
        return null;
    }
};

export const savePersistedChatState = (state: PersistedChatState): void => {
    try {
        localStorage.setItem(PERSISTED_CHAT_STATE_STORAGE_KEY, JSON.stringify(state));
    } catch {
        return;
    }
};

export const toPersistedDmConversation = (contact: DmConversation): PersistedDmConversation => ({
    id: contact.id,
    displayName: contact.displayName,
    pubkey: String(contact.pubkey),
    lastMessage: contact.lastMessage,
    unreadCount: contact.unreadCount,
    lastMessageTimeMs: contact.lastMessageTime.getTime(),
});

export const fromPersistedDmConversation = (contact: PersistedDmConversation): DmConversation | null => {
    const parsed = parsePublicKeyInput(contact.pubkey);
    if (!parsed.ok) return null;
    return {
        kind: "dm",
        id: contact.id,
        displayName: contact.displayName,
        pubkey: parsed.publicKeyHex,
        lastMessage: contact.lastMessage,
        unreadCount: contact.unreadCount,
        lastMessageTime: new Date(contact.lastMessageTimeMs),
    };
};

export const toPersistedGroupConversation = (group: GroupConversation): PersistedGroupConversation => ({
    id: group.id,
    groupId: group.groupId,
    relayUrl: group.relayUrl,
    displayName: group.displayName,
    memberPubkeys: [...group.memberPubkeys],
    lastMessage: group.lastMessage,
    unreadCount: group.unreadCount,
    lastMessageTimeMs: group.lastMessageTime.getTime(),
});

export const fromPersistedGroupConversation = (group: PersistedGroupConversation): GroupConversation => ({
    kind: "group",
    id: group.id,
    groupId: group.groupId,
    relayUrl: group.relayUrl,
    displayName: group.displayName,
    memberPubkeys: [...group.memberPubkeys],
    lastMessage: group.lastMessage,
    unreadCount: group.unreadCount,
    lastMessageTime: new Date(group.lastMessageTimeMs),
});

export const toPersistedOverridesByContactId = (
    overrides: ContactOverridesByContactId
): Readonly<Record<string, PersistedContactOverride>> => {
    const result: Record<string, PersistedContactOverride> = {};
    Object.entries(overrides).forEach(([key, value]) => {
        result[key] = { lastMessage: value.lastMessage, lastMessageTimeMs: value.lastMessageTime.getTime() };
    });
    return result;
};

export const fromPersistedOverridesByContactId = (
    overrides: Readonly<Record<string, PersistedContactOverride>>
): ContactOverridesByContactId => {
    const result: Record<string, Readonly<{ lastMessage: string; lastMessageTime: Date }>> = {};
    Object.entries(overrides).forEach(([key, value]) => {
        result[key] = { lastMessage: value.lastMessage, lastMessageTime: new Date(value.lastMessageTimeMs) };
    });
    return result;
};

export const toPersistedMessagesByConversationId = (messagesByConversationId: MessagesByConversationId): Readonly<Record<string, ReadonlyArray<PersistedMessage>>> => {
    const result: Record<string, ReadonlyArray<PersistedMessage>> = {};
    Object.entries(messagesByConversationId).forEach(([conversationId, messages]) => {
        const sorted = [...messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const limited = sorted.slice(-MAX_PERSISTED_MESSAGES_PER_CONVERSATION);
        result[conversationId] = limited.map((m): PersistedMessage => ({
            id: m.id,
            ...(m.kind !== "user" ? { kind: m.kind } : {}),
            content: m.content,
            timestampMs: m.timestamp.getTime(),
            isOutgoing: m.isOutgoing,
            status: m.status,
            ...(m.attachments ? { attachments: m.attachments } : {}),
            ...(m.replyTo ? { replyTo: m.replyTo } : {}),
            ...(m.reactions ? { reactions: m.reactions } : {}),
            ...(m.deletedAt ? { deletedAtMs: m.deletedAt.getTime() } : {}),
        }));
    });
    return result;
};

export const fromPersistedMessagesByConversationId = (messagesByConversationId: Readonly<Record<string, ReadonlyArray<PersistedMessage>>>): MessagesByConversationId => {
    const result: Record<string, ReadonlyArray<Message>> = {};
    Object.entries(messagesByConversationId).forEach(([conversationId, messages]) => {
        const parsed = messages.map((m): Message => {
            // Handle legacy data where 'attachment' might exist instead of 'attachments'
            const legacyMessage = m as unknown as { attachment?: Attachment };
            const attachments = m.attachments && m.attachments.length > 0
                ? m.attachments
                : (legacyMessage.attachment ? [legacyMessage.attachment] : undefined);

            return {
                id: m.id,
                kind: m.kind ?? "user",
                content: m.content,
                timestamp: new Date(m.timestampMs),
                isOutgoing: m.isOutgoing,
                status: m.status,
                ...(attachments ? { attachments } : {}),
                ...(m.replyTo ? { replyTo: m.replyTo } : {}),
                ...(m.reactions ? { reactions: m.reactions } : {}),
                ...(m.deletedAtMs ? { deletedAt: new Date(m.deletedAtMs) } : {}),
            };
        });
        result[conversationId] = [...parsed]
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
            .slice(-MAX_PERSISTED_MESSAGES_PER_CONVERSATION);
    });
    return result;
};

// Last seen specific
const getLastSeenStorageKey = (pk: PublicKeyHex): string => `${LAST_SEEN_STORAGE_PREFIX}.${pk}`;

export const loadLastSeen = (pk: PublicKeyHex): LastSeenByConversationId => {
    try {
        const raw = localStorage.getItem(getLastSeenStorageKey(pk));
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed)) return {};
        const out: Record<string, number> = {};
        Object.entries(parsed).forEach(([conversationId, value]) => {
            if (typeof value === "number" && Number.isFinite(value) && value > 0) {
                out[conversationId] = value;
            }
        });
        return out;
    } catch {
        return {};
    }
};

export const saveLastSeen = (pk: PublicKeyHex, next: LastSeenByConversationId): void => {
    try {
        localStorage.setItem(getLastSeenStorageKey(pk), JSON.stringify(next));
    } catch {
        return;
    }
};

export const updateLastSeen = (params: Readonly<{ publicKeyHex: PublicKeyHex; conversationId: string; seenAtMs: number }>): void => {
    const existing = loadLastSeen(params.publicKeyHex);
    if ((existing[params.conversationId] ?? 0) >= params.seenAtMs) return;
    const next = { ...existing, [params.conversationId]: params.seenAtMs };
    saveLastSeen(params.publicKeyHex, next);
};
