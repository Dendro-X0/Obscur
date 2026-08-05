import { beforeEach, describe, expect, it, vi } from "vitest";
import { appendGroupThreadMessage } from "./group-thread-append";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@dweb/db", () => ({
  isTauri: vi.fn(() => true),
}));

vi.mock("./workspace-group-message-persist-port", () => ({
  insertWorkspaceGroupMessageRecord: vi.fn(async () => undefined),
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: vi.fn(() => "profile-1"),
}));

const dispatchMock = vi.fn();
vi.mock("./group-thread-messages-changed", () => ({
  dispatchGroupThreadMessagesChanged: (...args: unknown[]) => dispatchMock(...args),
}));

import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { isTauri } from "@dweb/db";
import { insertWorkspaceGroupMessageRecord } from "./workspace-group-message-persist-port";

describe("appendGroupThreadMessage", () => {
  beforeEach(() => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(insertWorkspaceGroupMessageRecord).mockClear();
    dispatchMock.mockClear();
  });

  it("persists confirmed group messages to sqlite on native", async () => {
    const eventId = "a".repeat(64);
    const result = await appendGroupThreadMessage({
      conversationId: "community:group-1",
      groupId: "group-1",
      senderPublicKeyHex: "b".repeat(64) as never,
      plaintext: "hello group",
      eventId,
    });

    expect(result).toEqual({ status: "persisted", eventId });
    expect(insertWorkspaceGroupMessageRecord).toHaveBeenCalledWith(expect.objectContaining({
      event_id: eventId,
      group_id: "group-1",
      profile_id: "profile-1",
      plaintext: "hello group",
    }));
    expect(dispatchMock).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: "community:group-1",
      profileId: "profile-1",
      groupId: "group-1",
    }));
  });

  it("suspends uuid-only optimistic rows", async () => {
    const result = await appendGroupThreadMessage({
      conversationId: "community:group-1",
      groupId: "group-1",
      senderPublicKeyHex: "b".repeat(64) as never,
      plaintext: "pending",
      eventId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result).toEqual({ status: "suspended" });
    expect(insertWorkspaceGroupMessageRecord).not.toHaveBeenCalled();
  });

  it("suspends on web runtimes", async () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
    const result = await appendGroupThreadMessage({
      conversationId: "community:group-1",
      groupId: "group-1",
      senderPublicKeyHex: "b".repeat(64) as never,
      plaintext: "hello",
      eventId: "c".repeat(64),
    });
    expect(result).toEqual({ status: "suspended" });
    expect(insertWorkspaceGroupMessageRecord).not.toHaveBeenCalled();
  });
});
