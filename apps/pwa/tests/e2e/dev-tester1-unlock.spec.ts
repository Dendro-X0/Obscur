import { expect, test } from "@playwright/test";

/**
 * Dev-server smoke: unlock disposable Tester1 on http://127.0.0.1:3340.
 * Run: PLAYWRIGHT_BASE_URL=http://127.0.0.1:3340 pnpm exec playwright test tests/e2e/dev-tester1-unlock.spec.ts
 */
const TESTER1 = {
  username: "Tester1",
  password: "SyI14^ew1E",
  privateKeyHex: "c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884",
  npub: "npub1uplk0h9c5k848vfl69dw2jwrr7ecz736dncw30tfqwaw8sv3aftq3rtdrg",
};

test.describe("dev Tester1", () => {
  test("unlocks via username/password or imports key then reaches chats", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const usernameInput = page.locator('input[type="text"], input:not([type])').filter({ hasNot: page.locator("[type=search]") }).first();
    const passwordInput = page.locator('input[type="password"]').first();

    const unlockButton = page.getByRole("button", { name: /unlock/i });
    const useKeyButton = page.getByRole("button", { name: /private key|log in with key/i });

    if (await unlockButton.isVisible().catch(() => false)) {
      await usernameInput.fill(TESTER1.username);
      await passwordInput.fill(TESTER1.password);
      await unlockButton.click();
    } else if (await useKeyButton.isVisible().catch(() => false)) {
      await useKeyButton.click();
      const keyInput = page.getByPlaceholder(/nsec|hex|private/i).first();
      await keyInput.fill(TESTER1.privateKeyHex);
      const importButton = page.getByRole("button", { name: /import|continue|unlock/i }).first();
      await importButton.click();
      if (await passwordInput.isVisible().catch(() => false)) {
        await passwordInput.fill(TESTER1.password);
        const confirm = page.getByRole("button", { name: /unlock|continue|create|import/i }).first();
        await confirm.click();
      }
    } else {
      const keyTab = page.getByRole("button", { name: /key|import/i }).first();
      if (await keyTab.isVisible().catch(() => false)) {
        await keyTab.click();
      }
      const keyInput = page.getByPlaceholder(/nsec/i).first();
      if (await keyInput.isVisible().catch(() => false)) {
        await keyInput.fill(TESTER1.privateKeyHex);
        await page.getByRole("button", { name: /import/i }).first().click();
      }
    }

    await page.waitForTimeout(2000);
    await page.goto("/settings");
    await page.waitForLoadState("domcontentloaded");

    const bodyText = await page.locator("body").innerText();
    const hasNpub = bodyText.includes("npub1") || bodyText.includes(TESTER1.npub.slice(0, 12));
    const onAuthOnly = /unlock|import.*key|create account/i.test(bodyText) && !hasNpub;

    expect(onAuthOnly, "Expected unlocked settings, still on auth gate").toBe(false);
    await expect(page.locator("body")).not.toContainText("404");
  });

  test("settings and network routes load when unlocked", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/settings");
    await page.waitForLoadState("domcontentloaded");

    const passwordInput = page.locator('input[type="password"]').first();
    if (await passwordInput.isVisible().catch(() => false)) {
      const usernameInput = page.locator("input").first();
      await usernameInput.fill(TESTER1.username);
      await passwordInput.fill(TESTER1.password);
      await page.getByRole("button", { name: /unlock/i }).click();
      await page.waitForTimeout(1500);
    }

    for (const route of ["/network", "/search"]) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
      await expect(page.locator("body")).not.toContainText("404");
    }
  });
});
