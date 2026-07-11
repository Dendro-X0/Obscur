import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Message } from "@/app/features/messaging/types";
import type { CommunityDmInviteId } from "./community-dm-invite-contract";

const appendCanonicalDmEvent = vi.hoisted(() => vi.fn(() => new Promise<void>(() => {})));
const flushPendingNow = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/app/features/account-sync/services/account-event-ingest-bridge", () => ({
  appendCanonicalDmEvent,
}));

vi.mock("@/app/features/messaging/services/message-persistence-service", () => ({
  messagePersistenceService: { flushPendingNow },
}));

vi.mock("@/app/features/messaging/services/message-bus", () => ({
  messageBus: { emitNewMessage: vi.fn() },
}));

vi.mock("@/app/features/messaging/lib/message-queue", () => ({
  MessageQueue: class MockMessageQueue {
    persistMessage = vi.fn(async () => undefined);
  },
}));

vi.mock("@/app/features/messaging/services/messaging-chat-state-message-port", () => ({
  messagingChatStateMessagePort: {
    load: vi.fn(() => null),
    updateMessages: vi.fn(),
  },
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "default",
}));

vi.mock("../utils/community-invite-message-snapshot", () => ({
  pinCommunityInviteMessageSnapshotForMessage: vi.fn(),
}));

vi.mock("./community-dm-invite-ledger", () => ({
  upsertCommunityDmInviteLedgerEntry: vi.fn(),
}));

import { commitOutboundCommunityDmInvite } from "./community-dm-invite-pipeline";

describe("commitOutboundCommunityDmInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appendCanonicalDmEvent.mockImplementation(() => new Promise<void>(() => {}));
  });

  it("returns without awaiting account projection replay (invite UX must not block)", async () => {
    const inviteId = "inv-hang-test" as CommunityDmInviteId;
    const dmMessage: Message = {
      id: "gift-wrap-id",
      eventId: "rumor-id",
      conversationId: "a:b",
      kind: "user",
      content: JSON.stringify({
        type: "community-invite",
        inviteId,
        groupId: "group-1",
        roomKey: "rk",
        metadata: { id: "group-1", name: "Test", access: "invite-only" },
      }),
      timestamp: new Date(),
      isOutgoing: true,
      status: "delivered",
      senderPubkey: "a".repeat(64),
      recipientPubkey: "b".repeat(64),
    };

    const result = await commitOutboundCommunityDmInvite({
      inviteId,
      invitePayload: {
        type: "community-invite",
        inviteId,
        groupId: "group-1",
        roomKey: "rk",
        metadata: { id: "group-1", name: "Test", access: "invite-only" },
      },
      dmMessage,
      accountPublicKeyHex: "a".repeat(64) as never,
      profileId: "default",
    });

    expect(result.id).toBe("rumor-id");
    expect(flushPendingNow).toHaveBeenCalledTimes(1);
    expect(appendCanonicalDmEvent).toHaveBeenCalledTimes(1);
  });
});
