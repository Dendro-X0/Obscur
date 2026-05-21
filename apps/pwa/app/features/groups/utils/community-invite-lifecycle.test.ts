import { describe, expect, it } from "vitest";
import type { Message } from "@/app/features/messaging/types";
import {
    COMMUNITY_INVITE_PENDING_TTL_MS,
    isCommunityInviteExpiredByAge,
    resolveCommunityInviteCardStatus,
} from "./community-invite-lifecycle";

const baseMessage = (overrides: Partial<Message> & Pick<Message, "id" | "content" | "isOutgoing">): Message => ({
    conversationId: "a:b",
    kind: "user",
    timestamp: new Date(1_700_000_000_000),
    status: "delivered",
    senderPubkey: "a".repeat(64) as Message["senderPubkey"],
    recipientPubkey: "b".repeat(64) as Message["recipientPubkey"],
    ...overrides,
});

describe("resolveCommunityInviteCardStatus", () => {
    it("returns linked terminal status from cache", () => {
        const invite = baseMessage({
            id: "invite-1",
            isOutgoing: false,
            content: JSON.stringify({ type: "community-invite", groupId: "g1", roomKey: "rk" }),
        });
        expect(resolveCommunityInviteCardStatus({
            message: invite,
            messages: [invite],
            responseStatus: "canceled",
        })).toBe("canceled");
    });

    it("marks older pending invite superseded when a newer invite exists", () => {
        const oldInvite = baseMessage({
            id: "invite-old",
            isOutgoing: false,
            timestamp: new Date(1_700_000_000_000),
            content: JSON.stringify({ type: "community-invite", groupId: "g1", roomKey: "rk" }),
        });
        const newInvite = baseMessage({
            id: "invite-new",
            isOutgoing: false,
            timestamp: new Date(1_700_000_200_000),
            content: JSON.stringify({ type: "community-invite", groupId: "g1", roomKey: "rk2" }),
        });
        expect(resolveCommunityInviteCardStatus({
            message: oldInvite,
            messages: [oldInvite, newInvite],
            nowMs: 1_700_000_300_000,
        })).toBe("superseded");
    });

    it("marks older pending invite superseded when a later cancel exists for the group", () => {
        const oldInvite = baseMessage({
            id: "invite-old",
            isOutgoing: false,
            timestamp: new Date(1_700_000_000_000),
            content: JSON.stringify({ type: "community-invite", groupId: "g1", roomKey: "rk" }),
        });
        const cancel = baseMessage({
            id: "cancel-1",
            isOutgoing: true,
            timestamp: new Date(1_700_000_300_000),
            content: JSON.stringify({ type: "community-invite-response", status: "canceled", groupId: "g1" }),
            replyTo: { messageId: "invite-new", previewText: "" },
        });
        expect(resolveCommunityInviteCardStatus({
            message: oldInvite,
            messages: [oldInvite, cancel],
            nowMs: 1_700_000_400_000,
        })).toBe("superseded");
    });

    it("expires pending invite after TTL", () => {
        const sentAt = 1_700_000_000_000;
        const invite = baseMessage({
            id: "invite-1",
            isOutgoing: false,
            timestamp: new Date(sentAt),
            content: JSON.stringify({ type: "community-invite", groupId: "g1", roomKey: "rk" }),
        });
        expect(resolveCommunityInviteCardStatus({
            message: invite,
            messages: [invite],
            nowMs: sentAt + COMMUNITY_INVITE_PENDING_TTL_MS + 1,
        })).toBe("expired");
    });

    it("keeps latest pending invite actionable when no superseding activity", () => {
        const invite = baseMessage({
            id: "invite-1",
            isOutgoing: false,
            timestamp: new Date(1_700_000_000_000),
            content: JSON.stringify({ type: "community-invite", groupId: "g1", roomKey: "rk" }),
        });
        expect(resolveCommunityInviteCardStatus({
            message: invite,
            messages: [invite],
            nowMs: 1_700_000_000_000 + 60_000,
        })).toBe("pending");
    });
});

describe("isCommunityInviteExpiredByAge", () => {
    it("is false before TTL elapses", () => {
        const sentAt = 1_000;
        expect(isCommunityInviteExpiredByAge(sentAt, sentAt + COMMUNITY_INVITE_PENDING_TTL_MS - 1)).toBe(false);
    });
});
