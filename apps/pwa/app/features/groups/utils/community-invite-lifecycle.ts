import type { Message } from "@/app/features/messaging/types";
import type { InviteResponseStatus } from "@/app/features/messaging/components/message-list-render-meta";
import { parseInvitePayloadFromMessageContent } from "../services/community-dm-invite-pipeline";

/** Unanswered community DM invites stop being actionable after this window. */
export const COMMUNITY_INVITE_PENDING_TTL_MS = 72 * 60 * 60 * 1000;

export type CommunityInviteCardStatus =
    | InviteResponseStatus
    | "expired"
    | "superseded";

const TERMINAL_RESPONSE_STATUSES = new Set<InviteResponseStatus>([
    "accepted",
    "declined",
    "canceled",
]);

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

const toMessageUnixMs = (message: Message): number => (
    message.eventCreatedAt?.getTime() ?? message.timestamp.getTime()
);

const readPayloadGroupId = (record: Record<string, unknown> | null): string | null => {
    if (!record) {
        return null;
    }
    if (record.type !== "community-invite" && record.type !== "community-invite-response") {
        return null;
    }
    const groupId = typeof record.groupId === "string" ? record.groupId.trim() : "";
    return groupId.length > 0 ? groupId : null;
};

const readInviteGroupId = (record: Record<string, unknown> | null): string | null => {
    if (!record || record.type !== "community-invite") {
        return null;
    }
    return readPayloadGroupId(record);
};

const readResponseStatus = (record: Record<string, unknown> | null): InviteResponseStatus | null => {
    if (!record || record.type !== "community-invite-response") {
        return null;
    }
    const status = record.status;
    return typeof status === "string" && TERMINAL_RESPONSE_STATUSES.has(status as InviteResponseStatus)
        ? status as InviteResponseStatus
        : null;
};

export const isCommunityInviteHistoricalStatus = (
    status: CommunityInviteCardStatus,
): boolean => (
    status === "accepted"
    || status === "declined"
    || status === "canceled"
    || status === "expired"
    || status === "superseded"
);

export const isCommunityInviteActionableStatus = (
    status: CommunityInviteCardStatus,
): boolean => status === "pending";

export const isCommunityInviteExpiredByAge = (
    inviteSentAtMs: number,
    nowMs: number = Date.now(),
): boolean => (
    nowMs - inviteSentAtMs >= COMMUNITY_INVITE_PENDING_TTL_MS
);

type InviteLifecycleContext = Readonly<{
    message: Message;
    messages: ReadonlyArray<Message>;
    responseStatus?: InviteResponseStatus;
    nowMs?: number;
}>;

/**
 * Per-invite card status: terminal response, superseded by newer thread activity, TTL expiry, or pending.
 */
export const resolveCommunityInviteCardStatus = (
    params: InviteLifecycleContext,
): CommunityInviteCardStatus => {
    const { message, messages } = params;
    const nowMs = params.nowMs ?? Date.now();
    const inviteSentAtMs = toMessageUnixMs(message);
    const parsedInvite = parseJsonPayload(message.content);
    const groupId = readInviteGroupId(parsedInvite);
    if (!groupId) {
        return params.responseStatus ?? "pending";
    }

    const linkedStatus = params.responseStatus;
    if (linkedStatus && linkedStatus !== "pending") {
        return linkedStatus;
    }

    const thisInviteId = parseInvitePayloadFromMessageContent(message.content)?.inviteId;

    let hasNewerSameGroupInvite = false;

    messages.forEach((entry) => {
        if (entry.id === message.id) {
            return;
        }
        const entryAtMs = toMessageUnixMs(entry);
        const entryParsed = parseJsonPayload(entry.content);
        const entryInviteGroupId = readInviteGroupId(entryParsed);

        if (entryInviteGroupId !== groupId || entry.isOutgoing !== message.isOutgoing || entryAtMs <= inviteSentAtMs) {
            return;
        }

        const otherInviteId = parseInvitePayloadFromMessageContent(entry.content)?.inviteId;
        if (
            thisInviteId
            && otherInviteId
            && !thisInviteId.startsWith("legacy:")
            && thisInviteId === otherInviteId
        ) {
            return;
        }

        hasNewerSameGroupInvite = true;
    });

    if (hasNewerSameGroupInvite) {
        return "superseded";
    }

    if (isCommunityInviteExpiredByAge(inviteSentAtMs, nowMs)) {
        return "expired";
    }

    return "pending";
};
