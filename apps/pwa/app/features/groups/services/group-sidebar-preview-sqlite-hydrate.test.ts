import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupConversation } from "@/app/features/messaging/types";
import { LEDGER_ONLY_GROUP_PLACEHOLDER_MESSAGE } from "./community-membership-ledger";

const { loadGroupThreadPageFromSqliteMock } = vi.hoisted(() => ({
  loadGroupThreadPageFromSqliteMock: vi.fn(async () => ({
    messages: [],
    hasEarlier: false,
    didExpandHistory: false,
    nextCursor: null,
  })),
}));

vi.mock("@/app/features/messaging/services/thread-history/group-thread-sqlite-store", () => ({
  loadGroupThreadPageFromSqlite: loadGroupThreadPageFromSqliteMock,
}));

vi.mock("@/app/features/workspace-kernel/workspace-kernel-policy", () => ({
  isWorkspaceKernelAuthority: vi.fn(() => true),
}));

import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";
import {
  hydrateGroupSidebarPreviewFromSqlite,
  hydrateGroupSidebarPreviewsFromSqlite,
  isStaleGroupSidebarPreview,
} from "./group-sidebar-preview-sqlite-hydrate";

const baseGroup = (lastMessage: string): GroupConversation => ({
  kind: "group",
  id: "group-conv-1",
  groupId: "b93f53e23d8c4456835afd3f4d3a627b",
  relayUrl: "ws://127.0.0.1:7000",
  displayName: "NewTest 2",
  memberPubkeys: [],
  lastMessage,
  unreadCount: 0,
  lastMessageTime: new Date(0),
  access: "private",
  memberCount: 2,
  adminPubkeys: [],
});

describe("group-sidebar-preview-sqlite-hydrate", () => {
  beforeEach(() => {
    vi.mocked(isWorkspaceKernelAuthority).mockReturnValue(true);
    loadGroupThreadPageFromSqliteMock.mockReset();
    loadGroupThreadPageFromSqliteMock.mockResolvedValue({
      messages: [],
      hasEarlier: false,
      didExpandHistory: false,
      nextCursor: null,
    });
  });

  it("isStaleGroupSidebarPreview treats empty and ledger placeholder as stale", () => {
    expect(isStaleGroupSidebarPreview("")).toBe(true);
    expect(isStaleGroupSidebarPreview("   ")).toBe(true);
    expect(isStaleGroupSidebarPreview(LEDGER_ONLY_GROUP_PLACEHOLDER_MESSAGE)).toBe(true);
    expect(isStaleGroupSidebarPreview("hello")).toBe(false);
  });

  it("hydrates stale preview from latest sqlite row", async () => {
    loadGroupThreadPageFromSqliteMock.mockResolvedValue({
      messages: [{
        id: "evt-1",
        eventId: "evt-1",
        kind: "user",
        content: "R3-sidebar-preview-t4",
        timestamp: new Date("2026-07-04T12:00:00.000Z"),
        isOutgoing: true,
        status: "delivered",
        senderPubkey: "abc",
        conversationId: "group-conv-1",
      }],
      hasEarlier: false,
      didExpandHistory: false,
      nextCursor: null,
    });

    const hydrated = await hydrateGroupSidebarPreviewFromSqlite({
      group: baseGroup(""),
      publicKeyHex: "abc" as never,
      profileId: "profile-1",
    });

    expect(hydrated?.lastMessage).toBe("R3-sidebar-preview-t4");
    expect(hydrated?.lastMessageTime.toISOString()).toBe("2026-07-04T12:00:00.000Z");
    expect(loadGroupThreadPageFromSqliteMock).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: "group-conv-1",
      groupId: "b93f53e23d8c4456835afd3f4d3a627b",
      pageSize: 1,
      profileId: "profile-1",
    }));
  });

  it("skips sqlite read when preview is already populated", async () => {
    const result = await hydrateGroupSidebarPreviewFromSqlite({
      group: baseGroup("existing preview"),
      publicKeyHex: "abc" as never,
      profileId: "profile-1",
    });

    expect(result).toBeNull();
    expect(loadGroupThreadPageFromSqliteMock).not.toHaveBeenCalled();
  });

  it("returns original array reference when nothing changes", async () => {
    const groups = [baseGroup("existing preview")];
    const result = await hydrateGroupSidebarPreviewsFromSqlite({
      groups,
      publicKeyHex: "abc" as never,
      profileId: "profile-1",
    });

    expect(result).toBe(groups);
  });

  it("no-ops when workspace kernel authority is disabled", async () => {
    vi.mocked(isWorkspaceKernelAuthority).mockReturnValue(false);
    const groups = [baseGroup("")];
    const result = await hydrateGroupSidebarPreviewsFromSqlite({
      groups,
      publicKeyHex: "abc" as never,
      profileId: "profile-1",
    });

    expect(result).toBe(groups);
    expect(loadGroupThreadPageFromSqliteMock).not.toHaveBeenCalled();
  });
});
