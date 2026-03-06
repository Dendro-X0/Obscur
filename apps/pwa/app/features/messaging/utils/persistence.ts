import { parsePublicKeyInput } from "../../profile/utils/parse-public-key-input";
import type {
    PersistedChatState,
    PersistedDmConversation,
    PersistedGroupConversation,
    PersistedConnectionRequest,
    PersistedMessage,
    PersistedConnectionOverride,
    PersistedGroupMessage,
    DmConversation,
    GroupConversation,
    Message,
    MessageKind,
    Attachment,
    ReplyTo,
    ReactionEmoji,
    ReactionsByEmoji,
    ConnectionOverridesByConnectionId,
    MessagesByConversationId,
    LastSeenByConversationId
} from "../types";
import type { GroupAccessMode } from "../../groups/types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { deriveCommunityId } from "@/app/features/groups/utils/community-identity";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

const MAX_PERSISTED_MESSAGES_PER_CONVERSATION: number = 5000;
const PERSISTED_CHAT_STATE_VERSION: number = 2;
const LEGACY_PERSISTED_CHAT_STATE_STORAGE_KEY: string = "dweb.nostr.pwa.chatState";
const PERSISTED_CHAT_STATE_STORAGE_KEY_PREFIX: string = "dweb.nostr.pwa.chatState.v2";
const LAST_SEEN_STORAGE_PREFIX: string = "dweb.nostr.pwa.last-seen";

const getPersistedChatStateStorageKey = (publicKeyHex: string | null | undefined): string => {
    if (!publicKeyHex || publicKeyHex.trim().length === 0) {
        return getScopedStorageKey(LEGACY_PERSISTED_CHAT_STATE_STORAGE_KEY);
    }
    return getScopedStorageKey(`${PERSISTED_CHAT_STATE_STORAGE_KEY_PREFIX}.${publicKeyHex}`);
};

// Helper functions for type checking
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isMessageKind = (value: unknown): value is MessageKind => value === "user" || value === "command";

const isReactionEmoji = (value: unknown): value is ReactionEmoji =>
    value === "👍" || value === "❤️" || value === "😂" || value === "🔥" || value === "👏";

const isHashedCommunityId = (communityId: string | null | undefined): boolean => {
    const trimmed = communityId?.trim() ?? "";
    return /^v2_[0-9a-f]{64}$/i.test(trimmed);
};

type ParsedLegacyGroupConversationKey = Readonly<{
    groupId: string;
    relayUrl: string;
}>;

const normalizeGroupRelayUrl = (relayUrl: string | null | undefined): string => {
    if (!relayUrl) return "unknown";
    const trimmed = relayUrl.trim();
    return trimmed.length > 0 ? trimmed : "unknown";
};

const parseLegacyGroupConversationKey = (conversationId: string): ParsedLegacyGroupConversationKey | null => {
    const trimmed = conversationId.trim();
    if (trimmed.length === 0) return null;

    if (trimmed.startsWith("community:") || trimmed.startsWith("group:")) {
        const raw = trimmed.startsWith("community:")
            ? trimmed.slice("community:".length)
            : trimmed.slice("group:".length);
        const separatorIndex = raw.indexOf(":");
        if (separatorIndex <= 0) return null;
        const rawGroupId = raw.slice(0, separatorIndex).trim();
        const rawRelay = raw.slice(separatorIndex + 1).trim();
        if (rawGroupId.length === 0) return null;
        return { groupId: rawGroupId, relayUrl: normalizeGroupRelayUrl(rawRelay) };
    }

    if (trimmed.includes("@")) {
        const [rawGroupId, ...relayParts] = trimmed.split("@");
        const groupId = rawGroupId.trim();
        const relayHost = relayParts.join("@").trim();
        if (groupId.length === 0 || relayHost.length === 0) return null;
        const relayUrl = relayHost.startsWith("ws://") || relayHost.startsWith("wss://")
            ? relayHost
            : `wss://${relayHost}`;
        return { groupId, relayUrl: normalizeGroupRelayUrl(relayUrl) };
    }

    return null;
};

const uniqueStrings = (values: ReadonlyArray<string>): ReadonlyArray<string> => {
    const seen = new Set<string>();
    const result: string[] = [];
    values.forEach((value) => {
        const normalized = value.trim();
        if (normalized.length === 0 || seen.has(normalized)) return;
        seen.add(normalized);
        result.push(normalized);
    });
    return result;
};

