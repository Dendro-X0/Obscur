/**
 * sec-bot-inbound-live — BOT-1 runner config validation + inbound flood parity (CLI, no relay I/O).
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeCommunityBotTriggers } from "./community-bot-triggers-contracts.mjs";
import {
  DEFAULT_INBOUND_RATE_LIMIT_PER_MIN,
  deriveBotPublicKeyHex,
  simulateInboundTriggerFlood,
} from "./community-bot-inbound.mjs";

const DEV_BOT_PRIVATE_KEY_HEX = "aa".repeat(32);
const DEV_HUMAN_PUBKEY_HEX = "bb".repeat(32);
const DEV_GROUP_ID = "dev-lab-managed-group";
const DEV_ROOM_KEY_HEX = "cc".repeat(32);
const DEV_RELAY_URL = "ws://127.0.0.1:7000";

export const DEV_LAB_BOT_INBOUND_LIVE_BOT_PUBKEY = deriveBotPublicKeyHex(DEV_BOT_PRIVATE_KEY_HEX);

const buildKeywordTriggerEntry = (enabled = true) => (
  normalizeCommunityBotTriggers([{
    botPubkey: DEV_LAB_BOT_INBOUND_LIVE_BOT_PUBKEY,
    enabled,
    triggers: [{
      kind: "keyword",
      enabled: true,
      reply: "pong",
      keywords: ["help"],
    }],
  }])[0]
);

const buildKeywordFloodEvents = (count) => (
  Array.from({ length: count }, (_, index) => ({
    eventId: `dev-lab-inbound-live-${index}`,
    inner: {
      kind: 9,
      content: `please help ${index}`,
      authorPublicKeyHex: DEV_HUMAN_PUBKEY_HEX,
    },
  }))
);

/**
 * @param {Readonly<{
 *   repoRoot: string;
 *   env?: Record<string, string | undefined>;
 *   timeoutMs?: number;
 * }>} params
 */
