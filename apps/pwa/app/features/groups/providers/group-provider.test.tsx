import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation, PersistedChatState } from "@/app/features/messaging/types";

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

const groupProviderTestBus = vi.hoisted(() => {
  const { createProfileMessageBus } =
    require("@dweb/core/profile-message-bus") as typeof import("@dweb/core/profile-message-bus");
  return createProfileMessageBus({ profileId: "default" });
});

const { mockRuntimeProfileIdRef } = vi.hoisted(() => ({
  mockRuntimeProfileIdRef: { current: "default" as string },
}));

vi.mock("@/app/features/profiles/providers/profile-runtime-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/features/profiles/providers/profile-runtime-provider")>();
  const { getResolvedStoragePorts } = await import("@/app/features/profiles/services/default-storage-ports");
  const { getResolvedClientGateway } = await import("@/app/features/profiles/services/resolve-client-gateway");
  return {
    ...actual,
    useOptionalProfileMessageBus: () => groupProviderTestBus,
    useOptionalProfileRuntime: () => ({
      profileId: mockRuntimeProfileIdRef.current,
      bus: groupProviderTestBus,
      storagePorts: getResolvedStoragePorts(),
      clientGateway: getResolvedClientGateway(),
    }),
  };
});

import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import {
  communityMembershipLedgerInternals,
  loadCommunityMembershipLedger,
  saveCommunityMembershipLedger,
} from "../services/community-membership-ledger";
import { GroupProvider, useGroups } from "./group-provider";
import { encryptedAccountBackupServiceInternals } from "@/app/features/account-sync/services/encrypted-account-backup-service";
import {
  dispatchCommunityKnownParticipantsObserved,
  dispatchGroupInviteResponseAccepted,
  dispatchGroupInviteResponseTerminal,
  dispatchGroupMembershipConfirmed,
  dispatchGroupMembershipSnapshot,
} from "@/app/features/profiles/services/profile-bus-dispatch";
import { loadCommunityTerminalMembershipCache } from "../services/community-terminal-membership-cache";
import { setProfileRuntimeScope } from "@/app/features/profiles/services/profile-runtime-scope";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { relayListInternals } from "@/app/features/relays/hooks/use-relay-list";