const mergePersistedMessages = (
    left: ReadonlyArray<PersistedMessage>,
    right: ReadonlyArray<PersistedMessage>
): ReadonlyArray<PersistedMessage> => {
    const byId = new Map<string, PersistedMessage>();
    [...left, ...right].forEach((message) => {
        const existing = byId.get(message.id);
        if (!existing || message.timestampMs >= existing.timestampMs) {
            byId.set(message.id, message);
        }
    });
    return Array.from(byId.values())
        .sort((a, b) => a.timestampMs - b.timestampMs)
        .slice(-MAX_PERSISTED_MESSAGES_PER_CONVERSATION);
};

const mergePersistedGroupMessages = (
    left: ReadonlyArray<PersistedGroupMessage>,
    right: ReadonlyArray<PersistedGroupMessage>
): ReadonlyArray<PersistedGroupMessage> => {
    const byId = new Map<string, PersistedGroupMessage>();
    [...left, ...right].forEach((message) => {
        const existing = byId.get(message.id);
        if (!existing || message.created_at >= existing.created_at) {
            byId.set(message.id, message);
        }
    });
    return Array.from(byId.values()).sort((a, b) => a.created_at - b.created_at);
};

const normalizePersistedGroupConversations = (groups: ReadonlyArray<PersistedGroupConversation>): Readonly<{
    groups: ReadonlyArray<PersistedGroupConversation>;
    idMigration: ReadonlyMap<string, string>;
}> => {
    const idMigration = new Map<string, string>();
    const groupsByCanonicalKey = new Map<string, PersistedGroupConversation>();

    groups.forEach((group) => {
        const parsedFromId = parseLegacyGroupConversationKey(group.id);
        const groupId = (group.groupId || parsedFromId?.groupId || "").trim();
        if (!groupId) return;

        const relayUrl = normalizeGroupRelayUrl(group.relayUrl || parsedFromId?.relayUrl);
        const existingCommunityId = (group.communityId ?? "").trim() || undefined;
        const shouldPromoteLegacyIdentity =
            !isHashedCommunityId(existingCommunityId) &&
            typeof group.genesisEventId === "string" &&
            group.genesisEventId.trim().length > 0 &&
            typeof group.creatorPubkey === "string" &&
            group.creatorPubkey.trim().length > 0;
        const communityId = deriveCommunityId({
            existingCommunityId: shouldPromoteLegacyIdentity ? undefined : existingCommunityId,
            groupId,
            relayUrl,
            genesisEventId: group.genesisEventId,
            creatorPubkey: group.creatorPubkey
        });
        const canonicalId = toGroupConversationId({ groupId, relayUrl, communityId });
        idMigration.set(group.id, canonicalId);

        const normalized: PersistedGroupConversation = {
            ...group,
            id: canonicalId,
            communityId,
            groupId,
            relayUrl,
            displayName: group.displayName.trim() || "Private Group",
            memberPubkeys: uniqueStrings(group.memberPubkeys),
            adminPubkeys: uniqueStrings(group.adminPubkeys ?? []),
        };

        const dedupeKey = `${groupId}@@${relayUrl}`;
        const existing = groupsByCanonicalKey.get(dedupeKey);
        if (!existing) {
            groupsByCanonicalKey.set(dedupeKey, {
                ...normalized,
                memberCount: Math.max(
                    normalized.memberCount ?? 0,
                    normalized.memberPubkeys.length
                ),
            });
            return;
        }

        const mergedMemberPubkeys = uniqueStrings([
            ...existing.memberPubkeys,
            ...normalized.memberPubkeys
        ]);
        const mergedAdminPubkeys = uniqueStrings([
            ...(existing.adminPubkeys ?? []),
            ...(normalized.adminPubkeys ?? [])
        ]);
        const shouldUseNormalizedAsPrimary = normalized.lastMessageTimeMs >= existing.lastMessageTimeMs;
        const primary = shouldUseNormalizedAsPrimary ? normalized : existing;

        groupsByCanonicalKey.set(dedupeKey, {
            ...primary,
            id: canonicalId,
            groupId,
            relayUrl,
            memberPubkeys: mergedMemberPubkeys,
            adminPubkeys: mergedAdminPubkeys,
            memberCount: Math.max(
                existing.memberCount ?? 0,
                normalized.memberCount ?? 0,
                mergedMemberPubkeys.length
            ),
        });
    });

    return {
        groups: Array.from(groupsByCanonicalKey.values()),
        idMigration
    };
};

