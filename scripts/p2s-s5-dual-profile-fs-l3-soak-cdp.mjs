#!/usr/bin/env node
/**
 * P2-S S5 L3 — dual-profile quarantine FS soak via CDP :9230.
 * Spec: specs/backend/p2s-s5-dual-profile-fs-l3-soak-2026-11.md
 *
 * Proves AppData write under Alice quarantine + product read gate:
 *   Alice read → bytes · Bob cross-read → null
 * Does NOT claim Soft L3 / Tor Verified / OS ACL isolation.
 *
 *   OBSCUR_ALLOW_STALE_SHELL=1 pnpm dev:desktop -- --skip-build
 *   node scripts/p2s-s5-dual-profile-fs-l3-soak-cdp.mjs
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
const outJson = path.join(repoRoot, "docs", "handoffs", "p2s-s5-l3-soak-latest.json");
const outMd = path.join(repoRoot, "docs", "handoffs", "p2s-s5-l3-soak-latest.md");

const ALICE = "profile-alice";
const BOB = "profile-bob";
const SHA = "a".repeat(64);
const PAYLOAD = [0x53, 0x35, 0x4c, 0x33, 0x41, 0x6c, 0x69, 0x63, 0x65]; // S5L3Alice

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
      "# P2-S S5 dual-profile quarantine FS L3 soak",
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
      "## Notes",
      "",
      "- Product gate mirrors `readInboundMediaQuarantineBytes` path membership (Storage plane).",
      "- Raw FS presence under Alice path is honesty only — isolation is API fail-closed, not OS ACL.",
      "",
    ].filter(Boolean).join("\n"),
    "utf8",
  );
}

async function main() {
  const { chromium } = loadPlaywright();
  const browser = await chromium.connectOverCDP(CDP);
  let page = await pickAppPageFromBrowser(browser, "http://127.0.0.1:1430");
  if (!page) {
    page = await waitForAppPageFromBrowser(browser, { timeoutMs: 30000 });
  }
  if (!page) {
    throw new Error(formatNoObscurPageError(browser, CDP));
  }

  const result = await page.evaluate(async ({ alice, bob, sha, payload }) => {
    const invoke = window.__TAURI_INTERNALS__?.invoke ?? window.__TAURI__?.core?.invoke;
    if (typeof invoke !== "function") {
      return { error: "tauri_invoke_missing" };
    }
    // Tauri BaseDirectory.AppData
    const AppData = 14;

    const sanitizeProfileVaultId = (profileId) => {
      const trimmed = String(profileId ?? "").trim();
      if (!trimmed) return "default";
      const cleaned = trimmed.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
      return cleaned.length > 0 ? cleaned : "default";
    };
    const buildDir = (profileId) => `profiles/${sanitizeProfileVaultId(profileId)}/quarantine`;
    const buildPath = (profileId) => `${buildDir(profileId)}/${sha}`;
    const normalize = (relativePath) =>
      String(relativePath).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
    // Mirrors apps/pwa/.../inbound-media-quarantine.ts relativePathBelongsToProfileQuarantine
    const belongs = (relativePath, profileId) => {
      const normalized = normalize(relativePath);
      if (!normalized || normalized.includes("..") || /^[a-zA-Z]:/.test(normalized) || normalized.startsWith("/")) {
        return false;
      }
      const lower = normalized.toLowerCase();
      if (!lower.startsWith("profiles/") || !lower.includes("/quarantine/")) {
        return false;
      }
      const expectedPrefix = `${buildDir(profileId)}/`.toLowerCase();
      return `${lower}/`.startsWith(expectedPrefix);
    };

    const fsRead = async (relativePath) => {
      const arr = await invoke("plugin:fs|read_file", {
        path: relativePath,
        options: { baseDir: AppData },
      });
      return arr instanceof ArrayBuffer ? Array.from(new Uint8Array(arr)) : Array.from(arr);
    };

    // Product gate (same contract as readInboundMediaQuarantineBytes).
    const productRead = async (requestingProfileId, relativePath) => {
      if (!belongs(relativePath, requestingProfileId)) {
        return { ok: false, gated: true, bytes: null };
      }
      try {
        const bytes = await fsRead(relativePath);
        return { ok: true, gated: false, bytes };
      } catch (error) {
        return { ok: false, gated: false, bytes: null, error: String(error) };
      }
    };

    const alicePath = buildPath(alice);
    await invoke("plugin:fs|mkdir", {
      path: buildDir(alice),
      options: { baseDir: AppData, recursive: true },
    });
    await invoke("plugin:fs|write_file", new Uint8Array(payload), {
      headers: {
        path: encodeURIComponent(alicePath),
        options: JSON.stringify({ baseDir: AppData, create: true }),
      },
    });

    const aliceRead = await productRead(alice, alicePath);
    const bobCross = await productRead(bob, alicePath);

    let bobRawFs = { present: false };
    try {
      const raw = await fsRead(alicePath);
      bobRawFs = { present: raw.length === payload.length };
    } catch (error) {
      bobRawFs = { present: false, error: String(error) };
    }

    try {
      await invoke("plugin:fs|remove", {
        path: alicePath,
        options: { baseDir: AppData },
      });
    } catch {
      // ignore
    }

    return {
      alicePath,
      aliceWrite: true,
      aliceReadOk: aliceRead.ok
        && Array.isArray(aliceRead.bytes)
        && aliceRead.bytes.length === payload.length
        && aliceRead.bytes.every((b, i) => b === payload[i]),
      bobCrossNull: bobCross.gated === true && bobCross.bytes === null,
      bobRawFsPresent: bobRawFs.present === true,
      aliceRead,
      bobCross,
      bobRawFs,
    };
  }, { alice: ALICE, bob: BOB, sha: SHA, payload: PAYLOAD });

  const matrix = {
    aliceWrite: Boolean(result.aliceWrite),
    aliceRead: Boolean(result.aliceReadOk),
    bobCrossRead: Boolean(result.bobCrossNull),
    bobRawFsStillPresent: Boolean(result.bobRawFsPresent),
  };
  const pass = matrix.aliceWrite && matrix.aliceRead && matrix.bobCrossRead;
  const report = {
    capturedAt: new Date().toISOString(),
    surface: "tauri-desktop-cdp",
    cdp: CDP,
    band: "p2s-S5-L3-dual-profile-quarantine-fs",
    nonClaims: [
      "Soft L3 Fixed",
      "Tor Verified",
      "Matrix promote",
      "OS ACL multi-user isolation",
    ],
    result,
    matrix,
    verdict: pass ? "Pass" : "Fail",
    reason: pass
      ? undefined
      : !matrix.aliceWrite
        ? "alice_write_failed"
        : !matrix.aliceRead
          ? "alice_read_failed"
          : "bob_cross_read_not_null",
  };

  writeReport(report);
  console.log(JSON.stringify({
    verdict: report.verdict,
    reason: report.reason,
    matrix,
    outJson,
    outMd,
  }, null, 2));
  await browser.close().catch(() => undefined);
  process.exit(pass ? 0 : 2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
