import type { Message } from "@/app/features/messaging/types";
import type { InviteResponseStatus } from "@/app/features/messaging/components/message-list-render-meta";
import { collectCommunityInviteMessageIdentityAliases } from "./community-invite-dm-message";
import { normalizeCommunityInvitePayload, type InvitePayload } from "./community-invite-payload";

const TERMINAL_INVITE_RESPONSE_STATUSES = new Set<InviteResponseStatus>([
    "accepted",
    "declined",
    "canceled",
]);

const isTerminalInviteResponseStatus = (status: unknown): status is InviteResponseStatus => (
    typeof status === "string" && TERMINAL_INVITE_RESPONSE_STATUSES.has(status as InviteResponseStatus)
);

const parseJsonPayload = (content: string): Record<string, unknown> | null => {
    const trimmed = content.trim().replace(/^\uFEFF/, "");
    if (!trimmed) {
        return null;
    }
    let candidate: unknown = trimmed;
    for (let depth = 0; depth < 3; depth += 1) {
        if (typeof candidate !== "string") {
            break;
        }
        try {
            candidate = JSON.parse(candidate);
        } catch {
            return null;
        }
    }
    return candidate && typeof candidate === "object" ? candidate as Record<string, unknown> : null;
};

const readInviteGroupId = (record: Record<string, unknown> | null): string | null => {
    if (!record || record.type !== "community-invite") {
        return null;
    }
    const groupId = typeof record.groupId === "string" ? record.groupId.trim() : "";
    return groupId.length > 0 ? groupId : null;
};

const readResponseFields = (record: Record<string, unknown> | null): Readonly<{
    groupId: string | null;
    status: InviteResponseStatus | null;
}> => {
    if (!record || record.type !== "community-invite-response") {
        return { groupId: null, status: null };
    }
    const groupId = typeof record.groupId === "string" ? record.groupId.trim() : "";
    const status = isTerminalInviteResponseStatus(record.status) ? record.status : null;
    return {
        groupId: groupId.length > 0 ? groupId : null,
        status,
    };
};

const toMessageUnixMs = (message: Message): number => (
    message.eventCreatedAt?.getTime() ?? message.timestamp.getTime()
);

type InviteIndexEntry = Readonly<{
    messageId: string;
    groupId: string;
    isOutgoing: boolean;
    timestampMs: number;
}>;

const registerInviteIdentityAliases = (
    inviteIdentityToMessageId: Map<string, string>,
    message: Message,
    inviteMessageId: string,
): void => {
    collectCommunityInviteMessageIdentityAliases(message).forEach((alias) => {
        inviteIdentityToMessageId.set(alias, inviteMessageId);
    });
};

/**
 * Maps invite message ids to terminal response status.
 * Only binds via replyTo → invite identity aliases (gift-wrap, rumor, relay ids).
 * Legacy responses without replyTo fall back to the latest same-group invite before the response.
 */
export const buildCommunityInviteResponseStatusByMessageId = (
    messages: ReadonlyArray<Message>,
): ReadonlyMap<string, InviteResponseStatus> => {
    const statusByInviteMessageId = new Map<string, InviteResponseStatus>();
    const inviteIdentityToMessageId = new Map<string, string>();
    const invites: InviteIndexEntry[] = [];

    messages.forEach((message) => {
        const parsed = parseJsonPayload(message.content);
        const groupId = readInviteGroupId(parsed);
        if (!groupId) {
            return;
        }
        invites.push({
            messageId: message.id,
            groupId,
            isOutgoing: message.isOutgoing,
            timestampMs: toMessageUnixMs(message),
        });
        registerInviteIdentityAliases(inviteIdentityToMessageId, message, message.id);
    });

    const assignStatus = (inviteMessageId: string, status: InviteResponseStatus, responseAtMs: number): void => {
        const existing = statusByInviteMessageId.get(inviteMessageId);
        if (!existing) {
            statusByInviteMessageId.set(inviteMessageId, status);
            return;
        }
        const existingInvite = invites.find((entry) => entry.messageId === inviteMessageId);
        if (!existingInvite) {
            statusByInviteMessageId.set(inviteMessageId, status);
            return;
        }
        if (responseAtMs >= existingInvite.timestampMs) {
            statusByInviteMessageId.set(inviteMessageId, status);
        }
    };

    messages.forEach((message) => {
        const parsed = parseJsonPayload(message.content);
        const { groupId, status } = readResponseFields(parsed);
        if (!status) {
            return;
        }
        const responseAtMs = toMessageUnixMs(message);

        const replyTargetId = message.replyTo?.messageId?.trim();
        if (replyTargetId) {
            const inviteMessageId = inviteIdentityToMessageId.get(replyTargetId);
            if (inviteMessageId) {
                assignStatus(inviteMessageId, status, responseAtMs);
            }
            return;
        }

        if (groupId) {
            const matchingInvites = invites.filter((invite) => (
                invite.groupId === groupId
                && invite.isOutgoing !== message.isOutgoing
                && responseAtMs >= invite.timestampMs
            ));
            if (matchingInvites.length > 0) {
                const targetInvite = matchingInvites.reduce((latest, current) => (
                    current.timestampMs >= latest.timestampMs ? current : latest
                ));
                assignStatus(targetInvite.messageId, status, responseAtMs);
            }
        }
    });

    return statusByInviteMessageId;
};

const mergeInvitePayloadParts = (
    primary: InvitePayload | null,
    secondary: InvitePayload | null,
): InvitePayload | null => {
    const base = primary ?? secondary;
    if (!base) {
        return null;
    }
    const roomKey = primary?.roomKey?.trim() || secondary?.roomKey?.trim() || "";
    const metadataName = primary?.metadata.name?.trim() || secondary?.metadata.name?.trim() || "";
    const metadataAbout = primary?.metadata.about?.trim() || secondary?.metadata.about?.trim();
    return {
        ...base,
        roomKey,
        communityId: primary?.communityId ?? secondary?.communityId,
        genesisEventId: primary?.genesisEventId ?? secondary?.genesisEventId,
        creatorPubkey: primary?.creatorPubkey ?? secondary?.creatorPubkey,
        relayUrl: primary?.relayUrl ?? secondary?.relayUrl,
        metadata: {
            ...base.metadata,
            name: metadataName || base.metadata.name,
            about: metadataAbout ?? base.metadata.about,
            picture: primary?.metadata.picture ?? secondary?.metadata.picture,
            access: primary?.metadata.access ?? secondary?.metadata.access,
            memberCount: primary?.metadata.memberCount ?? secondary?.metadata.memberCount,
        },
    };
};

/** Prefer normalized invite from message content (full DM plaintext). */
export const resolveCommunityInvitePayloadFromMessage = (
    message: Message | undefined,
    parsedInvite: unknown,
): InvitePayload | null => {
    const fromContent = message?.content?.trim()
        ? normalizeCommunityInvitePayload(parseJsonPayload(message.content))
        : null;
    const fromParsed = normalizeCommunityInvitePayload(parsedInvite);
    return mergeInvitePayloadParts(fromContent, fromParsed);
};

/** Stable id for invite-response reply tags (prefer nostr rumor event id). */
export const resolveCommunityInviteReplyTargetId = (message: Message): string => (
    message.eventId?.trim() || message.id
);

export const resolveCommunityInviteRoomKeyHex = (
    invite: InvitePayload | null,
    message?: Message,
): string => {
    const fromInvite = invite?.roomKey?.trim() ?? "";
    if (fromInvite) {
        return fromInvite;
    }
    return resolveCommunityInvitePayloadFromMessage(message, invite)?.roomKey?.trim() ?? "";
};
