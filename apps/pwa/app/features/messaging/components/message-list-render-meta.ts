import type { Attachment, Message } from "../types";
import { inferAttachmentKind } from "../utils/logic";

export type ParsedMessagePayload = Readonly<Record<string, unknown> & { type?: string }>;
export type InviteResponseStatus = "pending" | "accepted" | "declined" | "canceled";

export type MessageTextContentResult = Readonly<{
    content: string;
    hasHiddenAttachmentRelayUrls: boolean;
}>;

export type MessageRenderMeta = Readonly<{
    attachmentUrlsExpanded: boolean;
    hasVisualAttachments: boolean;
    hasAttachmentRelayUrlsInContent: boolean;
    textContentResult: MessageTextContentResult;
    parsedPayload: ParsedMessagePayload | null;
}>;

export type VoiceCallRoomRenderSummary = Readonly<{
    roomId: string;
    invitedAtUnixMs: number | null;
    expiresAtUnixMs: number | null;
    connectedAtUnixMs: number | null;
    endedAtUnixMs: number | null;
    endedNormally: boolean;
    durationSeconds: number | null;
}>;

export type MessageRenderCaches = Readonly<{
    parsedPayloadByMessageId: ReadonlyMap<string, ParsedMessagePayload | null>;
    inviteResponseStatusByMessageId: ReadonlyMap<string, InviteResponseStatus>;
    renderMetaByMessageId: ReadonlyMap<string, MessageRenderMeta>;
    voiceCallRoomSummaryByRoomId: ReadonlyMap<string, VoiceCallRoomRenderSummary>;
}>;

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const messageHasAttachmentRelayUrls = (params: Readonly<{
    content: string;
    attachments?: ReadonlyArray<Attachment>;
}>): boolean => {
    const { content, attachments } = params;
    if (!attachments || attachments.length === 0 || !content) {
        return false;
    }
    return attachments.some((attachment) => {
        const url = attachment.url?.trim();
        return !!url && content.includes(url);
    });
};

const messageHasOnlyVoiceNoteAttachments = (attachments?: ReadonlyArray<Attachment>): boolean => {
    if (!attachments || attachments.length === 0) {
        return false;
    }
    return attachments.every((attachment) => inferAttachmentKind(attachment) === "voice_note");
};

const removeAttachmentRelayUrlsFromContent = (params: Readonly<{
    content: string;
    attachments?: ReadonlyArray<Attachment>;
}>): MessageTextContentResult => {
    const { content, attachments } = params;
    if (!attachments || attachments.length === 0 || !content) {
        return { content, hasHiddenAttachmentRelayUrls: false };
    }

    let next = content;
    let hasHiddenAttachmentRelayUrls = false;

    attachments.forEach((attachment) => {
        const url = attachment.url?.trim();
        if (!url) return;

        const escapedUrl = escapeRegex(url);
        const markdownRegex = new RegExp(`\\[[\\s\\S]*?\\]\\(${escapedUrl}\\)`, "g");
        if (next.match(markdownRegex)) {
            hasHiddenAttachmentRelayUrls = true;
            next = next.replace(markdownRegex, "");
        }

        if (next.includes(url)) {
            hasHiddenAttachmentRelayUrls = true;
            next = next.split(url).join("");
        }
    });

    if (!hasHiddenAttachmentRelayUrls) {
        return { content, hasHiddenAttachmentRelayUrls: false };
    }

    next = next
        .replace(/[ \t]+$/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return { content: next, hasHiddenAttachmentRelayUrls: true };
};

const getMessageContentForDisplay = (params: Readonly<{
    content: string;
    attachments?: ReadonlyArray<Attachment>;
    showAttachmentRelayUrls: boolean;
}>): MessageTextContentResult => {
    if (params.showAttachmentRelayUrls) {
        return { content: params.content, hasHiddenAttachmentRelayUrls: false };
    }
    return removeAttachmentRelayUrlsFromContent({
        content: params.content,
        attachments: params.attachments,
    });
};

const parsePayload = (content: string): ParsedMessagePayload | null => {
    try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object") {
            return parsed as ParsedMessagePayload;
        }
    } catch {
        // Ignore parse failures for non-JSON message content.
    }
    return null;
};

const isInviteResponseStatus = (status: unknown): status is InviteResponseStatus => {
    return status === "pending"
        || status === "accepted"
        || status === "declined"
        || status === "canceled";
};

type MutableVoiceCallRoomAccumulator = {
    roomId: string;
    invitedAtUnixMs: number | null;
    expiresAtUnixMs: number | null;
    connectedAtUnixMs: number | null;
    endedAtUnixMs: number | null;
};

const toFiniteUnixMsOrNull = (value: unknown): number | null => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
    }
    return Math.floor(value);
};

const toMessageUnixMs = (message: Message): number => {
    const eventCreatedAtUnixMs = message.eventCreatedAt?.getTime();
    if (typeof eventCreatedAtUnixMs === "number" && Number.isFinite(eventCreatedAtUnixMs)) {
        return eventCreatedAtUnixMs;
    }
    return message.timestamp.getTime();
};

