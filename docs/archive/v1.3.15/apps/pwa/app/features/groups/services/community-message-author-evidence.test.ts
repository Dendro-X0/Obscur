import { describe, expect, it } from "vitest";
import { collectGroupMessageAuthorPubkeys } from "./community-message-author-evidence";

describe("community-message-author-evidence", () => {
  it("collects unique author pubkeys for a community conversation", () => {
    const authors = collectGroupMessageAuthorPubkeys({
      conversationId: "community:testclub1:wss://relay.test",
      chatState: {
        version: 2,
        createdConnections: [],
        createdGroups: [],
        unreadByConversationId: {},
        connectionOverridesByConnectionId: {},
        messagesByConversationId: {},
        groupMessages: {
          "community:testclub1:wss://relay.test": [
            { id: "g1", pubkey: "a".repeat(64), content: "one", created_at: 10 },
            { id: "g2", pubkey: "b".repeat(64), content: "two", created_at: 20 },
            { id: "g3", pubkey: "a".repeat(64), content: "three", created_at: 30 },
          ],
        },
        connectionRequests: [],
        pinnedChatIds: [],
        hiddenChatIds: [],
      },
    });

    expect(authors).toEqual(["a".repeat(64), "b".repeat(64)]);
  });

  it("returns an empty list when no group messages are stored for the conversation", () => {
    const authors = collectGroupMessageAuthorPubkeys({
      conversationId: "community:testclub1:wss://relay.test",
      chatState: null,
    });

    expect(authors).toEqual([]);
  });
});