const remapConversationId = (
    conversationId: string,
    idMigration: ReadonlyMap<string, string>,
    canonicalIdByGroupRelay: ReadonlyMap<string, string>,
    canonicalIdByGroupId: ReadonlyMap<string, string>
): string => {
    const fromKnownMigration = idMigration.get(conversationId);
    if (fromKnownMigration) return fromKnownMigration;

    const parsedLegacy = parseLegacyGroupConversationKey(conversationId);
    if (!parsedLegacy) return conversationId;

    const relayScopedKey = `${parsedLegacy.groupId}@@${parsedLegacy.relayUrl}`;
    const relayScopedCanonical = canonicalIdByGroupRelay.get(relayScopedKey);
    if (relayScopedCanonical) return relayScopedCanonical;

    const groupIdCanonical = canonicalIdByGroupId.get(parsedLegacy.groupId);
    if (groupIdCanonical) return groupIdCanonical;

    return conversationId;
};

const remapNumberRecordByConversationId = (
    source: Readonly<Record<string, number>>,
    idMigration: ReadonlyMap<string, string>,
    canonicalIdByGroupRelay: ReadonlyMap<string, string>,
    canonicalIdByGroupId: ReadonlyMap<string, string>
): Readonly<Record<string, number>> => {
    const next: Record<string, number> = {};
    Object.entries(source).forEach(([conversationId, value]) => {
        const remappedId = remapConversationId(
            conversationId,
            idMigration,
            canonicalIdByGroupRelay,
            canonicalIdByGroupId
        );
        next[remappedId] = Math.max(next[remappedId] ?? 0, value);
    });
    return next;
};

const remapMessagesRecordByConversationId = (
    source: Readonly<Record<string, ReadonlyArray<PersistedMessage>>>,
    idMigration: ReadonlyMap<string, string>,
    canonicalIdByGroupRelay: ReadonlyMap<string, string>,
    canonicalIdByGroupId: ReadonlyMap<string, string>
): Readonly<Record<string, ReadonlyArray<PersistedMessage>>> => {
    const next: Record<string, ReadonlyArray<PersistedMessage>> = {};
    Object.entries(source).forEach(([conversationId, list]) => {
        const remappedId = remapConversationId(
            conversationId,
            idMigration,
            canonicalIdByGroupRelay,
            canonicalIdByGroupId
        );
        const existing = next[remappedId] ?? [];
        next[remappedId] = mergePersistedMessages(existing, list);
    });
    return next;
};

const remapGroupMessagesRecordByConversationId = (
    source: Readonly<Record<string, ReadonlyArray<PersistedGroupMessage>>> | undefined,
    idMigration: ReadonlyMap<string, string>,
    canonicalIdByGroupRelay: ReadonlyMap<string, string>,
    canonicalIdByGroupId: ReadonlyMap<string, string>
): Readonly<Record<string, ReadonlyArray<PersistedGroupMessage>>> | undefined => {
    if (!source) return undefined;
    const next: Record<string, ReadonlyArray<PersistedGroupMessage>> = {};
    Object.entries(source).forEach(([conversationId, list]) => {
        const remappedId = remapConversationId(
            conversationId,
            idMigration,
            canonicalIdByGroupRelay,
            canonicalIdByGroupId
        );
        const existing = next[remappedId] ?? [];
        next[remappedId] = mergePersistedGroupMessages(existing, list);
    });
    return next;
};

const remapConversationIdList = (
    source: ReadonlyArray<string> | undefined,
    idMigration: ReadonlyMap<string, string>,
    canonicalIdByGroupRelay: ReadonlyMap<string, string>,
    canonicalIdByGroupId: ReadonlyMap<string, string>
): ReadonlyArray<string> | undefined => {
    if (!source) return undefined;
    const seen = new Set<string>();
    const result: string[] = [];
    source.forEach((conversationId) => {
        const remappedId = remapConversationId(
            conversationId,
            idMigration,
            canonicalIdByGroupRelay,
            canonicalIdByGroupId
        );
        if (seen.has(remappedId)) return;
        seen.add(remappedId);
        result.push(remappedId);
    });
    return result;
};

