import type { Message } from "../types";

import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { parseCommandMessage } from "../utils/commands";
import { toDmConversationId } from "../utils/dm-conversation-id";
import { extractAttachmentsFromContent } from "../utils/logic";
import { inferPeerFromConversationId } from "../utils/dm-conversation-sibling-ids";

export type NormalizeDmConversationMessageRowOptions = Readonly<{
    conversationId?: string;
    myPublicKeyHex?: string | null;
}>;

const shouldInferAttachmentsFromContent = (content: string): boolean => {
    const trimmed = content.trim();
    if (!trimmed) {
        return false;
    }

    // Community control payloads may include image URLs in metadata (picture),
    // but these are not chat attachments and should not render preview blocks.
    try {
        const parsed = JSON.parse(trimmed) as { type?: unknown };
        if (
            parsed?.type === "community-invite"
            || parsed?.type === "community-invite-response"
            || parsed?.type === "voice-call-invite"
            || parsed?.type === "voice-call-signal"
        ) {
            return false;
        }
    } catch {
        // Non-JSON user text can still infer attachments.
    }

    return (
        content.includes("https://")
        || content.includes("http://")
        || content.includes("/uploads/")
    );
};

/**
 * Normalizes persisted / bus / IndexedDB DM rows into a display `Message`.
 * Canonicalizes `conversationId` when `myPublicKeyHex` + peer can be inferred.
 */
export const normalizeDmConversationMessageRow = (
    value: any,
    options?: NormalizeDmConversationMessageRowOptions,
): Message => {
    const timestamp = value.timestamp instanceof Date ? value.timestamp : new Date(value.timestampMs ?? value.timestamp);
    const myPublicKeyHex = normalizePublicKeyHex(options?.myPublicKeyHex);
    const conversationId = typeof value.conversationId === "string"
        ? value.conversationId
        : options?.conversationId;
    const inferredPeer = (myPublicKeyHex && conversationId)
        ? inferPeerFromConversationId({ conversationId, myPublicKeyHex })
        : null;
    const canonicalConversationId = (myPublicKeyHex && inferredPeer)
        ? toDmConversationId({
            myPublicKeyHex,
            peerPublicKeyHex: inferredPeer,
        }) ?? conversationId
        : conversationId;

    let senderPubkey = normalizePublicKeyHex(
        typeof value.senderPubkey === "string" ? value.senderPubkey : undefined,
    ) ?? normalizePublicKeyHex(
        typeof value.pubkey === "string" ? value.pubkey : undefined,
    );
    if (!senderPubkey) {
        if (value.isOutgoing === true && myPublicKeyHex) {
            senderPubkey = myPublicKeyHex;
        } else if (value.isOutgoing === false && inferredPeer) {
            senderPubkey = inferredPeer;
        }
    }

    let recipientPubkey = normalizePublicKeyHex(
        typeof value.recipientPubkey === "string" ? value.recipientPubkey : undefined,
    );
    if (!recipientPubkey && myPublicKeyHex && inferredPeer) {
        recipientPubkey = value.isOutgoing === true ? inferredPeer : myPublicKeyHex;
    }

    const content = typeof value.content === "string" ? value.content : "";
    const parsedCommand = parseCommandMessage(content);
    const resolvedKind: Message["kind"] = (
        value.kind === "command"
        || parsedCommand !== null
    )
        ? "command"
        : "user";
    const storedAttachments = Array.isArray(value.attachments) && value.attachments.length > 0
        ? value.attachments
        : Array.isArray(value.attachment) && value.attachment.length > 0
            ? value.attachment
            : value.attachment
                ? [value.attachment]
                : [];
    const inferredAttachments = (
        storedAttachments.length === 0
        && content.length > 0
        && shouldInferAttachmentsFromContent(content)
    )
        ? extractAttachmentsFromContent(content)
        : [];
    const attachments = storedAttachments.length > 0
        ? storedAttachments
        : inferredAttachments.length > 0
            ? inferredAttachments
            : undefined;

    return {
        ...value,
        kind: resolvedKind,
        timestamp,
        ...(senderPubkey ? { senderPubkey } : {}),
        ...(recipientPubkey ? { recipientPubkey } : {}),
        ...(canonicalConversationId ? { conversationId: canonicalConversationId } : {}),
        ...(attachments ? { attachments } : {}),
    };
};
