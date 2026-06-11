import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../types";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

import {
  evaluateDirectionCoverage,
  evaluatePartialDirectionHydrateRetryPolicy,
  evaluatePartialThreadRetryPolicy,
  evaluateProjectionMergePolicy,
  evaluateStaleEmptyHydrateRetryPolicy,
  finalizeDmThreadHydrateRead,
  hasPartialDirectionCoverage,
  reconcileDirectionCoverage,
  reconcileMonotonicLoadedDepth,
  resolveDisplayMessagesWithCacheFallback,
  resolveExpandedHistoryAfterHydrate,
  resolveInitialConversationPaint,
  shouldPersistDmThreadDisplayCache,
} from "./dm-thread-read-model";

const myPublicKeyHex = "a".repeat(64);
const peerPublicKeyHex = "b".repeat(64);

const baseMessage = (overrides: Partial<Message> & Pick<Message, "id" | "isOutgoing">): Message => ({
  conversationId: `${myPublicKeyHex}:${peerPublicKeyHex}`,
  kind: "user",
  content: "hello",
  timestamp: new Date(1_700_000_000_000),
  status: "delivered",
  senderPubkey: overrides.isOutgoing ? myPublicKeyHex : peerPublicKeyHex,
  recipientPubkey: overrides.isOutgoing ? peerPublicKeyHex : myPublicKeyHex,
  ...overrides,
});