export const normalizePersistedGroupState = (state: PersistedChatState): PersistedChatState => {
    const normalizedGroups = normalizePersistedGroupConversations(state.createdGroups);
    const canonicalIdByGroupRelay = new Map<string, string>();
    const canonicalIdByGroupId = new Map<string, string>();
    const groupIdCounts = new Map<string, number>();

    normalizedGroups.groups.forEach((group) => {
        canonicalIdByGroupRelay.set(`${group.groupId}@@${group.relayUrl}`, group.id);
        groupIdCounts.set(group.groupId, (groupIdCounts.get(group.groupId) ?? 0) + 1);
    });
    normalizedGroups.groups.forEach((group) => {
        if ((groupIdCounts.get(group.groupId) ?? 0) === 1) {
            canonicalIdByGroupId.set(group.groupId, group.id);
        }
    });

    return {
        ...state,
        createdGroups: normalizedGroups.groups,
        unreadByConversationId: remapNumberRecordByConversationId(
            state.unreadByConversationId,
            normalizedGroups.idMigration,
            canonicalIdByGroupRelay,
            canonicalIdByGroupId
        ),
        messagesByConversationId: remapMessagesRecordByConversationId(
            state.messagesByConversationId,
            normalizedGroups.idMigration,
            canonicalIdByGroupRelay,
            canonicalIdByGroupId
        ),
        groupMessages: remapGroupMessagesRecordByConversationId(
            state.groupMessages,
            normalizedGroups.idMigration,
            canonicalIdByGroupRelay,
            canonicalIdByGroupId
        ),
        pinnedChatIds: remapConversationIdList(
            state.pinnedChatIds,
            normalizedGroups.idMigration,
            canonicalIdByGroupRelay,
            canonicalIdByGroupId
        ),
        hiddenChatIds: remapConversationIdList(
            state.hiddenChatIds,
            normalizedGroups.idMigration,
            canonicalIdByGroupRelay,
            canonicalIdByGroupId
        )
    };
};

// Parsing functions
const parseAttachment = (value: unknown): Attachment | null => {
    if (!isRecord(value)) return null;
    const kind: unknown = value.kind;
    const url: unknown = value.url;
    const contentType: unknown = value.contentType;
    const fileName: unknown = value.fileName;
    if (kind !== "image" && kind !== "video" && kind !== "audio" && kind !== "file") return null;
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

    // Migration and parsing for new fields
    const access: GroupAccessMode =
        (value.access === "private" || value.access === "invite-only") ? "invite-only" :
            (value.access === "discoverable") ? "discoverable" : "open";
    const memberCount: number = isNumber(value.memberCount) ? value.memberCount : parsedMemberPubkeys.length;
    const adminPubkeysRaw: unknown = value.adminPubkeys;
    const adminPubkeys: string[] = Array.isArray(adminPubkeysRaw)
        ? adminPubkeysRaw.filter((v): v is string => isString(v) && v.trim().length > 0)
        : [];
    const about: string | undefined = isString(value.about) ? value.about : undefined;
    const avatar: string | undefined = isString(value.avatar) ? value.avatar : undefined;
    const communityId: string | undefined = isString(value.communityId) && value.communityId.trim().length > 0
        ? value.communityId.trim()
        : undefined;
    const genesisEventId: string | undefined = isString(value.genesisEventId) && value.genesisEventId.trim().length > 0
        ? value.genesisEventId.trim()
        : undefined;
    const creatorPubkey: string | undefined = isString(value.creatorPubkey) && value.creatorPubkey.trim().length > 0
        ? value.creatorPubkey.trim()
        : undefined;

    return {
        id,
        communityId,
        genesisEventId,
        creatorPubkey,
        groupId,
        relayUrl,
        displayName,
        memberPubkeys: parsedMemberPubkeys,
        lastMessage,
        unreadCount,
        lastMessageTimeMs,
        access,
        memberCount,
        adminPubkeys,
        about,
        avatar
    };
};

const parsePersistedConnectionRequest = (value: unknown): PersistedConnectionRequest | null => {
    if (!isRecord(value)) return null;
    const { id, status, isOutgoing, introMessage, timestampMs } = value;
    if (!isString(id) || id.trim().length === 0) return null;
    if (!isString(status)) return null;
    if (!isBoolean(isOutgoing)) return null;
    if (!isNumber(timestampMs)) return null;
    if (introMessage !== undefined && !isString(introMessage)) return null;
    if (status !== "pending" && status !== "accepted" && status !== "declined" && status !== "canceled") {
        return null;
    }
    return {
        id,
        status,
        isOutgoing,
        introMessage: introMessage as string | undefined,
        timestampMs
    };
};

