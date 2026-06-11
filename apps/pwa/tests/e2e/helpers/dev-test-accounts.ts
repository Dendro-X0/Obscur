import type { Page } from "@playwright/test";
import { gotoApp, resolveAppBaseUrl } from "./app-url";

const AUTH_SUBMIT_PATTERN = /^(unlock|log in)$/i;

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
};

export const isMessengerShellVisible = async (page: Page): Promise<boolean> => {
  const chatsLink = page.getByRole("link", { name: /^chats$/i });
  const chatsButton = page.getByRole("button", { name: /^chats$/i });
  return (await chatsLink.isVisible().catch(() => false))
    || (await chatsButton.isVisible().catch(() => false));
};

/** Desktop sidebar uses icon links with aria-label (see app-shell.tsx). */
export const isAppShellUnlocked = async (page: Page): Promise<boolean> => {
  if (await isMessengerShellVisible(page)) {
    return true;
  }
  for (const label of ["Settings", "Network", "Search", "Chats"] as const) {
    const link = page.getByRole("link", { name: label, exact: true });
    if (await link.isVisible().catch(() => false)) {
      return true;
    }
  }
  return false;
};

const submitAuthForm = async (
  page: Page,
  account: Readonly<{ username: string; password: string }>,
): Promise<void> => {
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
};

const resolveStartupTimeoutMs = (): number => {
  const raw = process.env.OBSCUR_RUNTIME_CAPTURE_STARTUP_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120_000;
};

/** Waits until shell or auth gate is detected (whichever appears first). */
const waitForAuthGateOrShell = async (page: Page): Promise<"shell" | "auth"> => {
  const deadline = Date.now() + resolveStartupTimeoutMs();
  while (Date.now() < deadline) {
    if (await isAppShellUnlocked(page)) {
      return "shell";
    }
    if (await isAuthGateVisible(page)) {
      return "auth";
    }
    await page.waitForTimeout(500);
  }
  throw new Error("Timed out waiting for messenger shell or auth gate after navigation");
};

/** Poll until sidebar shell appears (stays waiting through auth gate). */
export const waitForAppShellUnlocked = async (
  page: Page,
  options?: Readonly<{ timeoutMs?: number }>,
): Promise<void> => {
  const timeoutMs = options?.timeoutMs ?? resolveStartupTimeoutMs();
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let lastLog = 0;
  while (Date.now() < deadline) {
    if (await isAppShellUnlocked(page)) {
      return;
    }
    const elapsed = Date.now() - startedAt;
    if (elapsed - lastLog >= 15_000) {
      lastLog = elapsed;
      console.log(
        `[runtime-capture] Waiting for unlocked shell (${Math.round(elapsed / 1000)}s)...`,
      );
    }
    await page.waitForTimeout(500);
  }
  if (await isAuthGateVisible(page)) {
    throw new Error(
      "Timed out on auth gate. Unlock Tester1 in Tauri, then re-run capture.",
    );
  }
  throw new Error("Timed out waiting for unlocked shell.");
};

export const unlockDevAccount = async (
  page: Page,
  account: Readonly<{ username: string; password: string; privateKeyHex?: string; nsec?: string }>,
  baseURL?: string | null,
): Promise<void> => {
  const appBase = resolveAppBaseUrl(baseURL);
  if (!(await isAppShellUnlocked(page))) {
    if (!page.url().startsWith(appBase)) {
      await gotoApp(page, "/", baseURL);
      await page.waitForLoadState("domcontentloaded");
    }
  }

  const gateOrShell = await waitForAuthGateOrShell(page);
  if (gateOrShell === "shell") {
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
};

/**
 * Native CDP attaches to a live Tauri webview; automated auth is unreliable there.
 * Require an already-unlocked shell, or fail with an actionable message.
 */
export const ensureUnlockedForRuntimeCapture = async (
  page: Page,
  account: Readonly<{ username: string; password: string; privateKeyHex?: string; nsec?: string }>,
  baseURL?: string | null,
  options?: Readonly<{ cdpNative?: boolean }>,
): Promise<void> => {
  if (await isAppShellUnlocked(page)) {
    return;
  }

  if (options?.cdpNative) {
    await page.evaluate(async () => {
      const lab = window.obscurDevLab;
      if (lab && typeof lab.unlock === "function") {
        try {
          await lab.unlock("tester1");
        } catch {
          // Manual unlock fallback below.
        }
      }
    }).catch(() => undefined);
    if (await isAppShellUnlocked(page)) {
      return;
    }
    if (await isAuthGateVisible(page)) {
      console.log(
        "[runtime-capture] Unlock Tester1 in the Tauri window — "
        + `polling up to ${Math.round(resolveStartupTimeoutMs() / 1000)}s. `
        + "Tip: pnpm capture:runtime:cdp avoids Playwright test runner.",
      );
    }
    await waitForAppShellUnlocked(page);
    return;
  }

  await unlockDevAccount(page, account, baseURL);
  if (!(await isAppShellUnlocked(page))) {
    await page.evaluate(async () => {
      const lab = window.obscurDevLab;
      if (lab && typeof lab.unlock === "function") {
        await lab.unlock("tester1");
      }
    }).catch(() => undefined);
  }
};

/** Wait until main messenger chrome is visible (post-auth). */
export const expectMessengerShell = async (page: Page): Promise<void> => {
  const { expect } = await import("@playwright/test");
  const shellMarker = page.getByRole("link", { name: "Settings", exact: true })
    .or(page.getByRole("link", { name: "Network", exact: true }))
    .or(page.getByRole("link", { name: /^chats$/i }))
    .or(page.getByRole("button", { name: /^chats$/i }));
  await expect(shellMarker.first()).toBeVisible({ timeout: resolveStartupTimeoutMs() });
};

export const openCreateGroupDialog = async (page: Page, baseURL?: string | null): Promise<void> => {
  await gotoApp(page, "/", baseURL);
  await expectMessengerShell(page);
  await page.getByRole("button", { name: /^group$/i }).click();
  await page.getByRole("button", { name: /new group/i }).click();
};