export const runCommunityInboundBotOnce = (params) => new Promise((resolve) => {
  const repoRoot = params.repoRoot;
  const runnerPath = path.join(repoRoot, "scripts", "community-inbound-bot.mjs");
  const triggers = buildKeywordTriggerEntry(true);
  const env = {
    ...process.env,
    OBSCUR_BOT_NSEC: DEV_BOT_PRIVATE_KEY_HEX,
    OBSCUR_BOT_RELAY_URL: DEV_RELAY_URL,
    OBSCUR_BOT_GROUP_ID: DEV_GROUP_ID,
    OBSCUR_BOT_ROOM_KEY_HEX: DEV_ROOM_KEY_HEX,
    OBSCUR_BOT_ALLOWED_PUBKEYS: DEV_LAB_BOT_INBOUND_LIVE_BOT_PUBKEY,
    OBSCUR_BOT_INBOUND_TRIGGERS_JSON: JSON.stringify([triggers]),
    OBSCUR_BOT_RATE_LIMIT_PER_MIN: String(DEFAULT_INBOUND_RATE_LIMIT_PER_MIN),
    ...params.env,
  };

  const child = spawn(process.execPath, [runnerPath, "--once"], {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
  child.stderr?.on("data", (chunk) => { stderr += String(chunk); });

  const timeoutMs = params.timeoutMs ?? 15_000;
  const timer = setTimeout(() => {
    child.kill("SIGTERM");
    resolve({
      ok: false,
      exitCode: null,
      timedOut: true,
      stdout,
      stderr,
    });
  }, timeoutMs);

  child.on("close", (exitCode) => {
    clearTimeout(timer);
    resolve({
      ok: exitCode === 0,
      exitCode,
      timedOut: false,
      stdout,
      stderr,
    });
  });
});

export const evaluateSecBotInboundLiveFlood = () => {
  const triggerEntry = buildKeywordTriggerEntry(true);
  const floodCount = 50;
  const flood = simulateInboundTriggerFlood({
    botPublicKeyHex: DEV_LAB_BOT_INBOUND_LIVE_BOT_PUBKEY,
    triggerEntry,
    inboundEvents: buildKeywordFloodEvents(floodCount),
    limitPerMinute: DEFAULT_INBOUND_RATE_LIMIT_PER_MIN,
    nowStartMs: 1_700_000_000_000,
    intervalMs: 100,
  });

  const rateLimitOk = flood.matchedCount === floodCount
    && flood.publishedCount === DEFAULT_INBOUND_RATE_LIMIT_PER_MIN
    && flood.rateLimitedCount === floodCount - DEFAULT_INBOUND_RATE_LIMIT_PER_MIN
    && flood.relayPublishAttempts === DEFAULT_INBOUND_RATE_LIMIT_PER_MIN;

  const paused = simulateInboundTriggerFlood({
    botPublicKeyHex: DEV_LAB_BOT_INBOUND_LIVE_BOT_PUBKEY,
    triggerEntry: buildKeywordTriggerEntry(false),
    inboundEvents: buildKeywordFloodEvents(20),
  });
  const stewardDisableOk = paused.matchedCount === 0 && paused.publishedCount === 0;

  return {
    flood,
    rateLimitOk,
    paused,
    stewardDisableOk,
  };
};

/**
 * @param {Readonly<{ log?: (msg: string) => void; repoRoot?: string }>} deps
 */
export async function runSecBotInboundLiveScenario(deps = {}) {
  const log = deps.log ?? (() => undefined);
  const repoRoot = deps.repoRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const startedAt = Date.now();
  const steps = [];

  const runnerOnce = await runCommunityInboundBotOnce({ repoRoot });
  const runnerOncePassed = runnerOnce.ok === true
    && runnerOnce.stdout.includes("--once mode");
  log(runnerOncePassed ? "community-inbound-bot --once ok" : "community-inbound-bot --once failed");
  steps.push({
    id: "runner_once_config_valid",
    passed: runnerOncePassed,
    message: runnerOncePassed
      ? "community-inbound-bot --once validated allowlist + triggers."
      : `Runner --once failed (exit=${runnerOnce.exitCode ?? "timeout"}): ${runnerOnce.stderr || runnerOnce.stdout}`,
    durationMs: 0,
    context: { exitCode: runnerOnce.exitCode, timedOut: runnerOnce.timedOut },
  });

  const allowlistReject = await runCommunityInboundBotOnce({
    repoRoot,
    env: { OBSCUR_BOT_ALLOWED_PUBKEYS: DEV_HUMAN_PUBKEY_HEX },
  });
  const allowlistRejectPassed = allowlistReject.ok === false
    && (allowlistReject.stderr.includes("allowlist") || allowlistReject.stderr.includes("OBSCUR_BOT_ALLOWED_PUBKEYS"));
  steps.push({
    id: "runner_allowlist_reject",
    passed: allowlistRejectPassed,
    message: allowlistRejectPassed
      ? "Runner rejected non-allowlisted bot pubkey."
      : `Expected allowlist rejection; exit=${allowlistReject.exitCode} stderr=${allowlistReject.stderr}`,
    durationMs: 0,
    context: { exitCode: allowlistReject.exitCode },
  });

  const floodEval = evaluateSecBotInboundLiveFlood();
  steps.push({
    id: "inbound_flood_rate_limit",
    passed: floodEval.rateLimitOk,
    message: floodEval.rateLimitOk
      ? `Inbound flood capped at ${DEFAULT_INBOUND_RATE_LIMIT_PER_MIN}/min (${floodEval.flood.rateLimitedCount} skipped).`
      : `Rate limit mismatch: published=${floodEval.flood.publishedCount}, limited=${floodEval.flood.rateLimitedCount}.`,
    durationMs: 0,
    context: { flood: floodEval.flood },
  });
  steps.push({
    id: "steward_disable_no_publish",
    passed: floodEval.stewardDisableOk,
    message: floodEval.stewardDisableOk
      ? "Steward-disabled triggers publish nothing under flood."
      : `Disabled triggers still matched/published (${floodEval.paused.matchedCount}/${floodEval.paused.publishedCount}).`,
    durationMs: 0,
    context: { paused: floodEval.paused },
  });

  const passed = steps.every((entry) => entry.passed === true);

  return {
    id: "sec-bot-inbound-live",
    name: "SEC-B BOT-1 live inbound runner + flood (CLI)",
    category: "security",
    passed,
    durationMs: Date.now() - startedAt,
    steps,
  };
}