const { setCommunityMembershipStatus } = communityMembershipLedgerInternals;

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
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH", "0");
    window.localStorage.clear();
    vi.clearAllMocks();
    setProfileScopeOverride(null);
    mockRuntimeProfileIdRef.current = "default";
    setProfileRuntimeScope({ profileId: "default", bus: groupProviderTestBus });
    activePublicKeyHex = PUBLIC_KEY_A;
    chatStateStoreService.replace(PUBLIC_KEY_A, createEmptyState(), { emitMutationSignal: false });
    chatStateStoreService.replace(PUBLIC_KEY_B, createEmptyState(), { emitMutationSignal: false });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it("hydrates groups inferred from groupMessages when createdGroups rows were wiped", async () => {
    chatStateStoreService.replace(PUBLIC_KEY_A, {
      ...createEmptyState(),
      createdGroups: [],
      groupMessages: {
        "community:delta:wss://relay.delta": [{
          id: "g-delta-1",
          pubkey: PUBLIC_KEY_A,
          created_at: 9_000,
          content: "still here after wipe",
        }],
      },
    }, { emitMutationSignal: false });

    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );
    const { result } = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => {
      expect(result.current.createdGroups).toHaveLength(1);
    });
    expect(result.current.createdGroups[0]).toEqual(expect.objectContaining({
      groupId: "delta",
      relayUrl: "wss://relay.delta",
    }));
    expect(chatStateStoreService.load(PUBLIC_KEY_A)?.createdGroups).toHaveLength(1);
  });

  it("recordMembershipLedgerAfterInviteDecline writes terminal left ledger entry", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );
    const { result } = renderHook(() => useGroups(), { wrapper });

    const group: GroupConversation = {
      kind: "group",
      id: "community:decline-test:wss://relay.decline",
      communityId: "decline-test:wss://relay.decline",
      groupId: "decline-test",
      relayUrl: "wss://relay.decline",
      creatorPubkey: PUBLIC_KEY_B,
      genesisEventId: "ev1",
      displayName: "Decline G",
      memberPubkeys: [PUBLIC_KEY_A, PUBLIC_KEY_B],
      adminPubkeys: [PUBLIC_KEY_B],
      lastMessage: "",
      unreadCount: 0,
      lastMessageTime: new Date(),
      access: "invite-only",
      memberCount: 2,
    };

    await act(async () => {
      result.current.recordMembershipLedgerAfterInviteDecline(group);
    });

    const ledger = loadCommunityMembershipLedger(PUBLIC_KEY_A, { profileId: "default" });
    expect(ledger.some((e) => e.groupId === "decline-test" && e.status === "left")).toBe(true);
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

  it("REL-003: profile scope switch re-hydrates without stale groups when public key is unchanged", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );
    const group = {
      kind: "group" as const,
      id: "community:rel003:wss://relay.rel003",
      communityId: "rel003:wss://relay.rel003",
      groupId: "rel003",
      relayUrl: "wss://relay.rel003",
      displayName: "REL003 Group",
      memberPubkeys: [PUBLIC_KEY_A],
      lastMessage: "",
      unreadCount: 0,
      lastMessageTime: new Date(2_000),
      access: "invite-only" as const,
      memberCount: 1,
      adminPubkeys: [],
    };

    mockRuntimeProfileIdRef.current = "profile-a";
    setProfileScopeOverride("profile-a");
    setProfileRuntimeScope({ profileId: "profile-a", bus: groupProviderTestBus });
    activePublicKeyHex = PUBLIC_KEY_A;
    saveCommunityMembershipLedger(PUBLIC_KEY_A, [{
      communityId: group.communityId,
      groupId: group.groupId,
      relayUrl: group.relayUrl,
      status: "joined",
      updatedAtUnixMs: 2_000,
      displayName: group.displayName,
      memberPubkeys: group.memberPubkeys,
    }], { profileId: "profile-a" });
    chatStateStoreService.replace(PUBLIC_KEY_A, {
      ...createEmptyState(),
      createdGroups: [{
        id: group.id,
        communityId: group.communityId,
        groupId: group.groupId,
        relayUrl: group.relayUrl,
        displayName: group.displayName,
        memberPubkeys: [...group.memberPubkeys],
        lastMessage: group.lastMessage,
        unreadCount: group.unreadCount,
        lastMessageTimeMs: group.lastMessageTime.getTime(),
      }],
    }, { emitMutationSignal: false, profileId: "profile-a" });

    const { result, rerender } = renderHook(() => useGroups(), { wrapper });
    await waitFor(() => {
      expect(result.current.createdGroups.some((entry) => entry.groupId === "rel003")).toBe(true);
    });

    mockRuntimeProfileIdRef.current = "profile-b";
    setProfileScopeOverride("profile-b");
    setProfileRuntimeScope({ profileId: "profile-b", bus: groupProviderTestBus });
    rerender();

    await waitFor(() => {
      expect(result.current.createdGroups.some((entry) => entry.groupId === "rel003")).toBe(false);
    });
  });

  it("forcePurgeCommunity clears only active profile ledger scope", async () => {
    setProfileRuntimeScope({ profileId: "profile-b", bus: groupProviderTestBus });
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );
    const { result } = renderHook(() => useGroups(), { wrapper });

    const group = {
      kind: "group" as const,
      id: "community:scoped:wss://relay.scoped",
      communityId: "scoped:wss://relay.scoped",
      groupId: "scoped",
      relayUrl: "wss://relay.scoped",
      displayName: "Scoped Group",
      memberPubkeys: [PUBLIC_KEY_A],
      lastMessage: "",
      unreadCount: 0,
      lastMessageTime: new Date(1_000),
      access: "invite-only" as const,
      memberCount: 1,
      adminPubkeys: [],
    };

    act(() => {
      result.current.addGroup(group);
      saveCommunityMembershipLedger(PUBLIC_KEY_A, [{
        communityId: group.communityId,
        groupId: group.groupId,
        relayUrl: group.relayUrl,
        status: "joined",
        updatedAtUnixMs: 2_000,
      }], { profileId: "profile-b" });
      saveCommunityMembershipLedger(PUBLIC_KEY_A, [{
        communityId: group.communityId,
        groupId: group.groupId,
        relayUrl: group.relayUrl,
        status: "joined",
        updatedAtUnixMs: 2_100,
      }], { profileId: "default" });
    });

    await waitFor(() => {
      expect(result.current.createdGroups.some((entry) => entry.groupId === "scoped")).toBe(true);
    });

    act(() => {
      result.current.forcePurgeCommunity({
        groupId: group.groupId,
        relayUrl: group.relayUrl,
      });
    });

    await waitFor(() => {
      expect(result.current.createdGroups.some((entry) => entry.groupId === "scoped")).toBe(false);
    });

    expect(
      loadCommunityMembershipLedger(PUBLIC_KEY_A, { profileId: "profile-b" }).some(
        (entry) => entry.groupId === group.groupId && entry.relayUrl === group.relayUrl,
      ),
    ).toBe(false);
    expect(
      loadCommunityMembershipLedger(PUBLIC_KEY_A, { profileId: "default" }).some(
        (entry) => entry.groupId === group.groupId && entry.relayUrl === group.relayUrl,
      ),
    ).toBe(true);
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

  it("defers restore ledger refresh until restore materialization completes", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );
    const { result } = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => {
      expect(result.current.createdGroups).toHaveLength(0);
    });
    logAppEventMock.mockClear();

    await act(async () => {
      await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(PUBLIC_KEY_A, {
        version: 1,
        publicKeyHex: PUBLIC_KEY_A,
        createdAtUnixMs: Date.now(),
        profile: {
          username: "restore-order-user",
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
          communityId: "restore-order:wss://relay.restore",
          groupId: "restore-order",
          relayUrl: "wss://relay.restore",
          status: "joined",
          updatedAtUnixMs: 3_000,
          displayName: "Restore Order",
        }],
        chatState: createEmptyState(),
        privacySettings: PrivacySettingsService.getSettings(),
        relayList: relayListInternals.DEFAULT_RELAYS,
      });
    });

    await waitFor(() => {
      expect(result.current.createdGroups).toHaveLength(1);
    });
    const refreshEvents = logAppEventMock.mock.calls
      .map((call) => call[0])
      .filter((event) => event?.name === "groups.membership_recovery_refresh_triggered");
    expect(refreshEvents).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        context: expect.objectContaining({
          triggerEvent: "obscur:community-membership-ledger-updated",
        }),
      }),
    ]));
    expect(refreshEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        context: expect.objectContaining({
          triggerEvent: "obscur:account-restore-materialization-completed",
        }),
      }),
    ]));
  });

  it("defers full backup restore ledger refresh until restore materialization completes", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );
    const { result } = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => {
      expect(result.current.createdGroups).toHaveLength(0);
    });
    logAppEventMock.mockClear();

    await act(async () => {
      await encryptedAccountBackupServiceInternals.applyBackupPayload(PUBLIC_KEY_A, {
        version: 1,
        publicKeyHex: PUBLIC_KEY_A,
        createdAtUnixMs: Date.now(),
        profile: {
          username: "full-restore-order-user",
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
          communityId: "full-restore-order:wss://relay.restore",
          groupId: "full-restore-order",
          relayUrl: "wss://relay.restore",
          status: "joined",
          updatedAtUnixMs: 3_000,
          displayName: "Full Restore Order",
        }],
        chatState: createEmptyState(),
        privacySettings: PrivacySettingsService.getSettings(),
        relayList: relayListInternals.DEFAULT_RELAYS,
      });
    });

    await waitFor(() => {
      expect(result.current.createdGroups).toHaveLength(1);
    });
    const refreshEvents = logAppEventMock.mock.calls
      .map((call) => call[0])
      .filter((event) => event?.name === "groups.membership_recovery_refresh_triggered");
    expect(refreshEvents).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        context: expect.objectContaining({
          triggerEvent: "obscur:community-membership-ledger-updated",
        }),
      }),
    ]));
    expect(refreshEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        context: expect.objectContaining({
          triggerEvent: "obscur:account-restore-materialization-completed",
        }),
      }),
    ]));
  });

  it("does not surface live groups from delayed backup chat-state evidence alone (REL-002)", async () => {
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
      expect(result.current.createdGroups).toHaveLength(0);
    });
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
      dispatchGroupInviteResponseAccepted({
          groupId: "delta",
          relayUrl: "wss://relay.delta",
          communityId: "delta:wss://relay.delta",
          memberPubkey: PUBLIC_KEY_B,
        });
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

  it("MEM-005: clears relay-joined peer after terminal invite response", async () => {
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
      expect(hook.result.current.createdGroups).toHaveLength(1);
    });

    act(() => {
      dispatchGroupInviteResponseAccepted({
        groupId: "delta",
        relayUrl: "wss://relay.delta",
        communityId: "delta:wss://relay.delta",
        memberPubkey: PUBLIC_KEY_B,
        recipientPublicKeyHex: PUBLIC_KEY_A,
      });
    });
    await waitFor(() => {
      expect(hook.result.current.createdGroups[0]?.memberPubkeys).toContain(PUBLIC_KEY_B);
    });

    act(() => {
      dispatchGroupInviteResponseTerminal({
        groupId: "delta",
        relayUrl: "wss://relay.delta",
        communityId: "delta:wss://relay.delta",
        memberPubkey: PUBLIC_KEY_B,
        recipientPublicKeyHex: PUBLIC_KEY_A,
        responseStatus: "declined",
      });
    });

    await waitFor(() => {
      expect(hook.result.current.createdGroups[0]?.memberPubkeys).not.toContain(PUBLIC_KEY_B);
    });
    expect(loadCommunityTerminalMembershipCache({
      groupId: "delta",
      relayUrl: "wss://relay.delta",
    })?.leftMemberPubkeys).toContain(PUBLIC_KEY_B);
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
      dispatchGroupInviteResponseAccepted({
          groupId: "orphan-group",
          relayUrl: "wss://relay.orphan",
          communityId: "orphan-group:wss://relay.orphan",
          memberPubkey: PUBLIC_KEY_B,
        });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(hook.result.current.createdGroups).toHaveLength(0);
    expect(loadCommunityMembershipLedger(PUBLIC_KEY_A)).toHaveLength(0);
  });

  it("does not write joined ledger when invite-accept updates a provisional group", async () => {
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
        id: "community:provisional:wss://relay.provisional",
        communityId: "provisional:wss://relay.provisional",
        groupId: "provisional",
        relayUrl: "wss://relay.provisional",
        displayName: "Provisional",
        memberPubkeys: [PUBLIC_KEY_A],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTime: new Date(1_000),
        access: "invite-only",
        memberCount: 1,
        adminPubkeys: [],
      }, { provisionalJoin: true });
    });

    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(1);
    });
    expect(loadCommunityMembershipLedger(PUBLIC_KEY_A)).toHaveLength(0);

    act(() => {
      dispatchGroupInviteResponseAccepted({
        groupId: "provisional",
        relayUrl: "wss://relay.provisional",
        communityId: "provisional:wss://relay.provisional",
        memberPubkey: PUBLIC_KEY_B,
        recipientPublicKeyHex: PUBLIC_KEY_A,
      });
    });

    await waitFor(() => {
      const members = hook.result.current.createdGroups[0]?.memberPubkeys ?? [];
      expect(members).toEqual(expect.arrayContaining([PUBLIC_KEY_A, PUBLIC_KEY_B]));
    });
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
      dispatchGroupInviteResponseAccepted({
          groupId: "self-heal",
          relayUrl: "wss://relay.self",
          communityId: "self-heal:wss://relay.self",
          memberPubkey: PUBLIC_KEY_B,
        });
    });

    await waitFor(() => {
      const members = hook.result.current.createdGroups[0]?.memberPubkeys ?? [];
      expect(members).toEqual(expect.arrayContaining([PUBLIC_KEY_A, PUBLIC_KEY_B]));
    });
  });

  it("does not mutate visible members from invite-accept evidence when ledger state is terminal", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );

    activePublicKeyHex = PUBLIC_KEY_A;
    setCommunityMembershipStatus(PUBLIC_KEY_A, {
      groupId: "terminal-invite",
      relayUrl: "wss://relay.terminal",
      communityId: "terminal-invite:wss://relay.terminal",
      status: "left",
      updatedAtUnixMs: 2_000,
      displayName: "Terminal Invite",
    });
    const hook = renderHook(() => useGroups(), { wrapper });
    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(0);
    });

    act(() => {
      hook.result.current.setCreatedGroups([{
        kind: "group",
        id: "community:terminal-invite:wss://relay.terminal",
        communityId: "terminal-invite:wss://relay.terminal",
        groupId: "terminal-invite",
        relayUrl: "wss://relay.terminal",
        displayName: "Terminal Invite",
        memberPubkeys: [PUBLIC_KEY_A],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTime: new Date(1_000),
        access: "invite-only",
        memberCount: 1,
        adminPubkeys: [],
      }]);
    });
    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(1);
    });

    act(() => {
      dispatchGroupInviteResponseAccepted({
          groupId: "terminal-invite",
          relayUrl: "wss://relay.terminal",
          communityId: "terminal-invite:wss://relay.terminal",
          memberPubkey: PUBLIC_KEY_B,
          recipientPublicKeyHex: PUBLIC_KEY_A,
        });
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(hook.result.current.createdGroups[0]?.memberPubkeys).toEqual([PUBLIC_KEY_A]);
    expect(loadCommunityMembershipLedger(PUBLIC_KEY_A)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        groupId: "terminal-invite",
        relayUrl: "wss://relay.terminal",
        status: "left",
      }),
    ]));
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
      dispatchGroupMembershipConfirmed({
          groupId: "canonical-group",
          relayUrl: "wss://relay.canonical",
          communityId: "canonical-group:wss://relay.canonical",
          displayName: "Private Group",
          memberPubkeys: [PUBLIC_KEY_B],
          memberCount: 2,
          lastMessageTimeUnixMs: 2_000,
        });
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
      dispatchGroupMembershipConfirmed({
          groupId: "omega",
          relayUrl: "wss://relay.omega",
          displayName: "Omega",
          access: "discoverable",
          memberPubkeys: [PUBLIC_KEY_B],
          adminPubkeys: [PUBLIC_KEY_A],
          memberCount: 2,
          lastMessageTimeUnixMs: 7_000,
        });
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

  it("does not resurrect a left group from runtime membership-confirmed evidence", async () => {
    setCommunityMembershipStatus(PUBLIC_KEY_A, {
      groupId: "omega-left",
      relayUrl: "wss://relay.omega",
      communityId: "omega-left:wss://relay.omega",
      status: "left",
      updatedAtUnixMs: 8_000,
      displayName: "Omega Left",
    });
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );
    activePublicKeyHex = PUBLIC_KEY_A;
    const { result } = renderHook(() => useGroups(), { wrapper });

    await waitFor(() => {
      expect(result.current.createdGroups).toHaveLength(0);
    });

    act(() => {
      dispatchGroupMembershipConfirmed({
          groupId: "omega-left",
          relayUrl: "wss://relay.omega",
          displayName: "Omega Left",
          memberPubkeys: [PUBLIC_KEY_A, PUBLIC_KEY_B],
          memberCount: 2,
          lastMessageTimeUnixMs: 9_000,
          publicKeyHex: PUBLIC_KEY_A,
        });
    });

    await waitFor(() => {
      expect(result.current.createdGroups).toHaveLength(0);
    });
    expect(loadCommunityMembershipLedger(PUBLIC_KEY_A)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        groupId: "omega-left",
        relayUrl: "wss://relay.omega",
        status: "left",
      }),
    ]));
  });

  it("does not backfill declined invite peers into inviter roster evidence", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );

    activePublicKeyHex = PUBLIC_KEY_A;
    await act(async () => {
      await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(PUBLIC_KEY_A, {
        version: 1,
        publicKeyHex: PUBLIC_KEY_A,
        createdAtUnixMs: Date.now(),
        profile: {
          username: "inviter-terminal-decline",
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
          communityId: "decline-peer:wss://relay.peer",
          groupId: "decline-peer",
          relayUrl: "wss://relay.peer",
          status: "joined",
          updatedAtUnixMs: 9_000,
          displayName: "Decline Peer",
        }],
        chatState: {
          ...createEmptyState(),
          createdGroups: [{
            id: "community:decline-peer:wss://relay.peer",
            communityId: "decline-peer:wss://relay.peer",
            groupId: "decline-peer",
            relayUrl: "wss://relay.peer",
            displayName: "Decline Peer",
            memberPubkeys: [PUBLIC_KEY_A],
            lastMessage: "inviter only",
            unreadCount: 0,
            lastMessageTimeMs: 9_000,
            access: "invite-only",
            memberCount: 1,
            adminPubkeys: [PUBLIC_KEY_A],
          }],
          messagesByConversationId: {
            [`${PUBLIC_KEY_A}:${PUBLIC_KEY_B}`]: [{
              id: "invite-out-1",
              content: JSON.stringify({
                type: "community-invite",
                groupId: "decline-peer",
                relayUrl: "wss://relay.peer",
                communityId: "decline-peer:wss://relay.peer",
                roomKey: "rk",
                metadata: { name: "Decline Peer" },
              }),
              timestampMs: 8_000,
              isOutgoing: true,
              status: "delivered",
              pubkey: PUBLIC_KEY_A,
            }, {
              id: "invite-decline-1",
              content: JSON.stringify({
                type: "community-invite-response",
                status: "declined",
                groupId: "decline-peer",
                relayUrl: "wss://relay.peer",
                communityId: "decline-peer:wss://relay.peer",
              }),
              timestampMs: 8_200,
              isOutgoing: false,
              status: "delivered",
              pubkey: PUBLIC_KEY_B,
            }],
          },
        },
        privacySettings: PrivacySettingsService.getSettings(),
        relayList: relayListInternals.DEFAULT_RELAYS,
      });
    });

    const hook = renderHook(() => useGroups(), { wrapper });
    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(1);
    });

    expect(hook.result.current.createdGroups[0]?.memberPubkeys).toEqual([PUBLIC_KEY_A]);
    expect(hook.result.current.createdGroups[0]?.memberPubkeys).not.toContain(PUBLIC_KEY_B);
    expect(
      hook.result.current.communityKnownParticipantDirectoryByConversationId["community:decline-peer:wss://relay.peer"]?.participantPubkeys ?? [],
    ).not.toContain(PUBLIC_KEY_B);
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
      dispatchGroupMembershipSnapshot({
          groupId: "lambda",
          relayUrl: "wss://relay.lambda",
          communityId: "lambda:wss://relay.lambda",
          activeMemberPubkeys: [PUBLIC_KEY_A],
          leftMembers: [PUBLIC_KEY_B],
          expelledMembers: [],
          disbandedAt: null,
        });
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

  it("does NOT write local-user expelled roster snapshot to ledger — only signed events can expel", async () => {
    // Three-tier architecture: relay snapshots are NEVER authoritative for the
    // local user's membership status. Only explicit signed events (admin expel)
    // can write terminal entries. The relay snapshot is ignored for ledger purposes.
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
      expect(hook.result.current.createdGroups).toHaveLength(1);
    });

    // Relay says user A is expelled, but this is NOT written to the ledger
    act(() => {
      dispatchGroupMembershipSnapshot({
          groupId: "nu",
          relayUrl: "wss://relay.nu",
          communityId: "nu:wss://relay.nu",
          activeMemberPubkeys: [PUBLIC_KEY_B],
          leftMembers: [],
          expelledMembers: [PUBLIC_KEY_A],
          disbandedAt: null,
        });
    });

    // Group should remain visible — relay snapshot does not write terminal entry
    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(1);
    });

    // Ledger should still show "joined" — no terminal entry written
    const ledger = loadCommunityMembershipLedger(PUBLIC_KEY_A);
    const expelledEntry = ledger.find((e) => e.groupId === "nu" && e.status === "expelled");
    expect(expelledEntry).toBeUndefined();
    expect(ledger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        groupId: "nu",
        relayUrl: "wss://relay.nu",
        status: "joined",
      }),
    ]));
  });

  it("records relay disband snapshot evidence and removes the visible group", async () => {
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
      expect(hook.result.current.createdGroups).toHaveLength(1);
    });

    act(() => {
      dispatchGroupMembershipSnapshot({
          groupId: "xi",
          relayUrl: "wss://relay.xi",
          communityId: "xi:wss://relay.xi",
          activeMemberPubkeys: [],
          leftMembers: [],
          expelledMembers: [],
          disbandedAt: 7_000,
        });
    });

    await waitFor(() => {
      expect(hook.result.current.createdGroups).toHaveLength(0);
    });
    expect(loadCommunityMembershipLedger(PUBLIC_KEY_A)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        groupId: "xi",
        relayUrl: "wss://relay.xi",
        status: "left",
      }),
    ]));
    const disbandEntry = loadCommunityMembershipLedger(PUBLIC_KEY_A).find((entry) => entry.groupId === "xi");
    expect(disbandEntry?.updatedAtUnixMs).toBeGreaterThanOrEqual(7_000);
    expect(chatStateStoreService.load(PUBLIC_KEY_A)?.createdGroups).toHaveLength(0);
  });

    it("rejects thinner live membership snapshots that omit leave or expel evidence while relay confidence is low", async () => {
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
      dispatchGroupMembershipSnapshot({
          groupId: "mu",
          relayUrl: "wss://relay.mu",
          communityId: "mu:wss://relay.mu",
          activeMemberPubkeys: [PUBLIC_KEY_A],
          leftMembers: [],
          expelledMembers: [],
          disbandedAt: null,
        });
    });

    await waitFor(() => {
      expect(hook.result.current.communityRosterByConversationId["community:mu:wss://relay.mu"]?.activeMemberPubkeys).toEqual([
        PUBLIC_KEY_A,
        PUBLIC_KEY_B,
      ]);
      expect(hook.result.current.communityRosterByConversationId["community:mu:wss://relay.mu"]?.memberCount).toBe(2);
      expect(hook.result.current.createdGroups[0]?.memberPubkeys).toEqual([PUBLIC_KEY_A, PUBLIC_KEY_B]);
    });
    expect(logAppEventMock).toHaveBeenCalledWith(expect.objectContaining({
      name: "groups.membership_snapshot_projection_result",
      context: expect.objectContaining({
        conversationId: "community:mu:wss://relay.mu",
        groupId: "mu",
        relayUrl: "wss://relay.mu",
        reasonCode: "missing_removal_evidence",
        currentMemberCount: 2,
        incomingMemberCount: 1,
        nextMemberCount: 2,
        removedWithoutEvidenceCount: 1,
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
      dispatchGroupMembershipSnapshot({
          groupId: "nu",
          relayUrl: "wss://relay.nu",
          communityId: "nu:wss://relay.nu",
          activeMemberPubkeys: [PUBLIC_KEY_A],
          leftMembers: [PUBLIC_KEY_B],
          expelledMembers: [],
          disbandedAt: null,
        });
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
      dispatchGroupMembershipSnapshot({
          groupId: "xi",
          relayUrl: "wss://relay.xi",
          communityId: "xi:wss://relay.xi",
          activeMemberPubkeys: [PUBLIC_KEY_A],
          leftMembers: [],
          expelledMembers: [],
          disbandedAt: null,
        });
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
      dispatchCommunityKnownParticipantsObserved({
          groupId: "omicron",
          relayUrl: "wss://relay.omicron",
          communityId: "omicron:wss://relay.omicron",
          conversationId: "community:omicron:wss://relay.omicron",
          participantPubkeys: [PUBLIC_KEY_A, PUBLIC_KEY_B],
        });
    });

    await waitFor(() => {
      expect(hook.result.current.createdGroups[0]?.memberPubkeys).toEqual([PUBLIC_KEY_A]);
      expect(hook.result.current.communityKnownParticipantDirectoryByConversationId["community:omicron:wss://relay.omicron"]?.participantPubkeys).toEqual([PUBLIC_KEY_A, PUBLIC_KEY_B]);
      expect(hook.result.current.communityKnownParticipantDirectoryByConversationId["community:omicron:wss://relay.omicron"]?.participantCount).toBe(2);
    });
  });
});

