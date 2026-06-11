import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  commitSealedGroupMessages,
  flushPendingSealedGroupSqliteWrites,
  loadPersistedSealedGroupMessages,
  resolveSealedGroupPersistenceProfileId,
  sealedGroupMessagePersistenceInternals,
} from "./sealed-group-message-persistence";

const appendMock = vi.fn(async () => ({ status: "persisted" as const, eventId: "evt-1" }));
const loadPageMock = vi.fn(async () => ({
  messages: [{
    id: "evt-1",
    eventId: "evt-1",
    kind: "user" as const,
    content: "hello",
    timestamp: new Date(1_000),
    isOutgoing: true,
    status: "delivered" as const,
    senderPubkey: "a".repeat(64),
    conversationId: "community:test",
  }],
  hasEarlier: false,
  didExpandHistory: false,
  nextCursor: null,
}));

vi.mock("@/app/features/messaging/services/thread-history/group-thread-append", () => ({
  appendGroupThreadMessage: (...args: unknown[]) => appendMock(...args),
}));

vi.mock("@/app/features/messaging/services/thread-history/group-thread-sqlite-store", () => ({
  loadGroupThreadPageFromSqlite: (...args: unknown[]) => loadPageMock(...args),
}));

vi.mock("@dweb/db", () => ({
  isTauri: vi.fn(() => true),
}));

vi.mock("@/app/features/profiles/services/read-active-desktop-profile-id", () => ({
  readActiveDesktopProfileId: vi.fn(() => "desktop-profile-slot"),
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: vi.fn(() => "web-profile-slot"),
}));

vi.mock("@/app/features/profiles/services/profile-scope", () => ({
  getDefaultProfileId: vi.fn(() => "default"),
}));

import { isTauri } from "@dweb/db";
import { readActiveDesktopProfileId } from "@/app/features/profiles/services/read-active-desktop-profile-id";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

const PUBLIC_KEY = "a".repeat(64) as PublicKeyHex;
const EVENT_ID = "b".repeat(64);

describe("sealed-group-message-persistence", () => {
  beforeEach(() => {
    appendMock.mockClear();
    loadPageMock.mockClear();
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(readActiveDesktopProfileId).mockReturnValue("desktop-profile-slot");
    vi.mocked(getResolvedProfileId).mockReturnValue("web-profile-slot");
    sealedGroupMessagePersistenceInternals.resetCommitQueueForTests();
  });

  it("commits sealed rows through appendGroupThreadMessage", async () => {
    await commitSealedGroupMessages({
      conversationId: "community:test:ws://localhost:7000",
      groupId: "test",
      publicKeyHex: PUBLIC_KEY,
      messages: [{
        id: EVENT_ID,
        pubkey: PUBLIC_KEY,
        created_at: 1,
        content: "hello",
      }],
    });

    expect(appendMock).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: "community:test:ws://localhost:7000",
      groupId: "test",
      senderPublicKeyHex: PUBLIC_KEY,
      eventId: EVENT_ID,
      plaintext: "hello",
    }));
  });

  it("resolves desktop window profile slot when profileId omitted (B3-2)", async () => {
    await commitSealedGroupMessages({
      conversationId: "community:test:ws://localhost:7000",
      groupId: "test",
      publicKeyHex: PUBLIC_KEY,
      messages: [{
        id: EVENT_ID,
        pubkey: PUBLIC_KEY,
        created_at: 1,
        content: "hello",
      }],
    });

    expect(appendMock).toHaveBeenCalledWith(expect.objectContaining({
      profileId: "desktop-profile-slot",
    }));
  });

  it("prefers explicit profileId over desktop resolver", async () => {
    await commitSealedGroupMessages({
      conversationId: "community:test:ws://localhost:7000",
      groupId: "test",
      publicKeyHex: PUBLIC_KEY,
      profileId: "explicit-slot",
      messages: [{
        id: EVENT_ID,
        pubkey: PUBLIC_KEY,
        created_at: 1,
        content: "hello",
      }],
    });

    expect(appendMock).toHaveBeenCalledWith(expect.objectContaining({
      profileId: "explicit-slot",
    }));
  });

  it("resolveSealedGroupPersistenceProfileId uses web runtime scope off native", () => {
    vi.mocked(isTauri).mockReturnValue(false);
    expect(resolveSealedGroupPersistenceProfileId()).toBe("web-profile-slot");
  });

  it("awaits in-flight sqlite writes on flush (B3-2)", async () => {
    let resolveAppend: (() => void) | undefined;
    appendMock.mockImplementationOnce(async () => new Promise((resolve) => {
      resolveAppend = resolve;
    }));

    const commitTask = commitSealedGroupMessages({
      conversationId: "community:test:ws://localhost:7000",
      groupId: "test",
      publicKeyHex: PUBLIC_KEY,
      messages: [{
        id: EVENT_ID,
        pubkey: PUBLIC_KEY,
        created_at: 1,
        content: "hello",
      }],
    });

    const flushTask = flushPendingSealedGroupSqliteWrites();
    resolveAppend?.();
    await Promise.all([commitTask, flushTask]);
    expect(appendMock).toHaveBeenCalledTimes(1);
  });

  it("loads persisted history from sqlite read path with resolved profile slot (B3-3)", async () => {
    const loaded = await loadPersistedSealedGroupMessages({
      conversationId: "community:test:ws://localhost:7000",
      groupId: "test",
      publicKeyHex: PUBLIC_KEY,
    });

    expect(loadPageMock).toHaveBeenCalledWith(expect.objectContaining({
      profileId: "desktop-profile-slot",
      myPublicKeyHex: PUBLIC_KEY,
    }));
    expect(loaded).toEqual([{
      id: "evt-1",
      pubkey: "a".repeat(64),
      created_at: 1,
      content: "hello",
    }]);
  });
});
