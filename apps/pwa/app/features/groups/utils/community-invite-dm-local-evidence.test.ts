import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/app/features/messaging/types";

const pipelineMocks = vi.hoisted(() => ({
  toCanonicalCommunityDmInviteThreadMessage: vi.fn((message: Message) => ({
    ...message,
    id: message.eventId ?? message.id,
    eventId: message.eventId ?? message.id,
  })),
}));

vi.mock("../services/community-dm-invite-pipeline", () => pipelineMocks);

import { toCanonicalOutgoingCommunityInviteMessage } from "./community-invite-dm-local-evidence";

describe("toCanonicalOutgoingCommunityInviteMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-exports canonical thread normalization from the unified pipeline", () => {
    const message: Message = {
      id: "gift-wrap-id",
      eventId: "rumor-id",
      relayPublishedEventId: "gift-wrap-id",
      conversationId: "a:b",
      kind: "user",
      content: "{}",
      timestamp: new Date(),
      isOutgoing: true,
      status: "delivered",
    };
    const canonical = toCanonicalOutgoingCommunityInviteMessage(message);
    expect(canonical.id).toBe("rumor-id");
    expect(pipelineMocks.toCanonicalCommunityDmInviteThreadMessage).toHaveBeenCalledWith(message);
  });
});
