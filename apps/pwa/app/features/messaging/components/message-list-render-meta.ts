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

export type MessageRenderCaches = Readonly<{
    parsedPayloadByMessageId: ReadonlyMap<string, ParsedMessagePayload | null>;
    inviteResponseStatusByMessageId: ReadonlyMap<string, InviteResponseStatus>;
    renderMetaByMessageId: ReadonlyMap<string, MessageRenderMeta>;
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

export const buildMessageRenderCaches = (params: Readonly<{
    messages: ReadonlyArray<Message>;
    expandedRelayUrlsByMessageId: ReadonlySet<string>;
}>): MessageRenderCaches => {
    const parsedPayloadByMessageId = new Map<string, ParsedMessagePayload | null>();
    const inviteResponseStatusByMessageId = new Map<string, InviteResponseStatus>();
    const renderMetaByMessageId = new Map<string, MessageRenderMeta>();

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
        const hasVisualAttachments = (message.attachments ?? []).some((attachment) => {
            const kind = inferAttachmentKind(attachment);
            return kind === "image" || kind === "video";
        });
        const hasAttachmentRelayUrlsInContent = messageHasAttachmentRelayUrls({
            content: message.content,
            attachments: message.attachments,
        });
        const textContentResult = getMessageContentForDisplay({
            content: message.content,
            attachments: message.attachments,
            showAttachmentRelayUrls: attachmentUrlsExpanded,
        });

        renderMetaByMessageId.set(message.id, {
            attachmentUrlsExpanded,
            hasVisualAttachments,
            hasAttachmentRelayUrlsInContent,
            textContentResult,
            parsedPayload,
        });
    });

    return {
        parsedPayloadByMessageId,
        inviteResponseStatusByMessageId,
        renderMetaByMessageId,
    };
};
