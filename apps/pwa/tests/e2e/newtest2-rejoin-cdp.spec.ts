import path from "node:path";
import { chromium, expect, test as base } from "@playwright/test";
import {
  applyOperatorDevBundle,
  ensureUnlockedForRuntimeCapture,
  expectMessengerShell,
  TESTER1,
} from "./helpers/dev-test-accounts";
import { waitForAppPageFromCdpBrowserAsync } from "./helpers/cdp-page";
import { resolveAppBaseUrl } from "./helpers/app-url";
import {
  assertSliceCL3Tester1Identity,
  clearNewTest2Tombstone,
  forcePersistNewTest2JoinedLedger,
  injectNewTest2RoomKey,
  openNetworkJoinDialog,
  readU4L3MembershipEntry,
  SLICE_C_L3_GROUP_ID,
  SLICE_C_L3_GROUP_NAME,
  submitNewTest2JoinUri,
  writeSliceCL3Report,
} from "./helpers/newtest2-rejoin-fixture";
import { TESTER1_DERIVED_PUBLIC_KEY_HEX } from "./helpers/slice-c-l3-fixture";

const CDP_URL = process.env.OBSCUR_CDP_URL?.trim() || "http://127.0.0.1:9230";
const ROOM_KEY_HEX = process.env.OBSCUR_NEWTEST2_ROOM_KEY_HEX?.trim() ?? "";
const REPORT_PATH = path.resolve(
  __dirname,
  "../../../../test-results/newtest2-rejoin-2026-07-31.json",
);

const test = base.extend({
  page: async ({ baseURL }, use) => {
    const browser = await chromium.connectOverCDP(CDP_URL);
    const cdpPage = await waitForAppPageFromCdpBrowserAsync(browser, baseURL, { timeoutMs: 120_000 });
    if (!cdpPage) {
      await browser.close();
      throw new Error(`No Obscur page on CDP ${CDP_URL}`);
    }
    await use(cdpPage);
    await browser.close();
  },
});

test.describe("NewTest 2 rejoin — Slice C fixture hygiene", () => {
  test("Tester1 rejoin NewTest 2 → ledger joined", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    expect(ROOM_KEY_HEX, "OBSCUR_NEWTEST2_ROOM_KEY_HEX required").toMatch(/^[0-9a-f]{64}$/i);

    const startedAt = Date.now();
    const base = resolveAppBaseUrl(baseURL);

    // Pick up rebuilt static shell assets after product fixes.
    await page.goto(`${base}/?rejoin=${startedAt}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await applyOperatorDevBundle(page);
    // Close leftover Join dialog from a prior attempt so shell unlock heuristics see Chats.
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(500);
    await ensureUnlockedForRuntimeCapture(page, TESTER1, base, { cdpNative: true });
    await expectMessengerShell(page);
    await assertSliceCL3Tester1Identity(page);

    const pre = await readU4L3MembershipEntry(page);
    const tombstonesRemoved = await clearNewTest2Tombstone(page, {
      publicKeyHex: TESTER1_DERIVED_PUBLIC_KEY_HEX,
    });
    await injectNewTest2RoomKey(page, ROOM_KEY_HEX);
    await openNetworkJoinDialog(page);
    await submitNewTest2JoinUri(page);
    const ledgerKeysUpdated = await forcePersistNewTest2JoinedLedger(page);

    const deadline = Date.now() + 90_000;
    let joined = false;
    while (Date.now() < deadline) {
      const entry = await readU4L3MembershipEntry(page);
      if (entry.joined) {
        joined = true;
        break;
      }
      await forcePersistNewTest2JoinedLedger(page);
      await page.waitForTimeout(1500);
    }

    const post = await readU4L3MembershipEntry(page);
    const pass = post.joined === true;

    await writeSliceCL3Report(REPORT_PATH, {
      suite: "newtest2-rejoin",
      startedAt,
      finishedAt: Date.now(),
      durationMs: Date.now() - startedAt,
      groupId: SLICE_C_L3_GROUP_ID,
      groupName: SLICE_C_L3_GROUP_NAME,
      pre: { status: pre.status, joined: pre.joined, left: pre.left },
      post: { status: post.status, joined: post.joined, left: post.left },
      tombstonesRemoved,
      ledgerKeysUpdated,
      waitedOk: joined,
      l3: { pass, note: "Fixture rejoin only — re-run verify:u2-l3 / verify:slice-c-l3 for soak claims" },
    });

    expect(pass, `Expected ledger joined; got status=${post.status}`).toBe(true);
  });
});
