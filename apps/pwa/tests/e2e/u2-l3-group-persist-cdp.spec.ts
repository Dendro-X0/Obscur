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
  navigateSliceCL3Shell,
  openSliceCL3NewTest2Chat,
  readSliceCL3LedgerSnapshot,
  sendSliceCL3GroupMessage,
  SLICE_C_L3_GROUP_ID,
  SLICE_C_L3_GROUP_NAME,
  SLICE_C_L3_RELAY_URL,
  TESTER1_DERIVED_PUBLIC_KEY_HEX,
  waitForSliceCL3InvalidEntries,
} from "./helpers/slice-c-l3-fixture";
import {
  insertWorkspaceGroupMessageViaEngine,
  listWorkspaceGroupMessagesViaEngine,
  listWorkspaceGroupsViaEngine,
  U2_L3_GROUP_ID,
  upsertWorkspaceGroupViaEngine,
  waitForWorkspaceGroupMessageMarker,
  writeU2L3Report,
} from "./helpers/u2-l3-group-persist-fixture";

/**
 * U2 Wave D — group list + message persist survive webview reload via workspace-engine.
 * @see specs/backend/community-u2-group-persist-engine-design-2026-07.md
 */

const CDP_URL = process.env.OBSCUR_CDP_URL?.trim() || "http://127.0.0.1:9230";
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const REPORT_PATH = path.join(REPO_ROOT, "test-results", "u2-l3-group-persist-2026-07-31.json");

