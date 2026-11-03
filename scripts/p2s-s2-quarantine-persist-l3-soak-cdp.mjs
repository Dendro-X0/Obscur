#!/usr/bin/env node
/**
 * P2-S S2 L3 — quarantine plan+persist soak via CDP :9230.
 * Spec: specs/backend/p2s-s2-quarantine-persist-l3-soak-2026-11.md
 *
 *   OBSCUR_ALLOW_STALE_SHELL=1 pnpm dev:desktop -- --rebuild
 *   node scripts/p2s-s2-quarantine-persist-l3-soak-cdp.mjs
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
const outJson = path.join(repoRoot, "docs", "handoffs", "p2s-s2-quarantine-persist-l3-soak-latest.json");
const outMd = path.join(repoRoot, "docs", "handoffs", "p2s-s2-quarantine-persist-l3-soak-latest.md");
const persistModulePath = path.join(
  repoRoot,
  "apps/pwa/app/features/storage/services/inbound-media-quarantine-persist.ts",
);

const PROFILE = "profile-s2-l3";
const SHA = "b".repeat(64);
const PAYLOAD = [0x53, 0x32, 0x4c, 0x33]; // S2L3

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
      "# P2-S S2 quarantine persist L3 soak",
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
  const persistSource = fs.readFileSync(persistModulePath, "utf8");
  const persistModuleNoShellOpen = !/openPath|shell\.open|plugin:shell/i.test(persistSource)
    && /persistInboundMediaQuarantineBytes/.test(persistSource);

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
  let navigatedLoginTab = false;
  while (Date.now() < hooksDeadline) {
    hooksPresent = await page.evaluate(() => (
      Boolean(window.__OBSCUR_STORAGE_SOAK__?.persistInboundMediaQuarantineBytes)
    ));
    if (hooksPresent) {
      break;
    }
    // Prefer device-password Log In tab over Import Key (nsec) so unlock can succeed when needed.
    const nsecPh = await page.locator('input[placeholder*="nsec" i]').count();
    if (nsecPh && !navigatedLoginTab) {
      const logInTab = page.getByRole("button", { name: /^Log In$/i }).first();
      if (await logInTab.count()) {
        await logInTab.click().catch(() => undefined);
        navigatedLoginTab = true;
        await page.waitForTimeout(500);
      }
    }
    if (await page.locator('input[type="password"][placeholder*="password" i]').count()
      || (await page.locator('input[type="password"]').count() && navigatedLoginTab)) {
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
    planNeverSystemOpen: false,
    planPathBelongs: false,
    persistWritten: false,
    productReadOk: false,
    persistModuleNoShellOpen,
  };
  let reason;

  if (!hooksPresent) {
    reason = "storage_persist_hooks_missing";
  } else {
    const live = await page.evaluate(async ({ profileId, sha, payload }) => {
      const soak = window.__OBSCUR_STORAGE_SOAK__;
      if (!soak?.persistInboundMediaQuarantineBytes || !soak.planInboundMediaWrite) {
        return { error: "hooks_incomplete" };
      }
      const plan = soak.planInboundMediaWrite({
        profileId,
        sha256: sha,
        mimeType: "image/png",
        fileName: "s2.png",
        byteLength: payload.length,
      });
      const planNeverSystemOpen = plan.allowSystemOpen === false;
      const planPathBelongs = Boolean(plan.quarantineRelativePath)
        && soak.relativePathBelongsToProfileQuarantine(plan.quarantineRelativePath, profileId);
      const persist = await soak.persistInboundMediaQuarantineBytes({
        profileId,
        plan,
        bytes: new Uint8Array(payload),
      });
      let productReadOk = false;
      if (persist.status === "written" && plan.quarantineRelativePath) {
        const bytes = await soak.readInboundMediaQuarantineBytes({
          requestingProfileId: profileId,
          relativePath: plan.quarantineRelativePath,
        });
        productReadOk = Boolean(
          bytes
          && bytes.length === payload.length
          && Array.from(bytes).every((b, i) => b === payload[i]),
        );
      }
      return {
        planNeverSystemOpen,
        planPathBelongs,
        persist,
        productReadOk,
        path: plan.quarantineRelativePath,
      };
    }, { profileId: PROFILE, sha: SHA, payload: PAYLOAD });

    if (live.error) {
      reason = live.error;
    } else {
      matrix.planNeverSystemOpen = live.planNeverSystemOpen === true;
      matrix.planPathBelongs = live.planPathBelongs === true;
      matrix.persistWritten = live.persist?.status === "written";
      matrix.productReadOk = live.productReadOk === true;
      if (!Object.values(matrix).every(Boolean)) {
        reason = `matrix_incomplete:${JSON.stringify(live.persist ?? {})}`;
      }
    }
  }

  const verdict = reason ? "Fail" : "Pass";
  const report = {
    capturedAt: new Date().toISOString(),
    surface: "tauri-desktop-cdp",
    cdp: CDP,
    band: "p2s-S2-L3-quarantine-persist",
    matrix,
    verdict,
    reason,
    nonClaims: [
      "Soft L3 Fixed",
      "Tor Verified",
      "OS ACL multi-user isolation",
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
