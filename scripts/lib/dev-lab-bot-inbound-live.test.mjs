import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEV_LAB_BOT_INBOUND_LIVE_BOT_PUBKEY,
  evaluateSecBotInboundLiveFlood,
} from "./dev-lab-bot-inbound-live.mjs";
import { DEFAULT_INBOUND_RATE_LIMIT_PER_MIN } from "./community-bot-inbound.mjs";

describe("dev-lab-bot-inbound-live", () => {
  it("exposes stable dev bot pubkey for allowlist fixtures", () => {
    assert.match(DEV_LAB_BOT_INBOUND_LIVE_BOT_PUBKEY, /^[0-9a-f]{64}$/);
  });

  it("evaluates BOT-1 flood rate limit and steward disable", () => {
    const evaluation = evaluateSecBotInboundLiveFlood();
    assert.equal(evaluation.rateLimitOk, true);
    assert.equal(evaluation.flood.publishedCount, DEFAULT_INBOUND_RATE_LIMIT_PER_MIN);
    assert.equal(evaluation.stewardDisableOk, true);
  });
});
