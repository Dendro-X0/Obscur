import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PersistedChatState } from "@/app/features/messaging/types";

const PUBLIC_KEY_A = "a".repeat(64) as PublicKeyHex;
const PUBLIC_KEY_B = "b".repeat(64) as PublicKeyHex;
let activePublicKeyHex: PublicKeyHex = PUBLIC_KEY_A;

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: {
      status: "unlocked",
      publicKeyHex: activePublicKeyHex,
      stored: { publicKeyHex: activePublicKeyHex },
    },
  }),
}));

vi.mock("@/app/shared/account-sync-mutation-signal", () => ({
  emitAccountSyncMutation: vi.fn(),
}));

vi.mock("@dweb/storage/indexed-db", () => ({
  messagingDB: {
    put: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    ensureDB: vi.fn(),
  },
}));

import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import { loadCommunityMembershipLedger, setCommunityMembershipStatus } from "../services/community-membership-ledger";
import { GroupProvider, useGroups } from "./group-provider";
import { encryptedAccountBackupServiceInternals } from "@/app/features/account-sync/services/encrypted-account-backup-service";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { relayListInternals } from "@/app/features/relays/hooks/use-relay-list";

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

describe("group-provider membership ledger integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    setProfileScopeOverride(null);
    activePublicKeyHex = PUBLIC_KEY_A;
    chatStateStoreService.replace(PUBLIC_KEY_A, createEmptyState(), { emitMutationSignal: false });
    chatStateStoreService.replace(PUBLIC_KEY_B, createEmptyState(), { emitMutationSignal: false });
  });

  it("hydrates joined groups from membership ledger when chat-state groups are missing", async () => {
    setCommunityMembershipStatus(PUBLIC_KEY_A, {
      groupId: "alpha",
      relayUrl: "wss://relay.alpha",
      communityId: "alpha:wss://relay.alpha",
      status: "joined",
      updatedAtUnixMs: 1_000,
      displayName: "Alpha",
    });

    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );
    const { result } = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => {
      expect(result.current.createdGroups).toHaveLength(1);
    });
    expect(result.current.createdGroups[0]).toEqual(expect.objectContaining({
      groupId: "alpha",
      relayUrl: "wss://relay.alpha",
      displayName: "Alpha",
    }));
    expect(chatStateStoreService.load(PUBLIC_KEY_A)?.createdGroups).toHaveLength(1);
  });

  it("suppresses persisted group visibility when ledger membership is left", async () => {
    chatStateStoreService.replace(PUBLIC_KEY_A, {
      ...createEmptyState(),
      createdGroups: [{
        id: "community:alpha:wss://relay.alpha",
        communityId: "alpha:wss://relay.alpha",
        groupId: "alpha",
        relayUrl: "wss://relay.alpha",
        displayName: "Alpha",
        memberPubkeys: [PUBLIC_KEY_A],
        lastMessage: "legacy persisted",
        unreadCount: 0,
        lastMessageTimeMs: 1_000,
        access: "invite-only",
        memberCount: 1,
        adminPubkeys: [],
      }],
    }, { emitMutationSignal: false });
    setCommunityMembershipStatus(PUBLIC_KEY_A, {
      groupId: "alpha",
      relayUrl: "wss://relay.alpha",
      communityId: "alpha:wss://relay.alpha",
      status: "left",
      updatedAtUnixMs: 2_000,
      displayName: "Alpha",
    });

    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );
    const { result } = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => {
      expect(result.current.createdGroups).toHaveLength(0);
    });
    const ledger = loadCommunityMembershipLedger(PUBLIC_KEY_A);
    expect(ledger).toEqual([
      expect.objectContaining({
        groupId: "alpha",
        relayUrl: "wss://relay.alpha",
        status: "left",
      }),
    ]);
  });

  it("refreshes mounted provider from ledger updates and preserves leave status across remount", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );
    const first = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => {
      expect(first.result.current.createdGroups).toHaveLength(0);
    });

    act(() => {
      setCommunityMembershipStatus(PUBLIC_KEY_A, {
        groupId: "beta",
        relayUrl: "wss://relay.beta",
        communityId: "beta:wss://relay.beta",
        status: "joined",
        updatedAtUnixMs: 2_000,
        displayName: "Beta",
      });
    });

    await waitFor(() => {
      expect(first.result.current.createdGroups).toHaveLength(1);
    });

    act(() => {
      first.result.current.leaveGroup({
        groupId: "beta",
        relayUrl: "wss://relay.beta",
      });
    });

    await waitFor(() => {
      expect(first.result.current.createdGroups).toHaveLength(0);
    });

    const ledgerAfterLeave = loadCommunityMembershipLedger(PUBLIC_KEY_A);
    expect(ledgerAfterLeave).toEqual([
      expect.objectContaining({
        groupId: "beta",
        relayUrl: "wss://relay.beta",
        status: "left",
      }),
    ]);

    first.unmount();
    const second = renderHook(() => useGroups(), { wrapper });
    await waitFor(() => {
      expect(second.result.current.createdGroups).toHaveLength(0);
    });
  });

  it("refreshes mounted provider when backup restore writes membership ledger", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );
    const { result } = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => {
      expect(result.current.createdGroups).toHaveLength(0);
    });

    await act(async () => {
      await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(PUBLIC_KEY_A, {
        version: 1,
        publicKeyHex: PUBLIC_KEY_A,
        createdAtUnixMs: Date.now(),
        profile: {
          username: "restored-user",
          about: "",
          avatarUrl: "",
          nip05: "",
          inviteCode: "",
        },
        peerTrust: { acceptedPeers: [], mutedPeers: [] },
        requestFlowEvidence: { byPeer: {} },
        requestOutbox: { records: [] },
        syncCheckpoints: [],
        communityMembershipLedger: [{
          communityId: "gamma:wss://relay.gamma",
          groupId: "gamma",
          relayUrl: "wss://relay.gamma",
          status: "joined",
          updatedAtUnixMs: 3_000,
          displayName: "Gamma",
        }],
        chatState: {
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
        },
        privacySettings: PrivacySettingsService.getSettings(),
        relayList: relayListInternals.DEFAULT_RELAYS,
      });
    });

    await waitFor(() => {
      expect(result.current.createdGroups).toHaveLength(1);
    });
    expect(result.current.createdGroups[0]).toEqual(expect.objectContaining({
      groupId: "gamma",
      relayUrl: "wss://relay.gamma",
      displayName: "Gamma",
    }));
  });

  it("refreshes mounted provider when delayed backup reconstructs membership from chat-state evidence", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );
    const { result } = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => {
      expect(result.current.createdGroups).toHaveLength(0);
    });

    await act(async () => {
      await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(PUBLIC_KEY_A, {
        version: 1,
        publicKeyHex: PUBLIC_KEY_A,
        createdAtUnixMs: Date.now(),
        profile: {
          username: "restored-user",
          about: "",
          avatarUrl: "",
          nip05: "",
          inviteCode: "",
        },
        peerTrust: { acceptedPeers: [], mutedPeers: [] },
        requestFlowEvidence: { byPeer: {} },
        requestOutbox: { records: [] },
        syncCheckpoints: [],
        // No explicit membership ledger in this delayed snapshot.
        chatState: {
          version: 2,
          createdConnections: [],
          createdGroups: [{
            id: "community:theta:wss://relay.theta",
            communityId: "theta:wss://relay.theta",
            groupId: "theta",
            relayUrl: "wss://relay.theta",
            displayName: "Theta",
            memberPubkeys: [PUBLIC_KEY_A],
            lastMessage: "restored group evidence",
            unreadCount: 0,
            lastMessageTimeMs: 6_000,
            access: "invite-only",
            memberCount: 1,
            adminPubkeys: [],
          }],
          unreadByConversationId: {},
          connectionOverridesByConnectionId: {},
          messagesByConversationId: {},
          groupMessages: {},
          connectionRequests: [],
          pinnedChatIds: [],
          hiddenChatIds: [],
        },
        privacySettings: PrivacySettingsService.getSettings(),
        relayList: relayListInternals.DEFAULT_RELAYS,
      });
    });

    await waitFor(() => {
      expect(result.current.createdGroups).toHaveLength(1);
    });
    expect(result.current.createdGroups[0]).toEqual(expect.objectContaining({
      groupId: "theta",
      relayUrl: "wss://relay.theta",
      communityId: "theta:wss://relay.theta",
    }));
  });

  it("converges A invite-accept evidence and B restore into the same community identity", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );

    activePublicKeyHex = PUBLIC_KEY_A;
    const accountAHook = renderHook(() => useGroups(), { wrapper });
    await waitFor(() => {
      expect(accountAHook.result.current.createdGroups).toHaveLength(0);
    });

    act(() => {
      accountAHook.result.current.addGroup({
        kind: "group",
        id: "community:delta:wss://relay.delta",
        communityId: "delta:wss://relay.delta",
        groupId: "delta",
        relayUrl: "wss://relay.delta",
        displayName: "Delta",
        memberPubkeys: [PUBLIC_KEY_A],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTime: new Date(1_000),
        access: "invite-only",
        memberCount: 1,
        adminPubkeys: [],
      }, { allowRevive: true });
    });
    await waitFor(() => {
      expect(accountAHook.result.current.createdGroups).toHaveLength(1);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent("obscur:group-invite-response-accepted", {
        detail: {
          groupId: "delta",
          relayUrl: "wss://relay.delta",
          communityId: "delta:wss://relay.delta",
          memberPubkey: PUBLIC_KEY_B,
        },
      }));
    });
    await waitFor(() => {
      const members = accountAHook.result.current.createdGroups[0]?.memberPubkeys ?? [];
      expect(members).toContain(PUBLIC_KEY_B);
    });

    await act(async () => {
      await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(PUBLIC_KEY_B, {
        version: 1,
        publicKeyHex: PUBLIC_KEY_B,
        createdAtUnixMs: Date.now(),
        profile: {
          username: "b-restored",
          about: "",
          avatarUrl: "",
          nip05: "",
          inviteCode: "",
        },
        peerTrust: { acceptedPeers: [], mutedPeers: [] },
        requestFlowEvidence: { byPeer: {} },
        requestOutbox: { records: [] },
        syncCheckpoints: [],
        communityMembershipLedger: [{
          communityId: "delta:wss://relay.delta",
          groupId: "delta",
          relayUrl: "wss://relay.delta",
          status: "joined",
          updatedAtUnixMs: 4_000,
          displayName: "Delta",
        }],
        chatState: createEmptyState(),
        privacySettings: PrivacySettingsService.getSettings(),
        relayList: relayListInternals.DEFAULT_RELAYS,
      });
    });

    activePublicKeyHex = PUBLIC_KEY_B;
    const accountBHook = renderHook(() => useGroups(), { wrapper });
    await waitFor(() => {
      expect(accountBHook.result.current.createdGroups).toHaveLength(1);
    });
    const bGroup = accountBHook.result.current.createdGroups[0];
    expect(bGroup).toEqual(expect.objectContaining({
      groupId: "delta",
      relayUrl: "wss://relay.delta",
      communityId: "delta:wss://relay.delta",
    }));
    expect(bGroup?.id.startsWith("community:")).toBe(true);
    expect(bGroup?.id).not.toBe(PUBLIC_KEY_A);
    expect(bGroup?.id).not.toBe(PUBLIC_KEY_B);
  });

  it("does not create fallback groups from invite-accept events when no matching group is loaded", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );

    activePublicKeyHex = PUBLIC_KEY_A;
    const hook = renderHook(() => useGroups(), { wrapper });
    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(0);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent("obscur:group-invite-response-accepted", {
        detail: {
          groupId: "orphan-group",
          relayUrl: "wss://relay.orphan",
          communityId: "orphan-group:wss://relay.orphan",
          memberPubkey: PUBLIC_KEY_B,
        },
      }));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(hook.result.current.createdGroups).toHaveLength(0);
    expect(loadCommunityMembershipLedger(PUBLIC_KEY_A)).toHaveLength(0);
  });

  it("self-heals missing local member entry when invite-accept updates an existing group", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );

    activePublicKeyHex = PUBLIC_KEY_A;
    const hook = renderHook(() => useGroups(), { wrapper });
    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(0);
    });

    act(() => {
      hook.result.current.addGroup({
        kind: "group",
        id: "community:self-heal:wss://relay.self",
        communityId: "self-heal:wss://relay.self",
        groupId: "self-heal",
        relayUrl: "wss://relay.self",
        displayName: "Self Heal",
        memberPubkeys: [PUBLIC_KEY_B],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTime: new Date(1_000),
        access: "invite-only",
        memberCount: 1,
        adminPubkeys: [],
      }, { allowRevive: true });
    });

    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(1);
    });
    expect(hook.result.current.createdGroups[0]?.memberPubkeys).toEqual(
      expect.arrayContaining([PUBLIC_KEY_B]),
    );

    act(() => {
      window.dispatchEvent(new CustomEvent("obscur:group-invite-response-accepted", {
        detail: {
          groupId: "self-heal",
          relayUrl: "wss://relay.self",
          communityId: "self-heal:wss://relay.self",
          memberPubkey: PUBLIC_KEY_B,
        },
      }));
    });

    await waitFor(() => {
      const members = hook.result.current.createdGroups[0]?.memberPubkeys ?? [];
      expect(members).toEqual(expect.arrayContaining([PUBLIC_KEY_A, PUBLIC_KEY_B]));
    });
  });

  it("merges richer metadata when addGroup is called for an existing community row", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );

    activePublicKeyHex = PUBLIC_KEY_A;
    const hook = renderHook(() => useGroups(), { wrapper });
    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(0);
    });

    act(() => {
      hook.result.current.addGroup({
        kind: "group",
        id: "community:merge-me:wss://relay.merge",
        communityId: "merge-me:wss://relay.merge",
        groupId: "merge-me",
        relayUrl: "wss://relay.merge",
        displayName: "Private Group",
        memberPubkeys: [PUBLIC_KEY_B],
        lastMessage: "older",
        unreadCount: 0,
        lastMessageTime: new Date(1_000),
        access: "invite-only",
        memberCount: 1,
        adminPubkeys: [],
      }, { allowRevive: true });
    });

    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(1);
    });
    expect(hook.result.current.createdGroups[0]?.displayName).toBe("Private Group");

    act(() => {
      hook.result.current.addGroup({
        kind: "group",
        id: "community:merge-me:wss://relay.merge",
        communityId: "merge-me:wss://relay.merge",
        groupId: "merge-me",
        relayUrl: "wss://relay.merge",
        displayName: "Merge Me",
        memberPubkeys: [PUBLIC_KEY_B, "c".repeat(64)],
        lastMessage: "newer",
        unreadCount: 0,
        lastMessageTime: new Date(3_000),
        access: "discoverable",
        memberCount: 2,
        adminPubkeys: [PUBLIC_KEY_A],
        avatar: "https://cdn.example/avatar.png",
      }, { allowRevive: true });
    });

    await waitFor(() => {
      const group = hook.result.current.createdGroups[0];
      expect(group?.displayName).toBe("Merge Me");
      expect(group?.memberPubkeys).toEqual(expect.arrayContaining([PUBLIC_KEY_A, PUBLIC_KEY_B, "c".repeat(64)]));
      expect(group?.adminPubkeys).toEqual(expect.arrayContaining([PUBLIC_KEY_A]));
      expect(group?.avatar).toBe("https://cdn.example/avatar.png");
      expect(group?.access).toBe("discoverable");
      expect(group?.memberCount).toBeGreaterThanOrEqual(3);
    });
  });

  it("keeps restored groups visible after profile scope rebinding on a fresh device", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );

    setProfileScopeOverride("bootstrap");
    await act(async () => {
      await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(PUBLIC_KEY_B, {
        version: 1,
        publicKeyHex: PUBLIC_KEY_B,
        createdAtUnixMs: Date.now(),
        profile: {
          username: "b-restored",
          about: "",
          avatarUrl: "",
          nip05: "",
          inviteCode: "",
        },
        peerTrust: { acceptedPeers: [], mutedPeers: [] },
        requestFlowEvidence: { byPeer: {} },
        requestOutbox: { records: [] },
        syncCheckpoints: [],
        communityMembershipLedger: [{
          communityId: "scope-drill:wss://relay.scope",
          groupId: "scope-drill",
          relayUrl: "wss://relay.scope",
          status: "joined",
          updatedAtUnixMs: 5_000,
          displayName: "Scope Drill",
        }],
        chatState: createEmptyState(),
        privacySettings: PrivacySettingsService.getSettings(),
        relayList: relayListInternals.DEFAULT_RELAYS,
      });
    });

    setProfileScopeOverride("default");
    activePublicKeyHex = PUBLIC_KEY_B;
    const accountBHook = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => {
      expect(accountBHook.result.current.createdGroups).toHaveLength(1);
    });
    expect(accountBHook.result.current.createdGroups[0]).toEqual(expect.objectContaining({
      groupId: "scope-drill",
      relayUrl: "wss://relay.scope",
      communityId: "scope-drill:wss://relay.scope",
    }));
  });

  it("hydrates missing groups from runtime membership-confirmed evidence", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );
    activePublicKeyHex = PUBLIC_KEY_A;
    const { result } = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => {
      expect(result.current.createdGroups).toHaveLength(0);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent("obscur:group-membership-confirmed", {
        detail: {
          groupId: "omega",
          relayUrl: "wss://relay.omega",
          displayName: "Omega",
          access: "discoverable",
          memberPubkeys: [PUBLIC_KEY_B],
          adminPubkeys: [PUBLIC_KEY_A],
          memberCount: 2,
          lastMessageTimeUnixMs: 7_000,
        },
      }));
    });

    await waitFor(() => {
      expect(result.current.createdGroups).toHaveLength(1);
    });
    expect(result.current.createdGroups[0]).toEqual(expect.objectContaining({
      groupId: "omega",
      relayUrl: "wss://relay.omega",
      displayName: "Omega",
      access: "discoverable",
    }));
    expect(result.current.createdGroups[0]?.memberPubkeys).toEqual(expect.arrayContaining([
      PUBLIC_KEY_A,
      PUBLIC_KEY_B,
    ]));
    expect(loadCommunityMembershipLedger(PUBLIC_KEY_A)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        groupId: "omega",
        relayUrl: "wss://relay.omega",
        status: "joined",
      }),
    ]));
  });
});
