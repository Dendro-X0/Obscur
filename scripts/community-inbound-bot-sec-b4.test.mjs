import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeCommunityBotTriggers } from "./lib/community-bot-triggers-contracts.mjs";
import {
  DEFAULT_INBOUND_RATE_LIMIT_PER_MIN,
  simulateInboundTriggerFlood,
} from "./lib/community-bot-inbound.mjs";

const BOT = "aa".repeat(32);
const HUMAN = "bb".repeat(32);

const keywordTriggerEntry = normalizeCommunityBotTriggers([{
  botPubkey: BOT,
  enabled: true,
  triggers: [{
    kind: "keyword",
    enabled: true,
    reply: "pong",
    keywords: ["help"],
  }],
}])[0];

const buildKeywordFlood = (count) => Array.from({ length: count }, (_, index) => ({
  eventId: `evt-${index}`,
  inner: {
    kind: 9,
    content: `please help ${index}`,
    authorPublicKeyHex: HUMAN,
  },
}));

describe("community-inbound-bot SEC-B4 (BOT-1 keyword flood)", () => {
  it("caps relay publish attempts at per-minute rate limit under keyword flood", () => {
    const floodCount = 50;
    const result = simulateInboundTriggerFlood({
      botPublicKeyHex: BOT,
      triggerEntry: keywordTriggerEntry,
      inboundEvents: buildKeywordFlood(floodCount),
      limitPerMinute: DEFAULT_INBOUND_RATE_LIMIT_PER_MIN,
      nowStartMs: 1_700_000_000_000,
      intervalMs: 100,
    });

    assert.equal(result.matchedCount, floodCount);
    assert.equal(result.publishedCount, DEFAULT_INBOUND_RATE_LIMIT_PER_MIN);
    assert.equal(result.rateLimitedCount, floodCount - DEFAULT_INBOUND_RATE_LIMIT_PER_MIN);
    assert.equal(result.relayPublishAttempts, DEFAULT_INBOUND_RATE_LIMIT_PER_MIN);
  });

  it("does not queue or burst beyond limit — excess matches are skipped", () => {
    const result = simulateInboundTriggerFlood({
      botPublicKeyHex: BOT,
      triggerEntry: keywordTriggerEntry,
      inboundEvents: buildKeywordFlood(100),
      limitPerMinute: 3,
      nowStartMs: 0,
      intervalMs: 10,
    });

    assert.equal(result.publishedCount, 3);
    assert.equal(result.rateLimitedCount, 97);
    assert.ok(result.relayPublishAttempts <= 3);
  });

  it("steward-disabled triggers publish nothing despite keyword flood", () => {
    const pausedEntry = normalizeCommunityBotTriggers([{
      botPubkey: BOT,
      enabled: false,
      triggers: [{
        kind: "keyword",
        enabled: true,
        reply: "pong",
        keywords: ["help"],
      }],
    }])[0];

    const result = simulateInboundTriggerFlood({
      botPublicKeyHex: BOT,
      triggerEntry: pausedEntry,
      inboundEvents: buildKeywordFlood(20),
    });

    assert.equal(result.matchedCount, 0);
    assert.equal(result.publishedCount, 0);
    assert.equal(result.relayPublishAttempts, 0);
  });

  it("ignores bot self-replies and duplicate event ids during flood", () => {
    const events = [
      ...buildKeywordFlood(5),
      {
        eventId: "evt-0",
        inner: {
          kind: 9,
          content: "duplicate help",
          authorPublicKeyHex: HUMAN,
        },
      },
      {
        eventId: "evt-self",
        inner: {
          kind: 9,
          content: "help from bot",
          authorPublicKeyHex: BOT,
        },
      },
    ];

    const result = simulateInboundTriggerFlood({
      botPublicKeyHex: BOT,
      triggerEntry: keywordTriggerEntry,
      inboundEvents: events,
    });

    assert.equal(result.matchedCount, 5);
    assert.equal(result.duplicateCount, 1);
    assert.equal(result.skippedSelfCount, 1);
  });
});
