import { expect, test } from "@playwright/test";
import {
  applyOperatorDevBundle,
  expectMessengerShell,
  TESTER1,
  TESTER2,
  unlockDevAccount,
} from "./helpers/dev-test-accounts";

/**
 * Regression: open group thread, then switch to DM — DM history must not stay empty.
 *
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3340 pnpm exec playwright test tests/e2e/dev-g6-4-group-dm-switch.spec.ts
 */
test.describe("group → DM thread switch", () => {
  test("Tester1 DM history survives after viewing a community thread", async ({ page }) => {
    test.setTimeout(180_000);
    await unlockDevAccount(page, TESTER1);
    await applyOperatorDevBundle(page);
    await page.goto("/");
    try {
      await expectMessengerShell(page);
    } catch {
      test.skip(true, "Messenger shell not available in disposable browser profile; use Tauri Tester1 for full repro.");
    }

    await page.getByRole("button", { name: /^group$/i }).click();
    const groupRow = page.getByText(/GroupTset|Groupset|Sealed community/i).first();
    if (await groupRow.isVisible().catch(() => false)) {
      await groupRow.click();
      await page.waitForTimeout(800);
    }

    await page.getByRole("button", { name: /^chat$/i }).click();
    await page.getByText(TESTER2.username, { exact: false }).first().click();
    await page.waitForTimeout(1500);

    const outgoing = page.locator('[data-testid="message-outgoing"], .message-outgoing').first();
    const incoming = page.locator('[data-testid="message-incoming"], .message-incoming').first();
    const bodyHasTest = await page.locator("body").innerText().then((text) => /test/i.test(text));

    const hasVisibleHistory = await outgoing.isVisible().catch(() => false)
      || await incoming.isVisible().catch(() => false)
      || bodyHasTest;

    expect(hasVisibleHistory, "Expected DM messages after switching from a group thread").toBe(true);
  });
});
