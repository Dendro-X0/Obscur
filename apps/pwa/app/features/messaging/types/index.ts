
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type React from "react";

export type RelayStatusSummary = Readonly<{
    total: number;
    openCount: number;
    errorCount: number;
}>;

export type DmConversation = Readonly<{
    kind: "dm";
    id: string;
    displayName: string;
    pubkey: PublicKeyHex;
    lastMessage: string;
    unreadCount: number;
    lastMessageTime: Date;
}>;

export type GroupConversation = Readonly<{
    kind: "group";
    id: string;
    displayName: string;
    memberPubkeys: ReadonlyArray<string>;
    lastMessage: string;
    unreadCount: number;
    lastMessageTime: Date;
}>;

export type Conversation = DmConversation | GroupConversation;

export type MessageStatus = "delivered" | "sending" | "accepted" | "rejected" | "queued" | "failed";

export type StatusIcon = (props: Readonly<{ className?: string }>) => React.JSX.Element;

export type StatusUi = Readonly<{
    label: string;
    icon: StatusIcon;
}>;

export type MessageKind = "user" | "command";

export type AttachmentKind = "image" | "video";

export type Attachment = Readonly<{
    kind: AttachmentKind;
    url: string;
    contentType: string;
    fileName: string;
}>;

export type ReplyTo = Readonly<{
    messageId: string;
    previewText: string;
}>;

export type MediaItem = Readonly<{
    messageId: string;
    attachment: Attachment;
    timestamp: Date;
}>;

export type LastSeenByConversationId = Readonly<Record<string, number>>;

export type ReactionEmoji = "👍" | "❤️" | "😂" | "🔥" | "👏";

export type ReactionsByEmoji = Readonly<Record<ReactionEmoji, number>>;

export type Message = Readonly<{
    id: string;
    kind: MessageKind;
    content: string;
    timestamp: Date;
    isOutgoing: boolean;
    status: MessageStatus;
    attachment?: Attachment;
    replyTo?: ReplyTo;
    reactions?: ReactionsByEmoji;
    deletedAt?: Date;
    eventId?: string;
    eventCreatedAt?: Date;
    senderPubkey?: PublicKeyHex;
    recipientPubkey?: PublicKeyHex;
    encryptedContent?: string;
    relayResults?: ReadonlyArray<{
        relayUrl: string;
        success: boolean;
        error?: string;
        latency?: number;
    }>;
    retryCount?: number;
    conversationId?: string;
}>;

export type UnreadByConversationId = Readonly<Record<string, number>>;

export type ContactOverridesByContactId = Readonly<
    Record<string, Readonly<{ lastMessage: string; lastMessageTime: Date }>>
>;

export type MessagesByConversationId = Readonly<Record<string, ReadonlyArray<Message>>>;

export type UploadApiResponse = Readonly<
    | {
        ok: true;
        url: string;
        contentType: string;
    }
    | {
        ok: false;
        error: string;
    }
>;

export type PersistedDmConversation = Readonly<{
    id: string;
    displayName: string;
    pubkey: string;
    lastMessage: string;
    unreadCount: number;
    lastMessageTimeMs: number;
}>;

export type PersistedGroupConversation = Readonly<{
    id: string;
    displayName: string;
    memberPubkeys: ReadonlyArray<string>;
    lastMessage: string;
    unreadCount: number;
    lastMessageTimeMs: number;
}>;

export type PersistedMessage = Readonly<{
    id: string;
    kind?: MessageKind;
    content: string;
    timestampMs: number;
    isOutgoing: boolean;
    status: MessageStatus;
    attachment?: Attachment;
    replyTo?: ReplyTo;
    reactions?: ReactionsByEmoji;
    deletedAtMs?: number;
}>;

export type DeleteCommandMessage = Readonly<{ type: "delete"; targetMessageId: string }>;

export type PersistedContactOverride = Readonly<{ lastMessage: string; lastMessageTimeMs: number }>;

export type ConnectionRequestStatusValue = "pending" | "accepted" | "declined" | "canceled";

export type ConnectionRequest = Readonly<{
    id: string; // Peer pubkey
    status: ConnectionRequestStatusValue;
    isOutgoing: boolean;
    introMessage?: string;
    timestamp: Date;
}>;

export type PersistedConnectionRequest = Readonly<{
    id: string;
    status: ConnectionRequestStatusValue;
    isOutgoing: boolean;
    introMessage?: string;
    timestampMs: number;
}>;

export type PersistedChatState = Readonly<{
    version: number;
    createdContacts: ReadonlyArray<PersistedDmConversation>;
    createdGroups: ReadonlyArray<PersistedGroupConversation>;
    unreadByConversationId: Readonly<Record<string, number>>;
    contactOverridesByContactId: Readonly<Record<string, PersistedContactOverride>>;
    messagesByConversationId: Readonly<Record<string, ReadonlyArray<PersistedMessage>>>;
    connectionRequests?: ReadonlyArray<PersistedConnectionRequest>;
}>;
