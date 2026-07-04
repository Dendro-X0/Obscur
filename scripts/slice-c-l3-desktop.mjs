#!/usr/bin/env node
/**
 * Phase 1B Slice C L3 — desktop CDP send after coordination wrap backfill.
 *
 * Prerequisites:
 *   pnpm dev:desktop:online   (coordination :8787, relay :7000, CDP :9230)
 *   Unlock Tester1 in Tauri if auth gate appears
 *
 * Usage:
 *   node scripts/slice-c-l3-desktop.mjs
 *   node scripts/slice-c-l3-desktop.mjs --skip-backfill
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const skipBackfill = hasFlag("--skip-backfill");
const cdpUrl = process.env.OBSCUR_CDP_URL ?? "http://127.0.0.1:9230";
const coordinationUrl = process.env.OBSCUR_COORDINATION_URL ?? "http://127.0.0.1:8787";

const log = (message) => console.log(`[slice-c-l3] ${message}`);

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
  log(`Waiting for coordination health at ${coordinationUrl}/health`);
  await waitForHttp(`${coordinationUrl.replace(/\/$/, "")}/health`);

  try {
    await waitForHttp(`${cdpUrl.replace(/\/$/, "")}/json/version`, 15_000);
    log(`CDP reachable at ${cdpUrl}`);
  } catch {
    log(`WARN: CDP not reachable at ${cdpUrl} — start pnpm dev:desktop:online and unlock Tester1`);
  }

  if (!skipBackfill) {
    log("Publishing coordination room-key wrap fixture (Tester1 self-wrap)...");
    const backfill = spawnSync(
      process.execPath,
      [
        path.join(repoRoot, "scripts", "publish-coordination-room-key-wrap-fixture.mjs"),
        "--coordination",
        coordinationUrl,
      ],
      { cwd: repoRoot, encoding: "utf8", env: process.env },
    );
    process.stdout.write(backfill.stdout ?? "");
    process.stderr.write(backfill.stderr ?? "");
    if (backfill.status !== 0) {
      throw new Error("Fixture backfill failed — see output above");
    }
  }

  log("Running Playwright Slice C L3 spec via CDP...");
  const playwright = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    [
      "exec",
      "playwright",
      "test",
      "-c",
      "playwright.slice-c-l3.config.ts",
    ],
    {
      cwd: pwaDir,
      encoding: "utf8",
      env: {
        ...process.env,
        OBSCUR_CDP_URL: cdpUrl,
        PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3340",
        OBSCUR_RUNTIME_CAPTURE_REQUIRE_NATIVE: "1",
      },
      shell: process.platform === "win32",
    },
  );

  process.stdout.write(playwright.stdout ?? "");
  process.stderr.write(playwright.stderr ?? "");

  const reportPath = path.join(repoRoot, "test-results", "phase1b-slice-c-l3-2026-07-03.json");
  if (fs.existsSync(reportPath)) {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    log(`Report: ${reportPath}`);
    log(`L3 pass=${report.l3?.pass === true}`);
  }

  if (playwright.status !== 0) {
    process.exit(playwright.status ?? 1);
  }
}

main().catch((error) => {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