const parsePersistedConnectionOverride = (value: unknown): PersistedConnectionOverride | null => {
    if (!isRecord(value)) return null;
    const { lastMessage, lastMessageTimeMs } = value;
    if (!isString(lastMessage) || !isNumber(lastMessageTimeMs)) return null;
    return { lastMessage, lastMessageTimeMs };
};
const parsePersistedMessage = (value: unknown): PersistedMessage | null => {
    if (!isRecord(value)) return null;
    const { id, kind, content, timestampMs, isOutgoing, status, attachment, replyTo, reactions, deletedAtMs, pubkey } = value;

    if (!isString(id) || !isString(content) || !isNumber(timestampMs) || !isBoolean(isOutgoing)) return null;
    if (kind !== undefined && !isMessageKind(kind)) return null;
    if (
        status !== "delivered" &&
        status !== "sending" &&
        status !== "accepted" &&
        status !== "rejected" &&
        status !== "queued" &&
        status !== "failed"
    ) return null;

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
        pubkey: isString(pubkey) ? pubkey : undefined,
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

const parsePersistedGroupMessage = (value: unknown): PersistedGroupMessage | null => {
    if (!isRecord(value)) return null;
    const { id, pubkey, created_at, content } = value;
    if (!isString(id) || !isString(pubkey) || !isNumber(created_at) || !isString(content)) return null;
    return { id, pubkey, created_at, content };
};

const parsePersistedChatState = (value: unknown): PersistedChatState | null => {
    if (!isRecord(value)) return null;
    const { version, createdConnections, createdContacts, createdGroups, unreadByConversationId, unreadByContactId, connectionOverridesByConnectionId, contactOverridesByContactId, messagesByConversationId, messagesByContactId, connectionRequests, pinnedChatIds, hiddenChatIds, groupMessages } = value;

    if (!isNumber(version) || (version !== 1 && version !== PERSISTED_CHAT_STATE_VERSION)) return null;

    const connectionsSource = (Array.isArray(createdConnections) ? createdConnections : (Array.isArray(createdContacts) ? createdContacts : []));
    const parsedCreatedConnections = connectionsSource
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

    const parsedOverridesByConnectionId: Record<string, PersistedConnectionOverride> = {};
    const overridesSource = isRecord(connectionOverridesByConnectionId) ? connectionOverridesByConnectionId : (isRecord(contactOverridesByContactId) ? contactOverridesByContactId : {});
    Object.entries(overridesSource).forEach(([key, v]) => {
        const parsed = parsePersistedConnectionOverride(v);
        if (parsed) parsedOverridesByConnectionId[key] = parsed;
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

    const parsedGroupMessages: Record<string, ReadonlyArray<PersistedGroupMessage>> = {};
    if (isRecord(groupMessages)) {
        Object.entries(groupMessages).forEach(([conversationId, listValue]) => {
            if (!Array.isArray(listValue)) return;
            const parsedList = listValue
                .map(m => parsePersistedGroupMessage(m))
                .filter((m): m is PersistedGroupMessage => m !== null);
            parsedGroupMessages[conversationId] = parsedList;
        });
    }

    const parsedConnectionRequests: ReadonlyArray<PersistedConnectionRequest> | undefined = Array.isArray(connectionRequests)
        ? connectionRequests
            .map((cr: unknown) => parsePersistedConnectionRequest(cr))
            .filter((cr: PersistedConnectionRequest | null): cr is PersistedConnectionRequest => cr !== null)
        : undefined;

    const parsedPinnedChatIds: ReadonlyArray<string> | undefined = Array.isArray(pinnedChatIds)
        ? pinnedChatIds.filter(isString)
        : undefined;

    const parsedHiddenChatIds: ReadonlyArray<string> | undefined = Array.isArray(hiddenChatIds)
        ? hiddenChatIds.filter(isString)
        : undefined;

    const parsedState: PersistedChatState = {
        version: PERSISTED_CHAT_STATE_VERSION,
        createdConnections: parsedCreatedConnections,
        createdGroups: parsedCreatedGroups,
        unreadByConversationId: parsedUnreadByConversationId,
        connectionOverridesByConnectionId: parsedOverridesByConnectionId,
        messagesByConversationId: parsedMessagesByConversationId,
        groupMessages: parsedGroupMessages,
        ...(parsedConnectionRequests ? { connectionRequests: parsedConnectionRequests } : {}),
        pinnedChatIds: parsedPinnedChatIds,
        hiddenChatIds: parsedHiddenChatIds
    };
    return normalizePersistedGroupState(parsedState);
};

// Public persistence API
export const loadPersistedChatState = (publicKeyHex?: string | null): PersistedChatState | null => {
    try {
        const primaryKey = getPersistedChatStateStorageKey(publicKeyHex);
        const rawPrimary = localStorage.getItem(primaryKey);
        if (rawPrimary) {
            const parsed = JSON.parse(rawPrimary);
            const next = parsePersistedChatState(parsed);
            if (next) {
                return next;
            }
        }

        if (publicKeyHex && publicKeyHex.trim().length > 0) {
            const rawLegacy = localStorage.getItem(LEGACY_PERSISTED_CHAT_STATE_STORAGE_KEY);
            if (!rawLegacy) return null;
            const parsedLegacy = JSON.parse(rawLegacy);
            const nextLegacy = parsePersistedChatState(parsedLegacy);
            if (!nextLegacy) return null;
            try {
                localStorage.setItem(primaryKey, JSON.stringify(nextLegacy));
            } catch {
                return nextLegacy;
            }
            return nextLegacy;
        }

        return null;
    } catch {
        return null;
    }
};

export const savePersistedChatState = (state: PersistedChatState, publicKeyHex?: string | null): void => {
    try {
        const key = getPersistedChatStateStorageKey(publicKeyHex);
        localStorage.setItem(key, JSON.stringify(state));
    } catch {
        return;
    }
};

export const toPersistedDmConversation = (connection: DmConversation): PersistedDmConversation => ({
    id: connection.id,
    displayName: connection.displayName,
    pubkey: String(connection.pubkey),
    lastMessage: connection.lastMessage,
    unreadCount: connection.unreadCount,
    lastMessageTimeMs: connection.lastMessageTime.getTime(),
});

export const fromPersistedDmConversation = (connection: PersistedDmConversation): DmConversation | null => {
    const parsed = parsePublicKeyInput(connection.pubkey);
    if (!parsed.ok) return null;
    return {
        kind: "dm",
        id: connection.id,
        displayName: connection.displayName,
        pubkey: parsed.publicKeyHex,
        lastMessage: connection.lastMessage,
        unreadCount: connection.unreadCount,
        lastMessageTime: new Date(connection.lastMessageTimeMs),
    };
};

export const toPersistedGroupConversation = (group: GroupConversation): PersistedGroupConversation => ({
    id: group.id,
    communityId: group.communityId,
    genesisEventId: group.genesisEventId,
    creatorPubkey: group.creatorPubkey,
    groupId: group.groupId,
    relayUrl: group.relayUrl,
    displayName: group.displayName,
    memberPubkeys: [...(group.memberPubkeys || [])],
    lastMessage: group.lastMessage,
    unreadCount: group.unreadCount,
    lastMessageTimeMs: group.lastMessageTime.getTime(),
    access: group.access,
    memberCount: group.memberCount,
    adminPubkeys: [...(group.adminPubkeys || [])],
    avatar: group.avatar,
    about: group.about,
});

export const fromPersistedGroupConversation = (group: PersistedGroupConversation): GroupConversation => ({
    kind: "group",
    id: group.id,
    communityId: group.communityId,
    genesisEventId: group.genesisEventId,
    creatorPubkey: group.creatorPubkey,
    groupId: group.groupId,
    relayUrl: group.relayUrl,
    displayName: group.displayName,
    memberPubkeys: [...group.memberPubkeys],
    lastMessage: group.lastMessage,
    unreadCount: group.unreadCount,
    lastMessageTime: new Date(group.lastMessageTimeMs),
    access: group.access || "open",
    memberCount: group.memberCount || 0,
    adminPubkeys: group.adminPubkeys || [],
    avatar: group.avatar,
    about: group.about,
});

export const toPersistedOverridesByConnectionId = (
    overrides: ConnectionOverridesByConnectionId
): Readonly<Record<string, PersistedConnectionOverride>> => {
    const result: Record<string, PersistedConnectionOverride> = {};
    Object.entries(overrides).forEach(([key, value]) => {
        result[key] = { lastMessage: value.lastMessage, lastMessageTimeMs: value.lastMessageTime.getTime() };
    });
    return result;
};

export const fromPersistedOverridesByConnectionId = (
    overrides: Readonly<Record<string, PersistedConnectionOverride>>
): ConnectionOverridesByConnectionId => {
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
            pubkey: m.senderPubkey,
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
                senderPubkey: m.pubkey as PublicKeyHex,
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
const getLastSeenStorageKey = (pk: PublicKeyHex): string =>
    getScopedStorageKey(`${LAST_SEEN_STORAGE_PREFIX}.${pk}`);

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
