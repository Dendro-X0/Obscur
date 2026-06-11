import { describe, expect, it } from "vitest";
import type { Message } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { ProjectionReadAuthority } from "@/app/features/account-sync/services/account-projection-read-authority";
import { vi } from "vitest";
import { assembleDmHydrateThreadReadModel, getMessageDirectionCounts } from "./dm-conversation-hydrate-read-model";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => false),
}));

import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

const mkMsg = (partial: Partial<Message> & Pick<Message, "id" | "timestamp">): Message => ({
  kind: partial.kind ?? "user",
  content: partial.content ?? "",
  conversationId: partial.conversationId ?? "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  senderPubkey: partial.senderPubkey,
  recipientPubkey: partial.recipientPubkey,
  isOutgoing: partial.isOutgoing,
  eventId: partial.eventId,
  ...partial,
} as Message);

const shadowProjectionAuthority: ProjectionReadAuthority = {
  useProjectionReads: false,
  reason: "shadow_mode",
  policy: {} as ProjectionReadAuthority["policy"],
  criticalDriftCount: 0,
};

const projectionReadCutoverAuthority: ProjectionReadAuthority = {
  useProjectionReads: true,
  reason: "read_cutover_enabled",
  policy: {} as ProjectionReadAuthority["policy"],
  criticalDriftCount: 0,
};

