import { beforeEach, describe, expect, it, vi } from "vitest";
import { suppressGroupThreadMessage } from "./group-thread-suppress";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@dweb/db", () => ({
  isTauri: vi.fn(() => true),
  dbInsertGroupTombstone: vi.fn(async () => undefined),
}));

vi.mock("@/app/features/profiles/services/account-shared-sqlite-profile-ids", () => ({
  listAccountSharedSqliteProfileIds: vi.fn(() => ["profile-1"]),
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: vi.fn(() => "profile-1"),
}));

const dispatchMock = vi.fn();
vi.mock("./group-thread-messages-changed", () => ({
  dispatchGroupThreadMessagesChanged: (...args: unknown[]) => dispatchMock(...args),
}));

const emitDeletedMock = vi.fn();
vi.mock("@/app/features/messaging/services/message-bus", () => ({
  messageBus: {
    emitMessageDeleted: (...args: unknown[]) => emitDeletedMock(...args),
  },
}));

import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { dbInsertGroupTombstone, isTauri } from "@dweb/db";

describe("suppressGroupThreadMessage", () => {
  beforeEach(() => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(dbInsertGroupTombstone).mockClear();
    dispatchMock.mockClear();
    emitDeletedMock.mockClear();
  });

  it("inserts sqlite tombstones and notifies thread listeners", async () => {
    const eventId = "a".repeat(64);
    const deletedBy = "b".repeat(64);

    const result = await suppressGroupThreadMessage({
      conversationId: "community:group-1",
      groupId: "group-1",
      primaryMessageId: eventId,
      messageIdentityIds: [eventId],
      deletedByPublicKeyHex: deletedBy as never,
    });

    expect(result).toEqual({ status: "suppressed", eventIds: [eventId] });
    expect(dbInsertGroupTombstone).toHaveBeenCalledWith(expect.objectContaining({
      event_id: eventId,
      profile_id: "profile-1",
      deleted_by: deletedBy,
    }));
    expect(emitDeletedMock).toHaveBeenCalledWith(
      "community:group-1",
      eventId,
      expect.objectContaining({ messageIdentityIds: [eventId] }),
    );
    expect(dispatchMock).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: "community:group-1",
      groupId: "group-1",
    }));
  });

  it("suspends when no event ids are provided", async () => {
    const result = await suppressGroupThreadMessage({
      conversationId: "community:group-1",
      groupId: "group-1",
      primaryMessageId: "   ",
      messageIdentityIds: [],
      deletedByPublicKeyHex: "b".repeat(64) as never,
    });
    expect(result).toEqual({ status: "suspended" });
    expect(dbInsertGroupTombstone).not.toHaveBeenCalled();
  });
});
