import { expect, test } from "@playwright/test";

test.describe("theme", () => {
  test("can switch theme preference from settings", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("body")).toBeVisible();

    const appearanceTab = page.getByRole("button", { name: /appearance/i });
    await expect(appearanceTab).toBeVisible();
    await appearanceTab.click();

    const lightButton = page.getByRole("button", { name: /light/i });
    const darkButton = page.getByRole("button", { name: /dark/i });

    await expect(lightButton).toBeVisible();
    await expect(darkButton).toBeVisible();

    await darkButton.click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);

    await lightButton.click();
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  });
});
