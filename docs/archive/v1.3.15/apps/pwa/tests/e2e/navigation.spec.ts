import { test, expect } from "@playwright/test";

test.describe("navigation", () => {
  test("can navigate between main routes", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();

    await page.goto("/invites");
    await expect(page).toHaveURL(/\/invites(\/|$)/);
    await expect(page.locator("body")).not.toContainText("404");

    await page.goto("/search");
    await expect(page).toHaveURL(/\/search(\/|$)/);
    await expect(page.getByLabel("Public key")).toBeVisible();

    const openDmButton = page.getByRole("button", { name: "Open DM" });
    await expect(openDmButton).toBeDisabled();
    await page.getByLabel("Public key").fill("not-a-key");
    await expect(openDmButton).toBeDisabled();
    await page.getByLabel("Public key").fill("f".repeat(64));
    await expect(openDmButton).toBeEnabled();

    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings(\/|$)/);
    await expect(page.locator("body")).not.toContainText("404");

    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
  });
});