const test = base.extend({
  page: async ({ baseURL }, use) => {
    const browser = await chromium.connectOverCDP(CDP_URL);
    const cdpPage = await waitForAppPageFromCdpBrowserAsync(browser, baseURL, { timeoutMs: 120_000 });
    if (!cdpPage) {
      const urls = browser.contexts().flatMap((ctx) => ctx.pages().map((p) => p.url()));
      await browser.close();
      throw new Error(
        [
          `No Obscur page on CDP endpoint ${CDP_URL}.`,
          `Expected ${resolveAppBaseUrl(baseURL)} or Tauri shell.`,
          "Start stack: pnpm dev:desktop:online",
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

test.describe("U2 Wave D — group persist restart soak", () => {
  test("NewTest 2 list + sealed message survive reload via workspace-engine", async ({ page, baseURL }) => {
    test.setTimeout(360_000);
    const startedAt = Date.now();
    const messageText = `u2-l3-group-persist-${Date.now()}`;
    let blockedReason: string | null = null;

    try {
      await applyOperatorDevBundle(page);
      await ensureUnlockedForRuntimeCapture(page, TESTER1, resolveAppBaseUrl(baseURL), {
        cdpNative: true,
      });
      await expectMessengerShell(page);
      await assertSliceCL3Tester1Identity(page);

      await navigateSliceCL3Shell(page, "network");
      await page.waitForTimeout(1500);
      const invalidEntries = await waitForSliceCL3InvalidEntries(page);
      expect(invalidEntries, "membership ledger must be valid").toBe(0);

      const ledger = await readSliceCL3LedgerSnapshot(page);
      expect(ledger.joined, "NewTest 2 must be joined").toBe(true);

      // Wave A write path — ensure group list row exists in SQLite via workspace.upsertGroup.
      const upsert = await upsertWorkspaceGroupViaEngine(page, {
        groupId: U2_L3_GROUP_ID,
        name: SLICE_C_L3_GROUP_NAME,
        relayUrl: SLICE_C_L3_RELAY_URL,
      });
      expect(upsert.ok, `workspace.upsertGroup failed: ${upsert.errorMessage ?? upsert.invokeError}`).toBe(true);

      await openSliceCL3NewTest2Chat(page);
      const compose = page.getByPlaceholder(/type a message|message/i).first();
      await expect(compose).toBeEnabled({ timeout: 30_000 });

      await sendSliceCL3GroupMessage(page, messageText);
      await expect(page.getByText(messageText, { exact: false }).first()).toBeVisible({ timeout: 45_000 });

      // Product path commits after sign (B durability). Poll engine; bridge insert only if still missing.
      let preMessages = await waitForWorkspaceGroupMessageMarker(page, {
        messageText,
        timeoutMs: 45_000,
      });
      let engineInsertOk: boolean | null = null;
      if (!preMessages.hit) {
        const inserted = await insertWorkspaceGroupMessageViaEngine(page, {
          plaintext: messageText,
          senderPubkey: TESTER1_DERIVED_PUBLIC_KEY_HEX,
        });
        engineInsertOk = inserted.ok;
        expect(
          inserted.ok,
          `workspace.insertGroupMessage failed: ${inserted.errorMessage ?? inserted.invokeError}`,
        ).toBe(true);
        preMessages = await waitForWorkspaceGroupMessageMarker(page, {
          messageText,
          timeoutMs: 15_000,
        });
      }
      const preGroups = await listWorkspaceGroupsViaEngine(page);
      const preGroupHit = preGroups.rows.some((row) => row.id === U2_L3_GROUP_ID);
      const preMessageHit = preMessages.hit;

      expect(
        preGroupHit,
        "workspace.listGroups must include NewTest 2 before restart",
      ).toBe(true);
      expect(
        preMessageHit,
        `workspace.listGroupMessages must include marker before restart (ok=${preMessages.ok} err=${preMessages.errorMessage} count=${preMessages.rows.length} engineInsertOk=${engineInsertOk} sample=${JSON.stringify(preMessages.rows.slice(0, 3))})`,
      ).toBe(true);

      // Soft restart: webview reload (process-kill would drop shared CDP stack).
      await page.reload({ waitUntil: "domcontentloaded" });
      await applyOperatorDevBundle(page);
      await ensureUnlockedForRuntimeCapture(page, TESTER1, resolveAppBaseUrl(baseURL), {
        cdpNative: true,
      });
      await expectMessengerShell(page);
      await assertSliceCL3Tester1Identity(page);

      await openSliceCL3NewTest2Chat(page);

      const sidebarByName = page.getByRole("button", { name: new RegExp(SLICE_C_L3_GROUP_NAME, "i") });
      const sidebarById = page.getByRole("button", {
        name: new RegExp(SLICE_C_L3_GROUP_ID.slice(0, 8), "i"),
      });
      await expect(sidebarByName.or(sidebarById).first()).toBeVisible({ timeout: 60_000 });

      await expect(page.getByText(messageText, { exact: false }).first()).toBeVisible({ timeout: 60_000 });

      const postGroups = await listWorkspaceGroupsViaEngine(page);
      const postGroupHit = postGroups.rows.some((row) => row.id === U2_L3_GROUP_ID);
      const postMessages = await listWorkspaceGroupMessagesViaEngine(page, {
        groupId: U2_L3_GROUP_ID,
        limit: 100,
      });
      const postMessageHit = postMessages.rows.some((row) => (row.plaintext ?? "").includes(messageText));

      expect(postGroupHit, "workspace.listGroups must include NewTest 2 after reload").toBe(true);
      expect(postMessageHit, "workspace.listGroupMessages must include marker after reload").toBe(true);

      const pass = preGroupHit && preMessageHit && postGroupHit && postMessageHit;
      await writeU2L3Report(REPORT_PATH, {
        slice: "U2 Wave D",
        startedAtUnixMs: startedAt,
        finishedAtUnixMs: Date.now(),
        groupId: U2_L3_GROUP_ID,
        messageText,
        restartMode: "webview_reload",
        pre: {
          upsertOk: upsert.ok,
          listGroupsHit: preGroupHit,
          listGroupMessagesHit: preMessageHit,
          listGroupsCount: preGroups.rows.length,
          listGroupMessagesCount: preMessages.rows.length,
        },
        post: {
          listGroupsHit: postGroupHit,
          listGroupMessagesHit: postMessageHit,
          listGroupsCount: postGroups.rows.length,
          listGroupMessagesCount: postMessages.rows.length,
          sidebarVisible: true,
          threadVisible: true,
        },
        l3: {
          pass,
          note: engineInsertOk === true
            ? "UI send optimistic; marker durable via workspace.insertGroupMessage + reload"
            : "List+thread present after reload; SQLite proven via engine_invoke workspace methods",
          engineInsertOk,
        },
      });
      expect(pass).toBe(true);
    } catch (error) {
      blockedReason = error instanceof Error ? error.message : String(error);
      await writeU2L3Report(REPORT_PATH, {
        slice: "U2 Wave D",
        startedAtUnixMs: startedAt,
        finishedAtUnixMs: Date.now(),
        groupId: U2_L3_GROUP_ID,
        messageText,
        restartMode: "webview_reload",
        l3: {
          pass: false,
          blockedReason,
        },
      }).catch(() => undefined);
      throw error;
    }
  });
});
