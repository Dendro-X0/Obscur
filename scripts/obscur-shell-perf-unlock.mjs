/**
 * Playwright unlock for S0 / v2 perf baseline (headless static serve or dev server).
 * Mirrors apps/pwa/tests/e2e/helpers/dev-test-accounts.ts (Tester1).
 */

/** @typedef {import('playwright').Page} Page */

export const PERF_BASELINE_TESTER1 = {
  username: "Tester1",
  password: "SyI14^ew1E",
  privateKeyHex: "c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884",
};

const SIDEBAR_LABELS = ["Settings", "Network", "Search", "Chats"];

/**
 * @param {Page} page
 */
export const isAppShellUnlocked = async (page) => {
  for (const label of SIDEBAR_LABELS) {
    const link = page.getByRole("link", { name: label, exact: true });
    if (await link.isVisible().catch(() => false)) {
      return true;
    }
  }
  const chatsLink = page.getByRole("link", { name: /^chats$/i });
  return chatsLink.isVisible().catch(() => false);
};

/**
 * @param {Page} page
 */
const isAuthGateVisible = async (page) => {
  if (await page.getByRole("button", { name: /^(unlock|log in)$/i }).isVisible().catch(() => false)) {
    return true;
  }
  if (await page.locator('input[type="password"]').first().isVisible().catch(() => false)) {
    return true;
  }
  return page.getByPlaceholder(/nsec/i).first().isVisible().catch(() => false);
};

/**
 * @param {Page} page
 */
const unlockViaDevLab = async (page) => {
  await page.evaluate(async () => {
    const lab = window.obscurDevLab;
    if (lab && typeof lab.unlock === "function") {
      await lab.unlock("tester1");
    }
  }).catch(() => undefined);
};

/**
 * @param {Page} page
 * @param {typeof PERF_BASELINE_TESTER1} account
 */
const unlockViaAuthUi = async (page, account) => {
  const passwordInput = page.locator('input[type="password"]').first();

  if (await passwordInput.isVisible().catch(() => false)) {
    await passwordInput.fill(account.password);
    await page.getByRole("button", { name: /^(unlock|log in)$/i }).first().click();
    return;
  }

  const useKeyButton = page.getByRole("button", { name: /log in with key|private key|import key/i });
  if (await useKeyButton.isVisible().catch(() => false)) {
    await useKeyButton.click();
    await page.waitForTimeout(500);
  }

  const keyInput = page.getByPlaceholder(/nsec/i).first();
  if (!(await keyInput.isVisible().catch(() => false))) {
    return;
  }
  await keyInput.fill(account.privateKeyHex);
  await page.getByRole("button", { name: /import/i }).first().click();

  if (await passwordInput.isVisible().catch(() => false)) {
    await passwordInput.fill(account.password);
    await page.getByRole("button", { name: /unlock|continue|import|log in/i }).first().click();
  }
};

/**
 * @param {Page} page
 * @param {typeof PERF_BASELINE_TESTER1} [account]
 * @param {number} [timeoutMs]
 */
export const ensurePerfBaselineUnlocked = async (
  page,
  account = PERF_BASELINE_TESTER1,
  timeoutMs = 120_000,
) => {
  if (await isAppShellUnlocked(page)) {
    return;
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isAppShellUnlocked(page)) {
      return;
    }

    await unlockViaDevLab(page);
    if (await isAppShellUnlocked(page)) {
      return;
    }

    if (await isAuthGateVisible(page)) {
      await unlockViaAuthUi(page, account);
      await page.waitForTimeout(1500);
      if (await isAppShellUnlocked(page)) {
        return;
      }
    }

    await page.waitForTimeout(500);
  }

  throw new Error(
    "Timed out waiting for unlocked shell. Re-run with --unlock after build includes NEXT_PUBLIC_OBSCUR_DEV_LAB=1.",
  );
};
