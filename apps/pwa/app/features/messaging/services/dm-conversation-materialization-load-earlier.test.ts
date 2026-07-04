import { describe, expect, it, vi } from "vitest";
import type { Message } from "../types";

const scanMocks = vi.hoisted(() => ({
  loadLegacyConversationWindowAcrossAliases: vi.fn(async () => ({ rows: [], hasEarlier: false })),
  scanLegacyDisplayableHistoryWindow: vi.fn(async () => ({ messages: [], hasEarlier: false })),
  mapLegacyIndexedConversationRowsForDisplayableScan: vi.fn(() => []),
}));

vi.mock("@/app/features/messaging/services/thread-history/hydrate-indexed-legacy-port", () => scanMocks);

import { loadLegacyEarlierDmConversationMessages } from "@/app/features/messaging/services/thread-history/materialization-load-earlier";

describe("loadLegacyEarlierDmConversationMessages", () => {
  it("returns existing messages when indexed window is empty", async () => {
    const existing: ReadonlyArray<Message> = [{
      id: "m1",
      content: "hi",
      senderPubkey: "a".repeat(64),
      timestamp: new Date(1_000),
      status: "delivered",
      isOutgoing: false,
    } as Message];

    const result = await loadLegacyEarlierDmConversationMessages({
      conversationId: "conv",
      conversationAliasIds: ["conv"],
      earliestTimestampMs: 2_000,
      loadEarlierBatchSize: 50,
      publicKeyHex: "b".repeat(64),
      persistentSuppressedMessageIds: new Set(),
      localMessageRetentionDays: undefined,
      existingMessages: existing,
    });

    expect(result.messages).toBe(existing);
    expect(result.hasEarlier).toBe(false);
    expect(result.didExpandHistory).toBe(false);
  });
});
