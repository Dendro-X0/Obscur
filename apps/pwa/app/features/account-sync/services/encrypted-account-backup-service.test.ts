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
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getLocalMediaStorageConfig } from "@/app/features/vault/services/local-media-store";
import { ACCOUNT_BACKUP_D_TAG, ACCOUNT_BACKUP_EVENT_KIND } from "../account-sync-contracts";
import { useProfileInternals } from "@/app/features/profile/hooks/use-profile";
import { accountEventStore } from "./account-event-store";
import { loadCommunityMembershipLedger, saveCommunityMembershipLedger } from "@/app/features/groups/services/community-membership-ledger";

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
    requestFlowEvidenceStoreInternals.writeState({ byPeer: {} });
    contactRequestOutboxInternals.writeState({ records: [] });
    syncCheckpointInternals.persistCheckpointState(new Map());
    PrivacySettingsService.saveSettings(PrivacySettingsService.getSettings());
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

  it("overwrites local password unlock with incoming password snapshot during restore convergence", async () => {
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
      encryptedPrivateKey: "cipher-backup-new",
      username: "backup-user",
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
                  createdConnections: [],
                  createdGroups: [],
                  unreadByConversationId: {},
                  connectionOverridesByConnectionId: {},
                  messagesByConversationId: {
                    "dm:test": [{
                      id: "m-restore-1",
                      content: "restored",
                      timestampMs: 42_000,
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
    expect(peerTrustInternals.loadFromStorage(publicKeyHex).acceptedPeers).toEqual([]);
    expect(Array.from(syncCheckpointInternals.loadPersistedCheckpointState().values())).toEqual([]);
    expect(relayListInternals.loadRelayListFromStorage(publicKeyHex)).toEqual([
      { url: "wss://relay.example", enabled: true },
    ]);
    const restoredProfile = JSON.parse(localStorage.getItem(useProfileInternals.getStorageKey())!);
    expect(restoredProfile.profile.username).toBe("Restored Alice");
    expect(cryptoService.decryptDM).toHaveBeenCalled();
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
