import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../types";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

import {
  evaluateDirectionCoverage,
  evaluatePartialThreadRetryPolicy,
  evaluateProjectionMergePolicy,
  evaluateStaleEmptyHydrateRetryPolicy,
  finalizeDmThreadHydrateRead,
  hasPartialDirectionCoverage,
  reconcileDirectionCoverage,
  resolveDisplayMessagesWithCacheFallback,
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

    it("paints bidirectional display cache on native", () => {
      const bidirectional = [
        baseMessage({ id: "cache-in", isOutgoing: false }),
        baseMessage({ id: "cache-out", isOutgoing: true }),
      ];
      const result = resolveInitialConversationPaint({
        displayCache: bidirectional,
        syncSeed: [],
        myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
      });
      expect(result.shouldPaint).toBe(true);
      expect(result.source).toBe("display_cache");
      expect(result.messages).toHaveLength(2);
    });
  });

  describe("finalizeDmThreadHydrateRead", () => {
    it("schedules reconcile retry only when missing direction exists in hints", () => {
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
  });

  describe("evaluateProjectionMergePolicy", () => {
    it("blocks projection merge when it would drop outgoing coverage", () => {
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
      expect(policy.wouldDropDirectionCoverage).toBe(true);
    });
  });

  describe("shouldPersistDmThreadDisplayCache", () => {
    it("refuses persisting one-sided native display cache", () => {
      expect(shouldPersistDmThreadDisplayCache(
        [baseMessage({ id: "in-only", isOutgoing: false })],
        myPublicKeyHex as Message["senderPubkey"] & string,
      )).toBe(false);
    });

    it("allows persisting bidirectional native display cache", () => {
      expect(shouldPersistDmThreadDisplayCache(
        [
          baseMessage({ id: "in-1", isOutgoing: false }),
          baseMessage({ id: "out-1", isOutgoing: true }),
        ],
        myPublicKeyHex as Message["senderPubkey"] & string,
      )).toBe(true);
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

    it("upgrades one-sided live thread from fuller bidirectional cache", () => {
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
      expect(resolved.map((message) => message.id)).toEqual(["cache-out", "cache-in"]);
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
    it("retries partial native thread once", () => {
      const policy = evaluatePartialThreadRetryPolicy({
        messages: [baseMessage({ id: "in-only", isOutgoing: false })],
        myPublicKeyHex: myPublicKeyHex as Message["senderPubkey"] & string,
        isLoading: false,
        alreadyAttempted: false,
      });
      expect(policy.shouldRetry).toBe(true);
      expect(policy.forceIndexedAuthority).toBe(true);
    });
  });
});