describe("group-provider relay snapshot terminal write guard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    setProfileScopeOverride(null);
    mockRuntimeProfileIdRef.current = "default";
    setProfileRuntimeScope({ profileId: "default", bus: groupProviderTestBus });
    activePublicKeyHex = PUBLIC_KEY_A;
    chatStateStoreService.replace(PUBLIC_KEY_A, createEmptyState(), { emitMutationSignal: false });
  });

  it("relay snapshots NEVER write terminal entries for local user — three-tier architecture", async () => {
    // Under the three-tier architecture, relay snapshots are never authoritative
    // for the local user's membership status. This applies at ALL confidence levels,
    // not just warming_up. Only explicit signed actions can write terminal entries.
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );
    const { result } = renderHook(() => useGroups(), { wrapper });

    // Seed the group via addGroup so it is fully registered
    act(() => {
      result.current.addGroup({
        kind: "group",
        id: "community:relay-guard:wss://relay.guard",
        communityId: "relay-guard:wss://relay.guard",
        groupId: "relay-guard",
        relayUrl: "wss://relay.guard",
        displayName: "Relay Guard",
        memberPubkeys: [PUBLIC_KEY_A, PUBLIC_KEY_B],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTime: new Date(1_000),
        access: "invite-only",
        memberCount: 2,
        adminPubkeys: [],
      });
    });

    await waitFor(() => {
      expect(result.current.createdGroups).toHaveLength(1);
    });

    // Verify joined state was written
    expect(loadCommunityMembershipLedger(PUBLIC_KEY_A)).toEqual(expect.arrayContaining([
      expect.objectContaining({ groupId: "relay-guard", status: "joined" }),
    ]));

    // Fire a snapshot where local user is in leftMembers.
    // Under the new architecture, this is ALWAYS ignored for the local user.
    act(() => {
      dispatchGroupMembershipSnapshot({
          groupId: "relay-guard",
          relayUrl: "wss://relay.guard",
          communityId: "relay-guard:wss://relay.guard",
          activeMemberPubkeys: [PUBLIC_KEY_B],
          leftMembers: [PUBLIC_KEY_A],
          expelledMembers: [],
          disbandedAt: null,
        });
    });

    // Group must still be visible — relay never writes terminal entries for local user
    await waitFor(() => {
      expect(result.current.createdGroups).toHaveLength(1);
    });

    // Ledger must still have joined status; no terminal left entry should exist
    const ledger = loadCommunityMembershipLedger(PUBLIC_KEY_A);
    const leftEntry = ledger.find((e) => e.groupId === "relay-guard" && e.status === "left");
    expect(leftEntry).toBeUndefined();
    expect(ledger).toEqual(expect.arrayContaining([
      expect.objectContaining({ groupId: "relay-guard", status: "joined" }),
    ]));
  });
});