describe("assembleDmHydrateThreadReadModel", () => {
  it("merges missing outgoing rows from projection when native sqlite is incoming-only and projection reads are on", () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    const myHex = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as PublicKeyHex;
    const peerHex = "dddddddddddddddddddddddddddddddd" as PublicKeyHex;
    const conversationId = `${myHex}:${peerHex}`;
    const incomingOnly: Message[] = [
      mkMsg({
        id: "peer-test",
        timestamp: new Date(2),
        isOutgoing: false,
        senderPubkey: peerHex,
        conversationId,
        content: "from peer",
      }),
    ];
    const projectionOutgoing: Message[] = [
      mkMsg({
        id: "self-test",
        eventId: "self-test",
        timestamp: new Date(1),
        isOutgoing: true,
        senderPubkey: myHex,
        recipientPubkey: peerHex,
        conversationId,
        content: "from self",
      }),
    ];
    const assembled = assembleDmHydrateThreadReadModel({
      conversationId,
      conversationIds: [conversationId],
      retentionFilteredMapped: incomingOnly,
      cappedHydratedMessages: incomingOnly,
      scannedWindowHasEarlier: false,
      shouldCapHydratedHistoryWindow: false,
      normalizedPublicKeyHex: myHex,
      projectionMessagesSnapshot: projectionOutgoing,
      projectionEvidenceMessagesSnapshot: projectionOutgoing,
      projectionReadAuthoritySnapshot: projectionReadCutoverAuthority,
      projectionRestorePhaseActive: false,
      projectionBootstrapImportApplied: true,
      projectionCanonicalEvidencePending: false,
      persistedStateFallbackMessages: [],
      liveMessages: [],
      expandedHistory: false,
      persistentSuppressedMessageIds: new Set(),
      liveWindowSoftLimit: 200,
    });

    expect(assembled.finalMessages).toHaveLength(2);
    expect(assembled.finalMessages.map((message) => message.id)).toEqual([
      "self-test",
      "peer-test",
    ]);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
  });

  it("prefers indexed when projection reads off and indexed has rows", () => {
    const myHex = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as PublicKeyHex;
    const indexed: Message[] = [
      mkMsg({
        id: "1",
        timestamp: new Date(1),
        isOutgoing: true,
        senderPubkey: myHex,
      }),
    ];
    const assembled = assembleDmHydrateThreadReadModel({
      conversationId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      conversationIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
      retentionFilteredMapped: indexed,
      cappedHydratedMessages: indexed,
      scannedWindowHasEarlier: false,
      shouldCapHydratedHistoryWindow: false,
      normalizedPublicKeyHex: myHex,
      projectionMessagesSnapshot: [],
      projectionEvidenceMessagesSnapshot: [],
      projectionReadAuthoritySnapshot: shadowProjectionAuthority,
      projectionRestorePhaseActive: false,
      projectionBootstrapImportApplied: true,
      projectionCanonicalEvidencePending: false,
      persistedStateFallbackMessages: [],
      liveMessages: [],
      expandedHistory: false,
      persistentSuppressedMessageIds: new Set(),
      liveWindowSoftLimit: 200,
    });
    expect(assembled.authorityDecision.authority).toBe("indexed");
    expect(assembled.finalMessages).toHaveLength(1);
    expect(assembled.hasEarlier).toBe(false);
  });

  it("drops tombstoned messages on cold hydrate when live overlay is empty", () => {
    const myHex = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as PublicKeyHex;
    const indexed: Message[] = [
      mkMsg({
        id: "keep",
        timestamp: new Date(1),
        isOutgoing: true,
        senderPubkey: myHex,
      }),
      mkMsg({
        id: "gone",
        timestamp: new Date(2),
        isOutgoing: false,
        senderPubkey: "dddddddddddddddddddddddddddddddd" as PublicKeyHex,
      }),
    ];
    const assembled = assembleDmHydrateThreadReadModel({
      conversationId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      conversationIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
      retentionFilteredMapped: indexed,
      cappedHydratedMessages: indexed,
      scannedWindowHasEarlier: false,
      shouldCapHydratedHistoryWindow: false,
      normalizedPublicKeyHex: myHex,
      projectionMessagesSnapshot: [],
      projectionEvidenceMessagesSnapshot: [],
      projectionReadAuthoritySnapshot: shadowProjectionAuthority,
      projectionRestorePhaseActive: false,
      projectionBootstrapImportApplied: true,
      projectionCanonicalEvidencePending: false,
      persistedStateFallbackMessages: [],
      liveMessages: [],
      expandedHistory: false,
      persistentSuppressedMessageIds: new Set(["gone"]),
      liveWindowSoftLimit: 200,
    });
    expect(assembled.finalMessages).toHaveLength(1);
    expect(assembled.finalMessages[0]?.id).toBe("keep");
  });

  it("merges missing outgoing community invites from projection evidence when sqlite is authoritative", () => {
    const myHex = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as PublicKeyHex;
    const peerHex = "dddddddddddddddddddddddddddddddd" as PublicKeyHex;
    const conversationId = `${myHex}:${peerHex}`;
    const incomingOnly: Message[] = [
      mkMsg({
        id: "incoming-response",
        timestamp: new Date(2),
        isOutgoing: false,
        senderPubkey: peerHex,
        conversationId,
        content: JSON.stringify({
          type: "community-invite-response",
          status: "accepted",
          groupId: "group-1",
        }),
      }),
    ];
    const projectionEvidence: Message[] = [
      mkMsg({
        id: "outgoing-invite",
        eventId: "outgoing-invite",
        timestamp: new Date(1),
        isOutgoing: true,
        senderPubkey: myHex,
        recipientPubkey: peerHex,
        conversationId,
        content: JSON.stringify({
          type: "community-invite",
          groupId: "group-1",
          roomKey: "room-key",
          metadata: { name: "GroupTest 1", access: "invite-only" },
        }),
      }),
    ];
    const assembled = assembleDmHydrateThreadReadModel({
      conversationId,
      conversationIds: [conversationId],
      retentionFilteredMapped: incomingOnly,
      cappedHydratedMessages: incomingOnly,
      scannedWindowHasEarlier: false,
      shouldCapHydratedHistoryWindow: false,
      normalizedPublicKeyHex: myHex,
      projectionMessagesSnapshot: [],
      projectionEvidenceMessagesSnapshot: projectionEvidence,
      projectionReadAuthoritySnapshot: shadowProjectionAuthority,
      projectionRestorePhaseActive: false,
      projectionBootstrapImportApplied: true,
      projectionCanonicalEvidencePending: false,
      persistedStateFallbackMessages: [],
      liveMessages: [],
      expandedHistory: false,
      persistentSuppressedMessageIds: new Set(),
      liveWindowSoftLimit: 200,
    });

    expect(assembled.finalMessages).toHaveLength(2);
    expect(assembled.finalMessages.map((message) => message.id)).toEqual([
      "outgoing-invite",
      "incoming-response",
    ]);
  });
});

describe("getMessageDirectionCounts", () => {
  it("counts outgoing vs incoming using isOutgoing and sender match", () => {
    const myHex = "cccccccccccccccccccccccccccccccc" as PublicKeyHex;
    const counts = getMessageDirectionCounts([
      mkMsg({ id: "a", timestamp: new Date(1), isOutgoing: true, senderPubkey: myHex }),
      mkMsg({ id: "b", timestamp: new Date(2), isOutgoing: false, senderPubkey: "dddddddddddddddddddddddddddddddd" as PublicKeyHex }),
    ], myHex);
    expect(counts).toEqual({ outgoing: 1, incoming: 1 });
  });
});
