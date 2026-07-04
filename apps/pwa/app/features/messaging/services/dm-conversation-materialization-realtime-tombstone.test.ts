import { describe, expect, it, vi } from "vitest";
import { applyLegacyRealtimeBufferedEvents } from "@/app/features/messaging/services/thread-history/dm-thread-history-legacy-port";

const suppressMock = vi.hoisted(() => vi.fn(
  (_messageId?: string, _profileId?: string, _nowMs?: number) => false,
));

vi.mock("@/app/features/messaging/services/messaging-client-operations", () => ({
  messagingClientOperations: {
    isDmMessageSuppressed: suppressMock,
    isDmMessageIdentitySuppressed: vi.fn(() => false),
  },
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "profile-test",
}));

describe("applyLegacyRealtimeBufferedEvents tombstone TTL", () => {
  it("does not resurrect messages when durable tombstone remains after in-memory TTL", () => {
    suppressMock.mockImplementation((messageId) => messageId === "m-old");
    const tombstones = new Map<string, number>([["m-old", Date.now() - 5 * 60 * 1000]]);
    const result = applyLegacyRealtimeBufferedEvents({
      previous: [],
      events: [{
        type: "new_message",
        conversationId: "a:b",
        message: {
          id: "m-old",
          kind: "user",
          content: "ghost",
          timestamp: new Date(),
          isOutgoing: false,
          status: "delivered",
        },
      }],
      chatPerformanceV2Enabled: false,
      allowExpandedHistory: true,
      tombstones,
      nowMs: Date.now(),
      persistentSuppressedMessageIds: new Set(),
    });
    expect(result).toEqual([]);
  });

  it("blocks admission via persistentSuppressedMessageIds after in-memory tombstone TTL", () => {
    suppressMock.mockReturnValue(false);
    const tombstones = new Map<string, number>([["m-old", Date.now() - 5 * 60 * 1000]]);
    const result = applyLegacyRealtimeBufferedEvents({
      previous: [],
      events: [{
        type: "new_message",
        conversationId: "a:b",
        message: {
          id: "m-old",
          kind: "user",
          content: "ghost",
          timestamp: new Date(),
          isOutgoing: false,
          status: "delivered",
        },
      }],
      chatPerformanceV2Enabled: false,
      allowExpandedHistory: true,
      tombstones,
      nowMs: Date.now(),
      persistentSuppressedMessageIds: new Set(["m-old"]),
    });
    expect(result).toEqual([]);
  });
});
