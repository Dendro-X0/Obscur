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

async function withTimeout(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function isLockedIdentitySurface(page) {
  // Evaluate-only — avoid Playwright locator waits hanging CDP attach loops.
  // Native rehydrate can leave identityStatus=locked while Settings/Chats chrome
  // is already interactive — that is NOT a lock surface (Soft L3 Track A).
  // Require passphrase UI / LockedIdentityView copy, not session status alone.
  // Slice text — relay toast spam makes full body.innerText multi-second on CDP.
  return withTimeout(page.evaluate(() => {
    const root = document.querySelector("main") || document.body;
    const text = (root?.innerText ?? "").slice(0, 8_000);
    const hasPassword = Boolean(document.querySelector('input[type="password"]'));
    if (/identity locked|unlock identity/i.test(text) && hasPassword) {
      return true;
    }
    if (/identity locked/i.test(text) && /passphrase/i.test(text)) {
      return true;
    }
    return false;
  }), 15_000, "isLockedIdentitySurface").catch(() => false);
}

async function isAuthGateVisible(page) {
  if (await isLockedIdentitySurface(page)) {
    return true;
  }
  return withTimeout(page.evaluate(() => {
    const hasPassword = Boolean(document.querySelector('input[type="password"]'));
    const buttons = [...document.querySelectorAll("button")].map((b) => (b.textContent ?? "").trim());
    const hasUnlock = buttons.some((t) => /^(unlock|log in)$/i.test(t));
    const hasNsec = Boolean(document.querySelector('input[placeholder*="nsec" i]'));
    const root = document.querySelector("main") || document.body;
    const text = (root?.innerText ?? "").slice(0, 8_000);
    return hasPassword || hasUnlock || hasNsec || /welcome back|enter your password/i.test(text);
  }), 15_000, "isAuthGateVisible").catch(() => false);
}

async function isAppShellVisible(page) {
  return withTimeout(page.evaluate(() => {
    const hasPassword = Boolean(document.querySelector('input[type="password"]'));
    // Password field means unlock gate — not interactive messenger chrome.
    if (hasPassword) {
      return false;
    }
    const links = [...document.querySelectorAll("a")].map((a) => (a.textContent ?? "").trim());
    const buttons = [...document.querySelectorAll("button")].map((b) => (b.textContent ?? "").trim());
    if (links.some((t) => /^chats$/i.test(t)) || buttons.some((t) => /^chats$/i.test(t))) {
      return true;
    }
    if (["Settings", "Network", "Search", "Chats"].some((label) => links.includes(label))) {
      return true;
    }
    // Native rehydrate can leave session.identityStatus=locked while OBSCUR chrome is usable
    // (network profile / connection card) — treat as unlocked for Soft L3 / MCP attach.
    // Prefer main content + slice — toast stacks make full body.innerText CDP-hostile.
    const root = document.querySelector("main") || document.body;
    const text = (root?.innerText ?? "").slice(0, 8_000);
    if (
      /OBSCUR/i.test(text)
      && /(TESTER\s*[12]|CONNECTION PROFILE|DIRECT MESSAGES|Public contact|Friend Code|CONNECTED\s+\d|Resend Invitation)/i.test(text)
    ) {
      return true;
    }
    return false;
  }), 15_000, "isAppShellVisible").catch(() => false);
}

export async function isShellUnlocked(page) {
  try {
    if (!page || page.isClosed()) {
      return false;
    }
    const href = page.url();
    // Profile picker is pre-shell — never treat as unlocked messenger.
    if (/\/profiles(?:\/|$|\?)/i.test(href)) {
      return false;
    }
    if (await isLockedIdentitySurface(page)) {
      return false;
    }
    const health = await probeShellHealth(page);
    if (health?.shellUnlocked === true && health?.rootFatalBoundary !== true) {
      return true;
    }
    return isAppShellVisible(page);
  } catch {
    return false;
  }
}

/**
 * Exit desktop profile picker into sign-in / messenger for Tester1 Soft L3.
 * Prefer named Tester1 card; fall back to first profile-slot button.
 */
export async function enterMessengerFromProfilePicker(page, options = {}) {
  const log = options.log ?? (() => undefined);
  if (!/\/profiles(?:\/|$|\?)/i.test(page.url())) {
    return false;
  }
  log("on /profiles — opening profile slot into messenger/sign-in");
  // Prefer explicit Sign in here on Tester1 card (native stored_locked recovery).
  const signIn = page.getByRole("button", { name: /Tester1.*Sign in here|Sign in here/i }).first();
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click().catch(() => undefined);
    await page.waitForTimeout(2_500);
    return true;
  }
  const testerCard = page.locator("button").filter({ hasText: /Tester1/i }).first();
  if (await testerCard.isVisible().catch(() => false)) {
    await testerCard.click().catch(() => undefined);
    await page.waitForTimeout(2_000);
    return true;
  }
  const slotCard = page.locator("button").filter({ hasText: /Profile slot|Default/i }).first();
  if (await slotCard.isVisible().catch(() => false)) {
    await slotCard.click().catch(() => undefined);
    await page.waitForTimeout(2_000);
    return true;
  }
  const firstCard = page.getByRole("button").nth(0);
  if (await firstCard.isVisible().catch(() => false)) {
    await firstCard.click().catch(() => undefined);
    await page.waitForTimeout(2_000);
    return true;
  }
  return false;
}

