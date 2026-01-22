import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export type ReactionEmoji = "👍" | "❤️" | "😂" | "🔥" | "👏";

export type DeleteCommandMessage = Readonly<{
    type: "delete";
    targetMessageId: string;
}>;

export type ReactionsByEmoji = Readonly<Record<ReactionEmoji, number>>;

export type MessageStatus = "delivered" | "sending" | "accepted" | "rejected";

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

export type MessagesByConversationId = Readonly<Record<string, ReadonlyArray<Message>>>;
export type UnreadByConversationId = Readonly<Record<string, number>>;
export type ContactOverridesByConversationId = Readonly<
    Record<string, Readonly<{ lastMessage: string; lastMessageTime: Date }>>
>;
