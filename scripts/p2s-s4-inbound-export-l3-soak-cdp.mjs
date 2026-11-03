#!/usr/bin/env node
/**
 * P2-S S4 L3 — inbound export consent soak via CDP :9230.
 * Spec: specs/backend/p2s-s4-inbound-export-l3-soak-2026-11.md
 *
 *   OBSCUR_ALLOW_STALE_SHELL=1 pnpm dev:desktop -- --rebuild
 *   node scripts/p2s-s4-inbound-export-l3-soak-cdp.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatNoObscurPageError,
  pickAppPageFromBrowser,
  waitForAppPageFromBrowser,
} from "./lib/cdp-app-page.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const requireFromPwa = createRequire(path.join(pwaDir, "package.json"));
const CDP = process.env.OBSCUR_CDP_URL ?? "http://127.0.0.1:9230";
const outJson = path.join(repoRoot, "docs", "handoffs", "p2s-s4-inbound-export-l3-soak-latest.json");
const outMd = path.join(repoRoot, "docs", "handoffs", "p2s-s4-inbound-export-l3-soak-latest.md");
const exportModulePath = path.join(
  repoRoot,
  "apps/pwa/app/features/storage/services/inbound-media-export.ts",
);

function loadPlaywright() {
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

function writeReport(report) {
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const matrixLines = Object.entries(report.matrix ?? {})
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
  const nonClaims = (report.nonClaims ?? []).map((c) => `- ${c}`).join("\n");
  fs.writeFileSync(
    outMd,
    [
      "# P2-S S4 inbound export L3 soak",
      "",
      `- Captured: ${report.capturedAt}`,
      `- Verdict: **${report.verdict}**`,
      report.reason ? `- Reason: ${report.reason}` : "",
      `- CDP: \`${report.cdp}\``,
      "",
      "## Matrix",
      "",
      matrixLines,
      "",
      "## Non-claims",
      "",
      nonClaims,
      "",
    ].filter(Boolean).join("\n"),
    "utf8",
  );
}

async function main() {
  const exportSource = fs.readFileSync(exportModulePath, "utf8");
  const exportModuleNoShellOpen = !/openPath|shell\.open|plugin:shell/i.test(exportSource)
    && /userConsentConfirmed/.test(exportSource)
    && /consent_required/.test(exportSource);

  const { chromium } = loadPlaywright();
  const browser = await chromium.connectOverCDP(CDP);
  let page = await pickAppPageFromBrowser(browser, "http://127.0.0.1:1430");
  if (!page) {
    page = await waitForAppPageFromBrowser(browser, { timeoutMs: 30000 });
  }
  if (!page) {
    throw new Error(formatNoObscurPageError(browser, CDP));
  }

  await page.goto("http://127.0.0.1:1430/network").catch(() => undefined);
  await page.waitForTimeout(1500);

  const hooksDeadline = Date.now() + 90000;
  let hooksPresent = false;
  while (Date.now() < hooksDeadline) {
    hooksPresent = await page.evaluate(() => Boolean(window.__OBSCUR_STORAGE_SOAK__));
    if (hooksPresent) {
      break;
    }
    if (await page.locator('input[type="password"]').count()) {
      await page.locator('input[type="password"]').first().fill(
        process.env.OBSCUR_SOAK_PASSWORD ?? "SyI14^ew1E",
      );
      if (await page.locator('button[type="submit"]').count()) {
        await page.locator('button[type="submit"]').first().click();
      } else {
        await page.getByRole("button", { name: /unlock local data|^(unlock|log in)$/i }).last().click();
      }
      await page.waitForTimeout(2500);
      continue;
    }
    await page.waitForTimeout(500);
  }

  const matrix = {
    hooksPresent,
    quarantineRequiresConfirm: false,
    deniedExeRequiresConfirm: false,
    exportWithoutConsentBlocked: false,
    planNeverSystemOpen: false,
    exportModuleNoShellOpen,
  };
  let reason;

  if (!hooksPresent) {
    reason = "storage_soak_hooks_missing";
  } else {
    const live = await page.evaluate(async () => {
      const soak = window.__OBSCUR_STORAGE_SOAK__;
      if (!soak) {
        return { error: "hooks_missing" };
      }
      const quarantineRequiresConfirm = soak.requiresInboundMediaExportConfirm({
        contentAvailabilityState: "quarantined",
        mimeType: "image/png",
        fileName: "photo.png",
      });
      const deniedExeRequiresConfirm = soak.requiresInboundMediaExportConfirm({
        mimeType: "application/octet-stream",
        fileName: "setup.exe",
      });
      const exportWithoutConsent = await soak.exportInboundMediaToUserPath({
        attachment: {
          kind: "file",
          url: "blob:https://app/local-s4",
          contentType: "application/octet-stream",
          fileName: "setup.exe",
        },
        userConsentConfirmed: false,
        contentAvailabilityState: "quarantined",
      });
      const plan = soak.planInboundMediaWrite({
        profileId: "default",
        sha256: "a".repeat(64),
        mimeType: "image/png",
        fileName: "photo.png",
        byteLength: 12,
      });
      return {
        quarantineRequiresConfirm,
        deniedExeRequiresConfirm,
        exportWithoutConsent,
        allowSystemOpen: plan.allowSystemOpen,
      };
    });

    if (live.error) {
      reason = live.error;
    } else {
      matrix.quarantineRequiresConfirm = live.quarantineRequiresConfirm === true;
      matrix.deniedExeRequiresConfirm = live.deniedExeRequiresConfirm === true;
      matrix.exportWithoutConsentBlocked = live.exportWithoutConsent?.status === "consent_required";
      matrix.planNeverSystemOpen = live.allowSystemOpen === false;
      if (!Object.values(matrix).every(Boolean)) {
        reason = "matrix_incomplete";
      }
    }
  }

  const verdict = reason ? "Fail" : "Pass";
  const report = {
    capturedAt: new Date().toISOString(),
    surface: "tauri-desktop-cdp",
    cdp: CDP,
    band: "p2s-S4-L3-inbound-export",
    matrix,
    verdict,
    reason,
    nonClaims: [
      "Soft L3 Fixed",
      "Tor Verified",
      "antivirus replacement",
      "unattended save-as success after consent",
    ],
  };
  writeReport(report);
  console.log(JSON.stringify({ verdict, matrix, reason, outJson, outMd }, null, 2));
  await browser.close().catch(() => undefined);
  process.exit(verdict === "Pass" ? 0 : 2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
