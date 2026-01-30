import type { Page } from "@playwright/test";

type CreateHarnessParams = Readonly<{
  passphrase: string;
}>;

type EnsureIdentityResult = Readonly<{
  publicKeyHex: string;
}>;

type Harness = Readonly<{
  ensureUnlockedIdentity: (page: Page) => Promise<EnsureIdentityResult>;
  openDirectMessageByPubkeyHex: (params: Readonly<{ page: Page; peerPublicKeyHex: string }>) => Promise<void>;
  sendMessage: (params: Readonly<{ page: Page; text: string }>) => Promise<void>;
}>;

const getPublicKeyHexFromUi = async (page: Page): Promise<string> => {
  const monoBlocks = page.locator("div.font-mono");
  const count = await monoBlocks.count();
  for (let i = 0; i < count; i += 1) {
    const text = (await monoBlocks.nth(i).innerText()).trim();
    if (/^[0-9a-f]{64}$/i.test(text)) {
      return text;
    }
  }
  throw new Error("Could not locate publicKeyHex in UI");
};

export const createE2eHarness = (params: CreateHarnessParams): Harness => {
  const ensureUnlockedIdentity = async (page: Page): Promise<EnsureIdentityResult> => {
    await page.goto("/settings");
    await page.waitForLoadState("domcontentloaded");

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(params.passphrase);

    const unlockButton = page.getByRole("button", { name: /unlock/i });
    const createButton = page.getByRole("button", { name: /^create$/i });
    const createNewButton = page.getByRole("button", { name: /create new/i });

    if (await unlockButton.isVisible()) {
      await unlockButton.click();
    } else if (await createButton.isVisible()) {
      await createButton.click();
    } else if (await createNewButton.isVisible()) {
      await createNewButton.click();
    }

    const publicKeyHex = await getPublicKeyHexFromUi(page);
    return { publicKeyHex };
  };

  const openDirectMessageByPubkeyHex = async (input: Readonly<{ page: Page; peerPublicKeyHex: string }>): Promise<void> => {
    await input.page.goto("/search");
    await input.page.waitForLoadState("domcontentloaded");

    const inputBox = input.page.getByLabel(/public key or name/i);
    await inputBox.fill(input.peerPublicKeyHex);

    const openDmButton = input.page.getByRole("button", { name: /open dm/i });
    await openDmButton.click();

    await input.page.waitForURL(/\/?(.*)(pubkey=|chat=)/i);
  };

  const sendMessage = async (input: Readonly<{ page: Page; text: string }>): Promise<void> => {
    const textarea = input.page.locator("textarea").first();
    await textarea.fill(input.text);

    const sendButton = input.page.getByRole("button", { name: /^send$/i });
    await sendButton.click();
  };

  return { ensureUnlockedIdentity, openDirectMessageByPubkeyHex, sendMessage };
};
