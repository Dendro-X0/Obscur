import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const dbMocks = vi.hoisted(() => ({
  isTauri: vi.fn(() => true),
  dbInsertMessage: vi.fn(async () => undefined),
}));

vi.mock("@dweb/db", () => dbMocks);

const chatStateMocks = vi.hoisted(() => ({
  load: vi.fn(),
}));

vi.mock("./chat-state-store", () => ({
  chatStateStoreService: chatStateMocks,
}));

vi.mock("@/app/features/profiles/services/account-shared-sqlite-profile-ids", () => ({
  listAccountSharedSqliteProfileIds: vi.fn(() => ["profile-secondary", "default"]),
}));

import { loadNativeOutgoingChatStateRepairMessages } from "./dm-conversation-native-outgoing-repair";

const myPk = "a".repeat(64) as PublicKeyHex;
const peerPk = "b".repeat(64) as PublicKeyHex;
const conversationId = `${myPk}:${peerPk}`;

describe("loadNativeOutgoingChatStateRepairMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.isTauri.mockReturnValue(true);
  });

  it("repairs outgoing user messages from profile-scoped chat-state and backfills sqlite", () => {
    chatStateMocks.load.mockImplementation((_pk: string, options?: Readonly<{ profileId?: string }>) => (
      options?.profileId === "profile-secondary"
        ? {
          messagesByConversationId: {
            [conversationId]: [{
              id: "evt-out-1",
              eventId: "evt-out-1",
              content: "hello from B",
              timestampMs: 1_700_000_000_000,
              isOutgoing: true,
              pubkey: myPk,
              senderPubkey: myPk,
              recipientPubkey: peerPk,
            }],
          },
        }
        : null
    ));

    const repaired = loadNativeOutgoingChatStateRepairMessages({
      conversationIds: [conversationId],
      myPublicKeyHex: myPk,
      profileId: "profile-secondary",
    });

    expect(repaired).toHaveLength(1);
    expect(repaired[0]?.id).toBe("evt-out-1");
    expect(dbMocks.dbInsertMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: "evt-out-1",
        profile_id: "profile-secondary",
        is_outgoing: true,
      }),
    );
  });

  it("merges outgoing rows from chat-state across profile slots for the same account", () => {
    chatStateMocks.load.mockImplementation((_pk: string, options?: Readonly<{ profileId?: string }>) => {
      if (options?.profileId === "profile-secondary") {
        return {
          messagesByConversationId: {
            [conversationId]: [{
              id: "evt-out-1",
              eventId: "evt-out-1",
              content: "from secondary slot",
              timestampMs: 1_700_000_000_000,
              isOutgoing: true,
              pubkey: myPk,
            }],
          },
        };
      }
      if (options?.profileId === "default") {
        return {
          messagesByConversationId: {
            [conversationId]: [{
              id: "evt-out-default",
              eventId: "evt-out-default",
              content: "from default slot",
              timestampMs: 1_700_000_000_001,
              isOutgoing: true,
              pubkey: myPk,
            }],
          },
        };
      }
      return null;
    });

    const repaired = loadNativeOutgoingChatStateRepairMessages({
      conversationIds: [conversationId],
      myPublicKeyHex: myPk,
      profileId: "profile-secondary",
    });

    expect(repaired.map((row) => row.id).sort()).toEqual(["evt-out-1", "evt-out-default"]);
  });

  it("repairs outgoing chat-state rows on web without sqlite backfill", () => {
    dbMocks.isTauri.mockReturnValue(false);
    chatStateMocks.load.mockReturnValue({
      messagesByConversationId: {
        [conversationId]: [{
          id: "evt-out-web",
          eventId: "evt-out-web",
          content: "hello from web",
          timestampMs: 1_700_000_000_000,
          isOutgoing: true,
          pubkey: myPk,
        }],
      },
    });

    const repaired = loadNativeOutgoingChatStateRepairMessages({
      conversationIds: [conversationId],
      myPublicKeyHex: myPk,
      profileId: "default",
    });

    expect(repaired).toHaveLength(1);
    expect(repaired[0]?.id).toBe("evt-out-web");
    expect(dbMocks.dbInsertMessage).not.toHaveBeenCalled();
  });
});
