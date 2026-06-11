import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useGroupThreadMessages } from "./use-group-thread-messages";
import type { GroupConversation } from "../types";

const loadGroupThreadPageFromSqliteMock = vi.fn(async () => ({
  messages: [{ id: "group-msg-1" }],
  hasEarlier: false,
  didExpandHistory: false,
  nextCursor: null,
}));

vi.mock("../services/thread-history/group-thread-sqlite-store", () => ({
  loadGroupThreadPageFromSqlite: (...args: unknown[]) => loadGroupThreadPageFromSqliteMock(...args),
  loadGroupThreadEarlierFromSqlite: vi.fn(async () => ({
    messages: [],
    hasEarlier: false,
    didExpandHistory: false,
    nextCursor: null,
  })),
}));

const groupConversation: GroupConversation = {
  kind: "group",
  id: "community:group-1",
  communityId: "group-1",
  groupId: "group-1",
  relayUrl: "wss://localhost:7000",
  displayName: "Group 1",
  memberPubkeys: [],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(),
  access: "open",
  memberCount: 1,
  adminPubkeys: [],
};

describe("useGroupThreadMessages", () => {
  beforeEach(() => {
    loadGroupThreadPageFromSqliteMock.mockClear();
  });

  it("hydrates group threads from sqlite read path", async () => {
    const { result } = renderHook(() => useGroupThreadMessages(groupConversation, "a".repeat(64)));

    await waitFor(() => {
      expect(result.current.hasHydrated).toBe(true);
    });

    expect(loadGroupThreadPageFromSqliteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "community:group-1",
        groupId: "group-1",
        communityId: "group-1",
      }),
    );
    expect(result.current.messages).toEqual([{ id: "group-msg-1" }]);
    expect(result.current.hasEarlier).toBe(false);
  });
});
