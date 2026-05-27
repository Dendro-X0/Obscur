import { expect, test } from "@playwright/test";
import {
  applyOperatorDevBundle,
  openCreateGroupDialog,
  TESTER1,
  unlockDevAccount,
} from "./helpers/dev-test-accounts";

/**
 * G6-4 workspace smoke on dev server + local coordination.
 *
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3340 pnpm exec playwright test tests/e2e/dev-g6-4-workspace.spec.ts
 *
 * Requires: pnpm dev:desktop:online (or :3340) + pnpm dev:coordination
 */
test.describe("G6-4 workspace (dev)", () => {
  test("browser coordination /health is ok", async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const response = await fetch("http://127.0.0.1:8787/health", { cache: "no-store" });
      const json = await response.json() as { ok?: boolean };
      return { status: response.status, ok: json.ok === true };
    });
    expect(result.status).toBe(200);
    expect(result.ok).toBe(true);
  });

  test("Tester1: create group dialog when messenger shell is unlocked", async ({ page }) => {
    test.setTimeout(120_000);
    await unlockDevAccount(page, TESTER1);
    await applyOperatorDevBundle(page);

    const chatsTab = page.getByRole("button", { name: /^chats$/i });
    if (!(await chatsTab.isVisible().catch(() => false))) {
      test.skip(
        true,
        "Fresh browser profile did not reach messenger shell (use Tauri profile with Tester1 imported, or Log In with Key once).",
      );
    }

    await openCreateGroupDialog(page);
    await expect(page.getByText("Create New Group")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("create-group-workspace-trust-panel")).toBeVisible();

    const blocked = page.getByTestId("create-group-workspace-blocked");
    await page.waitForTimeout(3000);
    await expect(blocked).toBeHidden();

    await page.getByPlaceholder("Enter community name").fill(`E2E Workspace ${Date.now()}`);
    await expect(page.getByRole("button", { name: /^create group$/i })).toBeEnabled({ timeout: 15_000 });
  });
});
