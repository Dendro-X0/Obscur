#!/usr/bin/env node
/**
 * P2-S S3 L3 — inbound preview gate soak via CDP :9230.
 * Spec: specs/backend/p2s-s3-inbound-preview-l3-soak-2026-11.md
 *
 *   OBSCUR_ALLOW_STALE_SHELL=1 pnpm dev:desktop -- --rebuild
 *   node scripts/p2s-s3-inbound-preview-l3-soak-cdp.mjs
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
const outJson = path.join(repoRoot, "docs", "handoffs", "p2s-s3-inbound-preview-l3-soak-latest.json");
const outMd = path.join(repoRoot, "docs", "handoffs", "p2s-s3-inbound-preview-l3-soak-latest.md");
const previewModulePath = path.join(
  repoRoot,
  "apps/pwa/app/features/storage/services/inbound-media-preview.ts",
);

// Minimal 1x1 PNG
const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

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
      "# P2-S S3 inbound preview L3 soak",
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
  const previewSource = fs.readFileSync(previewModulePath, "utf8");
  const previewModuleNoShellOpen = !/openPath|shell\.open|plugin:shell/i.test(previewSource)
    && /shouldAllowInboundMediaPreview/.test(previewSource)
    && /createInboundMediaPreviewObjectUrl/.test(previewSource);

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
    hooksPresent = await page.evaluate(() => (
      Boolean(
        window.__OBSCUR_STORAGE_SOAK__?.shouldAllowInboundMediaPreview
        && window.__OBSCUR_STORAGE_SOAK__?.createInboundMediaPreviewObjectUrl,
      )
    ));
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
    quarantinedBlocked: false,
    deniedExeBlocked: false,
    allowedPngPreview: false,
    previewModuleNoShellOpen,
  };
  let reason;

  if (!hooksPresent) {
    reason = "storage_preview_hooks_missing";
  } else {
    const live = await page.evaluate(async ({ pngBytes }) => {
      const soak = window.__OBSCUR_STORAGE_SOAK__;
      if (!soak?.shouldAllowInboundMediaPreview || !soak.createInboundMediaPreviewObjectUrl) {
        return { error: "hooks_incomplete" };
      }

      const quarantinedAllow = soak.shouldAllowInboundMediaPreview({
        contentAvailabilityState: "quarantined",
        mimeType: "image/png",
        fileName: "ok.png",
        byteLength: pngBytes.length,
      });
      const quarantinedUrl = soak.createInboundMediaPreviewObjectUrl(
        new Blob([new Uint8Array(pngBytes)], { type: "image/png" }),
        { contentAvailabilityState: "quarantined", mimeType: "image/png", fileName: "ok.png" },
      );

      const exeAllow = soak.shouldAllowInboundMediaPreview({
        contentAvailabilityState: "available",
        mimeType: "application/octet-stream",
        fileName: "payload.exe",
        byteLength: 64,
      });
      const exeUrl = soak.createInboundMediaPreviewObjectUrl(
        new Blob([new Uint8Array(64)], { type: "application/octet-stream" }),
        { contentAvailabilityState: "available", mimeType: "application/octet-stream", fileName: "payload.exe" },
      );

      const pngAllow = soak.shouldAllowInboundMediaPreview({
        contentAvailabilityState: "available",
        mimeType: "image/png",
        fileName: "ok.png",
        byteLength: pngBytes.length,
      });
      const pngUrl = soak.createInboundMediaPreviewObjectUrl(
        new Blob([new Uint8Array(pngBytes)], { type: "image/png" }),
        { contentAvailabilityState: "available", mimeType: "image/png", fileName: "ok.png" },
      );
      if (typeof pngUrl === "string" && pngUrl.startsWith("blob:")) {
        URL.revokeObjectURL(pngUrl);
      }

      return {
        quarantinedBlocked: quarantinedAllow === false && quarantinedUrl === null,
        deniedExeBlocked: exeAllow === false && exeUrl === null,
        allowedPngPreview: pngAllow === true && typeof pngUrl === "string" && pngUrl.startsWith("blob:"),
      };
    }, { pngBytes: Array.from(PNG_BYTES) });

    if (live.error) {
      reason = live.error;
    } else {
      matrix.quarantinedBlocked = live.quarantinedBlocked === true;
      matrix.deniedExeBlocked = live.deniedExeBlocked === true;
      matrix.allowedPngPreview = live.allowedPngPreview === true;
      if (!Object.values(matrix).every(Boolean)) {
        reason = `matrix_incomplete:${JSON.stringify(live)}`;
      }
    }
  }

  const verdict = reason ? "Fail" : "Pass";
  const report = {
    capturedAt: new Date().toISOString(),
    surface: "tauri-desktop-cdp",
    cdp: CDP,
    band: "p2s-S3-L3-inbound-preview",
    matrix,
    verdict,
    reason,
    nonClaims: [
      "Soft L3 Fixed",
      "Tor Verified",
      "export consent (see S4)",
      "cross-profile deny (see S5)",
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
