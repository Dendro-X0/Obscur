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

const { logAppEventMock } = vi.hoisted(() => ({
  logAppEventMock: vi.fn(),
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: logAppEventMock,
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
    expect(logAppEventMock).toHaveBeenCalledWith(expect.objectContaining({
      name: "groups.membership_recovery_hydrate",
      context: expect.objectContaining({
        descriptorProjectionCount: 1,
        membershipProjectionCount: 1,
        projectionVisibleCount: 1,
        projectionJoinedCount: 1,
        projectionLedgerCount: 1,
      }),
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
        communityMode: "sovereign_room",
        relayCapabilityTier: "public_default",
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
        communityMode: "managed_workspace",
        relayCapabilityTier: "trusted_private",
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
      expect(group?.communityMode).toBe("managed_workspace");
      expect(group?.relayCapabilityTier).toBe("trusted_private");
    });
  });

  it("does not downgrade hashed community identity when runtime membership evidence is weaker", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );

    const hashedCommunityId = "v2_cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
    activePublicKeyHex = PUBLIC_KEY_A;
    const hook = renderHook(() => useGroups(), { wrapper });
    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(0);
    });

    act(() => {
      hook.result.current.addGroup({
        kind: "group",
        id: `community:${hashedCommunityId}`,
        communityId: hashedCommunityId,
        genesisEventId: "genesis-canonical",
        creatorPubkey: PUBLIC_KEY_A,
        groupId: "canonical-group",
        relayUrl: "wss://relay.canonical",
        displayName: "Canonical Group",
        memberPubkeys: [PUBLIC_KEY_A],
        lastMessage: "canonical",
        unreadCount: 0,
        lastMessageTime: new Date(1_000),
        access: "invite-only",
        memberCount: 1,
        adminPubkeys: [PUBLIC_KEY_A],
      }, { allowRevive: true });
    });

    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(1);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent("obscur:group-membership-confirmed", {
        detail: {
          groupId: "canonical-group",
          relayUrl: "wss://relay.canonical",
          communityId: "canonical-group:wss://relay.canonical",
          displayName: "Private Group",
          memberPubkeys: [PUBLIC_KEY_B],
          memberCount: 2,
          lastMessageTimeUnixMs: 2_000,
        },
      }));
    });

    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(1);
    });
    expect(hook.result.current.createdGroups[0]).toEqual(expect.objectContaining({
      id: `community:${hashedCommunityId}`,
      communityId: hashedCommunityId,
      displayName: "Canonical Group",
    }));
    expect(loadCommunityMembershipLedger(PUBLIC_KEY_A)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        groupId: "canonical-group",
        relayUrl: "wss://relay.canonical",
        communityId: hashedCommunityId,
      }),
    ]));
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

  it("backfills invite-peer membership when restored groups only contain the local member", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );

    activePublicKeyHex = PUBLIC_KEY_B;
    await act(async () => {
      await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(PUBLIC_KEY_B, {
        version: 1,
        publicKeyHex: PUBLIC_KEY_B,
        createdAtUnixMs: Date.now(),
        profile: {
          username: "b-restored-membership",
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
          communityId: "invite-peer:wss://relay.peer",
          groupId: "invite-peer",
          relayUrl: "wss://relay.peer",
          status: "joined",
          updatedAtUnixMs: 9_000,
          displayName: "Invite Peer",
        }],
        chatState: {
          ...createEmptyState(),
          createdConnections: [{
            id: `${PUBLIC_KEY_A}:${PUBLIC_KEY_B}`,
            displayName: "Peer A",
            pubkey: PUBLIC_KEY_A,
            lastMessage: "accepted",
            unreadCount: 0,
            lastMessageTimeMs: 8_500,
          }],
          createdGroups: [{
            id: "community:invite-peer:wss://relay.peer",
            communityId: "invite-peer:wss://relay.peer",
            groupId: "invite-peer",
            relayUrl: "wss://relay.peer",
            displayName: "Invite Peer",
            memberPubkeys: [PUBLIC_KEY_B],
            lastMessage: "restored self only",
            unreadCount: 0,
            lastMessageTimeMs: 9_000,
            access: "invite-only",
            memberCount: 1,
            adminPubkeys: [],
          }],
          messagesByConversationId: {
            [`${PUBLIC_KEY_A}:${PUBLIC_KEY_B}`]: [{
              id: "invite-1",
              content: JSON.stringify({
                type: "community-invite",
                groupId: "invite-peer",
                relayUrl: "wss://relay.peer",
                communityId: "invite-peer:wss://relay.peer",
                roomKey: "rk",
                metadata: { name: "Invite Peer" },
              }),
              timestampMs: 8_000,
              isOutgoing: false,
              status: "delivered",
              pubkey: PUBLIC_KEY_A,
            }, {
              id: "invite-accept-1",
              content: JSON.stringify({
                type: "community-invite-response",
                status: "accepted",
                groupId: "invite-peer",
                relayUrl: "wss://relay.peer",
                communityId: "invite-peer:wss://relay.peer",
              }),
              timestampMs: 8_200,
              isOutgoing: true,
              status: "delivered",
              pubkey: PUBLIC_KEY_B,
            }],
          },
        },
        privacySettings: PrivacySettingsService.getSettings(),
        relayList: relayListInternals.DEFAULT_RELAYS,
      }, "default", {
        restoreChatStateDomains: true,
      });
    });

    const hook = renderHook(() => useGroups(), { wrapper });
    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(1);
    });

    expect(hook.result.current.createdGroups[0]?.memberPubkeys).toEqual(expect.arrayContaining([
      PUBLIC_KEY_A,
      PUBLIC_KEY_B,
    ]));
    expect(hook.result.current.createdGroups[0]?.memberCount).toBeGreaterThanOrEqual(2);
    expect(hook.result.current.communityKnownParticipantDirectoryByConversationId["community:invite-peer:wss://relay.peer"]?.participantPubkeys).toEqual(expect.arrayContaining([
      PUBLIC_KEY_A,
      PUBLIC_KEY_B,
    ]));
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

  it("does not materialize a placeholder private group from sender-local accepted invite response restore", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );

    activePublicKeyHex = PUBLIC_KEY_B;
    await act(async () => {
      await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(PUBLIC_KEY_B, {
        version: 1,
        publicKeyHex: PUBLIC_KEY_B,
        createdAtUnixMs: Date.now(),
        profile: {
          username: "receiver-b-local-accept-only",
          about: "",
          avatarUrl: "",
          nip05: "",
          inviteCode: "",
        },
        peerTrust: { acceptedPeers: [], mutedPeers: [] },
        requestFlowEvidence: { byPeer: {} },
        requestOutbox: { records: [] },
        syncCheckpoints: [],
        chatState: {
          ...createEmptyState(),
          messagesByConversationId: {
            "dm:invite": [{
              id: "m-local-accept-only",
              content: JSON.stringify({
                type: "community-invite-response",
                status: "accepted",
                groupId: "testclub1",
                relayUrl: "wss://relay.testclub",
                communityId: "testclub1:wss://relay.testclub",
              }),
              timestampMs: 12_000,
              isOutgoing: true,
              status: "delivered",
            }],
          },
        },
        privacySettings: PrivacySettingsService.getSettings(),
        relayList: relayListInternals.DEFAULT_RELAYS,
      });
    });

    const hook = renderHook(() => useGroups(), { wrapper });
    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(0);
    });
    expect(loadCommunityMembershipLedger(PUBLIC_KEY_B)).toEqual([]);
  });

  it("updates active member roster from live membership snapshot events", async () => {
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
        id: "community:lambda:wss://relay.lambda",
        communityId: "lambda:wss://relay.lambda",
        groupId: "lambda",
        relayUrl: "wss://relay.lambda",
        displayName: "Lambda",
        memberPubkeys: [PUBLIC_KEY_A, PUBLIC_KEY_B],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTime: new Date(1_000),
        access: "invite-only",
        memberCount: 2,
        adminPubkeys: [],
      }, { allowRevive: true });
    });

    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(1);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent("obscur:group-membership-snapshot", {
        detail: {
          groupId: "lambda",
          relayUrl: "wss://relay.lambda",
          communityId: "lambda:wss://relay.lambda",
          activeMemberPubkeys: [PUBLIC_KEY_A],
          leftMembers: [PUBLIC_KEY_B],
          expelledMembers: [],
          disbandedAt: null,
        },
      }));
    });

    await waitFor(() => {
      expect(hook.result.current.communityRosterByConversationId["community:lambda:wss://relay.lambda"]?.activeMemberPubkeys).toEqual([PUBLIC_KEY_A]);
      expect(hook.result.current.createdGroups[0]?.memberPubkeys).toEqual([PUBLIC_KEY_A, PUBLIC_KEY_B]);
    });
    expect(logAppEventMock).toHaveBeenCalledWith(expect.objectContaining({
      name: "groups.membership_snapshot_projection_result",
      context: expect.objectContaining({
        conversationId: "community:lambda:wss://relay.lambda",
        groupId: "lambda",
        relayUrl: "wss://relay.lambda",
        reasonCode: "apply_snapshot",
        currentMemberCount: 2,
        incomingMemberCount: 1,
        nextMemberCount: 1,
        removedWithoutEvidenceCount: 0,
      }),
    }));
  });

  it("ignores thinner live membership snapshots that do not include leave or expel evidence", async () => {
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
        id: "community:mu:wss://relay.mu",
        communityId: "mu:wss://relay.mu",
        groupId: "mu",
        relayUrl: "wss://relay.mu",
        displayName: "Mu",
        memberPubkeys: [PUBLIC_KEY_A, PUBLIC_KEY_B],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTime: new Date(1_000),
        access: "invite-only",
        memberCount: 2,
        adminPubkeys: [],
      }, { allowRevive: true });
    });

    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(1);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent("obscur:group-membership-snapshot", {
        detail: {
          groupId: "mu",
          relayUrl: "wss://relay.mu",
          communityId: "mu:wss://relay.mu",
          activeMemberPubkeys: [PUBLIC_KEY_A],
          leftMembers: [],
          expelledMembers: [],
          disbandedAt: null,
        },
      }));
    });

    await waitFor(() => {
      expect(hook.result.current.communityRosterByConversationId["community:mu:wss://relay.mu"]?.activeMemberPubkeys).toEqual([PUBLIC_KEY_A]);
      expect(hook.result.current.communityRosterByConversationId["community:mu:wss://relay.mu"]?.memberCount).toBe(1);
      expect(hook.result.current.createdGroups[0]?.memberPubkeys).toEqual([PUBLIC_KEY_A, PUBLIC_KEY_B]);
    });
    expect(logAppEventMock).toHaveBeenCalledWith(expect.objectContaining({
      name: "groups.membership_snapshot_projection_result",
      context: expect.objectContaining({
        conversationId: "community:mu:wss://relay.mu",
        groupId: "mu",
        relayUrl: "wss://relay.mu",
        reasonCode: "apply_snapshot",
        currentMemberCount: 2,
        incomingMemberCount: 1,
        nextMemberCount: 1,
        removedWithoutEvidenceCount: 0,
      }),
    }));
  });

  it("preserves roster projection when later descriptor updates keep stale memberPubkeys", async () => {
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
        id: "community:nu:wss://relay.nu",
        communityId: "nu:wss://relay.nu",
        groupId: "nu",
        relayUrl: "wss://relay.nu",
        displayName: "Nu",
        memberPubkeys: [PUBLIC_KEY_A, PUBLIC_KEY_B],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTime: new Date(1_000),
        access: "invite-only",
        memberCount: 2,
        adminPubkeys: [],
      }, { allowRevive: true });
    });

    await waitFor(() => {
      expect(hook.result.current.communityRosterByConversationId["community:nu:wss://relay.nu"]?.activeMemberPubkeys).toEqual([PUBLIC_KEY_A, PUBLIC_KEY_B]);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent("obscur:group-membership-snapshot", {
        detail: {
          groupId: "nu",
          relayUrl: "wss://relay.nu",
          communityId: "nu:wss://relay.nu",
          activeMemberPubkeys: [PUBLIC_KEY_A],
          leftMembers: [PUBLIC_KEY_B],
          expelledMembers: [],
          disbandedAt: null,
        },
      }));
    });

    await waitFor(() => {
      expect(hook.result.current.communityRosterByConversationId["community:nu:wss://relay.nu"]?.activeMemberPubkeys).toEqual([PUBLIC_KEY_A]);
    });

    act(() => {
      hook.result.current.updateGroup({
        groupId: "nu",
        relayUrl: "wss://relay.nu",
        updates: {
          displayName: "Nu Updated",
        },
      });
    });

    await waitFor(() => {
      expect(hook.result.current.createdGroups[0]?.displayName).toBe("Nu Updated");
      expect(hook.result.current.createdGroups[0]?.memberPubkeys).toEqual([PUBLIC_KEY_A, PUBLIC_KEY_B]);
      expect(hook.result.current.communityRosterByConversationId["community:nu:wss://relay.nu"]?.activeMemberPubkeys).toEqual([PUBLIC_KEY_A]);
    });
  });

  it("keeps a stable known-participants directory after live roster narrows", async () => {
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
        id: "community:xi:wss://relay.xi",
        communityId: "xi:wss://relay.xi",
        groupId: "xi",
        relayUrl: "wss://relay.xi",
        displayName: "Xi",
        memberPubkeys: [PUBLIC_KEY_A, PUBLIC_KEY_B],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTime: new Date(1_000),
        access: "invite-only",
        memberCount: 2,
        adminPubkeys: [],
      }, { allowRevive: true });
    });

    await waitFor(() => {
      expect(hook.result.current.communityKnownParticipantDirectoryByConversationId["community:xi:wss://relay.xi"]?.participantPubkeys).toEqual([PUBLIC_KEY_A, PUBLIC_KEY_B]);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent("obscur:group-membership-snapshot", {
        detail: {
          groupId: "xi",
          relayUrl: "wss://relay.xi",
          communityId: "xi:wss://relay.xi",
          activeMemberPubkeys: [PUBLIC_KEY_A],
          leftMembers: [],
          expelledMembers: [],
          disbandedAt: null,
        },
      }));
    });

    await waitFor(() => {
      expect(hook.result.current.communityKnownParticipantDirectoryByConversationId["community:xi:wss://relay.xi"]?.participantPubkeys).toEqual([PUBLIC_KEY_A, PUBLIC_KEY_B]);
      expect(hook.result.current.communityKnownParticipantDirectoryByConversationId["community:xi:wss://relay.xi"]?.participantCount).toBe(2);
    });
  });

  it("persists richer observed known participants even when descriptor rows stay thin", async () => {
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
        id: "community:omicron:wss://relay.omicron",
        communityId: "omicron:wss://relay.omicron",
        groupId: "omicron",
        relayUrl: "wss://relay.omicron",
        displayName: "Omicron",
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
      expect(hook.result.current.communityKnownParticipantDirectoryByConversationId["community:omicron:wss://relay.omicron"]?.participantPubkeys).toEqual([PUBLIC_KEY_A]);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent("obscur:community-known-participants-observed", {
        detail: {
          groupId: "omicron",
          relayUrl: "wss://relay.omicron",
          communityId: "omicron:wss://relay.omicron",
          conversationId: "community:omicron:wss://relay.omicron",
          participantPubkeys: [PUBLIC_KEY_A, PUBLIC_KEY_B],
        },
      }));
    });

    await waitFor(() => {
      expect(hook.result.current.createdGroups[0]?.memberPubkeys).toEqual([PUBLIC_KEY_A]);
      expect(hook.result.current.communityKnownParticipantDirectoryByConversationId["community:omicron:wss://relay.omicron"]?.participantPubkeys).toEqual([PUBLIC_KEY_A, PUBLIC_KEY_B]);
      expect(hook.result.current.communityKnownParticipantDirectoryByConversationId["community:omicron:wss://relay.omicron"]?.participantCount).toBe(2);
    });
  });
});
