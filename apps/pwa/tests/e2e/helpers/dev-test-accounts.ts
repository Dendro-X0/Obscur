import type { Page } from "@playwright/test";

export const TESTER1 = {
  username: "Tester1",
  password: "SyI14^ew1E",
  privateKeyHex: "c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884",
  npub: "npub1uplk0h9c5k848vfl69dw2jwrr7ecz736dncw30tfqwaw8sv3aftq3rtdrg",
  publicKeyHex: "c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884",
} as const;

export const TESTER2 = {
  username: "Tester2",
  password: "HT512#scE8",
  nsec: "nsec1gkv6kg9gyfvrg7h7q60usvaqtjq096dxewaw4vpk9y6krrlcglpqat96ta",
  npub: "npub18kc9tdr7qk7lhyyralkqk7hv62sytklhmpju7nv4mxyp0k2xsv8ss7n67a",
} as const;

export const applyOperatorDevBundle = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    localStorage.setItem("obscur.operator.coordination_url.v1", "http://127.0.0.1:8787");
    localStorage.setItem("obscur.dev.coordination_only_workspace.v1", "1");
    localStorage.setItem("obscur.dev.assume_local_coordination.v1", "1");
    localStorage.setItem("obscur.membership_sync_mode.v1", "coordination_preferred");
  });
};

const isAuthGateVisible = async (page: Page): Promise<boolean> => {
  const unlockButton = page.getByRole("button", { name: /^unlock$/i });
  const importKey = page.getByPlaceholder(/nsec/i).first();
  return (await unlockButton.isVisible().catch(() => false))
    || (await importKey.isVisible().catch(() => false));
};

export const unlockDevAccount = async (
  page: Page,
  account: Readonly<{ username: string; password: string; privateKeyHex?: string; nsec?: string }>,
): Promise<void> => {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  const welcomeKeyLogin = page.getByRole("button", { name: /log in with key/i });
  if (await welcomeKeyLogin.isVisible().catch(() => false)) {
    await welcomeKeyLogin.click();
    await page.waitForTimeout(500);
  }

  if (!(await isAuthGateVisible(page))) {
    return;
  }

  const passwordInput = page.locator('input[type="password"]').first();
  const unlockButton = page.getByRole("button", { name: /^unlock$/i });

  if (await unlockButton.isVisible().catch(() => false)) {
    const textInputs = page.locator('input:not([type="password"]):not([type="hidden"])');
    await textInputs.first().fill(account.username);
    await passwordInput.fill(account.password);
    await unlockButton.click();
    await page.waitForTimeout(1500);
    return;
  }

  const useKeyButton = page.getByRole("button", { name: /log in with key|private key/i });
  if (await useKeyButton.isVisible().catch(() => false)) {
    await useKeyButton.click();
    await page.waitForTimeout(500);
  }

  const keyMaterial = account.privateKeyHex ?? account.nsec ?? "";
  const keyInput = page.getByPlaceholder(/nsec/i).first();
  if (!(await keyInput.isVisible().catch(() => false))) {
    return;
  }
  await keyInput.fill(keyMaterial);
  await page.getByRole("button", { name: /import/i }).first().click();

  if (await passwordInput.isVisible().catch(() => false)) {
    await passwordInput.fill(account.password);
    await page.getByRole("button", { name: /unlock|continue|import/i }).first().click();
  }
  await page.waitForTimeout(1500);
};

/** Wait until main messenger chrome is visible (post-auth). */
export const expectMessengerShell = async (page: Page): Promise<void> => {
  const { expect } = await import("@playwright/test");
  await expect(page.getByRole("button", { name: /^chats$/i })).toBeVisible({ timeout: 60_000 });
};

export const openCreateGroupDialog = async (page: Page): Promise<void> => {
  await page.goto("/");
  await expectMessengerShell(page);
  await page.getByRole("button", { name: /^group$/i }).click();
  await page.getByRole("button", { name: /new group/i }).click();
};
