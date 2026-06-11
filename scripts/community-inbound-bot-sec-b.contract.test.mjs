import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("community-inbound-bot SEC-B contract", () => {
  const read = (relativePath) => readFileSync(path.join(repoRoot, relativePath), "utf8");

  it("runner enforces allowlist before subscribe (SEC-B1)", () => {
    const runner = read("scripts/community-inbound-bot.mjs");
    assert.match(runner, /assertBotPubkeyAllowlisted/);
    assert.match(runner, /OBSCUR_BOT_ALLOWED_PUBKEYS/);
  });

  it("runner applies per-minute reply rate limit (SEC-B1)", () => {
    const runner = read("scripts/community-inbound-bot.mjs");
    const lib = read("scripts/lib/community-bot-inbound.mjs");
    assert.match(runner, /createRateLimiter/);
    assert.match(runner, /rate limit reached/);
    assert.match(lib, /DEFAULT_INBOUND_RATE_LIMIT_PER_MIN/);
  });

  it("verify:trust-v1.9.5 includes inbound bot tests", () => {
    const pkg = read("package.json");
    assert.match(pkg, /verify:trust-v1\.9\.5.*test:community-inbound-bot/s);
  });
});