async function submitPassphraseUnlock(page, account) {
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.click({ timeout: 5_000 });
  await passwordInput.fill("");
  await passwordInput.fill(account.password, { timeout: 5_000 });
  const submitAuth = page.getByRole("button", { name: AUTH_SUBMIT_PATTERN });
  if (await submitAuth.count() > 1) {
    await submitAuth.last().click({ timeout: 5_000 });
  } else {
    await submitAuth.click({ timeout: 5_000 });
  }
  await page.waitForTimeout(2500);
}

async function submitAuthForm(page, account) {
  const passwordInput = page.locator('input[type="password"]').first();
  // Prefer passphrase-only when LockedIdentityView / IdentityCard is up (search chrome
  // may still expose a non-password input that must not receive the username).
  if (await isLockedIdentitySurface(page)) {
    await submitPassphraseUnlock(page, account);
    return;
  }
  const textInput = page.locator('input:not([type="password"]):not([type="hidden"])').first();
  const hasUsernameField = await textInput.isVisible().catch(() => false);
  if (!hasUsernameField) {
    await submitPassphraseUnlock(page, account);
    return;
  }
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
  // Do not early-return on chrome alone — locked overlay can sit above nav.
  if (await isShellUnlocked(page) && !(await isLockedIdentitySurface(page))) {
    return;
  }

  const hasPassword = await withTimeout(page.evaluate(() => {
    return Boolean(document.querySelector('input[type="password"]'));
  }), 5_000, "hasPassword").catch(() => false);

  if (hasPassword) {
    await submitAuthForm(page, account);
    return;
  }

  const useKeyButton = page.getByRole("button", { name: /log in with key|private key|import key/i });
  if (await useKeyButton.isVisible().catch(() => false)) {
    await useKeyButton.click({ timeout: 5_000 });
    await page.waitForTimeout(500);
  }

  const keyMaterial = account.privateKeyHex ?? account.nsec ?? "";
  const keyInput = page.getByPlaceholder(/nsec/i).first();
  if (!(await keyInput.isVisible().catch(() => false))) {
    return;
  }
  await keyInput.fill(keyMaterial, { timeout: 5_000 });
  await page.getByRole("button", { name: /import/i }).first().click({ timeout: 5_000 });
  const passwordAfterImport = await withTimeout(page.evaluate(() => {
    return Boolean(document.querySelector('input[type="password"]'));
  }), 5_000, "passwordAfterImport").catch(() => false);
  if (passwordAfterImport) {
    await page.locator('input[type="password"]').first().fill(account.password, { timeout: 5_000 });
    await page.getByRole("button", { name: /unlock|continue|import|log in/i }).first().click({ timeout: 5_000 });
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
  let attempts = 0;

  while (Date.now() < deadline) {
    attempts += 1;
    if (await isShellUnlocked(page)) {
      return;
    }

    await page.evaluate(async (id) => {
      await window.obscurDevLab?.unlock(id);
    }, accountId).catch(() => undefined);
    await page.waitForTimeout(800);
    if (await isShellUnlocked(page)) {
      return;
    }

    const gate = await isAuthGateVisible(page);
    const locked = await isLockedIdentitySurface(page);
    if (gate || locked) {
      log(`unlocking ${account.username} via auth UI (attempt ${attempts}, locked=${locked})`);
      try {
        await unlockViaAuthUi(page, account);
      } catch (error) {
        log(`unlock UI attempt failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      await page.waitForTimeout(1500);
      if (await isShellUnlocked(page)) {
        return;
      }
    } else if (attempts === 1 || attempts % 5 === 0) {
      log(`unlock wait: no auth gate yet (attempt ${attempts})`);
    }

    await page.waitForTimeout(500);
  }

  throw new Error(`Timed out unlocking ${account.username} — start dev server (pnpm dev:desktop:online) and retry.`);
}
