import { beforeEach, describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { loadPersistedChatState } from "./persistence";

const myPublicKeyHex = "a".repeat(64) as PublicKeyHex;
const peerPublicKeyHex = "b".repeat(64);
const storageKey = getScopedStorageKey(`dweb.nostr.pwa.chatState.v2.${myPublicKeyHex}`);

const createBasePersistedState = () => ({
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

describe("persistence attachment parsing compatibility", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps legacy voice-note attachments when metadata fields are missing", () => {
    localStorage.setItem(storageKey, JSON.stringify({
      ...createBasePersistedState(),
      messagesByConversationId: {
        [peerPublicKeyHex]: [{
          id: "legacy-voice-note-msg",
          content: "",
          timestampMs: 1_000,
          isOutgoing: false,
          status: "delivered",
          attachments: [{
            kind: "voice_note",
            url: "https://cdn.example.com/voice-note-1.webm",
          }],
        }],
      },
    }));

    const parsed = loadPersistedChatState(myPublicKeyHex);
    const message = parsed?.messagesByConversationId[peerPublicKeyHex]?.[0];
    const attachment = message?.attachments?.[0];

    expect(attachment).toEqual(expect.objectContaining({
      kind: "voice_note",
      url: "https://cdn.example.com/voice-note-1.webm",
      fileName: "voice-note-1.webm",
      contentType: "audio/webm",
    }));
  });

  it("infers video attachment kind and metadata from URL when kind/contentType are missing", () => {
    localStorage.setItem(storageKey, JSON.stringify({
      ...createBasePersistedState(),
      messagesByConversationId: {
        [peerPublicKeyHex]: [{
          id: "legacy-video-msg",
          content: "",
          timestampMs: 2_000,
          isOutgoing: false,
          status: "delivered",
          attachments: [{
            url: "https://cdn.example.com/media/clip.mp4",
          }],
        }],
      },
    }));

    const parsed = loadPersistedChatState(myPublicKeyHex);
    const message = parsed?.messagesByConversationId[peerPublicKeyHex]?.[0];
    const attachment = message?.attachments?.[0];

    expect(attachment).toEqual(expect.objectContaining({
      kind: "video",
      url: "https://cdn.example.com/media/clip.mp4",
      fileName: "clip.mp4",
      contentType: "video/mp4",
    }));
  });
});
