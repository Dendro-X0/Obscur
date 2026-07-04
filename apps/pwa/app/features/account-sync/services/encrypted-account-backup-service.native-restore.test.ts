import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { encryptedAccountBackupServiceInternals } from "./encrypted-account-backup-service";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store-legacy";
import { peerTrustInternals } from "@/app/features/network/hooks/use-peer-trust";
import { relayListInternals } from "@/app/features/relays/hooks/use-relay-list";
import { requestFlowEvidenceStoreInternals } from "@/app/features/messaging/services/request-flow-evidence-store";
import { syncCheckpointInternals } from "@/app/features/messaging/lib/sync-checkpoints";
import { contactRequestOutboxInternals } from "@/app/features/search/hooks/use-contact-request-outbox";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { saveCommunityMembershipLedger } from "@/app/features/groups/services/community-membership-ledger";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import { useProfileInternals } from "@/app/features/profile/hooks/use-profile";

const tauriMocks = vi.hoisted(() => ({
  isTauri: vi.fn(() => true),
}));

vi.mock("@dweb/db", () => ({
  isTauri: tauriMocks.isTauri,
  dbDeleteMessage: vi.fn(async () => undefined),
  dbDeleteMessages: vi.fn(async () => undefined),
}));

vi.mock("@/app/features/messaging/services/thread-history/resolve-dm-thread-history-adapter", () => {
  const stubPort = {
    prepareThreadSuppressionIds: async () => new Set<string>(),
    hydrateThreadReadModel: async () => ({
      finalMessages: [],
      displayMessages: [],
      hasCompleteDirectionCoverage: true,
      projectionMergeBlocked: false,
    }),
    buildProjectionEvidenceMessages: () => [],
    mergeProjectionWithLiveOverlay: (params: { displayMessages?: ReadonlyArray<unknown> }) => ({
      displayMessages: params.displayMessages ?? [],
    }),
    loadEarlierMessages: async () => ({ messages: [], hasMore: false }),
    applyRealtimeBufferedEvents: () => [],
    filterThreadMessagesBySuppression: <T,>(messages: ReadonlyArray<T>) => messages,
    mergeHydratedBaseWithLiveOverlay: <T,>(base: ReadonlyArray<T>) => base,
  };
  return {
    resolveDmThreadHistoryAdapter: () => stubPort,
  };
});

const publicKeyHex = "f".repeat(64) as PublicKeyHex;
const peerPublicKeyHex = "e".repeat(64) as PublicKeyHex;
const conversationId = [publicKeyHex, peerPublicKeyHex].sort().join(":");

const buildPayloadWithMessageBodies = () => ({
  version: 1 as const,
  publicKeyHex,
  createdAtUnixMs: Date.now(),
  profile: {
    username: "Alice",
    about: "",
    avatarUrl: "",
    nip05: "",
    inviteCode: "",
  },
  peerTrust: {
    acceptedPeers: [peerPublicKeyHex],
    mutedPeers: [],
  },
  requestFlowEvidence: { byPeer: {} },
  requestOutbox: { records: [] },
  syncCheckpoints: [],
  chatState: {
    version: 2 as const,
    createdConnections: [{
      id: conversationId,
      displayName: "Peer",
      pubkey: peerPublicKeyHex,
      lastMessage: "ghost preview",
      unreadCount: 0,
      lastMessageTimeMs: 100,
    }],
    createdGroups: [],
    unreadByConversationId: {},
    connectionOverridesByConnectionId: {},
    messagesByConversationId: {
      [conversationId]: [{
        id: "ghost-msg",
        content: "must not resurrect in chat-state",
        timestampMs: 200,
        isOutgoing: false,
        status: "delivered" as const,
        pubkey: peerPublicKeyHex,
      }],
    },
    groupMessages: {
      "community:room:wss://relay.example": [{
        id: "group-ghost",
        content: "group body must not mirror",
        created_at: 300,
        pubkey: "c".repeat(64),
      }],
    },
    connectionRequests: [],
    pinnedChatIds: [conversationId],
    hiddenChatIds: [],
  },
  privacySettings: PrivacySettingsService.getSettings(),
  relayList: relayListInternals.DEFAULT_RELAYS,
});

