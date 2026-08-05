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
  buildU4L3LeaveHref,
  captureU4L3LeaveDigest,
  confirmU4L3LeaveCommunity,
  readSliceCL3LedgerSnapshot,
  readU4L3MembershipEntry,
  SLICE_C_L3_GROUP_ID,
  SLICE_C_L3_GROUP_NAME,
  writeSliceCL3Report,
} from "./helpers/u4-l3-leave-fixture";

const CDP_URL = process.env.OBSCUR_CDP_URL?.trim() || "http://127.0.0.1:9230";
const REPORT_PATH = path.resolve(
  __dirname,
  "../../../../test-results/u4-l3-leave-2026-07-31.json",
);

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
          "Start stack: pnpm dev:desktop:online + unlock Tester1",
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

test.describe("U4 L3 — leave CDP via leaveManagedWorkspaceMembership", () => {
  test("NewTest 2 leave → ledger left + workspace.leave.committed", async ({ page, baseURL }) => {
    test.setTimeout(240_000);

    const startedAt = Date.now();
    const base = resolveAppBaseUrl(baseURL);

    await applyOperatorDevBundle(page);
    await ensureUnlockedForRuntimeCapture(page, TESTER1, base, { cdpNative: true });
    await expectMessengerShell(page);
    await assertSliceCL3Tester1Identity(page);

    const preLedger = await readSliceCL3LedgerSnapshot(page);
    expect(preLedger.joined, "NewTest 2 must be joined before U4 L3 leave").toBe(true);

    const leaveHref = buildU4L3LeaveHref({
      communityId: preLedger.communityId,
      groupId: SLICE_C_L3_GROUP_ID,
      displayName: SLICE_C_L3_GROUP_NAME,
    });
    await page.goto(`${base}${leaveHref}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Group must resolve in sidebar metadata — otherwise leave port is skipped.
    await expect(page.getByRole("heading", { name: /Confirm Exit|Leave/i }).first()).toBeVisible({
      timeout: 60_000,
    });

    await confirmU4L3LeaveCommunity(page);

    // Wait for success toast or network redirect.
    const deadline = Date.now() + 90_000;
    let left = false;
    let digest = await captureU4L3LeaveDigest(page);
    while (Date.now() < deadline) {
      const entry = await readU4L3MembershipEntry(page);
      digest = await captureU4L3LeaveDigest(page);
      const committedForTarget = digest.leaveCommitted.some((event) => {
        const context = (event.context ?? event) as Record<string, unknown>;
        const groupId = typeof context.groupId === "string" ? context.groupId.trim() : "";
        return groupId === SLICE_C_L3_GROUP_ID || groupId.length === 0;
      });
      if (entry.left || (!entry.joined && entry.status === "left") || committedForTarget) {
        left = entry.left || committedForTarget;
        if (entry.left) {
          break;
        }
      }
      const onNetwork = page.url().includes("/network");
      if (onNetwork && (entry.left || !entry.joined)) {
        left = entry.left || !entry.joined;
        if (entry.left) {
          break;
        }
      }
      await page.waitForTimeout(1000);
    }

    const postEntry = await readU4L3MembershipEntry(page);
    digest = await captureU4L3LeaveDigest(page);
    const hitLeaveCommitted = digest.leaveCommitted.some((event) => {
      const context = (event.context ?? event) as Record<string, unknown>;
      const groupId = typeof context.groupId === "string" ? context.groupId.trim() : "";
      return groupId === SLICE_C_L3_GROUP_ID || groupId.length === 0;
    });
    const hitLeaveProof = digest.leaveProofPublished.length > 0;
    const ledgerLeft = postEntry.left === true;
    const notJoined = postEntry.joined !== true;
    const l3Pass = ledgerLeft && (hitLeaveCommitted || hitLeaveProof) && notJoined;

    await writeSliceCL3Report(REPORT_PATH, {
      suite: "u4-l3-leave",
      startedAt,
      finishedAt: Date.now(),
      durationMs: Date.now() - startedAt,
      groupId: SLICE_C_L3_GROUP_ID,
      groupName: SLICE_C_L3_GROUP_NAME,
      pre: {
        joined: preLedger.joined,
        communityId: preLedger.communityId,
      },
      post: {
        status: postEntry.status,
        joined: postEntry.joined,
        left: postEntry.left,
        communityId: postEntry.communityId,
      },
      digest: {
        leaveCommittedCount: digest.leaveCommitted.length,
        leaveRejectedCount: digest.leaveRejected.length,
        leaveProofPublishedCount: digest.leaveProofPublished.length,
        hitLeaveCommitted,
        hitLeaveProof,
      },
      sideEffect: "NewTest 2 leave invalidates Slice C L3 fixture until re-joined",
      l3: {
        pass: l3Pass,
        waitedOk: left,
        ledgerLeft,
        hitLeaveCommitted,
        hitLeaveProof,
      },
    });

    expect(ledgerLeft, `Expected ledger status left; got ${postEntry.status}`).toBe(true);
    expect(
      hitLeaveCommitted || hitLeaveProof,
      "Expected workspace.leave.committed (findByName) or groups.leave_proof_published",
    ).toBe(true);
  });
});
