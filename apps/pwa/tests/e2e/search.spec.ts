import { expect, test } from "@playwright/test";

test.describe("search", () => {
  test("Open DM button enables only for valid hex public key", async ({ page }) => {
    await page.goto("/search");

    const publicKeyInput = page.getByLabel("Public key");
    await expect(publicKeyInput).toBeVisible();

    const openDmButton = page.getByRole("button", { name: "Open DM" });
    await expect(openDmButton).toBeVisible();

    await publicKeyInput.fill("");
    await expect(openDmButton).toBeDisabled();

    await publicKeyInput.fill("not-a-key");
    await expect(openDmButton).toBeDisabled();

    await publicKeyInput.fill("f".repeat(64));
    await expect(openDmButton).toBeEnabled();
  });
});
