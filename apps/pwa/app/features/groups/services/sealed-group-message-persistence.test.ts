import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  loadPersistedSealedGroupMessages,
  persistSealedGroupMessages,
} from "./sealed-group-message-persistence";

const PUBLIC_KEY = "a".repeat(64) as PublicKeyHex;
const CONVERSATION_ID = "community:test8:ws://localhost:7000";
const GROUP_ID = "test8";

const chatStateStoreMocks = vi.hoisted(() => ({
  load: vi.fn(() => null as null | { groupMessages?: Record<string, ReadonlyArray<{ id: string; pubkey: string; created_at: number; content: string }>> }),
  updateGroupMessages: vi.fn(),
}));

vi.mock("@/app/features/messaging/services/chat-state-store", () => ({
  chatStateStoreService: chatStateStoreMocks,
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "profile-test",
}));

vi.mock("@dweb/db", () => ({
  isTauri: () => false,
  dbGetGroupMessages: vi.fn(),
}));

describe("sealed-group-message-persistence", () => {
  beforeEach(() => {
    chatStateStoreMocks.load.mockReset();
    chatStateStoreMocks.updateGroupMessages.mockReset();
    chatStateStoreMocks.load.mockReturnValue(null);
  });

  it("round-trips group messages through chat state per conversation", async () => {
    persistSealedGroupMessages({
      conversationId: CONVERSATION_ID,
      publicKeyHex: PUBLIC_KEY,
      messages: [{
        id: "evt-1",
        pubkey: PUBLIC_KEY,
        created_at: 1_700_000_000,
        content: "hello from B",
      }],
      profileId: "profile-test",
    });

    expect(chatStateStoreMocks.updateGroupMessages).toHaveBeenCalledWith(
      PUBLIC_KEY,
      expect.objectContaining({
        [CONVERSATION_ID]: [expect.objectContaining({ id: "evt-1", content: "hello from B" })],
      }),
    );

    chatStateStoreMocks.load.mockReturnValue({
      groupMessages: {
        [CONVERSATION_ID]: [{
          id: "evt-1",
          pubkey: PUBLIC_KEY,
          created_at: 1_700_000_000,
          content: "hello from B",
        }],
      },
    });

    const loaded = await loadPersistedSealedGroupMessages({
      conversationId: CONVERSATION_ID,
      groupId: GROUP_ID,
      publicKeyHex: PUBLIC_KEY,
      profileId: "profile-test",
    });

    expect(loaded).toEqual([{
      id: "evt-1",
      pubkey: PUBLIC_KEY,
      created_at: 1_700_000_000,
      content: "hello from B",
    }]);
  });
});