describe("encryptedAccountBackupService native restore (P5-BKP-1)", () => {
  beforeEach(() => {
    localStorage.clear();
    setProfileScopeOverride(null);
    tauriMocks.isTauri.mockReturnValue(true);
    peerTrustInternals.saveToStorage(publicKeyHex, {
      acceptedPeers: [],
      mutedPeers: [],
    });
    chatStateStoreService.replace(publicKeyHex, {
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
    }, { emitMutationSignal: false });
    relayListInternals.saveRelayListToStorage(publicKeyHex, []);
    saveCommunityMembershipLedger(publicKeyHex, []);
    requestFlowEvidenceStoreInternals.writeState({ byPeer: {} });
    contactRequestOutboxInternals.writeState({ records: [] });
    syncCheckpointInternals.persistCheckpointState(new Map());
    PrivacySettingsService.saveSettings(PrivacySettingsService.getSettings());
    localStorage.setItem(useProfileInternals.getStorageKey(), JSON.stringify({
      version: 1,
      profile: {
        username: "Alice",
        about: "",
        avatarUrl: "",
        nip05: "",
        inviteCode: "",
      },
    }));
  });

  it("applyBackupPayload strips DM and group bodies before chat-state replace on native", async () => {
    const replaceSpy = vi.spyOn(chatStateStoreService, "replace");

    await encryptedAccountBackupServiceInternals.applyBackupPayload(
      publicKeyHex,
      buildPayloadWithMessageBodies(),
    );

    const nativeReplaceCall = replaceSpy.mock.calls.find((call) => call[0] === publicKeyHex);
    expect(nativeReplaceCall).toBeDefined();
    const storedChatState = nativeReplaceCall?.[1];
    expect(storedChatState?.messagesByConversationId).toEqual({});
    expect(storedChatState?.groupMessages).toEqual({});
    expect(storedChatState?.createdConnections).toHaveLength(1);
    expect(storedChatState?.pinnedChatIds).toEqual([conversationId]);
    replaceSpy.mockRestore();
  });

  it("applyBackupPayloadNonV1Domains strips bodies on native restore domains path", async () => {
    const replaceSpy = vi.spyOn(chatStateStoreService, "replace");

    await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(
      publicKeyHex,
      buildPayloadWithMessageBodies(),
      "default",
      { restoreChatStateDomains: true },
    );

    const nativeReplaceCall = replaceSpy.mock.calls.find((call) => call[0] === publicKeyHex);
    expect(nativeReplaceCall).toBeDefined();
    const storedChatState = nativeReplaceCall?.[1];
    expect(storedChatState?.messagesByConversationId).toEqual({});
    expect(storedChatState?.groupMessages).toEqual({});
    replaceSpy.mockRestore();
  });

  it("buildBackupPayloadWithHydratedChatState skips chat-state hydrateMessages on native", async () => {
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);

    await encryptedAccountBackupServiceInternals.buildBackupPayloadWithHydratedChatState(publicKeyHex);

    expect(hydrateSpy).not.toHaveBeenCalled();
    hydrateSpy.mockRestore();
  });

  it("applyBackupPayload invokes native sqlite materialization on tauri (B4-2)", async () => {
    const materializeSpy = vi.spyOn(
      await import("./native-sqlite-backup-evidence"),
      "applyNativeRestoreSqliteMaterialization",
    ).mockResolvedValue(undefined);

    const payload = buildPayloadWithMessageBodies();
    await encryptedAccountBackupServiceInternals.applyBackupPayload(publicKeyHex, {
      ...payload,
      chatState: {
        ...payload.chatState!,
        createdGroups: [{
          id: "community:room:wss://relay.example",
          groupId: "room",
          relayUrl: "wss://relay.example",
          displayName: "Room",
          memberPubkeys: [publicKeyHex],
          lastMessage: "",
          unreadCount: 0,
          lastMessageTimeMs: 1000,
        }],
      },
      nativeSqliteEvidence: {
        collectedAtUnixMs: Date.now(),
        primaryProfileId: "default",
        dmMessages: [],
        groupMessages: [{
          event_id: "group-ghost",
          group_id: "room",
          profile_id: "default",
          sender_pubkey: "c".repeat(64),
          plaintext: "group body from sqlite evidence",
          created_at: 300,
          received_at: 300_000,
        }],
        groupRecords: [],
      },
    });

    expect(materializeSpy).toHaveBeenCalledWith(expect.objectContaining({
      chatState: expect.objectContaining({
        createdGroups: expect.arrayContaining([
          expect.objectContaining({ groupId: "room" }),
        ]),
      }),
    }));
    materializeSpy.mockRestore();
  });
});
