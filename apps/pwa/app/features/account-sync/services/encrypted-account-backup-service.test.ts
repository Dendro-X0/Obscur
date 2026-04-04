import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { encryptedAccountBackupService, encryptedAccountBackupServiceInternals } from "./encrypted-account-backup-service";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { MessageQueue } from "@/app/features/messaging/lib/message-queue";
import { requestFlowEvidenceStoreInternals } from "@/app/features/messaging/services/request-flow-evidence-store";
import { syncCheckpointInternals } from "@/app/features/messaging/lib/sync-checkpoints";
import { peerTrustInternals } from "@/app/features/network/hooks/use-peer-trust";
import { relayListInternals } from "@/app/features/relays/hooks/use-relay-list";
import { messagingDB } from "@dweb/storage/indexed-db";
import { contactRequestOutboxInternals } from "@/app/features/search/hooks/use-contact-request-outbox";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import * as storedIdentityReader from "@/app/features/auth/utils/get-stored-identity";
import * as storedIdentityWriter from "@/app/features/auth/utils/save-stored-identity";
import { getScopedStorageKey, setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import { getLocalMediaStorageConfig } from "@/app/features/vault/services/local-media-store";
import * as appEventLogger from "@/app/shared/log-app-event";
import { ACCOUNT_BACKUP_D_TAG, ACCOUNT_BACKUP_EVENT_KIND } from "../account-sync-contracts";
import { useProfileInternals } from "@/app/features/profile/hooks/use-profile";
import { accountEventStore } from "./account-event-store";
import { loadCommunityMembershipLedger, saveCommunityMembershipLedger } from "@/app/features/groups/services/community-membership-ledger";
import { roomKeyStore } from "@/app/features/crypto/room-key-store";

vi.mock("@/app/features/crypto/crypto-service", () => ({
  cryptoService: {
    encryptDM: vi.fn(async (plaintext: string) => `encrypted:${plaintext}`),
    decryptDM: vi.fn(async (ciphertext: string) => ciphertext.replace(/^encrypted:/, "")),
    signEvent: vi.fn(async (event: Record<string, unknown>) => ({
      ...event,
      id: "signed-event-id",
      sig: "sig",
    })),
  },
}));

const publicKeyHex = "f".repeat(64) as PublicKeyHex;
const privateKeyHex = "a".repeat(64) as PrivateKeyHex;
const acceptedPeerPublicKeyHex = "e".repeat(64) as PublicKeyHex;

describe("encryptedAccountBackupService", () => {
  beforeEach(() => {
    localStorage.clear();
    setProfileScopeOverride(null);
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
    encryptedAccountBackupServiceInternals.resetBackupEventOrderingState();
    vi.clearAllMocks();
  });

  it("builds a serializable backup payload from canonical local stores", () => {
    localStorage.setItem(useProfileInternals.getStorageKey(), JSON.stringify({
      version: 1,
      profile: {
        username: "Alice",
        about: "About Alice",
        avatarUrl: "",
        nip05: "",
        inviteCode: "",
      },
    }));
    peerTrustInternals.saveToStorage(publicKeyHex, {
      acceptedPeers: [acceptedPeerPublicKeyHex],
      mutedPeers: [],
    });
    requestFlowEvidenceStoreInternals.writeState({
      byPeer: {
        [publicKeyHex]: {
          requestEventId: "req-1",
          receiptAckSeen: true,
          acceptSeen: false,
          lastEvidenceUnixMs: 123,
        },
      },
    });
    contactRequestOutboxInternals.writeState({
      records: [{
        id: "outbox-1",
        peerPubkey: publicKeyHex,
        status: "queued",
        retries: 1,
        createdAtUnixMs: 100,
        updatedAtUnixMs: 200,
      }],
    });
    syncCheckpointInternals.persistCheckpointState(new Map([
      ["dm:test", {
        timelineKey: "dm:test",
        lastProcessedAtUnixSeconds: 777,
        updatedAtUnixMs: 888,
      }],
    ]));
    relayListInternals.saveRelayListToStorage(publicKeyHex, [{ url: "wss://relay.example", enabled: true }]);

    const payload = encryptedAccountBackupService.buildBackupPayload(publicKeyHex);

    expect(payload.version).toBe(1);
    expect(payload.publicKeyHex).toBe(publicKeyHex);
    expect(payload.profile.username).toBe("Alice");
    expect(payload.peerTrust.acceptedPeers).toEqual([acceptedPeerPublicKeyHex]);
    expect(payload.requestFlowEvidence.byPeer[publicKeyHex]?.requestEventId).toBe("req-1");
    expect(payload.requestOutbox.records).toHaveLength(1);
    expect(payload.syncCheckpoints).toEqual([
      expect.objectContaining({ timelineKey: "dm:test", lastProcessedAtUnixSeconds: 777 }),
    ]);
    expect(payload.relayList).toEqual([{ url: "wss://relay.example", enabled: true }]);
  });

  it("exports and imports a portable account bundle via canonical append path", async () => {
    peerTrustInternals.saveToStorage(publicKeyHex, {
      acceptedPeers: [acceptedPeerPublicKeyHex],
      mutedPeers: [],
    });
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
      version: 2,
      createdConnections: [],
      createdGroups: [{
        id: "community:alpha:wss://relay.example",
        communityId: "alpha:wss://relay.example",
        groupId: "alpha",
        relayUrl: "wss://relay.example",
        displayName: "Alpha",
        memberPubkeys: [publicKeyHex],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTimeMs: 6_000,
        access: "invite-only",
        memberCount: 1,
        adminPubkeys: [publicKeyHex],
      }],
      unreadByConversationId: {},
      connectionOverridesByConnectionId: {},
      messagesByConversationId: {
        "portable-thread": [{
          id: "portable-out-1",
          content: "portable outgoing",
          timestampMs: 1_000,
          status: "accepted",
          isOutgoing: true,
          pubkey: publicKeyHex,
        }],
      },
      groupMessages: {},
      connectionRequests: [],
      pinnedChatIds: [],
      hiddenChatIds: [],
    });
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([]);
    const queueSpy = vi.spyOn(MessageQueue.prototype, "getAllMessages").mockResolvedValue([] as any);
    const appendCanonicalEvents = vi.fn(async () => undefined);

    const exported = await encryptedAccountBackupService.exportPortableAccountBundle({
      publicKeyHex,
      privateKeyHex,
    });

    expect(exported.bundle).toEqual(expect.objectContaining({
      version: 1,
      format: "obscur.portable_account_bundle.v1",
      payloadVersion: 1,
      publicKeyHex,
    }));

    const imported = await encryptedAccountBackupService.importPortableAccountBundle({
      bundle: exported.bundle,
      publicKeyHex,
      privateKeyHex,
      profileId: "default",
      appendCanonicalEvents,
    });

    expect(imported.payload.publicKeyHex).toBe(publicKeyHex);
    expect(appendCanonicalEvents).toHaveBeenCalledTimes(1);
    expect(appendCanonicalEvents).toHaveBeenCalledWith(expect.objectContaining({
      profileId: "default",
      accountPublicKeyHex: publicKeyHex,
    }));

    relayListInternals.saveRelayListToStorage(publicKeyHex, []);
    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    queueSpy.mockRestore();
  });

  it("rejects portable bundle import when bundle account does not match active identity", async () => {
    peerTrustInternals.saveToStorage(publicKeyHex, {
      acceptedPeers: [acceptedPeerPublicKeyHex],
      mutedPeers: [],
    });
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
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
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([]);
    const queueSpy = vi.spyOn(MessageQueue.prototype, "getAllMessages").mockResolvedValue([] as any);
    const exported = await encryptedAccountBackupService.exportPortableAccountBundle({
      publicKeyHex,
      privateKeyHex,
    });
    const otherPublicKeyHex = "b".repeat(64) as PublicKeyHex;

    await expect(encryptedAccountBackupService.importPortableAccountBundle({
      bundle: exported.bundle,
      publicKeyHex: otherPublicKeyHex,
      privateKeyHex,
      profileId: "default",
    })).rejects.toThrow("Portable bundle belongs to a different account.");

    relayListInternals.saveRelayListToStorage(publicKeyHex, []);
    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    queueSpy.mockRestore();
  });

  it("includes community membership ledger in backup payload and merges it on restore", async () => {
    saveCommunityMembershipLedger(publicKeyHex, [{
      communityId: "alpha:wss://relay.example",
      groupId: "alpha",
      relayUrl: "wss://relay.example",
      status: "left",
      updatedAtUnixMs: 100,
      displayName: "Alpha",
    }]);
    peerTrustInternals.saveToStorage(publicKeyHex, {
      acceptedPeers: [acceptedPeerPublicKeyHex],
      mutedPeers: [],
    });

    const builtPayload = encryptedAccountBackupService.buildBackupPayload(publicKeyHex);
    expect(builtPayload.communityMembershipLedger).toEqual([
      expect.objectContaining({
        groupId: "alpha",
        relayUrl: "wss://relay.example",
        status: "left",
      }),
    ]);

    await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(publicKeyHex, {
      version: 1,
      publicKeyHex,
      createdAtUnixMs: Date.now(),
      profile: {
        username: "Recovered",
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
        communityId: "alpha:wss://relay.example",
        groupId: "alpha",
        relayUrl: "wss://relay.example",
        status: "joined",
        updatedAtUnixMs: 200,
        displayName: "Alpha",
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

    const mergedLedger = loadCommunityMembershipLedger(publicKeyHex);
    expect(mergedLedger).toEqual([
      expect.objectContaining({
        groupId: "alpha",
        relayUrl: "wss://relay.example",
        status: "joined",
        updatedAtUnixMs: 200,
      }),
    ]);
  });

  it("includes room key snapshots in hydrated backup payload", async () => {
    const roomKeySpy = vi.spyOn(roomKeyStore, "listRoomKeyRecords").mockResolvedValue([{
      groupId: "alpha",
      roomKeyHex: "room-key-alpha",
      previousKeys: ["room-key-alpha-old"],
      createdAt: 4_000,
    }]);
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
      version: 2,
      createdConnections: [],
      createdGroups: [{
        id: "community:alpha:wss://relay.example",
        communityId: "alpha:wss://relay.example",
        groupId: "alpha",
        relayUrl: "wss://relay.example",
        displayName: "Alpha",
        memberPubkeys: [publicKeyHex],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTimeMs: 4_000,
        access: "invite-only",
        memberCount: 1,
        adminPubkeys: [publicKeyHex],
      }],
      unreadByConversationId: {},
      connectionOverridesByConnectionId: {},
      messagesByConversationId: {},
      groupMessages: {},
      connectionRequests: [],
      pinnedChatIds: [],
      hiddenChatIds: [],
    });
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([]);
    const queueSpy = vi.spyOn(MessageQueue.prototype, "getAllMessages").mockResolvedValue([] as any);

    const payload = await encryptedAccountBackupServiceInternals.buildBackupPayloadWithHydratedChatState(publicKeyHex);

    expect(payload.roomKeys).toEqual([{
      groupId: "alpha",
      roomKeyHex: "room-key-alpha",
      previousKeys: ["room-key-alpha-old"],
      createdAt: 4_000,
    }]);

    roomKeySpy.mockRestore();
    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    queueSpy.mockRestore();
  });

  it("reconstructs room key snapshots from hydrated invite chat-state when local key store is empty", async () => {
    const roomKeySpy = vi.spyOn(roomKeyStore, "listRoomKeyRecords").mockResolvedValue([]);
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
      version: 2,
      createdConnections: [],
      createdGroups: [{
        id: "community:alpha:wss://relay.example",
        communityId: "alpha:wss://relay.example",
        groupId: "alpha",
        relayUrl: "wss://relay.example",
        displayName: "Alpha",
        memberPubkeys: [publicKeyHex],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTimeMs: 6_000,
        access: "invite-only",
        memberCount: 1,
        adminPubkeys: [publicKeyHex],
      }],
      unreadByConversationId: {},
      connectionOverridesByConnectionId: {},
      messagesByConversationId: {
        "dm:invite": [{
          id: "invite-msg-1",
          content: JSON.stringify({
            type: "community-invite",
            groupId: "alpha",
            roomKey: "room-key-from-invite",
            relayUrl: "wss://relay.example",
          }),
          timestampMs: 6_000,
          isOutgoing: false,
          status: "delivered",
        }],
      },
      groupMessages: {},
      connectionRequests: [],
      pinnedChatIds: [],
      hiddenChatIds: [],
    });
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([]);
    const queueSpy = vi.spyOn(MessageQueue.prototype, "getAllMessages").mockResolvedValue([] as any);

    const payload = await encryptedAccountBackupServiceInternals.buildBackupPayloadWithHydratedChatState(publicKeyHex);

    expect(payload.roomKeys).toEqual([
      expect.objectContaining({
        groupId: "alpha",
        roomKeyHex: "room-key-from-invite",
        createdAt: 6_000,
      }),
    ]);

    roomKeySpy.mockRestore();
    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    queueSpy.mockRestore();
  });

  it("merges incoming room key snapshots with local key history during restore", async () => {
    const listSpy = vi.spyOn(roomKeyStore, "listRoomKeyRecords").mockResolvedValue([{
      groupId: "alpha",
      roomKeyHex: "room-key-local",
      previousKeys: ["room-key-legacy"],
      createdAt: 1_000,
    }]);
    const upsertSpy = vi.spyOn(roomKeyStore, "upsertRoomKeyRecord").mockResolvedValue(undefined);
    saveCommunityMembershipLedger(publicKeyHex, [{
      communityId: "alpha:wss://relay.example",
      groupId: "alpha",
      relayUrl: "wss://relay.example",
      status: "joined",
      updatedAtUnixMs: 1_000,
      displayName: "Alpha",
    }]);

    await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(publicKeyHex, {
      version: 1,
      publicKeyHex,
      createdAtUnixMs: Date.now(),
      profile: {
        username: "Recovered",
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
        communityId: "alpha:wss://relay.example",
        groupId: "alpha",
        relayUrl: "wss://relay.example",
        status: "joined",
        updatedAtUnixMs: 2_000,
        displayName: "Alpha",
      }],
      roomKeys: [{
        groupId: "alpha",
        roomKeyHex: "room-key-remote",
        createdAt: 2_000,
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

    expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({
      groupId: "alpha",
      roomKeyHex: "room-key-remote",
      createdAt: 2_000,
      previousKeys: expect.arrayContaining(["room-key-local", "room-key-legacy"]),
    }));

    listSpy.mockRestore();
    upsertSpy.mockRestore();
  });

  it("drops room key snapshots without same-account joined evidence during restore", async () => {
    const listSpy = vi.spyOn(roomKeyStore, "listRoomKeyRecords").mockResolvedValue([{
      groupId: "orphan",
      roomKeyHex: "room-key-orphan-local",
      createdAt: 1_000,
    }]);
    const upsertSpy = vi.spyOn(roomKeyStore, "upsertRoomKeyRecord").mockResolvedValue(undefined);

    await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(publicKeyHex, {
      version: 1,
      publicKeyHex,
      createdAtUnixMs: Date.now(),
      profile: {
        username: "Recovered",
        about: "",
        avatarUrl: "",
        nip05: "",
        inviteCode: "",
      },
      peerTrust: { acceptedPeers: [], mutedPeers: [] },
      requestFlowEvidence: { byPeer: {} },
      requestOutbox: { records: [] },
      syncCheckpoints: [],
      roomKeys: [{
        groupId: "orphan",
        roomKeyHex: "room-key-orphan-remote",
        createdAt: 2_000,
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

    expect(upsertSpy).not.toHaveBeenCalled();

    listSpy.mockRestore();
    upsertSpy.mockRestore();
  });

  it("reconstructs room keys from invite chat-state during restore when incoming room-key snapshot is missing", async () => {
    const listSpy = vi.spyOn(roomKeyStore, "listRoomKeyRecords").mockResolvedValue([]);
    const upsertSpy = vi.spyOn(roomKeyStore, "upsertRoomKeyRecord").mockResolvedValue(undefined);

    await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(publicKeyHex, {
      version: 1,
      publicKeyHex,
      createdAtUnixMs: Date.now(),
      profile: {
        username: "Recovered",
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
        communityId: "alpha:wss://relay.example",
        groupId: "alpha",
        relayUrl: "wss://relay.example",
        status: "joined",
        updatedAtUnixMs: 7_000,
      }],
      chatState: {
        version: 2,
        createdConnections: [],
        createdGroups: [],
        unreadByConversationId: {},
        connectionOverridesByConnectionId: {},
        messagesByConversationId: {
          "dm:invite": [{
            id: "invite-msg-restore",
            content: JSON.stringify({
              type: "community-invite",
              groupId: "alpha",
              roomKey: "room-key-from-restore-invite",
              relayUrl: "wss://relay.example",
            }),
            timestampMs: 7_000,
            isOutgoing: false,
            status: "delivered",
          }],
        },
        groupMessages: {},
        connectionRequests: [],
        pinnedChatIds: [],
        hiddenChatIds: [],
      },
      privacySettings: PrivacySettingsService.getSettings(),
      relayList: relayListInternals.DEFAULT_RELAYS,
    });

    expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({
      groupId: "alpha",
      roomKeyHex: "room-key-from-restore-invite",
      createdAt: 7_000,
    }));

    listSpy.mockRestore();
    upsertSpy.mockRestore();
  });

  it("treats room key snapshots as portable private-state evidence", () => {
    const hasEvidence = encryptedAccountBackupServiceInternals.hasPortablePrivateStateEvidence({
      version: 1,
      publicKeyHex,
      createdAtUnixMs: Date.now(),
      profile: {
        username: "",
        about: "",
        avatarUrl: "",
        nip05: "",
        inviteCode: "",
      },
      peerTrust: { acceptedPeers: [], mutedPeers: [] },
      requestFlowEvidence: { byPeer: {} },
      requestOutbox: { records: [] },
      syncCheckpoints: [],
      roomKeys: [{
        groupId: "alpha",
        roomKeyHex: "room-key-alpha",
        createdAt: 1_000,
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

    expect(hasEvidence).toBe(true);
  });

  it("reconstructs membership ledger from backup chat-state groups when ledger snapshot is missing", async () => {
    await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(publicKeyHex, {
      version: 1,
      publicKeyHex,
      createdAtUnixMs: Date.now(),
      profile: {
        username: "Recovered",
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
        version: 2,
        createdConnections: [],
        createdGroups: [{
          id: "community:beta:wss://relay.beta",
          communityId: "beta:wss://relay.beta",
          groupId: "beta",
          relayUrl: "wss://relay.beta",
          displayName: "Beta",
          memberPubkeys: [publicKeyHex],
          lastMessage: "restored",
          unreadCount: 0,
          lastMessageTimeMs: 3_000,
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

    expect(loadCommunityMembershipLedger(publicKeyHex)).toEqual([
      expect.objectContaining({
        groupId: "beta",
        relayUrl: "wss://relay.beta",
        communityId: "beta:wss://relay.beta",
        status: "joined",
        updatedAtUnixMs: 3_000,
      }),
    ]);
  });

  it("does not override explicit local ledger status when reconstruction provides only supplemental joined evidence", async () => {
    saveCommunityMembershipLedger(publicKeyHex, [{
      communityId: "gamma:wss://relay.gamma",
      groupId: "gamma",
      relayUrl: "wss://relay.gamma",
      status: "left",
      updatedAtUnixMs: 5_000,
      displayName: "Gamma",
    }]);

    await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(publicKeyHex, {
      version: 1,
      publicKeyHex,
      createdAtUnixMs: Date.now(),
      profile: {
        username: "Recovered",
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
        version: 2,
        createdConnections: [],
        createdGroups: [{
          id: "community:gamma:wss://relay.gamma",
          communityId: "gamma:wss://relay.gamma",
          groupId: "gamma",
          relayUrl: "wss://relay.gamma",
          displayName: "Gamma",
          memberPubkeys: [publicKeyHex],
          lastMessage: "stale join evidence",
          unreadCount: 0,
          lastMessageTimeMs: 9_000,
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

    const ledger = loadCommunityMembershipLedger(publicKeyHex);
    expect(ledger).toEqual([
      expect.objectContaining({
        groupId: "gamma",
        relayUrl: "wss://relay.gamma",
        status: "left",
        updatedAtUnixMs: 5_000,
      }),
    ]);
  });

  it("promotes stale incoming left status when incoming chat-state has newer joined evidence", async () => {
    await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(publicKeyHex, {
      version: 1,
      publicKeyHex,
      createdAtUnixMs: Date.now(),
      profile: {
        username: "Recovered",
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
        communityId: "sigma:wss://relay.sigma",
        groupId: "sigma",
        relayUrl: "wss://relay.sigma",
        status: "left",
        updatedAtUnixMs: 2_000,
        displayName: "Sigma",
      }],
      chatState: {
        version: 2,
        createdConnections: [],
        createdGroups: [{
          id: "community:sigma:wss://relay.sigma",
          communityId: "sigma:wss://relay.sigma",
          groupId: "sigma",
          relayUrl: "wss://relay.sigma",
          displayName: "Sigma",
          memberPubkeys: [publicKeyHex],
          lastMessage: "newer joined evidence",
          unreadCount: 0,
          lastMessageTimeMs: 9_000,
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

    expect(loadCommunityMembershipLedger(publicKeyHex)).toEqual([
      expect.objectContaining({
        groupId: "sigma",
        relayUrl: "wss://relay.sigma",
        status: "joined",
        updatedAtUnixMs: 9_000,
      }),
    ]);
  });

  it("includes local identity unlock snapshot in hydrated backup payload", async () => {
    const readIdentitySpy = vi.spyOn(storedIdentityReader, "getStoredIdentity").mockResolvedValue({
      record: {
        encryptedPrivateKey: "cipher-local",
        publicKeyHex,
        username: "alice-local",
      },
    });
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
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
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([]);
    const queueSpy = vi.spyOn(MessageQueue.prototype, "getAllMessages").mockResolvedValue([] as any);

    const payload = await encryptedAccountBackupServiceInternals.buildBackupPayloadWithHydratedChatState(publicKeyHex);

    expect(payload.identityUnlock).toEqual({
      encryptedPrivateKey: "cipher-local",
      username: "alice-local",
    });

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    queueSpy.mockRestore();
    readIdentitySpy.mockRestore();
  });

  it("restores identity unlock snapshot from backup and replaces passwordless local sentinel", async () => {
    let identityRecord: {
      encryptedPrivateKey: string;
      publicKeyHex: PublicKeyHex;
      username?: string;
    } = {
      encryptedPrivateKey: "__obscur_native_only__",
      publicKeyHex,
      username: "local-user",
    };
    const readIdentitySpy = vi.spyOn(storedIdentityReader, "getStoredIdentity").mockImplementation(async () => ({
      record: identityRecord,
    }));
    const writeIdentitySpy = vi.spyOn(storedIdentityWriter, "saveStoredIdentity").mockImplementation(async ({ record }) => {
      identityRecord = {
        encryptedPrivateKey: record.encryptedPrivateKey,
        publicKeyHex,
        username: record.username,
      };
    });

    await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(publicKeyHex, {
      version: 1,
      publicKeyHex,
      createdAtUnixMs: Date.now(),
      identityUnlock: {
        encryptedPrivateKey: "cipher-backup",
        username: "backup-user",
      },
      profile: {
        username: "Recovered",
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

    expect(identityRecord).toEqual(expect.objectContaining({
      publicKeyHex,
      encryptedPrivateKey: "cipher-backup",
      username: "backup-user",
    }));
    readIdentitySpy.mockRestore();
    writeIdentitySpy.mockRestore();
  });

  it("does not overwrite stronger local password unlock with passwordless backup snapshot", async () => {
    let identityRecord: {
      encryptedPrivateKey: string;
      publicKeyHex: PublicKeyHex;
      username?: string;
    } = {
      encryptedPrivateKey: "cipher-local-strong",
      publicKeyHex,
      username: "local-user",
    };
    const readIdentitySpy = vi.spyOn(storedIdentityReader, "getStoredIdentity").mockImplementation(async () => ({
      record: identityRecord,
    }));
    const writeIdentitySpy = vi.spyOn(storedIdentityWriter, "saveStoredIdentity").mockImplementation(async ({ record }) => {
      identityRecord = {
        encryptedPrivateKey: record.encryptedPrivateKey,
        publicKeyHex,
        username: record.username,
      };
    });

    await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(publicKeyHex, {
      version: 1,
      publicKeyHex,
      createdAtUnixMs: Date.now(),
      identityUnlock: {
        encryptedPrivateKey: "__obscur_native_only__",
        username: "backup-user",
      },
      profile: {
        username: "Recovered",
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

    expect(identityRecord).toEqual(expect.objectContaining({
      publicKeyHex,
      encryptedPrivateKey: "cipher-local-strong",
      username: "local-user",
    }));
    readIdentitySpy.mockRestore();
    writeIdentitySpy.mockRestore();
  });

  it("preserves local password unlock when incoming password snapshot differs", async () => {
    let identityRecord: {
      encryptedPrivateKey: string;
      publicKeyHex: PublicKeyHex;
      username?: string;
    } = {
      encryptedPrivateKey: "cipher-local-old",
      publicKeyHex,
      username: "local-user",
    };
    const readIdentitySpy = vi.spyOn(storedIdentityReader, "getStoredIdentity").mockImplementation(async () => ({
      record: identityRecord,
    }));
    const writeIdentitySpy = vi.spyOn(storedIdentityWriter, "saveStoredIdentity").mockImplementation(async ({ record }) => {
      identityRecord = {
        encryptedPrivateKey: record.encryptedPrivateKey,
        publicKeyHex,
        username: record.username,
      };
    });

    await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(publicKeyHex, {
      version: 1,
      publicKeyHex,
      createdAtUnixMs: Date.now(),
      identityUnlock: {
        encryptedPrivateKey: "cipher-backup-new",
        username: "backup-user",
      },
      profile: {
        username: "Recovered",
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

    expect(identityRecord).toEqual(expect.objectContaining({
      publicKeyHex,
      encryptedPrivateKey: "cipher-local-old",
      username: "local-user",
    }));
    readIdentitySpy.mockRestore();
    writeIdentitySpy.mockRestore();
  });

  it("includes and restores ui settings snapshot", async () => {
    const themeStorageKey = getScopedStorageKey("dweb.nostr.pwa.ui.theme", "default");
    const accessibilityStorageKey = getScopedStorageKey("dweb.nostr.pwa.ui.accessibility.v1", "default");
    localStorage.setItem(themeStorageKey, "dark");
    localStorage.setItem(accessibilityStorageKey, JSON.stringify({
      textScale: 110,
      reducedMotion: true,
      contrastAssist: true,
    }));

    const builtPayload = encryptedAccountBackupService.buildBackupPayload(publicKeyHex);
    expect(builtPayload.uiSettings).toEqual(expect.objectContaining({
      themePreference: "dark",
      accessibilityPreferences: {
        textScale: 110,
        reducedMotion: true,
        contrastAssist: true,
      },
    }));

    await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(publicKeyHex, {
      ...builtPayload,
      uiSettings: {
        themePreference: "light",
        accessibilityPreferences: {
          textScale: 90,
          reducedMotion: false,
          contrastAssist: false,
        },
        localMediaStorageConfig: {
          enabled: false,
          subdir: "vault-media",
          customRootPath: "",
          cacheSentFiles: false,
          cacheReceivedFiles: true,
        },
      },
    });

    expect(localStorage.getItem(themeStorageKey)).toBe("light");
    expect(localStorage.getItem(accessibilityStorageKey)).toBe(JSON.stringify({
      textScale: 90,
      reducedMotion: false,
      contrastAssist: false,
    }));
    expect(getLocalMediaStorageConfig("default")).toEqual(expect.objectContaining({
      enabled: false,
      cacheSentFiles: false,
      cacheReceivedFiles: true,
    }));
  });

  it("restores relay backup through canonical event append for contacts + DMs domains", async () => {
    const dmConversationId = [publicKeyHex, acceptedPeerPublicKeyHex].sort().join(":");
    const restoredGroupId = "community:alpha:wss://relay.example";
    let currentSubId = "";
    const pool = {
      connections: [{ url: "wss://relay.example", status: "open" }],
      waitForConnection: vi.fn(async () => true),
      sendToOpen: vi.fn((payload: string) => {
        currentSubId = JSON.parse(payload)[1];
      }),
      subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => {
        queueMicrotask(() => {
          handler({
            url: "wss://relay.example",
            message: JSON.stringify(["EVENT", currentSubId, {
              id: "backup-event-id",
              pubkey: publicKeyHex,
              kind: ACCOUNT_BACKUP_EVENT_KIND,
              created_at: 10,
              tags: [["d", ACCOUNT_BACKUP_D_TAG]],
              content: `encrypted:${JSON.stringify({
                version: 1,
                publicKeyHex,
                createdAtUnixMs: 555,
                profile: {
                  username: "Restored Alice",
                  about: "Recovered profile",
                  avatarUrl: "",
                  nip05: "",
                  inviteCode: "",
                },
                peerTrust: { acceptedPeers: [acceptedPeerPublicKeyHex], mutedPeers: [] },
                requestFlowEvidence: { byPeer: {} },
                requestOutbox: { records: [] },
                syncCheckpoints: [{
                  timelineKey: "dm:test",
                  lastProcessedAtUnixSeconds: 42,
                  updatedAtUnixMs: 99,
                }],
                chatState: {
                  version: 2,
                  createdConnections: [{
                    id: dmConversationId,
                    displayName: "Peer",
                    pubkey: acceptedPeerPublicKeyHex,
                    lastMessage: "restored outgoing",
                    unreadCount: 0,
                    lastMessageTimeMs: 43_000,
                  }],
                  createdGroups: [{
                    id: restoredGroupId,
                    communityId: "alpha:wss://relay.example",
                    groupId: "alpha",
                    relayUrl: "wss://relay.example",
                    displayName: "Alpha",
                    memberPubkeys: [publicKeyHex, acceptedPeerPublicKeyHex],
                    lastMessage: "restored group message",
                    unreadCount: 0,
                    lastMessageTimeMs: 44_000,
                    access: "invite-only",
                    memberCount: 2,
                    adminPubkeys: [publicKeyHex],
                  }],
                  unreadByConversationId: {},
                  connectionOverridesByConnectionId: {},
                  messagesByConversationId: {
                    [dmConversationId]: [{
                      id: "m-restore-1",
                      content: "restored incoming",
                      timestampMs: 42_000,
                      isOutgoing: false,
                      status: "delivered",
                      pubkey: acceptedPeerPublicKeyHex,
                    }, {
                      id: "m-restore-2",
                      content: "restored outgoing",
                      timestampMs: 43_000,
                      isOutgoing: true,
                      status: "delivered",
                      pubkey: publicKeyHex,
                    }],
                  },
                  groupMessages: {
                    [restoredGroupId]: [{
                      id: "g-restore-1",
                      pubkey: publicKeyHex,
                      content: "restored group message",
                      created_at: 44_000,
                    }],
                  },
                  connectionRequests: [],
                  pinnedChatIds: [],
                  hiddenChatIds: [],
                },
                privacySettings: PrivacySettingsService.getSettings(),
                relayList: [{ url: "wss://relay.example", enabled: true }],
              })}`,
            }]),
          });
          handler({
            url: "wss://relay.example",
            message: JSON.stringify(["EOSE", currentSubId]),
          });
        });
        return () => undefined;
      },
    };

    const appendCanonicalEvents = vi.fn(async () => undefined);

    await encryptedAccountBackupService.restoreEncryptedAccountBackup({
      publicKeyHex,
      privateKeyHex,
      pool,
      profileId: "default",
      appendCanonicalEvents,
    });

    expect(appendCanonicalEvents).toHaveBeenCalledWith(expect.objectContaining({
      profileId: "default",
      accountPublicKeyHex: publicKeyHex,
      events: expect.arrayContaining([
        expect.objectContaining({ type: "CONTACT_ACCEPTED", peerPublicKeyHex: acceptedPeerPublicKeyHex }),
        expect.objectContaining({ type: "SYNC_CHECKPOINT_ADVANCED", timelineKey: "dm:test", lastProcessedAtUnixSeconds: 42 }),
      ]),
    }));
    const firstAppendCall = (appendCanonicalEvents.mock.calls as Array<ReadonlyArray<{ events?: ReadonlyArray<{ idempotencyKey: string }> }>>)[0];
    const importedEvents = firstAppendCall?.[0]?.events;
    expect(importedEvents?.length).toBeGreaterThan(0);
    expect(importedEvents?.some((event) => event.idempotencyKey.includes("backup-event-id"))).toBe(false);
    expect(importedEvents?.every((event) => event.idempotencyKey.startsWith("backup_restore_v1:"))).toBe(true);
    const restoredChatState = chatStateStoreService.load(publicKeyHex);
    expect(restoredChatState?.messagesByConversationId[dmConversationId]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "m-restore-1",
        isOutgoing: false,
      }),
      expect.objectContaining({
        id: "m-restore-2",
        isOutgoing: true,
        pubkey: publicKeyHex,
      }),
    ]));
    expect(restoredChatState?.createdGroups).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: restoredGroupId,
        groupId: "alpha",
      }),
    ]));
    expect(restoredChatState?.groupMessages?.[restoredGroupId]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "g-restore-1",
        content: "restored group message",
      }),
    ]));
    expect(peerTrustInternals.loadFromStorage(publicKeyHex).acceptedPeers).toEqual([]);
    expect(Array.from(syncCheckpointInternals.loadPersistedCheckpointState().values())).toEqual([]);
    expect(relayListInternals.loadRelayListFromStorage(publicKeyHex)).toEqual([
      { url: "wss://relay.example", enabled: true },
    ]);
    const restoredProfile = JSON.parse(localStorage.getItem(useProfileInternals.getStorageKey())!);
    expect(restoredProfile.profile.username).toBe("Restored Alice");
    expect(cryptoService.decryptDM).toHaveBeenCalled();
  });

  it("emits restore history regression diagnostics when canonical append drops outgoing DM history", async () => {
    const restoreLogSpy = vi.spyOn(appEventLogger, "logAppEvent");
    const conversationId = [publicKeyHex, acceptedPeerPublicKeyHex].sort().join(":");
    const fetchSpy = vi.spyOn(
      encryptedAccountBackupService,
      "fetchLatestEncryptedAccountBackupPayload",
    ).mockResolvedValue({
      event: {
        id: "backup-event-regression",
        pubkey: publicKeyHex,
        kind: ACCOUNT_BACKUP_EVENT_KIND,
        created_at: 101,
        tags: [["d", ACCOUNT_BACKUP_D_TAG]],
        content: "encrypted:stub",
        sig: "sig",
      },
      payload: {
        version: 1,
        publicKeyHex,
        createdAtUnixMs: 42_000,
        profile: {
          username: "Recovered",
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
          version: 2,
          createdConnections: [{
            id: conversationId,
            displayName: "Peer",
            pubkey: acceptedPeerPublicKeyHex,
            lastMessage: "from me",
            unreadCount: 0,
            lastMessageTimeMs: 2_000,
          }],
          createdGroups: [],
          unreadByConversationId: {},
          connectionOverridesByConnectionId: {},
          messagesByConversationId: {
            [conversationId]: [
              {
                id: "m-outgoing",
                content: "from me",
                timestampMs: 1_000,
                isOutgoing: true,
                status: "delivered",
                pubkey: publicKeyHex,
              },
              {
                id: "m-incoming",
                content: "from peer",
                timestampMs: 2_000,
                isOutgoing: false,
                status: "delivered",
                pubkey: acceptedPeerPublicKeyHex,
              },
            ],
          },
          groupMessages: {},
          connectionRequests: [],
          pinnedChatIds: [],
          hiddenChatIds: [],
        },
        privacySettings: PrivacySettingsService.getSettings(),
        relayList: relayListInternals.DEFAULT_RELAYS,
      },
      hasBackup: true,
      degradedReason: undefined,
    });
    const appendCanonicalEvents = vi.fn(async () => {
      chatStateStoreService.replace(publicKeyHex, {
        version: 2,
        createdConnections: [{
          id: conversationId,
          displayName: "Peer",
          pubkey: acceptedPeerPublicKeyHex,
          lastMessage: "from peer",
          unreadCount: 1,
          lastMessageTimeMs: 3_000,
        }],
        createdGroups: [],
        unreadByConversationId: {
          [conversationId]: 1,
        },
        connectionOverridesByConnectionId: {},
        messagesByConversationId: {
          [conversationId]: [{
            id: "m-incoming-only",
            content: "from peer",
            timestampMs: 3_000,
            isOutgoing: false,
            status: "delivered",
            pubkey: acceptedPeerPublicKeyHex,
          }],
        },
        groupMessages: {},
        connectionRequests: [],
        pinnedChatIds: [],
        hiddenChatIds: [],
      }, { emitMutationSignal: false });
    });

    await encryptedAccountBackupService.restoreEncryptedAccountBackup({
      publicKeyHex,
      privateKeyHex,
      pool: {
        connections: [],
        waitForConnection: vi.fn(async () => true),
        sendToOpen: vi.fn(),
        subscribeToMessages: () => () => undefined,
      } as any,
      profileId: "default",
      appendCanonicalEvents,
    });

    const regressionLogs: ReadonlyArray<Parameters<typeof appEventLogger.logAppEvent>[0]> = (
      restoreLogSpy.mock.calls
        .map((call) => call[0])
        .filter((entry): entry is Parameters<typeof appEventLogger.logAppEvent>[0] => (
          entry.name === "account_sync.backup_restore_history_regression"
        ))
    );
    expect(regressionLogs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        context: expect.objectContaining({
          stage: "post_apply_to_post_canonical_append",
          restorePath: "relay_sync_append",
          dmOutgoingDropped: true,
          dmAttachmentDropped: false,
          groupAttachmentDropped: false,
          dmOutgoingDelta: -1,
          canonicalEventCount: expect.any(Number),
        }),
      }),
    ]));
    expect(Number(regressionLogs[0]?.context?.canonicalEventCount ?? 0)).toBeGreaterThan(0);

    fetchSpy.mockRestore();
    restoreLogSpy.mockRestore();
  });

  it("emits restore profile-scope mismatch diagnostics when explicit profile scope differs from active binding", async () => {
    const restoreLogSpy = vi.spyOn(appEventLogger, "logAppEvent");
    const fetchSpy = vi.spyOn(encryptedAccountBackupService, "fetchLatestEncryptedAccountBackupPayload").mockResolvedValue({
      event: {
        id: "backup-event-scope",
        pubkey: publicKeyHex,
        kind: ACCOUNT_BACKUP_EVENT_KIND,
        created_at: 100,
        tags: [],
        content: "encrypted:{}",
      } as any,
      payload: {
        version: 1,
        publicKeyHex,
        createdAtUnixMs: 9_000,
        profile: {
          username: "Scoped Restore",
          about: "",
          avatarUrl: "",
          nip05: "",
          inviteCode: "",
        },
        peerTrust: {
          acceptedPeers: [],
          mutedPeers: [],
        },
        requestFlowEvidence: { byPeer: {} },
        requestOutbox: { records: [] },
        syncCheckpoints: [],
        chatState: null,
        privacySettings: PrivacySettingsService.getSettings(),
        relayList: relayListInternals.DEFAULT_RELAYS,
      },
      hasBackup: true,
      degradedReason: undefined,
    });
    setProfileScopeOverride("bound-profile");

    await encryptedAccountBackupService.restoreEncryptedAccountBackup({
      publicKeyHex,
      privateKeyHex,
      pool: {
        connections: [],
        waitForConnection: vi.fn(async () => true),
        sendToOpen: vi.fn(),
        subscribeToMessages: () => () => undefined,
      } as any,
      profileId: "requested-profile",
    });

    const mismatchLogs: ReadonlyArray<Parameters<typeof appEventLogger.logAppEvent>[0]> = (
      restoreLogSpy.mock.calls
        .map((call) => call[0])
        .filter((entry): entry is Parameters<typeof appEventLogger.logAppEvent>[0] => (
          entry.name === "account_sync.backup_restore_profile_scope_mismatch"
        ))
    );
    expect(mismatchLogs).toHaveLength(1);
    expect(mismatchLogs[0]?.context).toEqual(expect.objectContaining({
      reasonCode: "requested_profile_not_active",
      backupEventId: "backup-event-scope",
      requestedProfileId: "requested-profile",
      effectiveProfileId: "requested-profile",
      activeProfileIdAtRestoreStart: "bound-profile",
      activeProfileIdBeforeApply: "bound-profile",
      activeProfileIdAfterApply: "bound-profile",
      hasCanonicalAppender: false,
    }));

    setProfileScopeOverride(null);
    fetchSpy.mockRestore();
    restoreLogSpy.mockRestore();
  });

  it("waits for all open relay EOSE frames before selecting latest backup event", async () => {
    const selectionLogSpy = vi.spyOn(appEventLogger, "logAppEvent");
    let currentSubId = "";
    const buildBackupPayload = (createdAtUnixMs: number, username: string) => JSON.stringify({
      version: 1,
      publicKeyHex,
      createdAtUnixMs,
      profile: {
        username,
        about: "",
        avatarUrl: "",
        nip05: "",
        inviteCode: "",
      },
      peerTrust: { acceptedPeers: [], mutedPeers: [] },
      requestFlowEvidence: { byPeer: {} },
      requestOutbox: { records: [] },
      syncCheckpoints: [],
      chatState: null,
      privacySettings: PrivacySettingsService.getSettings(),
      relayList: relayListInternals.DEFAULT_RELAYS,
    });
    const pool = {
      connections: [
        { url: "wss://relay-fast.example", status: "open" },
        { url: "wss://relay-slow.example", status: "open" },
      ],
      waitForConnection: vi.fn(async () => true),
      sendToOpen: vi.fn((payload: string) => {
        currentSubId = JSON.parse(payload)[1];
      }),
      subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => {
        queueMicrotask(() => {
          handler({
            url: "wss://relay-fast.example",
            message: JSON.stringify(["EVENT", currentSubId, {
              id: "backup-event-old",
              pubkey: publicKeyHex,
              kind: ACCOUNT_BACKUP_EVENT_KIND,
              created_at: 50,
              tags: [
                ["d", ACCOUNT_BACKUP_D_TAG],
                ["obscur_backup_created_at_ms", "1000"],
              ],
              content: `encrypted:${buildBackupPayload(1_000, "Old Snapshot")}`,
            }]),
          });
          handler({
            url: "wss://relay-fast.example",
            message: JSON.stringify(["EOSE", currentSubId]),
          });
          window.setTimeout(() => {
            handler({
              url: "wss://relay-slow.example",
              message: JSON.stringify(["EVENT", currentSubId, {
                id: "backup-event-new",
                pubkey: publicKeyHex,
                kind: ACCOUNT_BACKUP_EVENT_KIND,
                created_at: 50,
                tags: [
                  ["d", ACCOUNT_BACKUP_D_TAG],
                  ["obscur_backup_created_at_ms", "2000"],
                ],
                content: `encrypted:${buildBackupPayload(2_000, "New Snapshot")}`,
              }]),
            });
            handler({
              url: "wss://relay-slow.example",
              message: JSON.stringify(["EOSE", currentSubId]),
            });
          }, 5);
        });
        return () => undefined;
      },
    };

    const fetched = await encryptedAccountBackupService.fetchLatestEncryptedAccountBackupPayload({
      publicKeyHex,
      privateKeyHex,
      pool,
    });

    expect(fetched.event?.id).toBe("backup-event-new");
    expect(fetched.payload?.createdAtUnixMs).toBe(2_000);
    expect(fetched.payload?.profile.username).toBe("New Snapshot");
    const selectionLogs: ReadonlyArray<Parameters<typeof appEventLogger.logAppEvent>[0]> = (
      selectionLogSpy.mock.calls
        .map((call) => call[0])
        .filter((entry): entry is Parameters<typeof appEventLogger.logAppEvent>[0] => (
          entry.name === "account_sync.backup_restore_selection"
        ))
    );
    expect(selectionLogs).toHaveLength(1);
    expect(selectionLogs[0]?.context).toEqual(expect.objectContaining({
      source: "pool",
      poolOpenRelayCount: 2,
      poolExpectedEoseRelayCount: 2,
      poolReceivedEoseRelayCount: 2,
      poolCandidateCount: 2,
      poolTimedOut: false,
      fallbackRelayCount: 0,
      selectedEventId: "backup-event-new",
      selectedEventCreatedAtUnixSeconds: 50,
      selectedPayloadCreatedAtUnixMs: 2_000,
    }));
    selectionLogSpy.mockRestore();
  });

  it("treats undecryptable relay backup as degraded instead of throwing", async () => {
    let currentSubId = "";
    vi.mocked(cryptoService.decryptDM).mockRejectedValueOnce(new Error("OperationError"));
    const pool = {
      connections: [{ url: "wss://relay.example", status: "open" }],
      waitForConnection: vi.fn(async () => true),
      sendToOpen: vi.fn((payload: string) => {
        currentSubId = JSON.parse(payload)[1];
      }),
      subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => {
        queueMicrotask(() => {
          handler({
            url: "wss://relay.example",
            message: JSON.stringify(["EVENT", currentSubId, {
              id: "backup-event-id",
              pubkey: publicKeyHex,
              kind: ACCOUNT_BACKUP_EVENT_KIND,
              created_at: 10,
              tags: [["d", ACCOUNT_BACKUP_D_TAG]],
              content: "encrypted:broken",
            }]),
          });
          handler({
            url: "wss://relay.example",
            message: JSON.stringify(["EOSE", currentSubId]),
          });
        });
        return () => undefined;
      },
    };

    await expect(encryptedAccountBackupService.restoreEncryptedAccountBackup({
      publicKeyHex,
      privateKeyHex,
      pool,
    })).resolves.toEqual(expect.objectContaining({
      event: expect.objectContaining({ id: "backup-event-id" }),
      payload: null,
      hasBackup: true,
      degradedReason: "Encrypted account backup could not be decrypted with this key.",
    }));
  });

  it("merges used-device private state deterministically before overwrite", () => {
    const merged = encryptedAccountBackupServiceInternals.mergePeerTrust(
      { acceptedPeers: [publicKeyHex], mutedPeers: [] },
      { acceptedPeers: [], mutedPeers: [publicKeyHex] }
    );

    expect(merged.acceptedPeers).toEqual([publicKeyHex]);
    expect(merged.mutedPeers).toEqual([publicKeyHex]);
  });

  it("preserves chat history when merging chat state payloads", () => {
    const merged = encryptedAccountBackupServiceInternals.mergeChatState({
      version: 2,
      createdConnections: [],
      createdGroups: [],
      unreadByConversationId: {},
      connectionOverridesByConnectionId: {},
      messagesByConversationId: {
        "dm:peer": [
          {
            id: "m-1",
            content: "hello",
            timestampMs: 10,
            isOutgoing: true,
            status: "delivered",
          },
        ],
      },
      groupMessages: {
        "group:one": [
          {
            id: "g-1",
            pubkey: publicKeyHex,
            created_at: 100,
            content: "group message",
          },
        ],
      },
      connectionRequests: [],
      pinnedChatIds: [],
      hiddenChatIds: [],
    }, {
      version: 2,
      createdConnections: [],
      createdGroups: [],
      unreadByConversationId: {},
      connectionOverridesByConnectionId: {},
      messagesByConversationId: {
        "dm:peer": [
          {
            id: "m-2",
            content: "world",
            timestampMs: 20,
            isOutgoing: false,
            status: "delivered",
          },
        ],
      },
      groupMessages: {},
      connectionRequests: [],
      pinnedChatIds: [],
      hiddenChatIds: [],
    });

    expect(merged?.messagesByConversationId["dm:peer"]).toEqual([
      expect.objectContaining({ id: "m-1" }),
      expect.objectContaining({ id: "m-2" }),
    ]);
    expect(merged?.groupMessages?.["group:one"]).toEqual([
      expect.objectContaining({ id: "g-1" }),
    ]);
  });

  it("uses same-account recovery snapshot as restore merge baseline when hydrated local state is empty", async () => {
    const emptyChatState = {
      version: 2 as const,
      createdConnections: [],
      createdGroups: [],
      unreadByConversationId: {},
      connectionOverridesByConnectionId: {},
      messagesByConversationId: {},
      groupMessages: {},
      connectionRequests: [],
      pinnedChatIds: [],
      hiddenChatIds: [],
    };
    const recoveryPayload = {
      version: 1 as const,
      publicKeyHex,
      createdAtUnixMs: 900_000,
      profile: {
        username: "Recovered Tester",
        about: "",
        avatarUrl: "",
        nip05: "",
        inviteCode: "",
      },
      peerTrust: {
        acceptedPeers: [acceptedPeerPublicKeyHex],
        mutedPeers: [],
      },
      requestFlowEvidence: { byPeer: {} },
      requestOutbox: { records: [] },
      syncCheckpoints: [],
      chatState: {
        ...emptyChatState,
        createdConnections: [{
          id: "dm:recovery",
          displayName: "Peer",
          pubkey: acceptedPeerPublicKeyHex,
          lastMessage: "recovered message",
          unreadCount: 0,
          lastMessageTimeMs: 4_000,
        }],
        messagesByConversationId: {
          "dm:recovery": [{
            id: "recovered-1",
            content: "recovered message",
            timestampMs: 4_000,
            isOutgoing: true,
            status: "delivered",
            pubkey: publicKeyHex,
          }],
        },
      },
      privacySettings: PrivacySettingsService.getSettings(),
      relayList: relayListInternals.DEFAULT_RELAYS,
      identityUnlock: {
        encryptedPrivateKey: "enc:recovered",
      },
    };
    window.localStorage.setItem(
      encryptedAccountBackupServiceInternals.getRecoverySnapshotStorageKey(publicKeyHex),
      JSON.stringify(recoveryPayload),
    );

    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue(emptyChatState);
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([]);
    const queueSpy = vi.spyOn(MessageQueue.prototype, "getAllMessages").mockResolvedValue([] as any);

    const merged = await encryptedAccountBackupServiceInternals.mergeIncomingRestorePayload(publicKeyHex, {
      version: 1,
      publicKeyHex,
      createdAtUnixMs: 901_000,
      profile: {
        username: "Incoming",
        about: "",
        avatarUrl: "",
        nip05: "",
        inviteCode: "",
      },
      peerTrust: {
        acceptedPeers: [],
        mutedPeers: [],
      },
      requestFlowEvidence: { byPeer: {} },
      requestOutbox: { records: [] },
      syncCheckpoints: [],
      chatState: emptyChatState,
      privacySettings: PrivacySettingsService.getSettings(),
      relayList: relayListInternals.DEFAULT_RELAYS,
    });

    expect(merged.chatState?.messagesByConversationId["dm:recovery"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "recovered-1",
        isOutgoing: true,
      }),
    ]));
    expect(merged.chatState?.createdConnections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "dm:recovery",
        pubkey: acceptedPeerPublicKeyHex,
      }),
    ]));

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    queueSpy.mockRestore();
  });

  it("keeps richer group metadata and member coverage when newer backup row is regressed", () => {
    const merged = encryptedAccountBackupServiceInternals.mergeChatState({
      version: 2,
      createdConnections: [],
      createdGroups: [{
        id: "community:alpha:wss://relay.example",
        communityId: "alpha:wss://relay.example",
        groupId: "alpha",
        relayUrl: "wss://relay.example",
        displayName: "Alpha Team",
        memberPubkeys: [publicKeyHex, acceptedPeerPublicKeyHex],
        lastMessage: "older rich metadata",
        unreadCount: 0,
        lastMessageTimeMs: 1_000,
        access: "invite-only",
        memberCount: 2,
        adminPubkeys: [publicKeyHex],
        avatar: "https://cdn.example/alpha.png",
      }],
      unreadByConversationId: {},
      connectionOverridesByConnectionId: {},
      messagesByConversationId: {},
      groupMessages: {},
      connectionRequests: [],
      pinnedChatIds: [],
      hiddenChatIds: [],
    }, {
      version: 2,
      createdConnections: [],
      createdGroups: [{
        id: "group:alpha:wss://relay.example",
        communityId: "alpha:wss://relay.example",
        groupId: "alpha",
        relayUrl: "wss://relay.example",
        displayName: "Private Group",
        memberPubkeys: [acceptedPeerPublicKeyHex],
        lastMessage: "newer but regressed metadata",
        unreadCount: 0,
        lastMessageTimeMs: 2_000,
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
    });

    expect(merged?.createdGroups).toHaveLength(1);
    expect(merged?.createdGroups[0]).toEqual(expect.objectContaining({
      groupId: "alpha",
      relayUrl: "wss://relay.example",
      displayName: "Alpha Team",
      avatar: "https://cdn.example/alpha.png",
    }));
    expect(merged?.createdGroups[0]?.memberPubkeys).toEqual(expect.arrayContaining([
      publicKeyHex,
      acceptedPeerPublicKeyHex,
    ]));
    expect((merged?.createdGroups[0]?.memberCount ?? 0) >= 2).toBe(true);
  });

  it("hydrates indexed chat state before publishing encrypted backup", async () => {
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
      version: 2,
      createdConnections: [],
      createdGroups: [],
      unreadByConversationId: {},
      connectionOverridesByConnectionId: {},
      messagesByConversationId: {
        "dm:peer": [
          {
            id: "msg-hydrated",
            content: "restored from db",
            timestampMs: 33,
            isOutgoing: true,
            status: "delivered",
          },
        ],
      },
      groupMessages: {},
      connectionRequests: [],
      pinnedChatIds: [],
      hiddenChatIds: [],
    });

    const pool = {
      connections: [{ url: "wss://relay.example", status: "open" }],
      waitForConnection: vi.fn(async () => true),
      publishToUrls: vi.fn(async () => ({
        success: true,
        successCount: 1,
        totalRelays: 1,
        metQuorum: true,
        quorumRequired: 1,
        results: [{ relayUrl: "wss://relay.example", success: true }],
      })),
    };

    await encryptedAccountBackupService.publishEncryptedAccountBackup({
      publicKeyHex,
      privateKeyHex,
      pool,
      scopedRelayUrls: ["wss://relay.example"],
    });

    expect(hydrateSpy).toHaveBeenCalledWith(publicKeyHex);
    expect(loadSpy).toHaveBeenCalled();
    expect(cryptoService.encryptDM).toHaveBeenCalledWith(
      expect.stringContaining("\"msg-hydrated\""),
      publicKeyHex,
      privateKeyHex,
    );

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
  });

  it("hydrates backup payload from indexed message records when chat state message map is empty", async () => {
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
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
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([
      {
        id: "sent-1",
        conversationId: "legacy-thread-1",
        senderPubkey: publicKeyHex,
        recipientPubkey: acceptedPeerPublicKeyHex,
        content: "from me",
        isOutgoing: true,
        status: "accepted",
        timestampMs: 1000,
        ownerPubkey: publicKeyHex,
      },
      {
        id: "recv-1",
        conversationId: "legacy-thread-1",
        senderPubkey: acceptedPeerPublicKeyHex,
        recipientPubkey: publicKeyHex,
        content: "from peer",
        isOutgoing: false,
        status: "delivered",
        timestampMs: 2000,
        ownerPubkey: publicKeyHex,
      },
    ]);

    const payload = await encryptedAccountBackupServiceInternals.buildBackupPayloadWithHydratedChatState(publicKeyHex);

    expect(hydrateSpy).toHaveBeenCalledWith(publicKeyHex);
    expect(getAllByIndexSpy).toHaveBeenCalledWith(
      "messages",
      "timestampMs",
      undefined,
      2_000,
      "prev",
    );
    expect(payload.chatState?.messagesByConversationId["legacy-thread-1"]).toEqual([
      expect.objectContaining({
        id: "sent-1",
        isOutgoing: true,
        pubkey: publicKeyHex,
      }),
      expect.objectContaining({
        id: "recv-1",
        isOutgoing: false,
        pubkey: acceptedPeerPublicKeyHex,
      }),
    ]);
    expect(payload.chatState?.createdConnections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "legacy-thread-1",
        pubkey: acceptedPeerPublicKeyHex,
      }),
    ]));

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
  });

  it("hydrates group history from indexed message records into backup chat-state group timelines", async () => {
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
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
    const groupConversationId = "community:alpha:wss://relay.example";
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([
      {
        id: "group-out-1",
        conversationId: groupConversationId,
        senderPubkey: publicKeyHex,
        content: "group message from me",
        isOutgoing: true,
        status: "delivered",
        timestampMs: 8_000,
        ownerPubkey: publicKeyHex,
      },
      {
        id: "group-in-1",
        conversationId: groupConversationId,
        senderPubkey: acceptedPeerPublicKeyHex,
        content: "group message from peer",
        isOutgoing: false,
        status: "delivered",
        timestampMs: 9_000,
        ownerPubkey: publicKeyHex,
      },
    ]);

    const payload = await encryptedAccountBackupServiceInternals.buildBackupPayloadWithHydratedChatState(publicKeyHex);

    expect(hydrateSpy).toHaveBeenCalledWith(publicKeyHex);
    expect(getAllByIndexSpy).toHaveBeenCalled();
    expect(payload.chatState?.groupMessages?.[groupConversationId]).toEqual([
      {
        id: "group-out-1",
        pubkey: publicKeyHex,
        content: "group message from me",
        created_at: 8,
      },
      {
        id: "group-in-1",
        pubkey: acceptedPeerPublicKeyHex,
        content: "group message from peer",
        created_at: 9,
      },
    ]);
    expect(payload.chatState?.messagesByConversationId[groupConversationId]).toBeUndefined();

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
  });

  it("hydrates legacy indexed records that only include pubkey metadata", async () => {
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
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
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([
      {
        id: "legacy-out-1",
        conversationId: "legacy-thread-2",
        pubkey: publicKeyHex,
        content: "from me legacy",
        status: "accepted",
        timestampMs: 6_000,
        ownerPubkey: publicKeyHex,
      },
      {
        id: "legacy-in-1",
        conversationId: "legacy-thread-2",
        pubkey: acceptedPeerPublicKeyHex,
        content: "from peer legacy",
        status: "delivered",
        timestampMs: 7_000,
        ownerPubkey: publicKeyHex,
      },
    ]);

    const payload = await encryptedAccountBackupServiceInternals.buildBackupPayloadWithHydratedChatState(publicKeyHex);

    expect(hydrateSpy).toHaveBeenCalledWith(publicKeyHex);
    expect(getAllByIndexSpy).toHaveBeenCalled();
    expect(payload.chatState?.messagesByConversationId["legacy-thread-2"]).toEqual([
      expect.objectContaining({
        id: "legacy-out-1",
        isOutgoing: true,
        pubkey: publicKeyHex,
      }),
      expect.objectContaining({
        id: "legacy-in-1",
        isOutgoing: false,
        pubkey: acceptedPeerPublicKeyHex,
      }),
    ]);

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
  });

  it("hydrates legacy DM indexed records with missing sender metadata from recipient plus conversation evidence", async () => {
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
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
    const conversationId = `${publicKeyHex}:${acceptedPeerPublicKeyHex}`;
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([
      {
        id: "legacy-infer-out-1",
        conversationId,
        recipientPubkey: acceptedPeerPublicKeyHex,
        content: "outgoing without sender metadata",
        status: "accepted",
        timestampMs: 8_000,
        ownerPubkey: publicKeyHex,
      },
      {
        id: "legacy-infer-in-1",
        conversationId,
        recipientPubkey: publicKeyHex,
        content: "incoming without sender metadata",
        status: "delivered",
        timestampMs: 8_100,
        ownerPubkey: publicKeyHex,
      },
    ]);
    const accountEventsSpy = vi.spyOn(accountEventStore, "loadEvents").mockResolvedValue([]);

    const payload = await encryptedAccountBackupServiceInternals.buildBackupPayloadWithHydratedChatState(publicKeyHex);

    expect(hydrateSpy).toHaveBeenCalledWith(publicKeyHex);
    expect(getAllByIndexSpy).toHaveBeenCalled();
    expect(payload.chatState?.messagesByConversationId[conversationId]).toEqual([
      expect.objectContaining({
        id: "legacy-infer-out-1",
        isOutgoing: true,
        pubkey: publicKeyHex,
      }),
      expect.objectContaining({
        id: "legacy-infer-in-1",
        isOutgoing: false,
        pubkey: acceptedPeerPublicKeyHex,
      }),
    ]);
    expect(payload.chatState?.createdConnections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: conversationId,
        pubkey: acceptedPeerPublicKeyHex,
      }),
    ]));
    expect(accountEventsSpy).not.toHaveBeenCalled();

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    accountEventsSpy.mockRestore();
  });

  it("hydrates backup payload from message queue records when indexed message store is empty", async () => {
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
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
    const currentSettings = PrivacySettingsService.getSettings();
    PrivacySettingsService.saveSettings({
      ...currentSettings,
      accountSyncConvergenceV091: true,
    });
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([]);
    const queueSpy = vi.spyOn(MessageQueue.prototype, "getAllMessages").mockResolvedValue([
      {
        id: "queue-sent-1",
        conversationId: "queue-thread-1",
        senderPubkey: publicKeyHex,
        recipientPubkey: acceptedPeerPublicKeyHex,
        content: "sent via queue store",
        isOutgoing: true,
        status: "accepted",
        timestamp: new Date(4_000),
        ownerPubkey: publicKeyHex,
      },
      {
        id: "queue-recv-1",
        conversationId: "queue-thread-1",
        senderPubkey: acceptedPeerPublicKeyHex,
        recipientPubkey: publicKeyHex,
        content: "received via queue store",
        isOutgoing: false,
        status: "delivered",
        timestamp: new Date(5_000),
        ownerPubkey: publicKeyHex,
      },
    ] as any);

    const payload = await encryptedAccountBackupServiceInternals.buildBackupPayloadWithHydratedChatState(publicKeyHex);

    expect(hydrateSpy).toHaveBeenCalledWith(publicKeyHex);
    expect(getAllByIndexSpy).toHaveBeenCalledWith(
      "messages",
      "timestampMs",
      undefined,
      2_000,
      "prev",
    );
    expect(queueSpy).toHaveBeenCalledTimes(1);
    expect(payload.chatState?.messagesByConversationId["queue-thread-1"]).toEqual([
      expect.objectContaining({
        id: "queue-sent-1",
        isOutgoing: true,
        pubkey: publicKeyHex,
      }),
      expect.objectContaining({
        id: "queue-recv-1",
        isOutgoing: false,
        pubkey: acceptedPeerPublicKeyHex,
      }),
    ]);
    expect(payload.chatState?.createdConnections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "queue-thread-1",
        pubkey: acceptedPeerPublicKeyHex,
      }),
    ]));

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    queueSpy.mockRestore();
    PrivacySettingsService.saveSettings(currentSettings);
  });

  it("hydrates outbound backup history from queue records when indexed records lack sent-message evidence", async () => {
    const currentSettings = PrivacySettingsService.getSettings();
    PrivacySettingsService.saveSettings({
      ...currentSettings,
      accountSyncConvergenceV091: false,
    });
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
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
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([
      {
        id: "indexed-recv-1",
        conversationId: "queue-thread-1",
        senderPubkey: acceptedPeerPublicKeyHex,
        recipientPubkey: publicKeyHex,
        content: "indexed inbound only",
        isOutgoing: false,
        status: "delivered",
        timestampMs: 1_000,
        ownerPubkey: publicKeyHex,
      },
    ]);
    const queueSpy = vi.spyOn(MessageQueue.prototype, "getAllMessages").mockResolvedValue([
      {
        id: "queue-sent-1",
        conversationId: "queue-thread-1",
        senderPubkey: publicKeyHex,
        recipientPubkey: acceptedPeerPublicKeyHex,
        content: "sent via queue store",
        isOutgoing: true,
        status: "accepted",
        timestamp: new Date(4_000),
        ownerPubkey: publicKeyHex,
      },
    ] as any);

    const payload = await encryptedAccountBackupServiceInternals.buildBackupPayloadWithHydratedChatState(publicKeyHex);

    expect(hydrateSpy).toHaveBeenCalledWith(publicKeyHex);
    expect(getAllByIndexSpy).toHaveBeenCalled();
    expect(queueSpy).toHaveBeenCalledTimes(1);
    expect(payload.chatState?.messagesByConversationId["queue-thread-1"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "queue-sent-1",
        isOutgoing: true,
        pubkey: publicKeyHex,
      }),
      expect.objectContaining({
        id: "indexed-recv-1",
        isOutgoing: false,
        pubkey: acceptedPeerPublicKeyHex,
      }),
    ]));

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    queueSpy.mockRestore();
    PrivacySettingsService.saveSettings(currentSettings);
  });

  it("hydrates queue records for conversations that are inbound-only in indexed storage", async () => {
    const currentSettings = PrivacySettingsService.getSettings();
    PrivacySettingsService.saveSettings({
      ...currentSettings,
      accountSyncConvergenceV091: false,
    });
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
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
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([
      {
        id: "indexed-sent-keep",
        conversationId: "indexed-thread-1",
        senderPubkey: publicKeyHex,
        recipientPubkey: acceptedPeerPublicKeyHex,
        content: "indexed sent",
        isOutgoing: true,
        status: "accepted",
        timestampMs: 3_000,
        ownerPubkey: publicKeyHex,
      },
      {
        id: "indexed-inbound-only",
        conversationId: "indexed-thread-2",
        senderPubkey: acceptedPeerPublicKeyHex,
        recipientPubkey: publicKeyHex,
        content: "indexed inbound only",
        isOutgoing: false,
        status: "delivered",
        timestampMs: 3_100,
        ownerPubkey: publicKeyHex,
      },
    ]);
    const queueSpy = vi.spyOn(MessageQueue.prototype, "getAllMessages").mockResolvedValue([
      {
        id: "queue-outbound-missing",
        conversationId: "indexed-thread-2",
        senderPubkey: publicKeyHex,
        recipientPubkey: acceptedPeerPublicKeyHex,
        content: "queue sent for inbound-only conversation",
        isOutgoing: true,
        status: "accepted",
        timestamp: new Date(3_200),
        ownerPubkey: publicKeyHex,
      },
    ] as any);

    const payload = await encryptedAccountBackupServiceInternals.buildBackupPayloadWithHydratedChatState(publicKeyHex);

    expect(hydrateSpy).toHaveBeenCalledWith(publicKeyHex);
    expect(getAllByIndexSpy).toHaveBeenCalled();
    expect(queueSpy).toHaveBeenCalledTimes(1);
    expect(payload.chatState?.messagesByConversationId["indexed-thread-2"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "indexed-inbound-only",
        isOutgoing: false,
      }),
      expect.objectContaining({
        id: "queue-outbound-missing",
        isOutgoing: true,
        pubkey: publicKeyHex,
      }),
    ]));

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    queueSpy.mockRestore();
    PrivacySettingsService.saveSettings(currentSettings);
  });

  it("preserves existing attachment metadata when indexed hydration sees the same message id without attachments", async () => {
    const currentSettings = PrivacySettingsService.getSettings();
    PrivacySettingsService.saveSettings({
      ...currentSettings,
      accountSyncConvergenceV091: false,
    });
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
      version: 2,
      createdConnections: [{
        id: "attachment-preserve-thread",
        displayName: "Peer",
        pubkey: acceptedPeerPublicKeyHex,
        lastMessage: "media message",
        unreadCount: 0,
        lastMessageTimeMs: 60_000,
      }],
      createdGroups: [],
      unreadByConversationId: {},
      connectionOverridesByConnectionId: {},
      messagesByConversationId: {
        "attachment-preserve-thread": [{
          id: "attachment-preserve-message",
          content: "media message",
          timestampMs: 60_000,
          isOutgoing: true,
          status: "accepted",
          pubkey: publicKeyHex,
          attachments: [{
            kind: "image",
            url: "https://image.nostr.build/preserved-image.jpg",
            contentType: "image/jpeg",
            fileName: "preserved-image.jpg",
          }],
        }],
      },
      groupMessages: {},
      connectionRequests: [],
      pinnedChatIds: [],
      hiddenChatIds: [],
    });
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([
      {
        id: "attachment-preserve-message",
        conversationId: "attachment-preserve-thread",
        senderPubkey: publicKeyHex,
        recipientPubkey: acceptedPeerPublicKeyHex,
        content: "media message",
        isOutgoing: true,
        status: "accepted",
        timestampMs: 60_000,
        ownerPubkey: publicKeyHex,
      },
    ]);
    const queueSpy = vi.spyOn(MessageQueue.prototype, "getAllMessages").mockResolvedValue([] as any);

    const payload = await encryptedAccountBackupServiceInternals.buildBackupPayloadWithHydratedChatState(publicKeyHex);
    const mergedMessage = payload.chatState?.messagesByConversationId["attachment-preserve-thread"]?.find(
      (message) => message.id === "attachment-preserve-message",
    );

    expect(hydrateSpy).toHaveBeenCalledWith(publicKeyHex);
    expect(getAllByIndexSpy).toHaveBeenCalled();
    expect(mergedMessage?.attachments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "image",
        url: "https://image.nostr.build/preserved-image.jpg",
      }),
    ]));

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    queueSpy.mockRestore();
    PrivacySettingsService.saveSettings(currentSettings);
  });

  it("skips queue scan when convergence guard is disabled and indexed records already include outbound evidence", async () => {
    const currentSettings = PrivacySettingsService.getSettings();
    PrivacySettingsService.saveSettings({
      ...currentSettings,
      accountSyncConvergenceV091: false,
    });
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
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
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([
      {
        id: "indexed-sent-1",
        conversationId: "indexed-thread-1",
        senderPubkey: publicKeyHex,
        recipientPubkey: acceptedPeerPublicKeyHex,
        content: "indexed sent",
        isOutgoing: true,
        status: "accepted",
        timestampMs: 3_000,
        ownerPubkey: publicKeyHex,
      },
    ]);
    const queueSpy = vi.spyOn(MessageQueue.prototype, "getAllMessages").mockResolvedValue([
      {
        id: "queue-sent-1",
        conversationId: "queue-thread-1",
        senderPubkey: publicKeyHex,
        recipientPubkey: acceptedPeerPublicKeyHex,
        content: "queue sent",
        isOutgoing: true,
        status: "accepted",
        timestamp: new Date(4_000),
        ownerPubkey: publicKeyHex,
      },
    ] as any);

    const payload = await encryptedAccountBackupServiceInternals.buildBackupPayloadWithHydratedChatState(publicKeyHex);

    expect(hydrateSpy).toHaveBeenCalledWith(publicKeyHex);
    expect(getAllByIndexSpy).toHaveBeenCalled();
    expect(queueSpy).not.toHaveBeenCalled();
    expect(payload.chatState?.messagesByConversationId["indexed-thread-1"]).toEqual([
      expect.objectContaining({
        id: "indexed-sent-1",
        isOutgoing: true,
        pubkey: publicKeyHex,
      }),
    ]);

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    queueSpy.mockRestore();
    PrivacySettingsService.saveSettings(currentSettings);
  });

  it("falls back to canonical account-event projection when local stores have no outbound messages", async () => {
    const currentSettings = PrivacySettingsService.getSettings();
    PrivacySettingsService.saveSettings({
      ...currentSettings,
      accountSyncConvergenceV091: false,
    });
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
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
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([
      {
        id: "indexed-inbound-only",
        conversationId: "projection-thread-1",
        senderPubkey: acceptedPeerPublicKeyHex,
        recipientPubkey: publicKeyHex,
        content: "inbound only",
        isOutgoing: false,
        status: "delivered",
        timestampMs: 8_000,
        ownerPubkey: publicKeyHex,
      },
    ]);
    const queueSpy = vi.spyOn(MessageQueue.prototype, "getAllMessages").mockResolvedValue([] as any);
    const accountEventsSpy = vi.spyOn(accountEventStore, "loadEvents").mockResolvedValue([
      {
        sequence: 1,
        event: {
          type: "DM_RECEIVED",
          profileId: "default",
          accountPublicKeyHex: publicKeyHex,
          source: "relay_sync",
          observedAtUnixMs: 9_000,
          eventId: "projection-in-1",
          idempotencyKey: "projection-in-1",
          peerPublicKeyHex: acceptedPeerPublicKeyHex,
          conversationId: "projection-thread-1",
          messageId: "projection-in-1",
          eventCreatedAtUnixSeconds: 9,
          plaintextPreview: "projection inbound",
        },
      },
      {
        sequence: 2,
        event: {
          type: "DM_SENT_CONFIRMED",
          profileId: "default",
          accountPublicKeyHex: publicKeyHex,
          source: "legacy_bridge",
          observedAtUnixMs: 10_000,
          eventId: "projection-out-1",
          idempotencyKey: "projection-out-1",
          peerPublicKeyHex: acceptedPeerPublicKeyHex,
          conversationId: "projection-thread-1",
          messageId: "projection-out-1",
          eventCreatedAtUnixSeconds: 10,
          plaintextPreview: "projection outbound",
        },
      },
    ] as any);

    const payload = await encryptedAccountBackupServiceInternals.buildBackupPayloadWithHydratedChatState(publicKeyHex);

    expect(hydrateSpy).toHaveBeenCalledWith(publicKeyHex);
    expect(getAllByIndexSpy).toHaveBeenCalled();
    expect(queueSpy).toHaveBeenCalledTimes(1);
    expect(accountEventsSpy).toHaveBeenCalledTimes(1);
    expect(payload.chatState?.messagesByConversationId["projection-thread-1"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "projection-in-1",
        isOutgoing: false,
      }),
      expect.objectContaining({
        id: "projection-out-1",
        isOutgoing: true,
        pubkey: publicKeyHex,
      }),
    ]));

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    queueSpy.mockRestore();
    accountEventsSpy.mockRestore();
    PrivacySettingsService.saveSettings(currentSettings);
  });

  it("falls back to canonical account-event projection when outgoing evidence is sparse", async () => {
    const currentSettings = PrivacySettingsService.getSettings();
    PrivacySettingsService.saveSettings({
      ...currentSettings,
      accountSyncConvergenceV091: false,
    });
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
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
    const indexedRecords = Array.from({ length: 16 }, (_, index) => (
      index === 0
        ? {
          id: "indexed-sparse-out-1",
          conversationId: "projection-thread-2",
          senderPubkey: publicKeyHex,
          recipientPubkey: acceptedPeerPublicKeyHex,
          content: "legacy sparse outgoing",
          isOutgoing: true,
          status: "delivered",
          timestampMs: 30_000,
          ownerPubkey: publicKeyHex,
        }
        : {
          id: `indexed-sparse-in-${index}`,
          conversationId: "projection-thread-2",
          senderPubkey: acceptedPeerPublicKeyHex,
          recipientPubkey: publicKeyHex,
          content: `legacy incoming ${index}`,
          isOutgoing: false,
          status: "delivered",
          timestampMs: 30_000 + index,
          ownerPubkey: publicKeyHex,
        }
    ));
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue(indexedRecords as any);
    const queueSpy = vi.spyOn(MessageQueue.prototype, "getAllMessages").mockResolvedValue([] as any);
    const accountEventsSpy = vi.spyOn(accountEventStore, "loadEvents").mockResolvedValue([
      {
        sequence: 1,
        event: {
          type: "DM_RECEIVED",
          profileId: "default",
          accountPublicKeyHex: publicKeyHex,
          source: "relay_sync",
          observedAtUnixMs: 31_000,
          eventId: "projection2-in-1",
          idempotencyKey: "projection2-in-1",
          peerPublicKeyHex: acceptedPeerPublicKeyHex,
          conversationId: "projection-thread-2",
          messageId: "projection2-in-1",
          eventCreatedAtUnixSeconds: 31,
          plaintextPreview: "projection inbound",
        },
      },
      {
        sequence: 2,
        event: {
          type: "DM_SENT_CONFIRMED",
          profileId: "default",
          accountPublicKeyHex: publicKeyHex,
          source: "legacy_bridge",
          observedAtUnixMs: 32_000,
          eventId: "projection2-out-1",
          idempotencyKey: "projection2-out-1",
          peerPublicKeyHex: acceptedPeerPublicKeyHex,
          conversationId: "projection-thread-2",
          messageId: "projection2-out-1",
          eventCreatedAtUnixSeconds: 32,
          plaintextPreview: "projection outbound",
        },
      },
    ] as any);

    const payload = await encryptedAccountBackupServiceInternals.buildBackupPayloadWithHydratedChatState(publicKeyHex);

    expect(hydrateSpy).toHaveBeenCalledWith(publicKeyHex);
    expect(getAllByIndexSpy).toHaveBeenCalled();
    expect(accountEventsSpy).toHaveBeenCalledTimes(1);
    expect(payload.chatState?.messagesByConversationId["projection-thread-2"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "projection2-out-1",
        isOutgoing: true,
        pubkey: publicKeyHex,
      }),
      expect.objectContaining({
        id: "projection2-in-1",
        isOutgoing: false,
      }),
    ]));

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    queueSpy.mockRestore();
    accountEventsSpy.mockRestore();
    PrivacySettingsService.saveSettings(currentSettings);
  });

  it("reconstructs media attachments from projection fallback plaintext previews", async () => {
    const currentSettings = PrivacySettingsService.getSettings();
    PrivacySettingsService.saveSettings({
      ...currentSettings,
      accountSyncConvergenceV091: false,
    });
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
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
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([
      {
        id: "indexed-media-inbound-only",
        conversationId: "projection-thread-media",
        senderPubkey: acceptedPeerPublicKeyHex,
        recipientPubkey: publicKeyHex,
        content: "indexed inbound only",
        isOutgoing: false,
        status: "delivered",
        timestampMs: 40_000,
        ownerPubkey: publicKeyHex,
      },
    ]);
    const queueSpy = vi.spyOn(MessageQueue.prototype, "getAllMessages").mockResolvedValue([] as any);
    const accountEventsSpy = vi.spyOn(accountEventStore, "loadEvents").mockResolvedValue([
      {
        sequence: 1,
        event: {
          type: "DM_SENT_CONFIRMED",
          profileId: "default",
          accountPublicKeyHex: publicKeyHex,
          source: "legacy_bridge",
          observedAtUnixMs: 41_000,
          eventId: "projection-media-out",
          idempotencyKey: "projection-media-out",
          peerPublicKeyHex: acceptedPeerPublicKeyHex,
          conversationId: "projection-thread-media",
          messageId: "projection-media-out",
          eventCreatedAtUnixSeconds: 41,
          plaintextPreview: "clip [2025-clip.mp4](https://video.nostr.build/example-clip.mp4)",
        },
      },
    ] as any);

    const payload = await encryptedAccountBackupServiceInternals.buildBackupPayloadWithHydratedChatState(publicKeyHex);
    const projectionMessages = payload.chatState?.messagesByConversationId["projection-thread-media"] ?? [];
    const outboundProjectionMessage = projectionMessages.find((message) => message.id === "projection-media-out");

    expect(hydrateSpy).toHaveBeenCalledWith(publicKeyHex);
    expect(getAllByIndexSpy).toHaveBeenCalled();
    expect(queueSpy).toHaveBeenCalledTimes(1);
    expect(accountEventsSpy).toHaveBeenCalledTimes(1);
    expect(outboundProjectionMessage).toEqual(expect.objectContaining({
      id: "projection-media-out",
      isOutgoing: true,
      attachments: expect.arrayContaining([
        expect.objectContaining({
          kind: "video",
          url: "https://video.nostr.build/example-clip.mp4",
        }),
      ]),
    }));

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    queueSpy.mockRestore();
    accountEventsSpy.mockRestore();
    PrivacySettingsService.saveSettings(currentSettings);
  });

  it("skips encrypted backup publish when private state is empty", async () => {
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
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

    const pool = {
      connections: [{ url: "wss://relay.example", status: "open" }],
      waitForConnection: vi.fn(async () => true),
      publishToUrls: vi.fn(async () => ({
        success: true,
        successCount: 1,
        totalRelays: 1,
        metQuorum: true,
        quorumRequired: 1,
        results: [{ relayUrl: "wss://relay.example", success: true }],
      })),
    };

    const result = await encryptedAccountBackupService.publishEncryptedAccountBackup({
      publicKeyHex,
      privateKeyHex,
      pool,
      scopedRelayUrls: ["wss://relay.example"],
    });

    expect(result.publishResult).toEqual({
      status: "unsupported",
      reasonCode: "empty_private_state",
      message: "Skipped encrypted backup publish because private account state is empty.",
    });
    expect(pool.publishToUrls).not.toHaveBeenCalled();
    expect(cryptoService.signEvent).not.toHaveBeenCalled();

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
  });

  it("uses monotonic backup event timestamps for rapid consecutive publishes", async () => {
    const orderingLogSpy = vi.spyOn(appEventLogger, "logAppEvent");
    peerTrustInternals.saveToStorage(publicKeyHex, {
      acceptedPeers: [acceptedPeerPublicKeyHex],
      mutedPeers: [],
    });
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
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
    const pool = {
      connections: [{ url: "wss://relay.example", status: "open" }],
      waitForConnection: vi.fn(async () => true),
      publishToUrls: vi.fn(async () => ({
        success: true,
        successCount: 1,
        totalRelays: 1,
        metQuorum: true,
        quorumRequired: 1,
        results: [{ relayUrl: "wss://relay.example", success: true }],
      })),
    };
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_123);

    await encryptedAccountBackupService.publishEncryptedAccountBackup({
      publicKeyHex,
      privateKeyHex,
      pool,
      scopedRelayUrls: ["wss://relay.example"],
    });
    await encryptedAccountBackupService.publishEncryptedAccountBackup({
      publicKeyHex,
      privateKeyHex,
      pool,
      scopedRelayUrls: ["wss://relay.example"],
    });

    const signEventCalls = vi.mocked(cryptoService.signEvent).mock.calls;
    expect(signEventCalls).toHaveLength(2);
    const firstUnsigned = signEventCalls[0]?.[0] as unknown as Record<string, unknown>;
    const secondUnsigned = signEventCalls[1]?.[0] as unknown as Record<string, unknown>;
    expect(firstUnsigned.created_at).toBe(1_700_000_000);
    expect(secondUnsigned.created_at).toBe(1_700_000_001);
    expect(firstUnsigned.tags).toEqual(expect.arrayContaining([
      ["d", ACCOUNT_BACKUP_D_TAG],
      ["obscur_backup_created_at_ms", "1700000000123"],
    ]));
    expect(secondUnsigned.tags).toEqual(expect.arrayContaining([
      ["d", ACCOUNT_BACKUP_D_TAG],
      ["obscur_backup_created_at_ms", "1700000000123"],
    ]));
    const orderingLogs: ReadonlyArray<Parameters<typeof appEventLogger.logAppEvent>[0]> = (
      orderingLogSpy.mock.calls
        .map((call) => call[0])
        .filter((entry): entry is Parameters<typeof appEventLogger.logAppEvent>[0] => (
          entry.name === "account_sync.backup_publish_ordering"
        ))
    );
    expect(orderingLogs).toHaveLength(2);
    expect(orderingLogs[0]?.context).toEqual(expect.objectContaining({
      payloadCreatedAtUnixMs: 1_700_000_000_123,
      payloadCreatedAtUnixSeconds: 1_700_000_000,
      eventCreatedAtUnixSeconds: 1_700_000_000,
      monotonicBumpApplied: false,
      createdAtAdjustmentSeconds: 0,
    }));
    expect(orderingLogs[1]?.context).toEqual(expect.objectContaining({
      payloadCreatedAtUnixMs: 1_700_000_000_123,
      payloadCreatedAtUnixSeconds: 1_700_000_000,
      eventCreatedAtUnixSeconds: 1_700_000_001,
      previousEventCreatedAtUnixSeconds: 1_700_000_000,
      monotonicBumpApplied: true,
      createdAtAdjustmentSeconds: 1,
    }));

    nowSpy.mockRestore();
    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    orderingLogSpy.mockRestore();
  });

  it("applies publish convergence floor when local payload has no group evidence", async () => {
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
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
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([]);
    const queueSpy = vi.spyOn(MessageQueue.prototype, "getAllMessages").mockResolvedValue([] as any);
    const fetchSpy = vi.spyOn(
      encryptedAccountBackupService,
      "fetchLatestEncryptedAccountBackupPayload",
    ).mockResolvedValue({
      event: {
        id: "backup-event-rich",
        pubkey: publicKeyHex,
        kind: ACCOUNT_BACKUP_EVENT_KIND,
        created_at: 123,
        tags: [["d", ACCOUNT_BACKUP_D_TAG]],
        content: "encrypted:rich",
        sig: "sig",
      },
      payload: {
        version: 1,
        publicKeyHex,
        createdAtUnixMs: 99_000,
        profile: {
          username: "Remote Rich",
          about: "",
          avatarUrl: "",
          nip05: "",
          inviteCode: "",
        },
        peerTrust: {
          acceptedPeers: [],
          mutedPeers: [],
        },
        requestFlowEvidence: { byPeer: {} },
        requestOutbox: { records: [] },
        syncCheckpoints: [],
        communityMembershipLedger: [{
          communityId: "alpha:wss://relay.example",
          groupId: "alpha",
          relayUrl: "wss://relay.example",
          status: "joined",
          updatedAtUnixMs: 88_000,
          displayName: "Alpha",
        }],
        chatState: {
          version: 2,
          createdConnections: [],
          createdGroups: [{
            id: "community:alpha:wss://relay.example",
            communityId: "alpha:wss://relay.example",
            groupId: "alpha",
            relayUrl: "wss://relay.example",
            displayName: "Alpha",
            memberPubkeys: [publicKeyHex],
            lastMessage: "group hello",
            unreadCount: 0,
            lastMessageTimeMs: 88_000,
            access: "invite-only",
            memberCount: 1,
            adminPubkeys: [],
          }],
          unreadByConversationId: {},
          connectionOverridesByConnectionId: {},
          messagesByConversationId: {},
          groupMessages: {
            "community:alpha:wss://relay.example": [{
              id: "g-1",
              pubkey: publicKeyHex,
              content: "group hello",
              created_at: 88_000,
            }],
          },
          connectionRequests: [],
          pinnedChatIds: [],
          hiddenChatIds: [],
        },
        privacySettings: PrivacySettingsService.getSettings(),
        relayList: relayListInternals.DEFAULT_RELAYS,
      },
      hasBackup: true,
      degradedReason: undefined,
    });
    const pool = {
      connections: [{ url: "wss://relay.example", status: "open" }],
      waitForConnection: vi.fn(async () => true),
      publishToUrls: vi.fn(async () => ({
        success: true,
        successCount: 1,
        totalRelays: 1,
        metQuorum: true,
        quorumRequired: 1,
        results: [{ relayUrl: "wss://relay.example", success: true }],
      })),
      sendToOpen: vi.fn(),
      subscribeToMessages: vi.fn(() => () => undefined),
    };

    await encryptedAccountBackupService.publishEncryptedAccountBackup({
      publicKeyHex,
      privateKeyHex,
      pool,
      scopedRelayUrls: ["wss://relay.example"],
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(cryptoService.encryptDM).toHaveBeenCalledWith(
      expect.stringContaining("\"community:alpha:wss://relay.example\""),
      publicKeyHex,
      privateKeyHex,
    );
    expect(cryptoService.encryptDM).toHaveBeenCalledWith(
      expect.stringContaining("\"communityMembershipLedger\""),
      publicKeyHex,
      privateKeyHex,
    );

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    queueSpy.mockRestore();
    fetchSpy.mockRestore();
  });

  it("suppresses low-evidence publish when relay convergence cannot confirm an existing backup", async () => {
    peerTrustInternals.saveToStorage(publicKeyHex, {
      acceptedPeers: [acceptedPeerPublicKeyHex],
      mutedPeers: [],
    });
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
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
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([]);
    const queueSpy = vi.spyOn(MessageQueue.prototype, "getAllMessages").mockResolvedValue([] as any);
    const fetchSpy = vi.spyOn(
      encryptedAccountBackupService,
      "fetchLatestEncryptedAccountBackupPayload",
    ).mockResolvedValue({
      event: null,
      payload: null,
      hasBackup: false,
      degradedReason: undefined,
    });
    const pool = {
      connections: [{ url: "wss://relay.example", status: "open" }],
      waitForConnection: vi.fn(async () => true),
      publishToUrls: vi.fn(async () => ({
        success: true,
        successCount: 1,
        totalRelays: 1,
        metQuorum: true,
        quorumRequired: 1,
        results: [{ relayUrl: "wss://relay.example", success: true }],
      })),
      sendToOpen: vi.fn(),
      subscribeToMessages: vi.fn(() => () => undefined),
    };

    const result = await encryptedAccountBackupService.publishEncryptedAccountBackup({
      publicKeyHex,
      privateKeyHex,
      pool,
      scopedRelayUrls: ["wss://relay.example"],
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(result.publishResult).toEqual({
      status: "unsupported",
      reasonCode: "low_evidence_convergence_unverified",
      message: "Skipped encrypted backup publish because relay convergence could not be verified for low-evidence local state.",
    });
    expect(pool.publishToUrls).not.toHaveBeenCalled();
    expect(cryptoService.signEvent).not.toHaveBeenCalled();

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    queueSpy.mockRestore();
    fetchSpy.mockRestore();
  });

  it("applies publish convergence floor when dm outgoing evidence is sparse even if group evidence exists", async () => {
    const localIncomingMessages = Array.from({ length: 40 }, (_, index) => ({
      id: `local-in-${index + 1}`,
      content: `incoming ${index + 1}`,
      timestampMs: 10_000 + index,
      status: "delivered" as const,
      isOutgoing: false,
      pubkey: acceptedPeerPublicKeyHex,
    }));
    const localOutgoingMessages = [{
      id: "local-out-1",
      content: "local outgoing",
      timestampMs: 11_000,
      status: "delivered" as const,
      isOutgoing: true,
      pubkey: publicKeyHex,
    }];
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
      version: 2,
      createdConnections: [{
        id: "dm:test",
        displayName: "Peer",
        pubkey: acceptedPeerPublicKeyHex,
        lastMessage: "incoming 40",
        unreadCount: 0,
        lastMessageTimeMs: 10_039,
      }],
      createdGroups: [{
        id: "community:beta:wss://relay.example",
        communityId: "beta:wss://relay.example",
        groupId: "beta",
        relayUrl: "wss://relay.example",
        displayName: "Beta",
        memberPubkeys: [publicKeyHex],
        lastMessage: "group local",
        unreadCount: 0,
        lastMessageTimeMs: 9_000,
        access: "invite-only",
        memberCount: 1,
        adminPubkeys: [],
      }],
      unreadByConversationId: {},
      connectionOverridesByConnectionId: {},
      messagesByConversationId: {
        "dm:test": [...localIncomingMessages, ...localOutgoingMessages],
      },
      groupMessages: {
        "community:beta:wss://relay.example": [{
          id: "group-local-1",
          pubkey: publicKeyHex,
          content: "group local",
          created_at: 9_000,
        }],
      },
      connectionRequests: [],
      pinnedChatIds: [],
      hiddenChatIds: [],
    });
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([]);
    const queueSpy = vi.spyOn(MessageQueue.prototype, "getAllMessages").mockResolvedValue([] as any);
    const fetchSpy = vi.spyOn(
      encryptedAccountBackupService,
      "fetchLatestEncryptedAccountBackupPayload",
    ).mockResolvedValue({
      event: {
        id: "backup-event-remote-dm-rich",
        pubkey: publicKeyHex,
        kind: ACCOUNT_BACKUP_EVENT_KIND,
        created_at: 200,
        tags: [["d", ACCOUNT_BACKUP_D_TAG]],
        content: "encrypted:remote-rich",
        sig: "sig",
      },
      payload: {
        version: 1,
        publicKeyHex,
        createdAtUnixMs: 190_000,
        profile: {
          username: "Remote Rich",
          about: "",
          avatarUrl: "",
          nip05: "",
          inviteCode: "",
        },
        peerTrust: {
          acceptedPeers: [],
          mutedPeers: [],
        },
        requestFlowEvidence: { byPeer: {} },
        requestOutbox: { records: [] },
        syncCheckpoints: [],
        communityMembershipLedger: [{
          communityId: "beta:wss://relay.example",
          groupId: "beta",
          relayUrl: "wss://relay.example",
          status: "joined",
          updatedAtUnixMs: 188_000,
          displayName: "Beta",
        }],
        chatState: {
          version: 2,
          createdConnections: [{
            id: "dm:test",
            displayName: "Peer",
            pubkey: acceptedPeerPublicKeyHex,
            lastMessage: "remote outgoing rich",
            unreadCount: 0,
            lastMessageTimeMs: 12_100,
          }],
          createdGroups: [{
            id: "community:beta:wss://relay.example",
            communityId: "beta:wss://relay.example",
            groupId: "beta",
            relayUrl: "wss://relay.example",
            displayName: "Beta",
            memberPubkeys: [publicKeyHex],
            lastMessage: "group remote",
            unreadCount: 0,
            lastMessageTimeMs: 9_500,
            access: "invite-only",
            memberCount: 1,
            adminPubkeys: [],
          }],
          unreadByConversationId: {},
          connectionOverridesByConnectionId: {},
          messagesByConversationId: {
            "dm:test": [{
              id: "remote-out-rich-1",
              content: "remote outgoing rich",
              timestampMs: 12_100,
              status: "delivered",
              isOutgoing: true,
              pubkey: publicKeyHex,
            }],
          },
          groupMessages: {
            "community:beta:wss://relay.example": [{
              id: "group-remote-1",
              pubkey: publicKeyHex,
              content: "group remote",
              created_at: 9_500,
            }],
          },
          connectionRequests: [],
          pinnedChatIds: [],
          hiddenChatIds: [],
        },
        privacySettings: PrivacySettingsService.getSettings(),
        relayList: relayListInternals.DEFAULT_RELAYS,
      },
      hasBackup: true,
      degradedReason: undefined,
    });
    const pool = {
      connections: [{ url: "wss://relay.example", status: "open" }],
      waitForConnection: vi.fn(async () => true),
      publishToUrls: vi.fn(async () => ({
        success: true,
        successCount: 1,
        totalRelays: 1,
        metQuorum: true,
        quorumRequired: 1,
        results: [{ relayUrl: "wss://relay.example", success: true }],
      })),
      sendToOpen: vi.fn(),
      subscribeToMessages: vi.fn(() => () => undefined),
    };

    await encryptedAccountBackupService.publishEncryptedAccountBackup({
      publicKeyHex,
      privateKeyHex,
      pool,
      scopedRelayUrls: ["wss://relay.example"],
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(cryptoService.encryptDM).toHaveBeenCalledWith(
      expect.stringContaining("\"remote-out-rich-1\""),
      publicKeyHex,
      privateKeyHex,
    );

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    queueSpy.mockRestore();
    fetchSpy.mockRestore();
  });

  it("does not hydrate local message history during non-v1 restore domain merge", async () => {
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([]);

    await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(publicKeyHex, {
      version: 1,
      publicKeyHex,
      createdAtUnixMs: Date.now(),
      profile: {
        username: "",
        about: "",
        avatarUrl: "",
        nip05: "",
        inviteCode: "",
      },
      peerTrust: {
        acceptedPeers: [],
        mutedPeers: [],
      },
      requestFlowEvidence: { byPeer: {} },
      requestOutbox: { records: [] },
      syncCheckpoints: [],
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

    expect(getAllByIndexSpy).not.toHaveBeenCalled();
    getAllByIndexSpy.mockRestore();
  });

  it("hydrates indexed invite-accept evidence for non-v1 chat-state domain restore", async () => {
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const getAllByIndexSpy = vi.spyOn(messagingDB, "getAllByIndex").mockResolvedValue([{
      id: "local-invite-accept-1",
      conversationId: "dm:invite",
      senderPubkey: publicKeyHex,
      recipientPubkey: acceptedPeerPublicKeyHex,
      ownerPubkey: publicKeyHex,
      content: JSON.stringify({
        type: "community-invite-response",
        status: "accepted",
        groupId: "omega",
        relayUrl: "wss://relay.omega",
        communityId: "omega:wss://relay.omega",
      }),
      status: "delivered",
      isOutgoing: true,
      timestampMs: 7_000,
    }] as any);
    const queueSpy = vi.spyOn(MessageQueue.prototype, "getAllMessages").mockResolvedValue([] as any);

    await encryptedAccountBackupServiceInternals.applyBackupPayloadNonV1Domains(publicKeyHex, {
      version: 1,
      publicKeyHex,
      createdAtUnixMs: Date.now(),
      profile: {
        username: "",
        about: "",
        avatarUrl: "",
        nip05: "",
        inviteCode: "",
      },
      peerTrust: {
        acceptedPeers: [],
        mutedPeers: [],
      },
      requestFlowEvidence: { byPeer: {} },
      requestOutbox: { records: [] },
      syncCheckpoints: [],
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
    }, "default", {
      restoreChatStateDomains: true,
    });

    expect(hydrateSpy).toHaveBeenCalledWith(publicKeyHex);
    expect(getAllByIndexSpy).toHaveBeenCalled();
    expect(loadCommunityMembershipLedger(publicKeyHex)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        groupId: "omega",
        relayUrl: "wss://relay.omega",
        status: "joined",
      }),
    ]));
    expect(chatStateStoreService.load(publicKeyHex)?.messagesByConversationId["dm:invite"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "local-invite-accept-1",
        isOutgoing: true,
      }),
    ]));

    hydrateSpy.mockRestore();
    getAllByIndexSpy.mockRestore();
    queueSpy.mockRestore();
  });

  it("skips encrypted backup publish for pending-only request state", async () => {
    requestFlowEvidenceStoreInternals.writeState({
      byPeer: {
        [acceptedPeerPublicKeyHex]: {
          requestEventId: "req-pending",
          receiptAckSeen: true,
          acceptSeen: false,
          lastEvidenceUnixMs: 123,
        },
      },
    });
    contactRequestOutboxInternals.writeState({
      records: [{
        id: "outbox-pending",
        peerPubkey: acceptedPeerPublicKeyHex,
        status: "queued",
        retries: 0,
        createdAtUnixMs: 100,
        updatedAtUnixMs: 200,
      }],
    });
    syncCheckpointInternals.persistCheckpointState(new Map([
      ["dm:pending-only", {
        timelineKey: "dm:pending-only",
        lastProcessedAtUnixSeconds: 123456,
        updatedAtUnixMs: 1234567890,
      }],
    ]));
    const hydrateSpy = vi.spyOn(chatStateStoreService, "hydrateMessages").mockResolvedValue(undefined);
    const loadSpy = vi.spyOn(chatStateStoreService, "load").mockReturnValue({
      version: 2,
      createdConnections: [],
      createdGroups: [],
      unreadByConversationId: {},
      connectionOverridesByConnectionId: {},
      messagesByConversationId: {},
      groupMessages: {},
      connectionRequests: [{
        id: acceptedPeerPublicKeyHex,
        status: "pending",
        isOutgoing: false,
        timestampMs: 321,
      }],
      pinnedChatIds: [],
      hiddenChatIds: [],
    });
    const pool = {
      connections: [{ url: "wss://relay.example", status: "open" }],
      waitForConnection: vi.fn(async () => true),
      publishToUrls: vi.fn(async () => ({
        success: true,
        successCount: 1,
        totalRelays: 1,
        metQuorum: true,
        quorumRequired: 1,
        results: [{ relayUrl: "wss://relay.example", success: true }],
      })),
    };

    const result = await encryptedAccountBackupService.publishEncryptedAccountBackup({
      publicKeyHex,
      privateKeyHex,
      pool,
      scopedRelayUrls: ["wss://relay.example"],
    });

    expect(result.publishResult).toEqual({
      status: "unsupported",
      reasonCode: "empty_private_state",
      message: "Skipped encrypted backup publish because private account state is empty.",
    });
    expect(pool.publishToUrls).not.toHaveBeenCalled();
    expect(cryptoService.signEvent).not.toHaveBeenCalled();

    hydrateSpy.mockRestore();
    loadSpy.mockRestore();
  });

  it("does not restore sync checkpoints from backups without replayable history", async () => {
    await encryptedAccountBackupServiceInternals.applyBackupPayload(publicKeyHex, {
      version: 1,
      publicKeyHex,
      createdAtUnixMs: Date.now(),
      profile: {
        username: "",
        about: "",
        avatarUrl: "",
        nip05: "",
        inviteCode: "",
      },
      peerTrust: {
        acceptedPeers: [],
        mutedPeers: [],
      },
      requestFlowEvidence: { byPeer: {} },
      requestOutbox: { records: [] },
      syncCheckpoints: [{
        timelineKey: "dm:peer-a",
        lastProcessedAtUnixSeconds: 9_999_999_999,
        updatedAtUnixMs: Date.now(),
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

    expect(Array.from(syncCheckpointInternals.loadPersistedCheckpointState().values())).toEqual([]);
  });

  it("keeps local checkpoints when incoming checkpoint-only backup has no history", async () => {
    syncCheckpointInternals.persistCheckpointState(new Map([
      ["dm:peer-a", {
        timelineKey: "dm:peer-a",
        lastProcessedAtUnixSeconds: 123,
        updatedAtUnixMs: 456,
      }],
    ]));

    await encryptedAccountBackupServiceInternals.applyBackupPayload(publicKeyHex, {
      version: 1,
      publicKeyHex,
      createdAtUnixMs: Date.now(),
      profile: {
        username: "",
        about: "",
        avatarUrl: "",
        nip05: "",
        inviteCode: "",
      },
      peerTrust: {
        acceptedPeers: [],
        mutedPeers: [],
      },
      requestFlowEvidence: { byPeer: {} },
      requestOutbox: { records: [] },
      syncCheckpoints: [{
        timelineKey: "dm:peer-a",
        lastProcessedAtUnixSeconds: 9_999_999_999,
        updatedAtUnixMs: Date.now(),
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

    expect(Array.from(syncCheckpointInternals.loadPersistedCheckpointState().values())).toEqual([
      expect.objectContaining({
        timelineKey: "dm:peer-a",
        lastProcessedAtUnixSeconds: 123,
      }),
    ]);
  });
});
