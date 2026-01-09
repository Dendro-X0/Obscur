import { test, expect } from "@playwright/test";

test.describe("navigation", () => {
  test("can navigate between main routes", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Nostr Messenger" })).toBeVisible();

    await page.getByRole("link", { name: "Invites" }).click();
    await expect(page.getByRole("heading", { name: "Invites" })).toBeVisible();

    await page.getByRole("link", { name: "Search" }).click();
    await expect(page.getByRole("heading", { name: "Search" })).toBeVisible();

    const openDmButton = page.getByRole("button", { name: "Open DM" });
    await expect(openDmButton).toBeDisabled();
    await page.getByLabel("Public key").fill("not-a-key");
    await expect(openDmButton).toBeDisabled();
    await page.getByLabel("Public key").fill("f".repeat(64));
    await expect(openDmButton).toBeEnabled();

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Unlock your identity to manage relays.")).toBeVisible();

    await page.getByRole("link", { name: "Requests" }).click();
    await expect(page.getByRole("heading", { name: "Requests" })).toBeVisible();
    await expect(page.getByText("Unlock your identity to manage requests.")).toBeVisible();

    await page.getByRole("link", { name: "Chats" }).click();
    await expect(page.getByRole("heading", { name: "Nostr Messenger" })).toBeVisible();
  });
});
