import type { Attachment, Message } from "../types";

import { normalizeAttachmentUrl } from "@/app/shared/public-url";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { resolveDmBubbleIsOutgoing } from "@/app/features/groups/services/community-invite-role-authority";
import {
    parseCommunityInviteWirePayload,
    parseMessageContentJson,
} from "@/app/features/groups/services/community-dm-invite-contract";
import { logAppEvent } from "@/app/shared/log-app-event";
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
        || /\]\([^)]+\)/.test(content)
        || /(?:^|\s)(?:[a-z0-9.-]+\.)+(?:nostr\.build|void\.cat|blossom\.|sovbit\.)/i.test(content)
    );
};

const readInviteCreatorPubkey = (content: string): ReturnType<typeof normalizePublicKeyHex> => {
    const invite = parseCommunityInviteWirePayload(parseMessageContentJson(content));
    return invite?.creatorPubkey ? normalizePublicKeyHex(invite.creatorPubkey) : null;
};

const isCommunityInviteControlPayload = (content: string): boolean => {
    try {
        const parsed = JSON.parse(content.trim()) as { type?: unknown };
        return parsed?.type === "community-invite" || parsed?.type === "community-invite-response";
    } catch {
        return false;
    }
};

const logNormalizeIsOutgoingMismatch = (params: Readonly<{
    messageId: string;
    storedIsOutgoing: boolean;
    resolvedIsOutgoing: boolean;
    senderPubkey?: string;
}>): void => {
    logAppEvent({
        name: "messaging.dm_normalize_is_outgoing_mismatch",
        level: "warn",
        scope: { feature: "messaging", action: "dm_normalize" },
        context: {
            messageIdHint: params.messageId.slice(0, 24),
            storedIsOutgoing: params.storedIsOutgoing,
            resolvedIsOutgoing: params.resolvedIsOutgoing,
            senderPubkeyHint: params.senderPubkey?.slice(0, 8) ?? null,
        },
    });
};

const logNormalizeInviteMissingWireParties = (params: Readonly<{
    messageId: string;
    conversationId?: string;
}>): void => {
    logAppEvent({
        name: "messaging.dm_normalize_invite_missing_wire_parties",
        level: "warn",
        scope: { feature: "messaging", action: "dm_normalize" },
        context: {
            messageIdHint: params.messageId.slice(0, 24),
            conversationIdHint: params.conversationId?.slice(0, 24) ?? null,
        },
    });
};

/**
 * Normalizes persisted / bus / IndexedDB DM rows into a display `Message`.
 * Canonicalizes `conversationId` when `myPublicKeyHex` + peer can be inferred.
 * IRA-2: recomputes `isOutgoing` from wire sender when viewer key is known.
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
    const content = typeof value.content === "string" ? value.content : "";
    if (!senderPubkey && content.length > 0) {
        senderPubkey = readInviteCreatorPubkey(content);
    }
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
    if (!recipientPubkey && myPublicKeyHex && senderPubkey) {
        recipientPubkey = senderPubkey === myPublicKeyHex
            ? inferredPeer
            : myPublicKeyHex;
    } else if (!recipientPubkey && myPublicKeyHex && inferredPeer) {
        recipientPubkey = value.isOutgoing === true ? inferredPeer : myPublicKeyHex;
    }
    if (
        isCommunityInviteControlPayload(content)
        && !senderPubkey
        && !recipientPubkey
    ) {
        const messageId = typeof value.id === "string" ? value.id : typeof value.eventId === "string" ? value.eventId : "";
        if (messageId) {
            logNormalizeInviteMissingWireParties({
                messageId,
                conversationId: canonicalConversationId,
            });
        }
    }

    const storedIsOutgoing = value.isOutgoing === true;
    let resolvedIsOutgoing = storedIsOutgoing;
    if (myPublicKeyHex && senderPubkey) {
        resolvedIsOutgoing = resolveDmBubbleIsOutgoing(myPublicKeyHex, { senderPubkey });
        if (typeof value.isOutgoing === "boolean" && storedIsOutgoing !== resolvedIsOutgoing) {
            const messageId = typeof value.id === "string" ? value.id : typeof value.eventId === "string" ? value.eventId : "";
            if (messageId) {
                logNormalizeIsOutgoingMismatch({
                    messageId,
                    storedIsOutgoing,
                    resolvedIsOutgoing,
                    senderPubkey,
                });
            }
        }
    }

    const parsedCommand = parseCommandMessage(content);
    const resolvedKind: Message["kind"] = (
        value.kind === "command"
        || parsedCommand !== null
    )
        ? "command"
        : "user";
    const storedAttachments: ReadonlyArray<Attachment> = Array.isArray(value.attachments) && value.attachments.length > 0
        ? (value.attachments as ReadonlyArray<Attachment>)
        : Array.isArray(value.attachment) && value.attachment.length > 0
            ? (value.attachment as ReadonlyArray<Attachment>)
            : value.attachment
                ? [value.attachment as Attachment]
                : [];
    const inferredAttachments = (
        storedAttachments.length === 0
        && content.length > 0
        && shouldInferAttachmentsFromContent(content)
    )
        ? extractAttachmentsFromContent(content)
        : [];
    const normalizedStoredAttachments = storedAttachments
        .map((attachment: Attachment) => ({
            ...attachment,
            url: normalizeAttachmentUrl(attachment.url),
        }))
        .filter((attachment: Attachment) => attachment.url.length > 0);
    const attachments = normalizedStoredAttachments.length > 0
        ? normalizedStoredAttachments
        : inferredAttachments.length > 0
            ? inferredAttachments
            : undefined;

    return {
        ...value,
        kind: resolvedKind,
        timestamp,
        isOutgoing: resolvedIsOutgoing,
        ...(senderPubkey ? { senderPubkey } : {}),
        ...(recipientPubkey ? { recipientPubkey } : {}),
        ...(canonicalConversationId ? { conversationId: canonicalConversationId } : {}),
        ...(attachments ? { attachments } : {}),
    };
};
