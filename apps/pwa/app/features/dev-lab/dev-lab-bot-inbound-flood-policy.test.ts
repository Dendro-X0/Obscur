import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  buildDevLabKeywordFloodEvents,
  buildDevLabKeywordTriggerEntry,
  DEV_LAB_BOT_INBOUND_RATE_LIMIT_PER_MIN,
  evaluateDevLabBotAllowlistGate,
  simulateDevLabInboundKeywordFlood,
} from "./dev-lab-bot-inbound-flood-policy";

const BOT = "aa".repeat(32) as PublicKeyHex;
const HUMAN = "bb".repeat(32) as PublicKeyHex;
const UNLISTED = "cc".repeat(32) as PublicKeyHex;

describe("dev-lab-bot-inbound-flood-policy", () => {
  it("caps keyword flood at default per-minute rate limit", () => {
    const result = simulateDevLabInboundKeywordFlood({
      botPublicKeyHex: BOT,
      triggerEntry: buildDevLabKeywordTriggerEntry(BOT, true),
      inboundEvents: buildDevLabKeywordFloodEvents(50, HUMAN),
      limitPerMinute: DEV_LAB_BOT_INBOUND_RATE_LIMIT_PER_MIN,
      nowStartMs: 1_700_000_000_000,
      intervalMs: 100,
    });

    expect(result.matchedCount).toBe(50);
    expect(result.publishedCount).toBe(DEV_LAB_BOT_INBOUND_RATE_LIMIT_PER_MIN);
    expect(result.rateLimitedCount).toBe(50 - DEV_LAB_BOT_INBOUND_RATE_LIMIT_PER_MIN);
  });

  it("publishes nothing when steward disables triggers", () => {
    const result = simulateDevLabInboundKeywordFlood({
      botPublicKeyHex: BOT,
      triggerEntry: buildDevLabKeywordTriggerEntry(BOT, false),
      inboundEvents: buildDevLabKeywordFloodEvents(20, HUMAN),
    });

    expect(result.matchedCount).toBe(0);
    expect(result.publishedCount).toBe(0);
  });

  it("rejects unregistered bot triggers via allowlist sanitizer", () => {
    const gate = evaluateDevLabBotAllowlistGate({
      registeredBotPubkeys: [BOT],
      triggerBotPubkey: UNLISTED,
    });
    expect(gate.accepted).toBe(false);
    expect(gate.sanitizedCount).toBe(0);
  });
});
