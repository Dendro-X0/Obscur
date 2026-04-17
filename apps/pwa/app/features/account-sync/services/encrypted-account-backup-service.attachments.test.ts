import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { defaultPrivacySettings } from "@/app/features/settings/services/privacy-settings-service";
import { encryptedAccountBackupServiceInternals } from "./encrypted-account-backup-service";

const publicKeyHex = "f".repeat(64) as PublicKeyHex;

const createBasePayload = () => ({
  version: 1,
  publicKeyHex,
  createdAtUnixMs: 1_000,
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
  requestFlowEvidence: { byPeer: {} },
  requestOutbox: { records: [] },
  syncCheckpoints: [],
  privacySettings: defaultPrivacySettings,
  relayList: [],
});

describe("encryptedAccountBackupService attachment compatibility parsing", () => {
  it("infers attachment kind/contentType/fileName from URL when metadata is sparse", () => {
    const parsed = encryptedAccountBackupServiceInternals.parseBackupPayload({
      ...createBasePayload(),
      chatState: {
        version: 2,
        createdConnections: [],
        createdGroups: [],
        unreadByConversationId: {},
        connectionOverridesByConnectionId: {},
        messagesByConversationId: {
          "dm:legacy": [{
            id: "legacy-video-msg",
            content: "",
            timestampMs: 3_000,
            isOutgoing: false,
            status: "delivered",
            attachments: [{
              url: "https://cdn.example.com/media/clip.mp4",
            }],
          }],
        },
        groupMessages: {},
        connectionRequests: [],
        pinnedChatIds: [],
        hiddenChatIds: [],
      },
    });

    const attachment = parsed?.chatState?.messagesByConversationId["dm:legacy"]?.[0]?.attachments?.[0];
    expect(attachment).toEqual(expect.objectContaining({
      kind: "video",
      url: "https://cdn.example.com/media/clip.mp4",
      fileName: "clip.mp4",
      contentType: "video/mp4",
    }));
  });

  it("keeps legacy voice-note attachments even when contentType/fileName were missing", () => {
    const parsed = encryptedAccountBackupServiceInternals.parseBackupPayload({
      ...createBasePayload(),
      chatState: {
        version: 2,
        createdConnections: [],
        createdGroups: [],
        unreadByConversationId: {},
        connectionOverridesByConnectionId: {},
        messagesByConversationId: {
          "dm:legacy-voice": [{
            id: "legacy-voice-msg",
            content: "",
            timestampMs: 4_000,
            isOutgoing: false,
            status: "delivered",
            attachments: [{
              kind: "voice_note",
              url: "https://cdn.example.com/voice-note-99.webm",
            }],
          }],
        },
        groupMessages: {},
        connectionRequests: [],
        pinnedChatIds: [],
        hiddenChatIds: [],
      },
    });

    const attachment = parsed?.chatState?.messagesByConversationId["dm:legacy-voice"]?.[0]?.attachments?.[0];
    expect(attachment).toEqual(expect.objectContaining({
      kind: "voice_note",
      url: "https://cdn.example.com/voice-note-99.webm",
      fileName: "voice-note-99.webm",
      contentType: "audio/webm",
    }));
  });
});
