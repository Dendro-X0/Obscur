import { describe, expect, it } from "vitest";
import type { Message } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { ProjectionReadAuthority } from "@/app/features/account-sync/services/account-projection-read-authority";
import { assembleDmHydrateThreadReadModel, getMessageDirectionCounts } from "./dm-conversation-hydrate-read-model";

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

describe("assembleDmHydrateThreadReadModel", () => {
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
