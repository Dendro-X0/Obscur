import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
export type { PublicKeyHex };
import type React from "react";
import type { GroupAccessMode } from "../../groups/types";

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
    id: string; // Internal UUID or similar
    communityId?: string; // Canonical logical identity for Community V2
    genesisEventId?: string;
    creatorPubkey?: string;
    groupId: string; // NIP-29 groupId
    relayUrl: string; // NIP-29 host relay
    displayName: string;
    memberPubkeys: ReadonlyArray<string>;
    lastMessage: string;
    unreadCount: number;
    lastMessageTime: Date;
    access: GroupAccessMode;
    memberCount: number;
    adminPubkeys: ReadonlyArray<string>;
    about?: string;
    avatar?: string;
}>;

export type Conversation = DmConversation | GroupConversation;

export type MessageStatus = "delivered" | "sending" | "accepted" | "rejected" | "queued" | "failed";

export type StatusIcon = (props: Readonly<{ className?: string }>) => React.JSX.Element;

export type StatusUi = Readonly<{
    label: string;
    icon: StatusIcon;
}>;

export type MessageKind = "user" | "command";

export type AttachmentKind = "image" | "video" | "audio" | "voice_note" | "file";

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

export type ReactionsByEmoji = Readonly<Partial<Record<ReactionEmoji, number>>>;

export type Message = Readonly<{
    id: string;
    kind: MessageKind;
    content: string;
    timestamp: Date;
    isOutgoing: boolean;
    status: MessageStatus;
    attachments?: ReadonlyArray<Attachment>;
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

export type SendDirectMessageParams = Readonly<{
    recipientPubkey: string;
    content: string;
    replyTo?: string;
}>;

export interface SendDirectMessageResult {
    success: boolean;
    messageId: string;
    relayResults: Array<{
        relayUrl: string;
        success: boolean;
        error?: string;
        latency?: number;
    }>;
    error?: string;
}

export type UnreadByConversationId = Readonly<Record<string, number>>;

export type ConnectionOverridesByConnectionId = Readonly<
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
    communityId?: string;
    genesisEventId?: string;
    creatorPubkey?: string;
    groupId: string;
    relayUrl: string;
    displayName: string;
    memberPubkeys: ReadonlyArray<string>;
    lastMessage: string;
    unreadCount: number;
    lastMessageTimeMs: number;
    access?: GroupAccessMode;
    memberCount?: number;
    adminPubkeys?: ReadonlyArray<string>;
    about?: string;
    avatar?: string;
}>;

export type PersistedMessage = Readonly<{
    id: string;
    kind?: MessageKind;
    pubkey?: string;
    content: string;
    timestampMs: number;
    isOutgoing: boolean;
    status: MessageStatus;
    attachments?: ReadonlyArray<Attachment>;
    replyTo?: ReplyTo;
    reactions?: ReactionsByEmoji;
    deletedAtMs?: number;
}>;

export type PersistedGroupMessage = Readonly<{
    id: string;
    pubkey: string;
    created_at: number;
    content: string;
}>;

export type DeleteCommandMessage = Readonly<{ type: "delete"; targetMessageId: string }>;

export type PersistedConnectionOverride = Readonly<{ lastMessage: string; lastMessageTimeMs: number }>;

export type ConnectionRequestStatusValue = "pending" | "accepted" | "declined" | "canceled";

export type RequestSendBlockReason =
    | "invalid_peer_key"
    | "identity_locked"
    | "self_request"
    | "peer_blocked"
    | "already_connected"
    | "pending_request_exists"
    | "already_accepted"
    | "cooldown_active";

export type JoinRequestBlockReason =
    | "identity_locked"
    | "already_member"
    | "pending_request_exists"
    | "denied_request"
    | "cooldown_active";

export type MessageActionFailureReason =
    | "no_active_relays"
    | "insufficient_writable_relays"
    | "quorum_not_met"
    | "publish_rejected"
    | "sync_failed"
    | "storage_unavailable"
    | "unknown";

export type IntegrityMigrationReport = Readonly<{
    timestampMs: number;
    backedUp: boolean;
    backupKey?: string;
    dedupedConnectionRequests: number;
    dedupedConnections: number;
    dedupedAcceptedPeers: number;
    dedupedMutedPeers: number;
    dedupedBlockedPeers: number;
    remappedConversationRefs: number;
    skipped: number;
    conflicts: number;
    restored: number;
}>;

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
    eventId?: string;
}>;

export type RequestsInboxItem = Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    lastMessagePreview: string;
    lastReceivedAtUnixSeconds: number;
    unreadCount: number;
    status?: ConnectionRequestStatusValue;
    isRequest?: boolean;
    isOutgoing?: boolean;
    eventId?: string;
}>;

export type PersistedChatState = Readonly<{
    version: number;
    createdConnections: ReadonlyArray<PersistedDmConversation>;
    createdGroups: ReadonlyArray<PersistedGroupConversation>;
    unreadByConversationId: Readonly<Record<string, number>>;
    connectionOverridesByConnectionId: Readonly<Record<string, PersistedConnectionOverride>>;
    messagesByConversationId: Readonly<Record<string, ReadonlyArray<PersistedMessage>>>;
    groupMessages?: Readonly<Record<string, ReadonlyArray<PersistedGroupMessage>>>;
    connectionRequests?: ReadonlyArray<PersistedConnectionRequest>;
    pinnedChatIds?: ReadonlyArray<string>;
    hiddenChatIds?: ReadonlyArray<string>;
}>;
// --- Upload Errors ---

export enum UploadErrorCode {
    AUTH_MISSING_KEY = "AUTH_MISSING_KEY",
    AUTH_ERROR = "AUTH_ERROR",
    NETWORK_ERROR = "NETWORK_ERROR",
    PROVIDER_ERROR = "PROVIDER_ERROR",
    FILE_TOO_LARGE = "FILE_TOO_LARGE",
    IO_ERROR = "IO_ERROR",
    MIME_ERROR = "MIME_ERROR",
    UNKNOWN = "UNKNOWN",
    NO_SESSION = "NO_SESSION"
}

export class UploadError extends Error {
    readonly code: UploadErrorCode;
    readonly context?: Record<string, unknown>;

    constructor(code: UploadErrorCode, message: string, context?: Record<string, unknown>) {
        super(message);
        this.code = code;
        this.context = context;
        this.name = "UploadError";
    }

    static fromNative(err: { code?: string; message?: string }): UploadError {
        const code = (err.code as UploadErrorCode) || UploadErrorCode.UNKNOWN;
        return new UploadError(
            code,
            err.message || `Native upload error: ${code}`,
            { nativeCode: err.code }
        );
    }
}
