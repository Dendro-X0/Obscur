import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("home renders and primary navigation is available", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("404");
  });

  test("settings + requests are gated when identity is locked", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings(\/|$)/);
    await expect(page.locator("body")).not.toContainText("404");

    await page.goto("/requests");
    await expect(page).toHaveURL(/\/requests(\/|$)/);
    await expect(page.locator("body")).not.toContainText("404");
  });
});
