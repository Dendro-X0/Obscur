import { describe, expect, it } from "vitest";
import type { Message } from "@/app/features/messaging/types";
import {
    buildCommunityInviteResponseStatusByMessageId,
    resolveCommunityInvitePayloadFromMessage,
} from "./community-invite-resolution";

const baseMessage = (overrides: Partial<Message> & Pick<Message, "id" | "content" | "isOutgoing">): Message => ({
    conversationId: "a:b",
    kind: "user",
    timestamp: new Date(1_700_000_000_000),
    status: "delivered",
    senderPubkey: "a".repeat(64) as Message["senderPubkey"],
    recipientPubkey: "b".repeat(64) as Message["recipientPubkey"],
    ...overrides,
});

describe("buildCommunityInviteResponseStatusByMessageId", () => {
    it("links response to invite by replyTo message id", () => {
        const invite = baseMessage({
            id: "invite-1",
            isOutgoing: true,
            content: JSON.stringify({ type: "community-invite", groupId: "g1", roomKey: "rk" }),
        });
        const response = baseMessage({
            id: "response-1",
            isOutgoing: false,
            content: JSON.stringify({ type: "community-invite-response", status: "accepted", groupId: "g1" }),
            replyTo: { messageId: "invite-1", previewText: "" },
        });
        const map = buildCommunityInviteResponseStatusByMessageId([invite, response]);
        expect(map.get("invite-1")).toBe("accepted");
    });

    it("links response to invite by rumor event id alias", () => {
        const invite = baseMessage({
            id: "gift-wrap-id",
            eventId: "rumor-event-id",
            relayPublishedEventId: "gift-wrap-id",
            isOutgoing: true,
            content: JSON.stringify({ type: "community-invite", groupId: "g1", roomKey: "rk" }),
        });
        const response = baseMessage({
            id: "response-1",
            isOutgoing: false,
            timestamp: new Date(1_700_000_100_000),
            content: JSON.stringify({ type: "community-invite-response", status: "declined", groupId: "g1" }),
            replyTo: { messageId: "rumor-event-id", previewText: "" },
        });
        const map = buildCommunityInviteResponseStatusByMessageId([invite, response]);
        expect(map.get("gift-wrap-id")).toBe("declined");
    });

    it("does not link response when replyTo points at a different invite", () => {
        const invite = baseMessage({
            id: "invite-outgoing-id",
            eventId: "invite-outgoing-id",
            isOutgoing: true,
            content: JSON.stringify({ type: "community-invite", groupId: "g1", roomKey: "rk" }),
        });
        const response = baseMessage({
            id: "response-1",
            isOutgoing: false,
            timestamp: new Date(1_700_000_100_000),
            content: JSON.stringify({ type: "community-invite-response", status: "declined", groupId: "g1" }),
            replyTo: { messageId: "wrong-rumor-id", previewText: "" },
        });
        const map = buildCommunityInviteResponseStatusByMessageId([invite, response]);
        expect(map.get("invite-outgoing-id")).toBeUndefined();
    });

    it("links groupId fallback only when replyTo is missing", () => {
        const inviteA = baseMessage({
            id: "invite-a",
            eventId: "invite-a",
            isOutgoing: true,
            timestamp: new Date(1_700_000_000_000),
            content: JSON.stringify({ type: "community-invite", groupId: "g1", roomKey: "rk" }),
        });
        const inviteB = baseMessage({
            id: "invite-b",
            eventId: "invite-b",
            isOutgoing: true,
            timestamp: new Date(1_700_000_050_000),
            content: JSON.stringify({ type: "community-invite", groupId: "g1", roomKey: "rk" }),
        });
        const response = baseMessage({
            id: "response-1",
            isOutgoing: false,
            timestamp: new Date(1_700_000_200_000),
            content: JSON.stringify({ type: "community-invite-response", status: "accepted", groupId: "g1" }),
        });
        const map = buildCommunityInviteResponseStatusByMessageId([inviteA, inviteB, response]);
        expect(map.get("invite-a")).toBeUndefined();
        expect(map.get("invite-b")).toBe("accepted");
    });

    it("does not apply an older response to a newer invite for the same group", () => {
        const oldInvite = baseMessage({
            id: "invite-old",
            isOutgoing: false,
            timestamp: new Date(1_700_000_000_000),
            content: JSON.stringify({ type: "community-invite", groupId: "g1", roomKey: "rk" }),
        });
        const oldResponse = baseMessage({
            id: "response-old",
            isOutgoing: true,
            timestamp: new Date(1_700_000_100_000),
            content: JSON.stringify({ type: "community-invite-response", status: "accepted", groupId: "g1" }),
            replyTo: { messageId: "invite-old", previewText: "" },
        });
        const newInvite = baseMessage({
            id: "invite-new",
            isOutgoing: false,
            timestamp: new Date(1_700_000_300_000),
            content: JSON.stringify({ type: "community-invite", groupId: "g1", roomKey: "rk2" }),
        });
        const map = buildCommunityInviteResponseStatusByMessageId([oldInvite, oldResponse, newInvite]);
        expect(map.get("invite-old")).toBe("accepted");
        expect(map.get("invite-new")).toBeUndefined();
    });
});

describe("resolveCommunityInvitePayloadFromMessage", () => {
    it("merges metadata name from content when parsed invite only has room key", () => {
        const message = baseMessage({
            id: "invite-1",
            isOutgoing: false,
            content: JSON.stringify({
                type: "community-invite",
                groupId: "g1",
                roomKey: "rk",
                metadata: { id: "g1", name: "NewTest 1", access: "invite-only" },
            }),
        });
        const merged = resolveCommunityInvitePayloadFromMessage(message, {
            type: "community-invite",
            groupId: "g1",
            roomKey: "rk",
            metadata: { id: "g1", name: "Private Group" },
        });
        expect(merged?.metadata.name).toBe("NewTest 1");
    });
});
