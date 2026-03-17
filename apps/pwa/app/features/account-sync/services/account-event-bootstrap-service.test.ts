import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { defaultPrivacySettings } from "@/app/features/settings/services/privacy-settings-service";
import type { EncryptedAccountBackupPayload } from "../account-sync-contracts";
import { buildCanonicalBackupImportEvents } from "./account-event-bootstrap-service";

const ACCOUNT = "a".repeat(64) as PublicKeyHex;
const PEER = "b".repeat(64) as PublicKeyHex;
const PROFILE_ID = "default";

const basePayload = (params: Readonly<{
  createdAtUnixMs?: number;
  chatState: EncryptedAccountBackupPayload["chatState"];
}>): EncryptedAccountBackupPayload => ({
  version: 1,
  publicKeyHex: ACCOUNT,
  createdAtUnixMs: params.createdAtUnixMs ?? 1_000,
  profile: {
    username: "Recovered",
    about: "",
    avatarUrl: "",
    nip05: "",
    inviteCode: "",
  },
  peerTrust: {
    acceptedPeers: [],
    mutedPeers: [],
  },
  requestFlowEvidence: {
    byPeer: {},
  },
  requestOutbox: {
    records: [],
  },
  syncCheckpoints: [],
  chatState: params.chatState,
  privacySettings: defaultPrivacySettings,
  relayList: [],
});

describe("account-event-bootstrap-service", () => {
  it("restores outgoing and incoming DMs when canonical conversation id is present without createdConnections", () => {
    const conversationId = [ACCOUNT, PEER].sort().join(":");
    const payload = basePayload({
      chatState: {
        version: 2,
        createdConnections: [],
        createdGroups: [],
        unreadByConversationId: {},
        connectionOverridesByConnectionId: {},
        messagesByConversationId: {
          [conversationId]: [
            {
              id: "m-out",
              content: "from me",
              timestampMs: 10_000,
              isOutgoing: true,
              status: "delivered",
              pubkey: ACCOUNT,
            },
            {
              id: "m-in",
              content: "from peer",
              timestampMs: 11_000,
              isOutgoing: false,
              status: "delivered",
              pubkey: PEER,
            },
          ],
        },
        groupMessages: {},
        connectionRequests: [],
        pinnedChatIds: [],
        hiddenChatIds: [],
      },
    });

    const events = buildCanonicalBackupImportEvents({
      profileId: PROFILE_ID,
      accountPublicKeyHex: ACCOUNT,
      payload,
      source: "relay_sync",
      idempotencyPrefix: "restore:test",
    });

    const dmEvents = events.filter((event) => event.type === "DM_SENT_CONFIRMED" || event.type === "DM_RECEIVED");
    expect(dmEvents).toHaveLength(2);
    expect(dmEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "DM_SENT_CONFIRMED",
        conversationId,
        peerPublicKeyHex: PEER,
        messageId: "m-out",
      }),
      expect.objectContaining({
        type: "DM_RECEIVED",
        conversationId,
        peerPublicKeyHex: PEER,
        messageId: "m-in",
      }),
    ]));
  });

  it("infers peer from message pubkey for legacy conversation ids and keeps outgoing history", () => {
    const payload = basePayload({
      chatState: {
        version: 2,
        createdConnections: [],
        createdGroups: [],
        unreadByConversationId: {},
        connectionOverridesByConnectionId: {},
        messagesByConversationId: {
          legacy_thread_1: [
            {
              id: "legacy-in",
              content: "peer hello",
              timestampMs: 20_000,
              isOutgoing: false,
              status: "delivered",
              pubkey: PEER,
            },
            {
              id: "legacy-out",
              content: "my reply",
              timestampMs: 21_000,
              isOutgoing: true,
              status: "delivered",
              pubkey: ACCOUNT,
            },
          ],
        },
        groupMessages: {},
        connectionRequests: [],
        pinnedChatIds: [],
        hiddenChatIds: [],
      },
    });

    const events = buildCanonicalBackupImportEvents({
      profileId: PROFILE_ID,
      accountPublicKeyHex: ACCOUNT,
      payload,
      source: "relay_sync",
      idempotencyPrefix: "restore:test",
    });

    const legacyDmEvents = events.filter((event) => event.type === "DM_SENT_CONFIRMED" || event.type === "DM_RECEIVED");
    expect(legacyDmEvents).toHaveLength(2);
    expect(legacyDmEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "DM_RECEIVED",
        conversationId: "legacy_thread_1",
        peerPublicKeyHex: PEER,
        messageId: "legacy-in",
      }),
      expect.objectContaining({
        type: "DM_SENT_CONFIRMED",
        conversationId: "legacy_thread_1",
        peerPublicKeyHex: PEER,
        messageId: "legacy-out",
      }),
    ]));
  });

  it("infers peer from legacy peer-key conversation ids when messages are self-authored", () => {
    const payload = basePayload({
      chatState: {
        version: 2,
        createdConnections: [],
        createdGroups: [],
        unreadByConversationId: {},
        connectionOverridesByConnectionId: {},
        messagesByConversationId: {
          [PEER]: [
            {
              id: "legacy-out-1",
              content: "self only history",
              timestampMs: 30_000,
              isOutgoing: true,
              status: "delivered",
              pubkey: ACCOUNT,
            },
          ],
        },
        groupMessages: {},
        connectionRequests: [],
        pinnedChatIds: [],
        hiddenChatIds: [],
      },
    });

    const events = buildCanonicalBackupImportEvents({
      profileId: PROFILE_ID,
      accountPublicKeyHex: ACCOUNT,
      payload,
      source: "relay_sync",
      idempotencyPrefix: "restore:test",
    });

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "DM_SENT_CONFIRMED",
        conversationId: PEER,
        peerPublicKeyHex: PEER,
        messageId: "legacy-out-1",
      }),
    ]));
  });

  it("treats message pubkey evidence as authoritative when legacy isOutgoing flag is missing or stale", () => {
    const payload = basePayload({
      chatState: {
        version: 2,
        createdConnections: [],
        createdGroups: [],
        unreadByConversationId: {},
        connectionOverridesByConnectionId: {},
        messagesByConversationId: {
          legacy_thread_2: [
            {
              id: "legacy-in-2",
              content: "peer message",
              timestampMs: 40_000,
              isOutgoing: false,
              status: "delivered",
              pubkey: PEER,
            },
            {
              id: "legacy-out-2",
              content: "my message",
              timestampMs: 41_000,
              // Simulate legacy payload drift: stale/missing direction metadata.
              isOutgoing: false,
              status: "delivered",
              pubkey: ACCOUNT,
            } as any,
          ],
        },
        groupMessages: {},
        connectionRequests: [],
        pinnedChatIds: [],
        hiddenChatIds: [],
      },
    });

    const events = buildCanonicalBackupImportEvents({
      profileId: PROFILE_ID,
      accountPublicKeyHex: ACCOUNT,
      payload,
      source: "relay_sync",
      idempotencyPrefix: "restore:test",
    });

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "DM_RECEIVED",
        messageId: "legacy-in-2",
        peerPublicKeyHex: PEER,
      }),
      expect.objectContaining({
        type: "DM_SENT_CONFIRMED",
        messageId: "legacy-out-2",
        peerPublicKeyHex: PEER,
      }),
    ]));
  });
});
