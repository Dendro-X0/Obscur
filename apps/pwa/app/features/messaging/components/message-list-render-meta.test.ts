import { describe, expect, it } from "vitest";
import type { Attachment, Message } from "../types";
import { buildMessageRenderCaches } from "./message-list-render-meta";

const createAttachment = (overrides: Partial<Attachment>): Attachment => ({
    kind: "file",
    url: "https://relay.example.com/default.bin",
    contentType: "application/octet-stream",
    fileName: "default.bin",
    ...overrides,
});

const createMessage = (overrides: Partial<Message>): Message => ({
    id: "msg-1",
    kind: "user",
    content: "hello",
    timestamp: new Date(1_000),
    isOutgoing: false,
    status: "delivered",
    ...overrides,
});

describe("message-list render meta cache", () => {
    it("builds parsed payload, invite-response mapping, and render meta in one pass", () => {
        const relayUrl = "https://relay.example.com/media/photo.png";
        const messages: ReadonlyArray<Message> = [
            createMessage({
                id: "msg-invite-response",
                content: JSON.stringify({
                    type: "community-invite-response",
                    status: "accepted",
                }),
                replyTo: { messageId: "msg-invite", previewText: "invite preview" },
            }),
            createMessage({
                id: "msg-media",
                content: `See this media ${relayUrl}`,
                attachments: [
                    createAttachment({
                        kind: "image",
                        contentType: "image/png",
                        fileName: "photo.png",
                        url: relayUrl,
                    }),
                ],
            }),
            createMessage({
                id: "msg-plain",
                content: "not json payload",
            }),
        ];

        const caches = buildMessageRenderCaches({
            messages,
            expandedRelayUrlsByMessageId: new Set<string>(),
        });

        expect(caches.parsedPayloadByMessageId.get("msg-invite-response")).toEqual({
            type: "community-invite-response",
            status: "accepted",
        });
        expect(caches.parsedPayloadByMessageId.get("msg-plain")).toBeNull();
        expect(caches.inviteResponseStatusByMessageId.get("msg-invite")).toBe("accepted");

        const mediaMeta = caches.renderMetaByMessageId.get("msg-media");
        expect(mediaMeta?.hasVisualAttachments).toBe(true);
        expect(mediaMeta?.hasAttachmentRelayUrlsInContent).toBe(true);
        expect(mediaMeta?.textContentResult.hasHiddenAttachmentRelayUrls).toBe(true);
        expect(mediaMeta?.textContentResult.content).toBe("See this media");
        expect(caches.voiceCallRoomSummaryByRoomId.size).toBe(0);
    });

    it("preserves relay URLs in message content when expanded", () => {
        const relayUrl = "https://relay.example.com/media/file.pdf";
        const message = createMessage({
            id: "msg-relay-expanded",
            content: `proof ${relayUrl}`,
            attachments: [
                createAttachment({
                    kind: "file",
                    contentType: "application/pdf",
                    fileName: "file.pdf",
                    url: relayUrl,
                }),
            ],
        });

        const caches = buildMessageRenderCaches({
            messages: [message],
            expandedRelayUrlsByMessageId: new Set<string>(["msg-relay-expanded"]),
        });

        const meta = caches.renderMetaByMessageId.get("msg-relay-expanded");
        expect(meta?.attachmentUrlsExpanded).toBe(true);
        expect(meta?.textContentResult.hasHiddenAttachmentRelayUrls).toBe(false);
        expect(meta?.textContentResult.content).toBe(`proof ${relayUrl}`);
    });

    it("keeps voice-note relay urls hidden even when expanded is requested", () => {
        const relayUrl = "https://relay.example.com/media/voice-note-1774249000000-d4.webm";
        const message = createMessage({
            id: "msg-voice-note-relay-hidden",
            content: `[voice-note-1774249000000-d4.webm](${relayUrl})`,
            attachments: [
                createAttachment({
                    kind: "voice_note",
                    contentType: "audio/webm",
                    fileName: "voice-note-1774249000000-d4.webm",
                    url: relayUrl,
                }),
            ],
        });

        const caches = buildMessageRenderCaches({
            messages: [message],
            expandedRelayUrlsByMessageId: new Set<string>(["msg-voice-note-relay-hidden"]),
        });

        const meta = caches.renderMetaByMessageId.get("msg-voice-note-relay-hidden");
        expect(meta?.attachmentUrlsExpanded).toBe(false);
        expect(meta?.hasAttachmentRelayUrlsInContent).toBe(false);
        expect(meta?.textContentResult.hasHiddenAttachmentRelayUrls).toBe(true);
        expect(meta?.textContentResult.content).toBe("");
    });

    it("builds room lifecycle summary with ended timestamp and duration", () => {
        const roomId = "dm-voice-room-z";
        const messages: ReadonlyArray<Message> = [
            createMessage({
                id: "msg-invite",
                timestamp: new Date(1_000),
                content: JSON.stringify({
                    type: "voice-call-invite",
                    roomId,
                    invitedAtUnixMs: 1_000,
                    expiresAtUnixMs: 31_000,
                }),
            }),
            createMessage({
                id: "msg-answer",
                timestamp: new Date(5_000),
                content: JSON.stringify({
                    type: "voice-call-signal",
                    roomId,
                    signalType: "answer",
                    sentAtUnixMs: 5_000,
                }),
            }),
            createMessage({
                id: "msg-leave",
                timestamp: new Date(16_500),
                content: JSON.stringify({
                    type: "voice-call-signal",
                    roomId,
                    signalType: "leave",
                    sentAtUnixMs: 16_500,
                }),
            }),
        ];

        const caches = buildMessageRenderCaches({
            messages,
            expandedRelayUrlsByMessageId: new Set<string>(),
        });

        const summary = caches.voiceCallRoomSummaryByRoomId.get(roomId);
        expect(summary).toMatchObject({
            roomId,
            invitedAtUnixMs: 1_000,
            expiresAtUnixMs: 31_000,
            connectedAtUnixMs: 5_000,
            endedAtUnixMs: 16_500,
            endedNormally: true,
            durationSeconds: 11,
        });
    });
});
