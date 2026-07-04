import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation, PersistedChatState } from "@/app/features/messaging/types";

const PUBLIC_KEY = "a".repeat(64) as PublicKeyHex;

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: {
      status: "unlocked",
      publicKeyHex: PUBLIC_KEY,
      stored: { publicKeyHex: PUBLIC_KEY },
    },
  }),
}));

vi.mock("@/app/features/profiles/providers/profile-runtime-provider", () => ({
  useOptionalProfileRuntime: () => ({ profileId: "default" }),
}));

import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store-legacy";
import { addGroupTombstone, isGroupTombstoned } from "@/app/features/groups/services/group-tombstone-store";
import { loadCommunityMembershipLedger } from "@/app/features/groups/services/community-membership-ledger";
import { LegacyGroupProvider, useGroups } from "@/app/features/groups/providers/group-provider-port";

vi.mock("@/app/features/workspace-kernel/workspace-kernel-policy", () => ({
  isWorkspaceKernelAuthority: () => false,
}));

const createEmptyState = (): PersistedChatState => ({
  version: 2,
  createdConnections: [],
  createdGroups: [],
  unreadByConversationId: {},
  connectionOverridesByConnectionId: {},
  messagesByConversationId: {},
  groupMessages: {},
  connectionRequests: [],
  pinnedChatIds: [],
  hiddenChatIds: [],
});

const createGroup = (groupId: string): GroupConversation => {
  const id = `community:${groupId}:ws://localhost:7000`;
  return {
      kind: "group",
    id,
    groupId,
    relayUrl: "ws://localhost:7000",
    displayName: `Group ${groupId}`,
    memberPubkeys: [PUBLIC_KEY],
      lastMessage: "",
      unreadCount: 0,
    lastMessageTime: new Date(0),
    access: "open",
    memberCount: 1,
    adminPubkeys: [],
  };
};

describe("group-provider (visual-only stub)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    chatStateStoreService.replace(PUBLIC_KEY, createEmptyState(), { emitMutationSignal: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates sidebar group rows from chat-state metadata", async () => {
    chatStateStoreService.replace(PUBLIC_KEY, {
      ...createEmptyState(),
      createdGroups: [{
        id: "community:alpha:ws://localhost:7000",
        groupId: "alpha",
        relayUrl: "ws://localhost:7000",
        displayName: "Alpha",
        memberPubkeys: [PUBLIC_KEY],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTimeMs: 0,
        access: "open",
        memberCount: 1,
        adminPubkeys: [],
      }],
    }, { emitMutationSignal: false });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LegacyGroupProvider>{children}</LegacyGroupProvider>
    );
    const hook = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.hasHydratedGroups).toBe(true);
    });
    expect(hook.result.current.createdGroups).toHaveLength(1);
    expect(hook.result.current.createdGroups[0]?.displayName).toBe("Alpha");
    expect(hook.result.current.communityRosterByConversationId).toEqual({});
  });

  it("persists list metadata and strips group message bodies on add", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LegacyGroupProvider>{children}</LegacyGroupProvider>
    );
    const hook = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.hasHydratedGroups).toBe(true);
    });

    const group = createGroup("beta");
    await act(async () => {
      hook.result.current.addGroup(group);
    });

    const persisted = chatStateStoreService.load(PUBLIC_KEY, { profileId: "default" });
    expect(persisted?.createdGroups).toHaveLength(1);
    expect(persisted?.createdGroups[0]?.displayName).toBe("Group beta");
    expect(persisted?.groupMessages).toEqual({});
  });

  it("does not revive tombstoned groups through addGroup without relay-confirmed revive", async () => {
    const group = createGroup("revive-me");
    addGroupTombstone(PUBLIC_KEY, { groupId: group.groupId, relayUrl: group.relayUrl }, { profileId: "default" });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LegacyGroupProvider>{children}</LegacyGroupProvider>
    );
    const hook = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.hasHydratedGroups).toBe(true);
    });

    await act(async () => {
      hook.result.current.addGroup(group);
    });

    expect(hook.result.current.createdGroups).toHaveLength(0);
  });

  it("removes a group conversation from the visual list", async () => {
    const group = createGroup("gamma");
    chatStateStoreService.replace(PUBLIC_KEY, {
      ...createEmptyState(),
      createdGroups: [{
        id: group.id,
        groupId: group.groupId,
        relayUrl: group.relayUrl,
        displayName: group.displayName,
        memberPubkeys: [...group.memberPubkeys],
      lastMessage: "",
      unreadCount: 0,
        lastMessageTimeMs: 0,
        access: "open",
      memberCount: 1,
      adminPubkeys: [],
      }],
    }, { emitMutationSignal: false });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LegacyGroupProvider>{children}</LegacyGroupProvider>
    );
    const hook = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(1);
    });

    await act(async () => {
      hook.result.current.removeGroupConversation(group.id);
    });

    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(0);
    });
    expect(chatStateStoreService.load(PUBLIC_KEY, { profileId: "default" })?.createdGroups).toEqual([]);
  });

  it("forcePurgeCommunity removes zombie groups without relay confirmation", async () => {
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_RELAY_AUTHORITATIVE_MEMBERSHIP", "1");
    const group = createGroup("test-10");
    chatStateStoreService.replace(PUBLIC_KEY, {
      ...createEmptyState(),
      createdGroups: [{
        id: group.id,
        groupId: group.groupId,
        relayUrl: group.relayUrl,
        displayName: "Test 10",
        memberPubkeys: [...group.memberPubkeys],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTimeMs: 0,
        access: "open",
        memberCount: 1,
        adminPubkeys: [],
      }],
    }, { emitMutationSignal: false });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LegacyGroupProvider>{children}</LegacyGroupProvider>
    );
    const hook = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(1);
    });

    await act(async () => {
      hook.result.current.forcePurgeCommunity({
        groupId: group.groupId,
        relayUrl: group.relayUrl,
        conversationId: group.id,
      });
    });

    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(0);
    });
    expect(isGroupTombstoned(PUBLIC_KEY, { groupId: group.groupId, relayUrl: group.relayUrl }, { profileId: "default" })).toBe(true);
    expect(loadCommunityMembershipLedger(PUBLIC_KEY, { profileId: "default" }).some((entry) => entry.status === "left")).toBe(true);
    expect(chatStateStoreService.load(PUBLIC_KEY, { profileId: "default" })?.createdGroups).toEqual([]);
  });
});
