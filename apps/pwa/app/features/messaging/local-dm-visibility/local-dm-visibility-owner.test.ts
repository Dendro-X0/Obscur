import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const storeMocks = vi.hoisted(() => ({
  loadEvents: vi.fn(async () => []),
  redactDmTimelineEvents: vi.fn(async () => ({ redactedCount: 0 })),
  appendAccountEvents: vi.fn(async () => ({ appendedCount: 0, dedupeCount: 0, lastSequence: 0 })),
}));

vi.mock("@/app/features/account-sync/services/account-event-store", () => ({
  accountEventStore: storeMocks,
}));

vi.mock("@dweb/db", () => ({
  isTauri: () => false,
  dbDeleteMessages: vi.fn(),
  dbDeleteMessage: vi.fn(),
  dbInsertTombstone: vi.fn(),
}));

vi.mock("../services/message-delete-tombstone-store", () => ({
  hydrateMessageDeleteTombstonesFromSqlite: vi.fn(async () => undefined),
  isMessageDeleteSuppressed: vi.fn(() => false),
}));

vi.mock("@/app/features/profiles/services/default-storage-ports", () => ({
  getResolvedStoragePorts: () => ({
    messageDeleteTombstones: {
      loadSuppressedMessageDeleteIds: vi.fn(() => new Set(["hidden"])),
      suppressMessageDeleteTombstone: vi.fn(),
      hydrateMessageDeleteTombstonesFromSqlite: vi.fn(async () => undefined),
      mergeMessageDeleteTombstonesFromIndexedDb: vi.fn(async () => undefined),
    },
  }),
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "profile-1",
}));

vi.mock("../services/chat-state-store", () => ({
  chatStateStoreService: {
    removeMessageIdentitiesFromAllActiveScopes: vi.fn(),
  },
}));

vi.mock("@dweb/storage/indexed-db", () => ({
  messagingDB: { delete: vi.fn(async () => undefined) },
}));

vi.mock("@/app/features/account-sync/services/account-projection-runtime", () => ({
  accountProjectionRuntime: {
    createDmRemovedEvent: vi.fn((params: Readonly<{ messageId: string }>) => ({
      type: "DM_REMOVED_LOCALLY",
      messageId: params.messageId,
    })),
    replay: vi.fn(async () => ({})),
  },
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

import { localDmVisibilityOwner } from "./local-dm-visibility-owner";

describe("localDmVisibilityOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filterVisibleMessages removes any message whose id or eventId is suppressed", () => {
    const filtered = localDmVisibilityOwner.filterVisibleMessages([
      { id: "visible", eventId: null },
      { id: "hidden", eventId: null },
      { id: "other", eventId: "hidden" },
    ], "profile-1");

    expect(filtered).toEqual([{ id: "visible", eventId: null }]);
  });

  it("executeDeleteForMe reconciles the account event log", async () => {
    const account = "aa".repeat(32) as PublicKeyHex;
    await localDmVisibilityOwner.executeDeleteForMe({
      conversationId: "conv",
      messageIdentityIds: ["msg-1"],
      accountPublicKeyHex: account,
      profileId: "profile-1",
    });

    expect(storeMocks.redactDmTimelineEvents).toHaveBeenCalled();
  });
});
