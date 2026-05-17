import { expect, test } from "@playwright/test";

test.describe("routes", () => {
  test("core routes load without 404", async ({ page }) => {
    const routes: ReadonlyArray<string> = ["/", "/invites", "/search", "/settings", "/requests"];
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
      await expect(page.locator("body")).not.toContainText("404");
      await expect(page).toHaveURL(new RegExp(`${route.replace("/", "\\/")}(\\/|$)`));
    }
  });

  test("search route has public key input", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByLabel("Public key")).toBeVisible();
  });
});