describe("dm-thread-read-model", () => {
  describe("evaluateDirectionCoverage", () => {
    it("detects partial coverage when only one direction exists", () => {
      const coverage = evaluateDirectionCoverage([
        baseMessage({ id: "in-1", isOutgoing: false }),
      ], myPublicKeyHex as Message["senderPubkey"] & string);
      expect(coverage.isPartial).toBe(true);
      expect(coverage.incoming).toBe(1);
      expect(coverage.outgoing).toBe(0);
    });

    it("marks complete when both directions exist", () => {
      const coverage = evaluateDirectionCoverage([
        baseMessage({ id: "in-1", isOutgoing: false }),
        baseMessage({ id: "out-1", isOutgoing: true }),
      ], myPublicKeyHex as Message["senderPubkey"] & string);
      expect(coverage.isComplete).toBe(true);
      expect(coverage.isPartial).toBe(false);
    });
  });

  describe("reconcileDirectionCoverage", () => {
    it("preserves outgoing rows when hydrate drops self-authored history", () => {
      const outgoing = baseMessage({ id: "out-1", isOutgoing: true, content: "mine" });
      const incoming = baseMessage({ id: "in-1", isOutgoing: false, content: "theirs" });
      const { messages, preserved } = reconcileDirectionCoverage({
        hydratedMessages: [incoming],
        previousMessages: [outgoing, incoming],
        conversationIds: [outgoing.conversationId!],
        myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
      });
      expect(preserved).toBe(true);
      expect(messages.some((m) => m.id === "out-1")).toBe(true);
      expect(messages.some((m) => m.id === "in-1")).toBe(true);
    });

    it("pulls missing direction from supplemental layers on cold open", () => {
      const outgoing = baseMessage({ id: "out-supplemental", isOutgoing: true, content: "seed outgoing" });
      const incoming = baseMessage({ id: "in-hydrated", isOutgoing: false, content: "hydrated incoming" });
      const { messages, preserved } = reconcileDirectionCoverage({
        hydratedMessages: [incoming],
        previousMessages: [],
        supplementalMessages: [outgoing],
        conversationIds: [incoming.conversationId!],
        myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
      });
      expect(preserved).toBe(true);
      expect(hasPartialDirectionCoverage(messages, myPublicKeyHex as Message["senderPubkey"] & string)).toBe(false);
    });
  });

  describe("resolveInitialConversationPaint", () => {
    it("refuses one-sided native display cache as first paint", () => {
      const incomingOnly = [baseMessage({ id: "cache-in", isOutgoing: false })];
      const result = resolveInitialConversationPaint({
        displayCache: incomingOnly,
        syncSeed: [],
        myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
      });
      expect(result.shouldPaint).toBe(false);
      expect(result.source).toBe("none");
    });

    it("does not paint display cache on native (sqlite-only R1)", () => {
      const bidirectional = [
        baseMessage({ id: "cache-in", isOutgoing: false }),
        baseMessage({ id: "cache-out", isOutgoing: true }),
      ];
      const result = resolveInitialConversationPaint({
        displayCache: bidirectional,
        syncSeed: [],
        myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
      });
      expect(result.shouldPaint).toBe(false);
      expect(result.source).toBe("none");
    });
  });

  describe("reconcileMonotonicLoadedDepth", () => {
    it("unions older in-memory rows when hydrate returns a smaller capped window", () => {
      const conversationId = `${myPublicKeyHex}:${peerPublicKeyHex}`;
      const previous = Array.from({ length: 400 }, (_, index) => baseMessage({
        id: `msg-${index + 1}`,
        isOutgoing: index % 2 === 0,
        timestamp: new Date(1_700_000_000_000 + index),
      }));
      const hydrated = previous.slice(-200);
      const { messages, preserved } = reconcileMonotonicLoadedDepth({
        hydratedMessages: hydrated,
        previousMessages: previous,
        conversationIds: [conversationId],
      });
      expect(preserved).toBe(true);
      expect(messages).toHaveLength(400);
      expect(messages[0]?.id).toBe("msg-1");
      expect(messages[399]?.id).toBe("msg-400");
    });

    it("does not grow the window when hydrate already includes all previous rows", () => {
      const conversationId = `${myPublicKeyHex}:${peerPublicKeyHex}`;
      const previous = [
        baseMessage({ id: "a", isOutgoing: false }),
        baseMessage({ id: "b", isOutgoing: true }),
      ];
      const hydrated = [
        baseMessage({ id: "a", isOutgoing: false }),
        baseMessage({ id: "b", isOutgoing: true }),
        baseMessage({ id: "c", isOutgoing: false }),
      ];
      const { messages, preserved } = reconcileMonotonicLoadedDepth({
        hydratedMessages: hydrated,
        previousMessages: previous,
        conversationIds: [conversationId],
      });
      expect(preserved).toBe(false);
      expect(messages).toHaveLength(3);
    });
  });

  describe("resolveExpandedHistoryAfterHydrate", () => {
    it("keeps expanded history when previous depth exceeded the soft limit", () => {
      expect(resolveExpandedHistoryAfterHydrate({
        previousExpandedHistory: false,
        previousMessageCount: 400,
        hydratedMessageCount: 200,
      })).toBe(true);
    });

    it("clears expanded history after hydrate when depth stayed within the soft limit", () => {
      expect(resolveExpandedHistoryAfterHydrate({
        previousExpandedHistory: false,
        previousMessageCount: 120,
        hydratedMessageCount: 120,
      })).toBe(false);
    });
  });

  describe("finalizeDmThreadHydrateRead", () => {
    describe("native sqlite owner", () => {
      beforeEach(() => {
        vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
      });

      it("surfaces hydrate truth without retry or merge", () => {
        const result = finalizeDmThreadHydrateRead({
          assembledMessages: [baseMessage({ id: "in-1", isOutgoing: false })],
          previousMessages: [baseMessage({ id: "cache-out", isOutgoing: true })],
          supplementalMessages: [baseMessage({ id: "out-supplemental", isOutgoing: true })],
          conversationIds: [`${myPublicKeyHex}:${peerPublicKeyHex}`],
          myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
          directionCoverageAttempt: 0,
          maxDirectionCoverageAttempts: 3,
        });
        expect(result.directionCoverage.isPartial).toBe(true);
        expect(result.reconcilePolicy.shouldRetryHydrate).toBe(false);
        expect(result.directionCoveragePreserved).toBe(false);
        expect(result.loadedDepthPreserved).toBe(false);
        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.id).toBe("in-1");
      });

      it("preserves loaded depth when sqlite hydrate shrinks a previously expanded thread", () => {
        const conversationId = `${myPublicKeyHex}:${peerPublicKeyHex}`;
        const previous = [
          baseMessage({ id: "cache-in", isOutgoing: false }),
          baseMessage({ id: "cache-out", isOutgoing: true }),
        ];
        const result = finalizeDmThreadHydrateRead({
          assembledMessages: [baseMessage({ id: "sqlite-out", isOutgoing: true })],
          previousMessages: previous,
          supplementalMessages: [],
          conversationIds: [conversationId],
          myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
          directionCoverageAttempt: 0,
          maxDirectionCoverageAttempts: 3,
        });
        expect(result.directionCoveragePreserved).toBe(false);
        expect(result.loadedDepthPreserved).toBe(true);
        expect(result.messages).toHaveLength(3);
        expect(result.messages.some((message) => message.id === "cache-in")).toBe(true);
        expect(result.messages.some((message) => message.id === "cache-out")).toBe(true);
        expect(result.messages.some((message) => message.id === "sqlite-out")).toBe(true);
      });
    });

    describe("web persistence", () => {
      beforeEach(() => {
        vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
      });

      it("schedules hydrate retry when incoming-only without hints", () => {
        const result = finalizeDmThreadHydrateRead({
          assembledMessages: [baseMessage({ id: "in-1", isOutgoing: false })],
          previousMessages: [],
          supplementalMessages: [],
          conversationIds: [`${myPublicKeyHex}:${peerPublicKeyHex}`],
          myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
          directionCoverageAttempt: 0,
          maxDirectionCoverageAttempts: 3,
        });
        expect(result.directionCoverage.isPartial).toBe(true);
        expect(result.reconcilePolicy.shouldRetryHydrate).toBe(false);
      });

      it("merges supplemental outgoing rows without scheduling hydrate retry", () => {
        const result = finalizeDmThreadHydrateRead({
          assembledMessages: [baseMessage({ id: "in-1", isOutgoing: false })],
          previousMessages: [],
          supplementalMessages: [baseMessage({ id: "out-supplemental", isOutgoing: true })],
          conversationIds: [`${myPublicKeyHex}:${peerPublicKeyHex}`],
          myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
          directionCoverageAttempt: 0,
          maxDirectionCoverageAttempts: 3,
        });
        expect(result.reconcilePolicy.shouldRetryHydrate).toBe(false);
        expect(result.directionCoverage.isComplete).toBe(true);
        expect(result.messages.some((message) => message.id === "out-supplemental")).toBe(true);
      });

      it("preserves loaded depth when hydrate shrinks a previously expanded thread", () => {
        const conversationId = `${myPublicKeyHex}:${peerPublicKeyHex}`;
        const previous = Array.from({ length: 400 }, (_, index) => baseMessage({
          id: `depth-${index + 1}`,
          isOutgoing: index % 2 === 0,
          timestamp: new Date(1_700_000_000_000 + index),
        }));
        const result = finalizeDmThreadHydrateRead({
          assembledMessages: previous.slice(-200),
          previousMessages: previous,
          supplementalMessages: [],
          conversationIds: [conversationId],
          myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
          directionCoverageAttempt: 0,
          maxDirectionCoverageAttempts: 3,
        });
        expect(result.loadedDepthPreserved).toBe(true);
        expect(result.messages).toHaveLength(400);
      });
    });
  });

  describe("evaluateProjectionMergePolicy", () => {
    it("disables projection merge on native (R1 sqlite-only read owner)", () => {
      const previous = [
        baseMessage({ id: "out-1", isOutgoing: true }),
        baseMessage({ id: "in-1", isOutgoing: false }),
      ];
      const projectionIncomingOnly = [
        baseMessage({ id: "proj-in", isOutgoing: false }),
      ];
      const policy = evaluateProjectionMergePolicy({
        projectionMessages: projectionIncomingOnly,
        previousMessages: previous,
        myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
        suppressUntilHydrate: false,
      });
      expect(policy.shouldMerge).toBe(false);
      expect(policy.wouldDropDirectionCoverage).toBe(false);
    });
  });

  describe("shouldPersistDmThreadDisplayCache", () => {
    it("refuses persisting one-sided native display cache", () => {
      expect(shouldPersistDmThreadDisplayCache(
        [baseMessage({ id: "in-only", isOutgoing: false })],
        myPublicKeyHex as Message["senderPubkey"] & string,
      )).toBe(false);
    });

    it("never persists native display cache", () => {
      expect(shouldPersistDmThreadDisplayCache(
        [
          baseMessage({ id: "in-1", isOutgoing: false }),
          baseMessage({ id: "out-1", isOutgoing: true }),
        ],
        myPublicKeyHex as Message["senderPubkey"] & string,
      )).toBe(false);
    });
  });

  describe("resolveDisplayMessagesWithCacheFallback", () => {
    it("refuses one-sided cache fallback when live messages are empty", () => {
      const incomingOnly = [baseMessage({ id: "cache-in", isOutgoing: false })];
      const resolved = resolveDisplayMessagesWithCacheFallback({
        messages: [],
        displayCache: incomingOnly,
        myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
      });
      expect(resolved).toEqual([]);
    });

    it("prefers live messages over cache", () => {
      const live = [baseMessage({ id: "live-out", isOutgoing: true })];
      const resolved = resolveDisplayMessagesWithCacheFallback({
        messages: live,
        displayCache: [baseMessage({ id: "cache-in", isOutgoing: false })],
        myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
      });
      expect(resolved).toEqual(live);
    });

    it("does not upgrade live thread from display cache on native", () => {
      const live = [baseMessage({ id: "live-out", isOutgoing: true })];
      const cache = [
        baseMessage({ id: "cache-out", isOutgoing: true }),
        baseMessage({ id: "cache-in", isOutgoing: false }),
      ];
      const resolved = resolveDisplayMessagesWithCacheFallback({
        messages: live,
        displayCache: cache,
        myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
      });
      expect(resolved.map((message) => message.id)).toEqual(["live-out"]);
    });
  });

  describe("evaluateStaleEmptyHydrateRetryPolicy", () => {
    it("schedules retry when thread is empty and projection has no messages", () => {
      const policy = evaluateStaleEmptyHydrateRetryPolicy({
        messageCount: 0,
        isLoading: false,
        projectionHasMessages: false,
        useProjectionReads: true,
        attempt: 0,
      });
      expect(policy.shouldSchedule).toBe(true);
      expect(policy.delayMs).toBeGreaterThan(0);
    });

    it("skips retry when projection already has messages", () => {
      const policy = evaluateStaleEmptyHydrateRetryPolicy({
        messageCount: 0,
        isLoading: false,
        projectionHasMessages: true,
        useProjectionReads: true,
        attempt: 0,
      });
      expect(policy.shouldSchedule).toBe(false);
    });
  });

  describe("evaluatePartialThreadRetryPolicy", () => {
    it("retries partial native thread while attempts remain", () => {
      const policy = evaluatePartialThreadRetryPolicy({
        messages: [baseMessage({ id: "in-only", isOutgoing: false })],
        myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
        isLoading: false,
        attempt: 0,
      });
      expect(policy.shouldRetry).toBe(true);
      expect(policy.forceIndexedAuthority).toBe(true);
    });

    it("stops retrying after max attempts", () => {
      const policy = evaluatePartialThreadRetryPolicy({
        messages: [baseMessage({ id: "in-only", isOutgoing: false })],
        myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
        isLoading: false,
        attempt: 5,
      });
      expect(policy.shouldRetry).toBe(false);
    });
  });

  describe("evaluatePartialDirectionHydrateRetryPolicy", () => {
    it("does not schedule retry on native sqlite owner (relay backfill is the repair path)", () => {
      const policy = evaluatePartialDirectionHydrateRetryPolicy({
        messages: [baseMessage({ id: "in-only", isOutgoing: false })],
        myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
        isLoading: false,
        attempt: 0,
      });
      expect(policy.shouldSchedule).toBe(false);
      expect(policy.delayMs).toBe(0);
      expect(policy.forceIndexedAuthority).toBe(false);
    });

    it("schedules backoff retry for partial web thread", () => {
      vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
      const policy = evaluatePartialDirectionHydrateRetryPolicy({
        messages: [baseMessage({ id: "in-only", isOutgoing: false })],
        myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
        isLoading: false,
        attempt: 0,
      });
      expect(policy.shouldSchedule).toBe(true);
      expect(policy.delayMs).toBe(200);
      expect(policy.forceIndexedAuthority).toBe(false);
    });

    it("increases delay on subsequent web attempts", () => {
      vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
      const policy = evaluatePartialDirectionHydrateRetryPolicy({
        messages: [baseMessage({ id: "in-only", isOutgoing: false })],
        myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
        isLoading: false,
        attempt: 2,
      });
      expect(policy.shouldSchedule).toBe(true);
      expect(policy.delayMs).toBe(600);
    });

    it("skips scheduling when both directions are present", () => {
      const policy = evaluatePartialDirectionHydrateRetryPolicy({
        messages: [
          baseMessage({ id: "in-1", isOutgoing: false }),
          baseMessage({ id: "out-1", isOutgoing: true }),
        ],
        myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
        isLoading: false,
        attempt: 0,
      });
      expect(policy.shouldSchedule).toBe(false);
    });
  });
});
