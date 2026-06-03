import type { DmConversation, PersistedChatState, PersistedMessage } from "@/app/features/messaging/types";
import { createDmConversation } from "./create-dm-conversation";
import { fromPersistedDmConversation } from "./persistence";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const DEFAULT_DM_DISPLAY_NAME = "Unknown contact";

const peerKey = (connection: DmConversation): string => (
    connection.pubkey.trim().toLowerCase()
);

const mergeConversationEntry = (
    existing: DmConversation | undefined,
    incoming: DmConversation,
): DmConversation => {
    if (!existing) {
        return incoming;
    }
    const incomingIsNewer = incoming.lastMessageTime.getTime() >= existing.lastMessageTime.getTime();
    const newer = incomingIsNewer ? incoming : existing;
    const older = incomingIsNewer ? existing : incoming;
    const displayName = (
        newer.displayName.trim().length > 0
        && newer.displayName !== DEFAULT_DM_DISPLAY_NAME
    )
        ? newer.displayName
        : older.displayName;
    return {
        ...newer,
        id: newer.id || older.id,
        pubkey: newer.pubkey || older.pubkey,
        displayName,
        lastMessage: incomingIsNewer
            ? newer.lastMessage
            : (newer.lastMessage || older.lastMessage),
        lastMessageIsOutgoing: incomingIsNewer
            ? newer.lastMessageIsOutgoing
            : (newer.lastMessageIsOutgoing ?? older.lastMessageIsOutgoing),
        unreadCount: Math.max(newer.unreadCount, older.unreadCount),
        lastMessageTime: newer.lastMessageTime,
    };
};

/** Union DM sidebar rows by peer pubkey; prefer the entry with the newer preview. */
export const mergeDmConversationLists = (
    primary: ReadonlyArray<DmConversation>,
    secondary: ReadonlyArray<DmConversation>,
): ReadonlyArray<DmConversation> => {
    const byPeer = new Map<string, DmConversation>();
    [...primary, ...secondary].forEach((connection) => {
        const key = peerKey(connection);
        byPeer.set(key, mergeConversationEntry(byPeer.get(key), connection));
    });
    return Array.from(byPeer.values()).sort(
        (left, right) => right.lastMessageTime.getTime() - left.lastMessageTime.getTime(),
    );
};

export const derivePeerPubkeyFromDmConversationId = (
    conversationId: string,
    myPublicKeyHex: string,
): PublicKeyHex | null => {
    const parts = conversationId.split(":");
    if (parts.length !== 2) {
        return null;
    }
    const my = normalizePublicKeyHex(myPublicKeyHex);
    const left = normalizePublicKeyHex(parts[0] ?? "");
    const right = normalizePublicKeyHex(parts[1] ?? "");
    if (!my || !left || !right) {
        return null;
    }
    if (left === my) {
        return right as PublicKeyHex;
    }
    if (right === my) {
        return left as PublicKeyHex;
    }
    return null;
};

/** Revision token for persisted DM message history — bumps when sidebar previews may change. */
export const computePersistedMessageHistoryRevision = (
    persisted: PersistedChatState | null | undefined,
): string => {
    if (!persisted) {
        return "empty";
    }
    let messageCount = 0;
    let maxTimestampMs = 0;
    Object.values(persisted.messagesByConversationId ?? {}).forEach((messages) => {
        messages?.forEach((message) => {
            messageCount += 1;
            maxTimestampMs = Math.max(maxTimestampMs, message.timestampMs ?? 0);
        });
    });
    return `${messageCount}:${maxTimestampMs}`;
};

export const upsertDmConversationInList = (
    connections: ReadonlyArray<DmConversation>,
    conversation: DmConversation,
): ReadonlyArray<DmConversation> => (
    mergeDmConversationLists(connections, [conversation])
);

const isDmConversationStorageId = (conversationId: string): boolean => (
    conversationId.length > 0
    && !conversationId.startsWith("community:")
    && !conversationId.startsWith("group:")
    && !conversationId.includes("@")
);

const readMessagePreview = (message: PersistedMessage): string => (
    typeof message.content === "string" ? message.content : ""
);

/** Rebuild DM sidebar rows from persisted connections plus any thread with stored messages. */
export const buildDmConnectionsFromPersistedChatState = (
    persisted: PersistedChatState | null | undefined,
    myPublicKeyHex: string,
): ReadonlyArray<DmConversation> => {
    if (!persisted || !myPublicKeyHex.trim()) {
        return [];
    }
    let connections: DmConversation[] = persisted.createdConnections
        .map((entry) => fromPersistedDmConversation(entry))
        .filter((entry): entry is DmConversation => entry !== null);
    Object.entries(persisted.messagesByConversationId ?? {}).forEach(([conversationId, messages]) => {
        if (!isDmConversationStorageId(conversationId) || !messages || messages.length === 0) {
            return;
        }
        const lastMessage = messages[messages.length - 1];
        if (!lastMessage) {
            return;
        }
        connections = [...touchDmConversationFromMessage({
            connections,
            conversationId,
            myPublicKeyHex,
            messagePreview: readMessagePreview(lastMessage),
            messageTime: new Date(lastMessage.timestampMs),
            lastMessageIsOutgoing: lastMessage.isOutgoing,
        })];
    });
    return connections;
};

export const persistedDmSidebarHasThreadsBeyondProjection = (
    persistedConnections: ReadonlyArray<DmConversation>,
    projectionConnections: ReadonlyArray<DmConversation>,
): boolean => {
    if (persistedConnections.length > projectionConnections.length) {
        return true;
    }
    const projectionPeers = new Set(projectionConnections.map((entry) => peerKey(entry)));
    return persistedConnections.some((entry) => !projectionPeers.has(peerKey(entry)));
};

export const touchDmConversationFromMessage = (params: Readonly<{
    connections: ReadonlyArray<DmConversation>;
    conversationId: string;
    myPublicKeyHex: string;
    messagePreview: string;
    messageTime: Date;
    displayName?: string;
    lastMessageIsOutgoing?: boolean;
}>): ReadonlyArray<DmConversation> => {
    const peerPublicKeyHex = derivePeerPubkeyFromDmConversationId(
        params.conversationId,
        params.myPublicKeyHex,
    );
    if (!peerPublicKeyHex) {
        return params.connections;
    }
    const existing = params.connections.find((entry) => peerKey(entry) === peerPublicKeyHex);
    const base = existing ?? createDmConversation({
        myPublicKeyHex: params.myPublicKeyHex,
        peerPublicKeyHex,
        displayName: params.displayName,
    });
    if (!base) {
        return params.connections;
    }
    const touched: DmConversation = {
        ...base,
        lastMessage: params.messagePreview,
        lastMessageTime: params.messageTime,
        lastMessageIsOutgoing: params.lastMessageIsOutgoing,
    };
    return upsertDmConversationInList(params.connections, touched);
};
