#!/usr/bin/env node
/**
 * Rejoin NewTest 2 for Tester1 after U4 L3 leave (Slice C fixture hygiene).
 *
 * Prerequisites: coordination :8787, desktop CDP :9230, shell :1430, Tester1 unlocked.
 *
 * Usage:
 *   node scripts/rejoin-newtest2-desktop.mjs
 *   pnpm rejoin:newtest2
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  deriveLegacyCommunityId,
  derivePublicKeyHexFromPrivate,
  ensureCoordinationMembershipJoin,
  NEWTEST2_GROUP_ID,
  NEWTEST2_RELAY_URL,
  resolveNewTest2RoomKeyHex,
  TESTER1_PRIVATE_KEY_HEX,
} from "./lib/coordination-room-key-wrap-fixture.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const cdpUrl = process.env.OBSCUR_CDP_URL ?? "http://127.0.0.1:9230";
const coordinationUrl = process.env.OBSCUR_COORDINATION_URL ?? "http://127.0.0.1:8787";
const communityId = process.env.OBSCUR_NEWTEST2_COMMUNITY_ID
  ?? deriveLegacyCommunityId(NEWTEST2_GROUP_ID, NEWTEST2_RELAY_URL);
const reportPath = path.join(repoRoot, "test-results", "newtest2-rejoin-2026-07-31.json");

const log = (message) => console.log(`[rejoin-newtest2] ${message}`);

async function waitForHttp(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  log(`Waiting for coordination ${coordinationUrl}/health`);
  await waitForHttp(`${coordinationUrl.replace(/\/$/, "")}/health`);

  const subjectPubkey = derivePublicKeyHexFromPrivate(TESTER1_PRIVATE_KEY_HEX);
  log(`Resolving room key for ${communityId} subject …${subjectPubkey.slice(-8)}`);
  const roomKey = await resolveNewTest2RoomKeyHex({
    coordinationBaseUrl: coordinationUrl,
    communityId,
    groupId: NEWTEST2_GROUP_ID,
    actorPrivateKeyHex: TESTER1_PRIVATE_KEY_HEX,
    subjectPubkey,
  });
  log(`Room key source=${roomKey.roomKeySource} wrapSeq=${roomKey.wrapSeq}`);

  log("Publishing coordination join delta (force)…");
  const join = await ensureCoordinationMembershipJoin({
    coordinationBaseUrl: coordinationUrl,
    communityId,
    actorPrivateKeyHex: TESTER1_PRIVATE_KEY_HEX,
    subjectPubkey,
    force: true,
  });
  log(`Join delta skipped=${join.skipped === true} seq=${join.seq ?? "n/a"}`);

  try {
    await waitForHttp(`${cdpUrl.replace(/\/$/, "")}/json/version`, 15_000);
    log(`CDP reachable at ${cdpUrl}`);
  } catch {
    throw new Error(`CDP not reachable at ${cdpUrl} — start pnpm dev:desktop:no-coord -- --skip-build`);
  }

  log("Running Playwright rejoin spec via CDP…");
  const playwright = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "playwright", "test", "-c", "playwright.newtest2-rejoin.config.ts"],
    {
      cwd: pwaDir,
      encoding: "utf8",
      env: {
        ...process.env,
        OBSCUR_CDP_URL: cdpUrl,
        PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:1430",
        OBSCUR_NEWTEST2_ROOM_KEY_HEX: roomKey.roomKeyHex,
        OBSCUR_RUNTIME_CAPTURE_REQUIRE_NATIVE: "1",
      },
      shell: process.platform === "win32",
    },
  );
  process.stdout.write(playwright.stdout ?? "");
  process.stderr.write(playwright.stderr ?? "");

  if (fs.existsSync(reportPath)) {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    log(`Report: ${reportPath}`);
    log(`joined=${report.l3?.pass === true}`);
  }

  if (playwright.status !== 0) {
    process.exit(playwright.status ?? 1);
  }
}

main().catch((error) => {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
