import { describe, expect, it } from "vitest";
import type { Message } from "../../types";
import {
  THREAD_HISTORY_DEFAULT_PAGE_SIZE,
  THREAD_HISTORY_LIVE_WINDOW_SOFT_LIMIT,
  toLoadEarlierParamsFromCursor,
  toThreadCursor,
  toThreadHistoryPageFromLoadEarlierResult,
} from "./contracts";
import { dmThreadHistoryAdapter } from "./dm-adapter";
import { groupThreadHistoryAdapter } from "./group-adapter";
import { groupThreadHistoryAdapterStub } from "./group-adapter.stub";
import { resolveThreadHistoryAdapter } from "./resolve-thread-history-adapter";
import type { ThreadHistoryPort } from "./port";
import {
  reconcileMonotonicLoadedDepth,
  resolveExpandedHistoryAfterHydrate,
} from "./read-model";

const THREAD_HISTORY_PORT_METHODS: ReadonlyArray<keyof ThreadHistoryPort> = [
  "prepareThreadSuppressionIds",
  "hydrateThreadReadModel",
  "buildProjectionEvidenceMessages",
  "mergeProjectionWithLiveOverlay",
  "loadEarlierMessages",
  "applyRealtimeBufferedEvents",
  "filterThreadMessagesBySuppression",
  "mergeHydratedBaseWithLiveOverlay",
];

const expectThreadHistoryPortShape = (adapter: ThreadHistoryPort, label: string): void => {
  THREAD_HISTORY_PORT_METHODS.forEach((method) => {
    expect(adapter[method], `${label}.${method}`).toBeTypeOf("function");
  });
};

const baseMessage = (id: string, timestampMs: number): Message => ({
  id,
  kind: "user",
  content: id,
  timestamp: new Date(timestampMs),
  isOutgoing: false,
  status: "delivered",
  conversationId: "c-1",
  senderPubkey: "b".repeat(64),
  recipientPubkey: "a".repeat(64),
});

describe("ThreadHistoryPort contract", () => {
  it("defines shared pagination constants aligned with DM soft window", () => {
    expect(THREAD_HISTORY_DEFAULT_PAGE_SIZE).toBe(200);
    expect(THREAD_HISTORY_LIVE_WINDOW_SOFT_LIMIT).toBe(200);
  });

  it("dm adapter satisfies the full port contract", () => {
    expectThreadHistoryPortShape(dmThreadHistoryAdapter, "dm");
  });

  it("group sqlite adapter satisfies the full port contract", () => {
    expectThreadHistoryPortShape(groupThreadHistoryAdapter, "group");
  });

  it("group empty stub still satisfies the full port contract", () => {
    expectThreadHistoryPortShape(groupThreadHistoryAdapterStub, "group-stub");
  });

  it("resolveThreadHistoryAdapter routes dm and group kinds", () => {
    expect(resolveThreadHistoryAdapter("dm")).toBe(dmThreadHistoryAdapter);
    expect(resolveThreadHistoryAdapter("group")).toBe(groupThreadHistoryAdapter);
  });

  it("maps cursor params to DM load-earlier and normalizes page results", () => {
    const cursor = toThreadCursor(5_000, "evt-older");
    const params = toLoadEarlierParamsFromCursor({
      base: {
        conversationId: "c-1",
        conversationAliasIds: ["c-1"],
        publicKeyHex: "a".repeat(64),
        persistentSuppressedMessageIds: new Set(),
        localMessageRetentionDays: 0,
        existingMessages: [baseMessage("newest", 6_000)],
      },
      cursor,
      pageSize: 50,
    });
    expect(params.earliestTimestampMs).toBe(5_000);
    expect(params.loadEarlierBatchSize).toBe(50);

    const page = toThreadHistoryPageFromLoadEarlierResult({
      messages: [baseMessage("older-1", 4_000), baseMessage("newest", 6_000)],
      hasEarlier: true,
      didExpandHistory: true,
    });
    expect(page.didExpandHistory).toBe(true);
    expect(page.hasEarlier).toBe(true);
    expect(page.nextCursor?.beforeTimestampMs).toBe(4_000);
  });

  it("group stub hydrate returns empty history without earlier pages", async () => {
    const result = await groupThreadHistoryAdapterStub.hydrateThreadReadModel({} as never);
    expect(result.finalMessages).toEqual([]);
    expect(result.hasEarlier).toBe(false);
    expect(result.authorityDiagnosticKey).toContain("group-stub");
  });

  it("read-model kernel preserves monotonic loaded depth", () => {
    const conversationId = "c-depth";
    const previous = Array.from({ length: 400 }, (_, index) => ({
      ...baseMessage(`m-${index}`, index * 1_000),
      conversationId,
    }));
    const hydrated = previous.slice(-200);
    const { messages, preserved } = reconcileMonotonicLoadedDepth({
      hydratedMessages: hydrated,
      previousMessages: previous,
      conversationIds: [conversationId],
    });
    expect(preserved).toBe(true);
    expect(messages).toHaveLength(400);
  });

  it("read-model kernel keeps expanded history when depth exceeds soft limit", () => {
    expect(resolveExpandedHistoryAfterHydrate({
      previousExpandedHistory: false,
      previousMessageCount: 350,
      hydratedMessageCount: 200,
    })).toBe(true);
  });
});
