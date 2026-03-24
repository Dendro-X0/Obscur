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
import { encryptedAccountBackupServiceInternals } from "@/app/features/account-sync/services/encrypted-account-backup-service";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { relayListInternals } from "@/app/features/relays/hooks/use-relay-list";
import { loadCommunityMembershipLedger } from "../services/community-membership-ledger";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import { GroupProvider, useGroups } from "./group-provider";

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

const createRestorePayload = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  username: string;
  chatState: PersistedChatState;
}>): Parameters<typeof encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains>[1] => ({
  version: 1,
  publicKeyHex: params.publicKeyHex,
  createdAtUnixMs: Date.now(),
  profile: {
    username: params.username,
    about: "",
    avatarUrl: "",
    nip05: "",
    inviteCode: "",
  },
  peerTrust: { acceptedPeers: [], mutedPeers: [] },
  requestFlowEvidence: { byPeer: {} },
  requestOutbox: { records: [] },
  syncCheckpoints: [],
  // Deliberately omitted for missing-ledger / delayed-ledger recovery paths.
  chatState: params.chatState,
  privacySettings: PrivacySettingsService.getSettings(),
  relayList: relayListInternals.DEFAULT_RELAYS,
});

describe("group-provider cross-device membership integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    setProfileScopeOverride(null);
    activePublicKeyHex = PUBLIC_KEY_A;
    chatStateStoreService.replace(PUBLIC_KEY_A, createEmptyState(), { emitMutationSignal: false });
    chatStateStoreService.replace(PUBLIC_KEY_B, createEmptyState(), { emitMutationSignal: false });
  });

  it("reconstructs receiver membership on a new device from missing-ledger invite-accept evidence", async () => {
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
        id: "community:sigma:wss://relay.sigma",
        communityId: "sigma:wss://relay.sigma",
        groupId: "sigma",
        relayUrl: "wss://relay.sigma",
        displayName: "Sigma",
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
          groupId: "sigma",
          relayUrl: "wss://relay.sigma",
          communityId: "sigma:wss://relay.sigma",
          memberPubkey: PUBLIC_KEY_B,
        },
      }));
    });
    await waitFor(() => {
      const members = accountAHook.result.current.createdGroups[0]?.memberPubkeys ?? [];
      expect(members).toContain(PUBLIC_KEY_B);
    });
    accountAHook.unmount();

    await act(async () => {
      await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(
        PUBLIC_KEY_B,
        createRestorePayload({
          publicKeyHex: PUBLIC_KEY_B,
          username: "receiver-b",
          chatState: {
            ...createEmptyState(),
            messagesByConversationId: {
              "dm:invite": [{
                id: "m-accepted",
                content: JSON.stringify({
                  type: "community-invite-response",
                  status: "accepted",
                  groupId: "sigma",
                  relayUrl: "wss://relay.sigma",
                  communityId: "sigma:wss://relay.sigma",
                }),
                timestampMs: 2_000,
                isOutgoing: true,
                status: "delivered",
              }],
            },
          },
        }),
      );
    });

    activePublicKeyHex = PUBLIC_KEY_B;
    const accountBHook = renderHook(() => useGroups(), { wrapper });
    await waitFor(() => {
      expect(accountBHook.result.current.createdGroups).toHaveLength(1);
    });
    expect(accountBHook.result.current.createdGroups[0]).toEqual(expect.objectContaining({
      groupId: "sigma",
      relayUrl: "wss://relay.sigma",
      communityId: "sigma:wss://relay.sigma",
    }));
    expect(loadCommunityMembershipLedger(PUBLIC_KEY_B)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        groupId: "sigma",
        relayUrl: "wss://relay.sigma",
        status: "joined",
      }),
    ]));
    expect(loadCommunityMembershipLedger(PUBLIC_KEY_A)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        groupId: "sigma",
        relayUrl: "wss://relay.sigma",
        status: "joined",
      }),
    ]));
  });

  it("refreshes a mounted receiver window when delayed restore reconstructs membership from chat-state groups", async () => {
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
        id: "community:tau:wss://relay.tau",
        communityId: "tau:wss://relay.tau",
        groupId: "tau",
        relayUrl: "wss://relay.tau",
        displayName: "Tau",
        memberPubkeys: [PUBLIC_KEY_A],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTime: new Date(3_000),
        access: "invite-only",
        memberCount: 1,
        adminPubkeys: [],
      }, { allowRevive: true });
    });
    await waitFor(() => {
      expect(accountAHook.result.current.createdGroups).toHaveLength(1);
    });
    accountAHook.unmount();

    activePublicKeyHex = PUBLIC_KEY_B;
    const accountBHook = renderHook(() => useGroups(), { wrapper });
    await waitFor(() => {
      expect(accountBHook.result.current.createdGroups).toHaveLength(0);
    });

    await act(async () => {
      await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(
        PUBLIC_KEY_B,
        createRestorePayload({
          publicKeyHex: PUBLIC_KEY_B,
          username: "receiver-b-late",
          chatState: {
            ...createEmptyState(),
            createdGroups: [{
              id: "community:tau:wss://relay.tau",
              communityId: "tau:wss://relay.tau",
              groupId: "tau",
              relayUrl: "wss://relay.tau",
              displayName: "Tau",
              memberPubkeys: [PUBLIC_KEY_B],
              lastMessage: "delayed restore evidence",
              unreadCount: 0,
              lastMessageTimeMs: 4_000,
              access: "invite-only",
              memberCount: 1,
              adminPubkeys: [],
            }],
          },
        }),
      );
    });

    await waitFor(() => {
      expect(accountBHook.result.current.createdGroups).toHaveLength(1);
    });
    expect(accountBHook.result.current.createdGroups[0]).toEqual(expect.objectContaining({
      groupId: "tau",
      relayUrl: "wss://relay.tau",
      communityId: "tau:wss://relay.tau",
    }));
    expect(loadCommunityMembershipLedger(PUBLIC_KEY_B)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        groupId: "tau",
        relayUrl: "wss://relay.tau",
        status: "joined",
      }),
    ]));
    expect(loadCommunityMembershipLedger(PUBLIC_KEY_A)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        groupId: "tau",
        relayUrl: "wss://relay.tau",
        status: "joined",
      }),
    ]));
  });

  it("keeps group visibility isolated by profile scope before profile rebind", async () => {
    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <GroupProvider>{children}</GroupProvider>
    );

    activePublicKeyHex = PUBLIC_KEY_B;
    setProfileScopeOverride("bootstrap");
    chatStateStoreService.replace(PUBLIC_KEY_B, createEmptyState(), { emitMutationSignal: false });

    setProfileScopeOverride("resolved");
    chatStateStoreService.replace(PUBLIC_KEY_B, {
      ...createEmptyState(),
      createdGroups: [{
        id: "community:phi:wss://relay.phi",
        communityId: "phi:wss://relay.phi",
        groupId: "phi",
        relayUrl: "wss://relay.phi",
        displayName: "Phi",
        memberPubkeys: [PUBLIC_KEY_B],
        lastMessage: "profile scoped restore",
        unreadCount: 0,
        lastMessageTimeMs: 5_000,
        access: "invite-only",
        memberCount: 1,
        adminPubkeys: [],
      }],
    }, { emitMutationSignal: false });

    setProfileScopeOverride("bootstrap");
    const hook = renderHook(() => useGroups(), { wrapper });
    await act(async () => {
      await Promise.resolve();
    });

    // Expected contract: bootstrap scope should stay empty before profile rebind.
    // Current behavior can leak resolved-scope chat-state groups through pubkey-only cache.
    expect(hook.result.current.createdGroups).toHaveLength(0);
  });
});
