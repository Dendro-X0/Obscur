import { describe, expect, it, vi } from "vitest";
import type { Message } from "../types";

const scanMocks = vi.hoisted(() => ({
  loadConversationWindowAcrossAliases: vi.fn(async () => ({ rows: [], hasEarlier: false })),
  scanDisplayableHistoryWindow: vi.fn(async () => ({ messages: [], hasEarlier: false })),
}));

vi.mock("./dm-conversation-hydrate-indexed-scan", () => scanMocks);

vi.mock("./dm-conversation-hydrate-indexed-map-rows", () => ({
  mapIndexedConversationRowsForDisplayableScan: vi.fn(() => []),
}));

import { loadEarlierDmConversationMessages } from "./dm-conversation-materialization-load-earlier";

describe("loadEarlierDmConversationMessages", () => {
  it("returns existing messages when indexed window is empty", async () => {
    const existing: ReadonlyArray<Message> = [{
      id: "m1",
      content: "hi",
      senderPubkey: "a".repeat(64),
      timestamp: new Date(1_000),
      status: "delivered",
      isOutgoing: false,
    } as Message];

    const result = await loadEarlierDmConversationMessages({
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