export const buildMessageRenderCaches = (params: Readonly<{
    messages: ReadonlyArray<Message>;
    expandedRelayUrlsByMessageId: ReadonlySet<string>;
}>): MessageRenderCaches => {
    const parsedPayloadByMessageId = new Map<string, ParsedMessagePayload | null>();
    const inviteResponseStatusByMessageId = new Map<string, InviteResponseStatus>();
    const renderMetaByMessageId = new Map<string, MessageRenderMeta>();
    const voiceCallRoomAccumulatorByRoomId = new Map<string, MutableVoiceCallRoomAccumulator>();

    params.messages.forEach((message) => {
        const parsedPayload = parsePayload(message.content);
        parsedPayloadByMessageId.set(message.id, parsedPayload);

        if (
            message.replyTo?.messageId
            && parsedPayload?.type === "community-invite-response"
            && isInviteResponseStatus(parsedPayload.status)
        ) {
            inviteResponseStatusByMessageId.set(message.replyTo.messageId, parsedPayload.status);
        }

        const attachmentUrlsExpanded = params.expandedRelayUrlsByMessageId.has(message.id);
        const hasOnlyVoiceNoteAttachments = messageHasOnlyVoiceNoteAttachments(message.attachments);
        const hasVisualAttachments = (message.attachments ?? []).some((attachment) => {
            const kind = inferAttachmentKind(attachment);
            return kind === "image" || kind === "video";
        });
        const hasAttachmentRelayUrlsInContent = !hasOnlyVoiceNoteAttachments && messageHasAttachmentRelayUrls({
            content: message.content,
            attachments: message.attachments,
        });
        const textContentResult = hasOnlyVoiceNoteAttachments
            ? removeAttachmentRelayUrlsFromContent({
                content: message.content,
                attachments: message.attachments,
            })
            : getMessageContentForDisplay({
                content: message.content,
                attachments: message.attachments,
                showAttachmentRelayUrls: attachmentUrlsExpanded,
            });

        renderMetaByMessageId.set(message.id, {
            attachmentUrlsExpanded: hasOnlyVoiceNoteAttachments ? false : attachmentUrlsExpanded,
            hasVisualAttachments,
            hasAttachmentRelayUrlsInContent,
            textContentResult,
            parsedPayload,
        });

        if (!parsedPayload || typeof parsedPayload.roomId !== "string" || !parsedPayload.roomId.trim()) {
            return;
        }

        const roomId = parsedPayload.roomId.trim();
        const messageUnixMs = toMessageUnixMs(message);
        const accumulator = voiceCallRoomAccumulatorByRoomId.get(roomId) ?? {
            roomId,
            invitedAtUnixMs: null,
            expiresAtUnixMs: null,
            connectedAtUnixMs: null,
            endedAtUnixMs: null,
        };

        if (parsedPayload.type === "voice-call-invite") {
            const invitedAtUnixMs = toFiniteUnixMsOrNull(parsedPayload.invitedAtUnixMs) ?? messageUnixMs;
            const expiresAtUnixMs = toFiniteUnixMsOrNull(parsedPayload.expiresAtUnixMs);
            accumulator.invitedAtUnixMs = accumulator.invitedAtUnixMs === null
                ? invitedAtUnixMs
                : Math.min(accumulator.invitedAtUnixMs, invitedAtUnixMs);
            if (expiresAtUnixMs !== null) {
                accumulator.expiresAtUnixMs = accumulator.expiresAtUnixMs === null
                    ? expiresAtUnixMs
                    : Math.max(accumulator.expiresAtUnixMs, expiresAtUnixMs);
            }
            voiceCallRoomAccumulatorByRoomId.set(roomId, accumulator);
            return;
        }

        if (parsedPayload.type === "voice-call-signal") {
            const signalType = typeof parsedPayload.signalType === "string" ? parsedPayload.signalType : null;
            const signalUnixMs = toFiniteUnixMsOrNull(parsedPayload.sentAtUnixMs) ?? messageUnixMs;
            if (signalType === "answer") {
                accumulator.connectedAtUnixMs = accumulator.connectedAtUnixMs === null
                    ? signalUnixMs
                    : Math.min(accumulator.connectedAtUnixMs, signalUnixMs);
            } else if (signalType === "leave") {
                accumulator.endedAtUnixMs = accumulator.endedAtUnixMs === null
                    ? signalUnixMs
                    : Math.max(accumulator.endedAtUnixMs, signalUnixMs);
            }
            voiceCallRoomAccumulatorByRoomId.set(roomId, accumulator);
        }
    });

    const voiceCallRoomSummaryByRoomId = new Map<string, VoiceCallRoomRenderSummary>();
    voiceCallRoomAccumulatorByRoomId.forEach((accumulator, roomId) => {
        const connectedAtUnixMs = accumulator.connectedAtUnixMs;
        const endedAtUnixMs = accumulator.endedAtUnixMs;
        const hasConnectedAt = connectedAtUnixMs !== null;
        const hasEndedAt = endedAtUnixMs !== null;
        const endedNormally = hasConnectedAt && hasEndedAt;
        const durationSeconds = (hasConnectedAt && hasEndedAt)
            ? Math.max(0, Math.floor((endedAtUnixMs - connectedAtUnixMs) / 1000))
            : null;
        voiceCallRoomSummaryByRoomId.set(roomId, {
            roomId,
            invitedAtUnixMs: accumulator.invitedAtUnixMs,
            expiresAtUnixMs: accumulator.expiresAtUnixMs,
            connectedAtUnixMs,
            endedAtUnixMs,
            endedNormally,
            durationSeconds,
        });
    });

    return {
        parsedPayloadByMessageId,
        inviteResponseStatusByMessageId,
        renderMetaByMessageId,
        voiceCallRoomSummaryByRoomId,
    };
};
