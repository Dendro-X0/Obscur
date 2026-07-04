const AUTH_SUBMIT_PATTERN = /^(unlock|log in)$/i;

export const TESTER1 = {
  username: "Tester1",
  password: "SyI14^ew1E",
  privateKeyHex: "c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884",
};

export const TESTER2 = {
  username: "Tester2",
  password: "HT512#scE8",
  nsec: "nsec1gkv6kg9gyfvrg7h7q60usvaqtjq096dxewaw4vpk9y6krrlcglpqat96ta",
  privateKeyHex: "3db055b47e05bdfb9083efec0b7aecd2a045dbf7d865cf4d95d98817d946830f",
  publicKeyHex: "3db055b47e05bdfb9083efec0b7aecd2a045dbf7d865cf4d95d98817d946830f",
};

const ACCOUNT_BY_ID = {
  tester1: TESTER1,
  tester2: TESTER2,
};

export async function applyDevOperatorBundle(page) {
  await page.evaluate(() => {
    localStorage.setItem("obscur.operator.coordination_url.v1", "http://127.0.0.1:8787");
    localStorage.setItem("obscur.dev.coordination_only_workspace.v1", "1");
    localStorage.setItem("obscur.dev.assume_local_coordination.v1", "1");
    localStorage.setItem("obscur.membership_sync_mode.v1", "coordination_preferred");
  });
}

/** COM-MEM-2 requires full-stack profile — relay + coordination, not coordination-only dev mode. */
export async function applyComMem2FullStackBundle(page) {
  await page.evaluate(() => {
    localStorage.setItem("obscur.operator.coordination_url.v1", "http://127.0.0.1:8787");
    localStorage.removeItem("obscur.dev.coordination_only_workspace.v1");
    localStorage.setItem("obscur.dev.assume_local_coordination.v1", "1");
    localStorage.setItem("obscur.membership_sync_mode.v1", "coordination_preferred");
  });
}

export async function probeShellHealth(page) {
  return page.evaluate(() => window.obscurDevLab?.probeShellHealth?.() ?? null);
}

async function isAuthGateVisible(page) {
  if (await page.getByRole("button", { name: AUTH_SUBMIT_PATTERN }).isVisible().catch(() => false)) {
    return true;
  }
  if (await page.locator('input[type="password"]').first().isVisible().catch(() => false)) {
    return true;
  }
  if (await page.getByPlaceholder(/nsec/i).first().isVisible().catch(() => false)) {
    return true;
  }
  return page.getByText(/welcome back|enter your password/i).isVisible().catch(() => false);
}

async function isAppShellVisible(page) {
  const chatsLink = page.getByRole("link", { name: /^chats$/i });
  const chatsButton = page.getByRole("button", { name: /^chats$/i });
  if (await chatsLink.isVisible().catch(() => false)) {
    return true;
  }
  if (await chatsButton.isVisible().catch(() => false)) {
    return true;
  }
  for (const label of ["Settings", "Network", "Search", "Chats"]) {
    const link = page.getByRole("link", { name: label, exact: true });
    if (await link.isVisible().catch(() => false)) {
      return true;
    }
  }
  return false;
}

export async function isShellUnlocked(page) {
  const health = await probeShellHealth(page);
  if (health?.shellUnlocked === true && health?.rootFatalBoundary !== true) {
    return true;
  }
  return isAppShellVisible(page);
}

async function submitAuthForm(page, account) {
  const textInput = page.locator('input:not([type="password"]):not([type="hidden"])').first();
  const passwordInput = page.locator('input[type="password"]').first();
  await textInput.click();
  await textInput.fill("");
  await textInput.pressSequentially(account.username, { delay: 25 });
  await passwordInput.click();
  await passwordInput.fill("");
  await passwordInput.pressSequentially(account.password, { delay: 25 });
  const submitAuth = page.getByRole("button", { name: AUTH_SUBMIT_PATTERN });
  if (await submitAuth.count() > 1) {
    await submitAuth.last().click();
  } else {
    await submitAuth.click();
  }
  await page.waitForTimeout(2500);
}


async function unlockViaAuthUi(page, account = TESTER1) {
  if (await isAppShellVisible(page)) {
    return;
  }

  const passwordInput = page.locator('input[type="password"]').first();
  if (await passwordInput.isVisible().catch(() => false)) {
    await submitAuthForm(page, account);
    return;
  }

  const useKeyButton = page.getByRole("button", { name: /log in with key|private key|import key/i });
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
    await page.getByRole("button", { name: /unlock|continue|import|log in/i }).first().click();
  }
  await page.waitForTimeout(1500);
}

/**
 * @param {import('playwright').Page} page
 * @param {{ log?: (msg: string) => void; timeoutMs?: number }} [options]
 */
export async function ensureTester1Unlocked(page, options = {}) {
  return ensureDevLabAccountUnlocked(page, "tester1", options);
}

/**
 * @param {import('playwright').Page} page
 * @param {"tester1" | "tester2"} accountId
 * @param {{ log?: (msg: string) => void; timeoutMs?: number }} [options]
 */
export async function ensureDevLabAccountUnlocked(page, accountId, options = {}) {
  const account = ACCOUNT_BY_ID[accountId];
  if (!account) {
    throw new Error(`Unknown dev lab account: ${accountId}`);
  }
  const log = options.log ?? (() => undefined);
  const timeoutMs = options.timeoutMs ?? 120_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isShellUnlocked(page)) {
      return;
    }

    await page.evaluate(async (id) => {
      await window.obscurDevLab?.unlock(id);
    }, accountId).catch(() => undefined);
    await page.waitForTimeout(1500);
    if (await isShellUnlocked(page)) {
      return;
    }

    if (await isAuthGateVisible(page)) {
      log(`unlocking ${account.username} via auth UI`);
      await unlockViaAuthUi(page, account);
      await page.waitForTimeout(2000);
      if (await isShellUnlocked(page)) {
        return;
      }
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(`Timed out unlocking ${account.username} — start dev server (pnpm dev:desktop:online) and retry.`);
}
