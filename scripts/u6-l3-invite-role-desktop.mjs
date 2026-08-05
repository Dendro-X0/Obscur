#!/usr/bin/env node
/**
 * U6 Wave B L3 — dual CDP Accept/Cancel invite role matrix.
 *
 * Prerequisites:
 *   pnpm dev:desktop:online   (coordination :8787, CDP :9230 / profile :9231)
 *   Tester1 unlocked on main; Tester2 unlocked on profile-2
 *   Active community invite visible in T1↔T2 DM (e.g. "U6 Invite Role")
 *
 * Usage:
 *   node scripts/u6-l3-invite-role-desktop.mjs
 *   pnpm verify:u6-l3
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const cdpMain = process.env.OBSCUR_CDP_URL ?? "http://127.0.0.1:9230";
const cdpProfile = process.env.OBSCUR_CDP_PROFILE_URL ?? "http://127.0.0.1:9231";
const reportPath = path.join(repoRoot, "test-results", "u6-l3-invite-role-2026-07-31.json");

const log = (message) => console.log(`[u6-l3] ${message}`);

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
  try {
    await waitForHttp(`${cdpMain.replace(/\/$/, "")}/json/version`, 15_000);
    log(`CDP main reachable at ${cdpMain}`);
  } catch {
    log(`WARN: CDP not reachable at ${cdpMain} — start pnpm dev:desktop:online`);
  }

  log("Running Playwright U6 L3 dual-CDP invite role spec...");
  const playwright = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    [
      "exec",
      "playwright",
      "test",
      "-c",
      "playwright.u6-l3.config.ts",
    ],
    {
      cwd: pwaDir,
      encoding: "utf8",
      env: {
        ...process.env,
        OBSCUR_CDP_URL: cdpMain,
        OBSCUR_CDP_PROFILE_URL: cdpProfile,
        PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:1430",
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
    log(`L3 pass=${report.l3?.pass === true}`);
    if (report.l3?.blockedReason) {
      log(`blockedReason=${report.l3.blockedReason}`);
    }
  }

  if (playwright.status !== 0) {
    process.exit(playwright.status ?? 1);
  }
}

main().catch((error) => {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
