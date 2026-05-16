import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const prepareMock = vi.hoisted(() => vi.fn(async () => new Set<string>()));
const loadEntriesMock = vi.hoisted(() => vi.fn(() => [
  { id: "local-deleted", deletedAtUnixMs: Date.now() - 60_000 },
]));
const projectionGetSnapshotMock = vi.hoisted(() => vi.fn(() => ({
  profileId: "profile-1",
  phase: "ready" as const,
  accountProjectionReady: true,
  projection: {
    profileId: "profile-1",
    accountPublicKeyHex: "aa".repeat(32),
    contactsByPeer: {},
    conversationsById: {},
    messagesByConversationId: {},
    removedMessageIds: {},
    sync: { checkpointsByTimelineKey: {}, bootstrapImportApplied: false },
    lastSequence: 0,
    updatedAtUnixMs: 0,
  },
})));

vi.mock("@/app/features/profiles/services/resolve-client-gateway", () => ({
  getResolvedClientGateway: () => ({
    dmConversationMaterialization: { prepareThreadSuppressionIds: prepareMock },
    messageDeleteTombstones: {
      loadMessageDeleteTombstoneEntries: loadEntriesMock,
    },
  }),
}));

vi.mock("./account-projection-runtime", () => ({
  accountProjectionRuntime: { getSnapshot: projectionGetSnapshotMock },
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { resolveRestoreMaterializationSuppressionContract } from "./restore-materialization-suppression-contract";

const publicKeyHex = "aa".repeat(32) as PublicKeyHex;

describe("resolveRestoreMaterializationSuppressionContract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectionGetSnapshotMock.mockReturnValue({
      profileId: "profile-1",
      phase: "ready",
      accountProjectionReady: true,
      projection: {
        profileId: "profile-1",
        accountPublicKeyHex: publicKeyHex,
        contactsByPeer: {},
        conversationsById: {},
        messagesByConversationId: {},
        removedMessageIds: {},
        sync: { checkpointsByTimelineKey: {}, bootstrapImportApplied: false },
        lastSequence: 0,
        updatedAtUnixMs: 0,
      },
    });
  });

  it("merges local tombstones and strips suppressed rows from backup chatState", async () => {
    const result = await resolveRestoreMaterializationSuppressionContract({
      publicKeyHex,
      profileId: "profile-1",
      mergedPayload: {
        version: 1,
        publicKeyHex,
        createdAtUnixMs: 2_000,
        profile: {
          username: "t",
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
          messagesByConversationId: {
            "dm:peer": [{
              id: "local-deleted",
              content: "should vanish",
              timestampMs: 100,
              isOutgoing: false,
              status: "delivered",
              pubkey: "bb".repeat(32),
            }, {
              id: "keep-me",
              content: "visible",
              timestampMs: 200,
              isOutgoing: false,
              status: "delivered",
              pubkey: "bb".repeat(32),
            }],
          },
          groupMessages: {},
          connectionRequests: [],
          pinnedChatIds: [],
          hiddenChatIds: [],
        },
        privacySettings: PrivacySettingsService.getSettings(),
        relayList: [],
      },
    });

    expect(prepareMock).toHaveBeenCalled();
    expect(loadEntriesMock).toHaveBeenCalled();
    expect(result.mergedTombstoneEntries.map((entry) => entry.id)).toContain("local-deleted");
    expect(result.durableDeleteIds.has("local-deleted")).toBe(true);
    expect(result.materializedPayload.chatState?.messagesByConversationId["dm:peer"]).toEqual([
      expect.objectContaining({ id: "keep-me" }),
    ]);
  });
});
