import { describe, expect, it, vi, beforeEach } from "vitest";

const searchMessagesMock = vi.hoisted(() => vi.fn());
const isNativeDmSqliteReadOwnerMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("@/app/features/messaging/services/chat-state-store-legacy", () => ({
  chatStateStoreService: {
    searchMessages: searchMessagesMock,
  },
}));

vi.mock("@/app/features/messaging/services/native-dm-read-policy", () => ({
  isNativeDmSqliteReadOwner: isNativeDmSqliteReadOwnerMock,
}));

import { searchConversationPersistedHistory } from "./conversation-history-persisted-search-port";

describe("conversation-history-persisted-search-port", () => {
  beforeEach(() => {
    searchMessagesMock.mockReset();
    isNativeDmSqliteReadOwnerMock.mockReturnValue(false);
  });

  it("skips legacy search when native sqlite owns DM reads", async () => {
    isNativeDmSqliteReadOwnerMock.mockReturnValue(true);

    const results = await searchConversationPersistedHistory("conv-1", "alpha", 50);

    expect(results).toEqual([]);
    expect(searchMessagesMock).not.toHaveBeenCalled();
  });

  it("filters persisted hits to the requested conversation", async () => {
    searchMessagesMock.mockResolvedValue([
      {
        conversationId: "conv-1",
        message: {
          id: "m-1",
          content: "alpha match",
          timestampMs: 1_000,
          attachments: [],
        },
      },
      {
        conversationId: "conv-2",
        message: {
          id: "m-2",
          content: "alpha elsewhere",
          timestampMs: 2_000,
          attachments: [],
        },
      },
    ]);

    const results = await searchConversationPersistedHistory("conv-1", "alpha", 120);

    expect(searchMessagesMock).toHaveBeenCalledWith("alpha", 120);
    expect(results).toHaveLength(1);
    expect(results[0]?.messageId).toBe("m-1");
    expect(results[0]?.preview).toBe("alpha match");
  });
});
