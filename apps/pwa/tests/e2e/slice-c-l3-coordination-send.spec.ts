import { spawnSync } from "node:child_process";
import path from "node:path";
import { chromium, expect, test as base } from "@playwright/test";
import {
  applyOperatorDevBundle,
  ensureUnlockedForRuntimeCapture,
  expectMessengerShell,
  TESTER1,
} from "./helpers/dev-test-accounts";
import { pickAppPageFromCdpBrowserAsync, waitForAppPageFromCdpBrowserAsync } from "./helpers/cdp-page";
import { resolveAppBaseUrl } from "./helpers/app-url";
import { captureCrossDeviceDigest } from "./helpers/runtime-capture";
import {
  assertSliceCL3Tester1Identity,
  captureSliceCL3DigestEvents,
  clearSliceCL3LocalRoomKey,
  openSliceCL3NewTest2Chat,
  navigateSliceCL3Shell,
  readSliceCL3InvalidEntries,
  readSliceCL3LedgerSnapshot,
  sendSliceCL3GroupMessage,
  SLICE_C_L3_GROUP_ID,
  SLICE_C_L3_GROUP_NAME,
  waitForSliceCL3InvalidEntries,
  writeSliceCL3Report,
} from "./helpers/slice-c-l3-fixture";

const CDP_URL = process.env.OBSCUR_CDP_URL?.trim() || "http://127.0.0.1:9230";
const REPO_ROOT = path.resolve(__dirname, "../../../..");

const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const browser = await chromium.connectOverCDP(CDP_URL);
    const cdpPage = await waitForAppPageFromCdpBrowserAsync(browser, baseURL, { timeoutMs: 120_000 });
    if (!cdpPage) {
      const urls = browser.contexts().flatMap((ctx) => ctx.pages().map((p) => p.url()));
      await browser.close();
      throw new Error(
        [
          `No Obscur page on CDP endpoint ${CDP_URL}.`,
          `Expected ${resolveAppBaseUrl(baseURL)} or Tauri shell.`,
          "Start stack: pnpm dev:desktop:online + serve apps/pwa/out on :3340",
          urls.length > 0 ? `CDP pages seen: ${urls.join(", ")}` : "CDP has no open pages.",
        ].join(" "),
      );
    }
    if (cdpPage.url().includes("chrome-error")) {
      await cdpPage.goto(`${resolveAppBaseUrl(baseURL)}/`, { waitUntil: "domcontentloaded" });
      await cdpPage.waitForTimeout(3000);
    }
    await use(cdpPage);
    await browser.close();
  },
});

