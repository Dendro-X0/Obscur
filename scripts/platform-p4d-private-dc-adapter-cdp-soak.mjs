#!/usr/bin/env node
/**
 * P4d/P4f — Private DC adapter CDP soak against local lab /v1.
 * Spec: specs/backend/platform-p4d-private-dc-adapter-cdp-soak-2026-11.md
 * Spec: specs/backend/platform-p4f-private-dc-connect-list-scope-2026-11.md
 *
 *   OBSCUR_ALLOW_STALE_SHELL=1 pnpm dev:desktop -- --skip-build   # or rebuild after hooks
 *   node scripts/platform-p4d-private-dc-adapter-cdp-soak.mjs
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
import { startPrivateDcLabServer } from "./lib/private-dc-lab-server.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const requireFromPwa = createRequire(path.join(pwaDir, "package.json"));
const CDP = process.env.OBSCUR_CDP_URL ?? "http://127.0.0.1:9230";
const outJson = path.join(repoRoot, "docs", "handoffs", "platform-p4d-private-dc-adapter-cdp-soak-latest.json");
const outMd = path.join(repoRoot, "docs", "handoffs", "platform-p4d-private-dc-adapter-cdp-soak-latest.md");

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
      "# Platform P4d private_dc adapter CDP soak",
      "",
      `- Captured: ${report.capturedAt}`,
      `- Verdict: **${report.verdict}**`,
      report.reason ? `- Reason: ${report.reason}` : "",
      `- CDP: \`${report.cdp}\``,
      `- Lab: \`${report.labBaseUrl}\``,
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
  const lab = await startPrivateDcLabServer({ requireBearer: true });
  const { chromium } = loadPlaywright();
  let browser;
  const matrix = {
    hooksPresent: false,
    sessionWritten: false,
    protocolActive: false,
    connectOk: false,
    listConversations: false,
    listMessages: false,
    sendMessage: false,
  };
  let reason;
  let previousProtocol;

  try {
    browser = await chromium.connectOverCDP(CDP);
    let page = await pickAppPageFromBrowser(browser, "http://127.0.0.1:1430");
    if (!page) {
      page = await waitForAppPageFromBrowser(browser, { timeoutMs: 30000 });
    }
    if (!page) {
      throw new Error(formatNoObscurPageError(browser, CDP));
    }

    await page.goto("http://127.0.0.1:1430/network").catch(() => undefined);
    await page.waitForTimeout(2000);

    // MessagingProvider mounts after unlock — wait for soak hooks.
    const hooksDeadline = Date.now() + 90000;
    while (Date.now() < hooksDeadline) {
      const ready = await page.evaluate(() => (
        Boolean(window.__OBSCUR_PAL_SOAK__?.listMessages && window.__OBSCUR_PAL_SOAK__?.connect)
      ));
      if (ready) {
        matrix.hooksPresent = true;
        break;
      }
      // Soft-lock / auth gate: try password unlock with Tester1 if field present.
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

    if (!matrix.hooksPresent) {
      reason = "pal_soak_hooks_missing_after_unlock";
    } else {
      const result = await page.evaluate(async ({ baseUrl, token }) => {
        const soak = window.__OBSCUR_PAL_SOAK__;
        if (!soak) {
          return { error: "hooks_missing" };
        }
        const previous = soak.getActiveProtocolId();
        soak.writePrivateDcSession({
          baseUrl,
          bearerToken: token,
          displayName: "P4d lab",
        }, "default");
        soak.setActiveProtocolId("private_dc", "default");
        const protocol = soak.getActiveProtocolId("default");
        await soak.connect("default");
        const conversations = await soak.listConversations("default");
        const messages = await soak.listMessages({
          profileId: "default",
          conversationId: "ops",
          myPublicKeyHex: "0".repeat(64),
        });
        const sent = await soak.sendMessage({
          profileId: "default",
          conversationId: "ops",
          body: "p4d-cdp-ping",
        });
        // Restore previous protocol when possible (nostr default).
        try {
          if (previous === "nostr" || previous === "matrix") {
            soak.setActiveProtocolId(previous, "default");
          } else {
            soak.setActiveProtocolId("nostr", "default");
          }
        } catch {
          soak.setActiveProtocolId("nostr", "default");
        }
        soak.clearPrivateDcSession("default");
        return {
          previous,
          protocol,
          conversations,
          messages,
          sent,
        };
      }, { baseUrl: lab.baseUrl, token: lab.bearerToken });

      if (result.error) {
        reason = result.error;
      } else {
        previousProtocol = result.previous;
        matrix.sessionWritten = true;
        matrix.protocolActive = result.protocol === "private_dc";
        matrix.connectOk = true;
        matrix.listConversations = Array.isArray(result.conversations)
          && result.conversations.some((row) => row.id === "ops" && row.title === "Ops");
        matrix.listMessages = Array.isArray(result.messages)
          && result.messages.some((row) => row.conversationId === "ops" && typeof row.body === "string");
        matrix.sendMessage = result.sent?.body === "p4d-cdp-ping"
          && result.sent?.conversationId === "ops";
        if (!Object.values(matrix).every(Boolean)) {
          reason = "matrix_incomplete";
        }
      }
    }
  } catch (error) {
    reason = error instanceof Error ? error.message : String(error);
  } finally {
    await lab.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }

  const verdict = reason ? "Fail" : "Pass";
  const report = {
    capturedAt: new Date().toISOString(),
    surface: "tauri-desktop-cdp",
    band: "platform-P4d-private-dc-adapter-CDP",
    cdp: CDP,
    labBaseUrl: lab.baseUrl,
    previousProtocol,
    matrix,
    verdict,
    reason,
    nonClaims: [
      "production company-DC interoperability",
      "Soft L3 Fixed",
      "Tor Verified",
      "Matrix promote",
      "multi-protocol Verified",
    ],
  };
  writeReport(report);
  console.log(JSON.stringify({ verdict, matrix, reason, outJson, outMd }, null, 2));
  process.exit(verdict === "Pass" ? 0 : 2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
