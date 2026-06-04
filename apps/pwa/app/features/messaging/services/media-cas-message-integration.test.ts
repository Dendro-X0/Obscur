import { beforeEach, describe, expect, it } from "vitest";
import {
  clearMediaStoreForProfile,
  getMessageMedia,
  relinkChatStateMediaAfterRestore,
} from "./media-cas-message-integration";
import type { PersistedChatState } from "@/app/features/messaging/types";

const PROFILE_ID = "default";
const SOURCE_PUBKEY = "a".repeat(64);
const HASH = "b".repeat(64);
const CAS_URL = `https://cas.obscur.app/blob/${HASH}`;

const emptyChatState = (): PersistedChatState => ({
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

describe("MED-001 — relinkChatStateMediaAfterRestore", () => {
  beforeEach(() => {
    clearMediaStoreForProfile(PROFILE_ID);
  });

  it("indexes persisted attachment URLs by CAS hash after restore", () => {
    const chatState: PersistedChatState = {
      ...emptyChatState(),
      messagesByConversationId: {
        "dm:peer": [{
          id: "msg-media-1",
          content: "photo",
          timestampMs: 1_000,
          isOutgoing: false,
          status: "delivered",
          attachments: [{
            kind: "image",
            url: CAS_URL,
            contentType: "image/jpeg",
            fileName: "photo.jpg",
          }],
        }],
      },
    };

    relinkChatStateMediaAfterRestore(PROFILE_ID, SOURCE_PUBKEY, chatState);

    const media = getMessageMedia(PROFILE_ID, "msg-media-1");
    expect(media).toHaveLength(1);
    expect(media[0]?.sha256).toBe(HASH);
    expect(media[0]?.references.has("msg-media-1")).toBe(true);
  });
});