test.describe("Slice C L3 — coordination room-key send", () => {
  test("NewTest 2 send after local key cleared hits coordination wrap", async ({ page, baseURL }) => {
    test.setTimeout(300_000);

    const startedAt = Date.now();
    const messageText = `phase1b-slice-c-l3-${Date.now()}`;

    await applyOperatorDevBundle(page);
    await ensureUnlockedForRuntimeCapture(page, TESTER1, resolveAppBaseUrl(baseURL), {
      cdpNative: true,
    });
    await page.evaluate(async () => {
      const lab = window.obscurDevLab;
      if (lab?.unlock) {
        try {
          await lab.unlock("tester1");
        } catch {
          // Manual unlock fallback handled by ensureUnlockedForRuntimeCapture.
        }
      }
    }).catch(() => undefined);
    await expectMessengerShell(page);
    await assertSliceCL3Tester1Identity(page);

    await navigateSliceCL3Shell(page, "network");
    await page.waitForTimeout(2000);

    const invalidEntries = await waitForSliceCL3InvalidEntries(page);
    expect(invalidEntries, "RIW-1 ledger must be valid before Slice C L3 send").toBe(0);

    const preLedger = await readSliceCL3LedgerSnapshot(page);
    expect(preLedger.joined, "NewTest 2 must be joined in membership ledger").toBe(true);
    expect(preLedger.communityId, "communityId must resolve from ledger").toBeTruthy();

    const roomKeyForBackfill = preLedger.roomKeyHex ?? undefined;
    const backfillArgs = [
      path.join(REPO_ROOT, "scripts", "publish-coordination-room-key-wrap-fixture.mjs"),
      "--coordination",
      "http://127.0.0.1:8787",
      "--community-id",
      preLedger.communityId ?? "",
      "--group-id",
      SLICE_C_L3_GROUP_ID,
      ...(roomKeyForBackfill ? ["--room-key-hex", roomKeyForBackfill] : []),
    ];
    const backfillRun = spawnSync(process.execPath, backfillArgs, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: process.env,
    });
    const backfillOutput = `${backfillRun.stdout ?? ""}${backfillRun.stderr ?? ""}`;
    expect(backfillRun.status, `Fixture backfill failed: ${backfillOutput}`).toBe(0);
    const backfillJsonLine = backfillOutput
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("{") && line.endsWith("}"))
      .pop();
    const backfill = JSON.parse(backfillJsonLine ?? "{}") as {
      ok?: boolean;
      wrapSeq?: number;
      roomKeySource?: string;
    };
    expect(backfill.ok, `Fixture backfill failed: ${backfillOutput}`).toBe(true);

    let cleared = { cleared: false, localRoomKeyCount: preLedger.localRoomKeyCount };
    if (preLedger.localRoomKeyCount > 0 || preLedger.roomKeyHex) {
      cleared = await clearSliceCL3LocalRoomKey(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await applyOperatorDevBundle(page);
      await page.evaluate(async () => {
        try {
          await window.obscurDevLab?.unlock?.("tester1");
        } catch {
          // ignore
        }
      }).catch(() => undefined);
      await ensureUnlockedForRuntimeCapture(page, TESTER1, resolveAppBaseUrl(baseURL), {
        cdpNative: true,
      });
      await assertSliceCL3Tester1Identity(page);
    }

    const preSendLedger = await readSliceCL3LedgerSnapshot(page);
    expect(preSendLedger.localRoomKeyCount, "Local room key must be cleared before send").toBe(0);
    expect(preSendLedger.roomKeyHex, "Target group room key must be absent before send").toBeNull();

    await openSliceCL3NewTest2Chat(page);
    const compose = page.getByPlaceholder(/type a message|message/i).first();
    await expect(compose).toBeEnabled({ timeout: 30_000 });

    await sendSliceCL3GroupMessage(page, messageText);
    await expect(page.getByText(messageText, { exact: false }).first()).toBeVisible({ timeout: 30_000 });

    const events = await captureSliceCL3DigestEvents(page, 600);
    const hitCoordination = events.resolveEvents.some((entry) => (
      entry.context
      && typeof entry.context === "object"
      && (entry.context as { source?: string }).source === "hit_coordination"
    ));
    const sendBlocked = events.blockedEvents.some((entry) => (
      entry.scope
      && typeof entry.scope === "object"
      && (entry.scope as { action?: string }).action === "send_message"
    ));

    const postSendLedger = await readSliceCL3LedgerSnapshot(page);
    const crossDeviceDigest = await captureCrossDeviceDigest(page, 400);

    const coordinationRecoveryProven = hitCoordination
      || events.materializedEvents.length > 0
      || Boolean(postSendLedger.roomKeyHex && !preSendLedger.roomKeyHex);

    const report = {
      round: "phase1b-slice-c-l3",
      at: new Date().toISOString(),
      stack: {
        coordination: "http://127.0.0.1:8787",
        desktopCdp: CDP_URL,
        fixture: `${SLICE_C_L3_GROUP_NAME} · groupId ${SLICE_C_L3_GROUP_ID}`,
      },
      l3: {
        captureMethod: "Playwright connectOverCDP",
        invalidEntries,
        coordinationWrap: {
          wrapSeq: backfill.wrapSeq ?? null,
          backfillRoomKeySource: backfill.roomKeySource ?? (roomKeyForBackfill ? "local_snapshot" : "generated"),
          communityId: preLedger.communityId,
        },
        localKeyClear: cleared,
        localKeyPreSend: preSendLedger,
        localKeyPostSend: postSendLedger,
        navigationGates: {
          newTest2Chat: true,
          composeEnabled: true,
        },
        sendAttempt: {
          text: messageText,
          messageVisible: true,
          hitCoordination,
          sendBlocked,
          honestFail: sendBlocked,
          resolveEvents: events.resolveEvents.slice(-5),
          blockedEvents: events.blockedEvents.slice(-3),
          materializedEvents: events.materializedEvents.slice(-3),
        },
        pass: !sendBlocked && coordinationRecoveryProven && preSendLedger.localRoomKeyCount === 0,
        elapsedMs: Date.now() - startedAt,
      },
      crossDeviceDigest,
    };

    const reportPath = path.join(REPO_ROOT, "test-results", "phase1b-slice-c-l3-2026-07-03.json");
    await writeSliceCL3Report(reportPath, report);

    expect(sendBlocked, "Send must not emit room_key_missing_send_blocked after coordination resolve").toBe(false);
    expect(
      coordinationRecoveryProven,
      "Expected coordination recovery via hit_coordination, materialize event, or post-send room key",
    ).toBe(true);
    expect(preSendLedger.localRoomKeyCount, "Local room key must be absent before send").toBe(0);
    expect(postSendLedger.roomKeyHex, "Room key should materialize into local store after send resolve").toBeTruthy();
  });
});
