import { beforeEach, describe, expect, it } from "vitest";
import {
  clearMediaStoreForProfile,
  getMessageMedia,
  isMediaAvailableLocally,
  relinkChatStateMediaAfterRestore,
  updateMediaBlob,
} from "./media-cas-message-integration";
import { readInboundMediaQuarantineBytes } from "@/app/features/storage/services/inbound-media-quarantine-persist";
import { buildProfileQuarantineRelativePath } from "@/app/features/storage/services/inbound-media-quarantine";
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

describe("P2-S S5 L2 — cross-profile media CAS isolation", () => {
  const ALICE = "profile-alice";
  const BOB = "profile-bob";

  beforeEach(() => {
    clearMediaStoreForProfile(ALICE);
    clearMediaStoreForProfile(BOB);
  });

  it("keeps Alice CAS blobs invisible to Bob session helpers", () => {
    const chatState: PersistedChatState = {
      ...emptyChatState(),
      messagesByConversationId: {
        "dm:peer": [{
          id: "msg-alice-media",
          content: "photo",
          timestampMs: 1_000,
          isOutgoing: false,
          status: "delivered",
          attachments: [{
            kind: "image",
            url: CAS_URL,
            contentType: "image/png",
            fileName: "secret.png",
          }],
        }],
      },
    };

    relinkChatStateMediaAfterRestore(ALICE, SOURCE_PUBKEY, chatState);
    updateMediaBlob(ALICE, HASH, new Blob([new Uint8Array([9, 9, 9])], { type: "image/png" }), {
      fileName: "secret.png",
    });

    expect(isMediaAvailableLocally(ALICE, HASH)).toBe(true);
    expect(isMediaAvailableLocally(BOB, HASH)).toBe(false);
    expect(getMessageMedia(BOB, "msg-alice-media")).toEqual([]);
    expect(getMessageMedia(ALICE, "msg-alice-media").some((item) => item.sha256 === HASH)).toBe(true);
  });

  it("fail-closes quarantine relative path reads across profiles", async () => {
    const alicePath = buildProfileQuarantineRelativePath(ALICE, HASH);
    expect(alicePath).toBeTruthy();
    await expect(readInboundMediaQuarantineBytes({
      requestingProfileId: BOB,
      relativePath: alicePath!,
    })).resolves.toBeNull();
  });
});

