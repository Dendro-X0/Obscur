#!/usr/bin/env node
/**
 * U2 Wave D L3 — group list + message persist after webview reload (workspace-engine).
 *
 * Prerequisites:
 *   pnpm dev:desktop:online   (coordination :8787, relay :7000, CDP :9230)
 *   Tester1 unlocked; NewTest 2 joined
 *
 * Usage:
 *   node scripts/u2-l3-group-persist-desktop.mjs
 *   pnpm verify:u2-l3
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const cdpUrl = process.env.OBSCUR_CDP_URL ?? "http://127.0.0.1:9230";
const reportPath = path.join(repoRoot, "test-results", "u2-l3-group-persist-2026-07-31.json");

const log = (message) => console.log(`[u2-l3] ${message}`);

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
    await waitForHttp(`${cdpUrl.replace(/\/$/, "")}/json/version`, 15_000);
    log(`CDP reachable at ${cdpUrl}`);
  } catch {
    log(`WARN: CDP not reachable at ${cdpUrl} — start pnpm dev:desktop:online`);
  }

  log("Running Playwright U2 L3 group-persist restart soak...");
  const playwright = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    [
      "exec",
      "playwright",
      "test",
      "-c",
      "playwright.u2-l3.config.ts",
    ],
    {
      cwd: pwaDir,
      encoding: "utf8",
      env: {
        ...process.env,
        OBSCUR_CDP_URL: cdpUrl,
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
  } else {
    log(`WARN: report missing at ${reportPath}`);
  }

  if (playwright.status !== 0) {
    process.exit(playwright.status ?? 1);
  }
}

main().catch((error) => {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
