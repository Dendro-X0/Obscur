import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { AccountProjectionSnapshot } from "../account-event-contracts";
import { createDriftReport } from "./account-sync-drift-detector";

const SELF = "a".repeat(64) as PublicKeyHex;
const PEER_B = "b".repeat(64) as PublicKeyHex;
const PEER_C = "c".repeat(64) as PublicKeyHex;

const driftMocks = vi.hoisted(() => ({
  peerTrustLoad: vi.fn(() => ({
    acceptedPeers: [PEER_B],
    mutedPeers: [],
  })),
  chatStateLoad: vi.fn((): any => ({
    connectionRequests: [
      { id: PEER_C, status: "pending", isOutgoing: false, introMessage: "", timestampMs: 1_000 },
    ],
    messagesByConversationId: {
      convo_b: [{ id: "m1", content: "hello", timestampMs: 1_000, isOutgoing: false }],
    },
  })),
}));

vi.mock("@/app/features/network/hooks/use-peer-trust", () => ({
  peerTrustInternals: {
    loadFromStorage: driftMocks.peerTrustLoad,
  },
}));

vi.mock("@/app/features/messaging/services/chat-state-store", () => ({
  chatStateStoreService: {
    load: driftMocks.chatStateLoad,
  },
}));

const createProjection = (): AccountProjectionSnapshot => ({
  profileId: "default",
  accountPublicKeyHex: SELF,
  contactsByPeer: {
    [PEER_B]: {
      peerPublicKeyHex: PEER_B,
      status: "accepted",
      direction: "unknown",
      lastEvidenceAtUnixMs: 1_000,
      lastEventId: "accepted-b",
    },
    [PEER_C]: {
      peerPublicKeyHex: PEER_C,
      status: "pending",
      direction: "incoming",
      lastEvidenceAtUnixMs: 1_200,
      lastEventId: "pending-c",
    },
  },
  conversationsById: {
    convo_b: {
      conversationId: "convo_b",
      peerPublicKeyHex: PEER_B,
      lastMessagePreview: "hello",
      lastMessageAtUnixMs: 1_000,
      unreadCount: 0,
    },
  },
  messagesByConversationId: {
    convo_b: [
      {
        messageId: "m1",
        conversationId: "convo_b",
        peerPublicKeyHex: PEER_B,
        direction: "incoming",
        eventCreatedAtUnixSeconds: 1,
        plaintextPreview: "hello",
        observedAtUnixMs: 1_000,
      },
    ],
  },
  sync: {
    checkpointsByTimelineKey: {},
    bootstrapImportApplied: true,
  },
  lastSequence: 1,
  updatedAtUnixMs: 1_500,
});

describe("account-sync-drift-detector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports clean drift when contact and message counts match", () => {
    const report = createDriftReport({
      publicKeyHex: SELF,
      projection: createProjection(),
    });

    expect(report.criticalDriftCount).toBe(0);
    expect(report.nonCriticalDriftCount).toBe(0);
    expect(report.domains).toEqual([]);
  });

  it("includes messages domain when timeline counts diverge", () => {
    driftMocks.chatStateLoad.mockReturnValue({
      connectionRequests: [
        { id: PEER_C, status: "pending", isOutgoing: false, introMessage: "", timestampMs: 1_000 },
      ],
      messagesByConversationId: {} as Record<string, ReadonlyArray<unknown>>,
    });

    const report = createDriftReport({
      publicKeyHex: SELF,
      projection: createProjection(),
    });

    expect(report.criticalDriftCount).toBe(0);
    expect(report.nonCriticalDriftCount).toBe(1);
    expect(report.domains).toContain("messages");
  });

  it("keeps accepted-contact drift as critical", () => {
    driftMocks.peerTrustLoad.mockReturnValue({
      acceptedPeers: [],
      mutedPeers: [],
    });

    const report = createDriftReport({
      publicKeyHex: SELF,
      projection: createProjection(),
    });

    expect(report.criticalDriftCount).toBe(1);
    expect(report.domains).toContain("contacts");
  });
});
