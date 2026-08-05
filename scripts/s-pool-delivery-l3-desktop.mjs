#!/usr/bin/env node
/**
 * Soft L3 — relay pool two-profile delivery on agreed path (S1–S4).
 *
 * Prefers CDP attach to the live desktop (Tester1 already unlocked).
 * Opens a second Playwright context for Tester2 (UI DM — not Dev Lab synthetic).
 *
 * Prerequisites:
 *   pnpm dev:desktop:online (static :1430) or live webpack · CDP :9230 · relay :7000 · Tester1 unlocked
 *   Prefer profile-2 CDP :9231 for Tester2 (set OBSCUR_CDP_B_URL / openProfileSlot(2))
 *   Falls back to Edge context when :9231 is down (flaky unlock/reunlock)
 *
 *   node scripts/s-pool-delivery-l3-desktop.mjs
 *   node scripts/s-pool-delivery-l3-desktop.mjs --preflight
 *   pnpm verify:s-pool-delivery-l3
 *   pnpm verify:s-pool-delivery-l3:preflight
 *
 * Pass requires Row B receive **and** publish ACK (F-ACK). Override:
 *   OBSCUR_SOFT_L3_ALLOW_RECEIVE_WITHOUT_ACK=1
 *
 * @see specs/backend/relay-pool-delivery-l3-soft-recipe-2026-08.md
 * @see specs/backend/soft-l3-automation-track-a-design-2026-08.md
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatNoObscurPageError,
  waitForAppPageFromBrowser,
} from "./lib/cdp-app-page.mjs";
import {
  applyDevOperatorBundle,
  ensureTester1Unlocked,
  enterMessengerFromProfilePicker,
  isShellUnlocked,
  TESTER1,
  TESTER2,
} from "./lib/dev-lab-playwright-auth.mjs";
import {
  isHttpReachable,
  resolvePlaywrightAppBase,
} from "./lib/resolve-playwright-app-base.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const requireFromPwa = createRequire(path.join(pwaDir, "package.json"));
const CDP = process.env.OBSCUR_CDP_URL ?? "http://127.0.0.1:9230";
const CDP_B = process.env.OBSCUR_CDP_B_URL
  ?? process.env.OBSCUR_CDP_PROFILE_URL
  ?? "http://127.0.0.1:9231";
const AGREED_PATH = process.env.OBSCUR_AGREED_RELAY_URL ?? "ws://localhost:7000";
const ALLOW_RECEIVE_WITHOUT_ACK = process.env.OBSCUR_SOFT_L3_ALLOW_RECEIVE_WITHOUT_ACK === "1";
const MARKER_PREFIX = "S-POOL-L3";
const today = new Date().toISOString().slice(0, 10);
const reportPath = path.join(repoRoot, "test-results", `s-pool-delivery-l3-${today}.json`);
const PREFLIGHT_ONLY = process.argv.includes("--preflight");
/** Set in main() after resolvePlaywrightAppBase — used by helpers (openRelaysSettings, etc.). */
let APP_BASE = "http://127.0.0.1:1430";

async function isCdpReachable(cdpUrl, timeoutMs = 2_000) {
  const versionUrl = `${String(cdpUrl).replace(/\/$/, "")}/json/version`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(versionUrl, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Canonical pubkeys (nsec/sk derived) — do not use fixture privateKeyHex as pubkey. */
const TESTER1_PUBKEY = "e07f67dcb8a58f53b13fd15ae549c31fb3817a3a6cf0e8bd6903bae3c191ea56";
const TESTER2_PUBKEY = "3db055b47e05bdfb9083efec0b7aecd2a045dbf7d865cf4d95d98817d946830f";
/** Friend codes for search when Kind 0 display names are unresolved. */
const TESTER1_FRIEND_CODE = "OBSCUR-5KMPFN";
const TESTER2_FRIEND_CODE = "OBSCUR-GBKMBC";
/** ≥12 chars — TESTER2_DEVICE_PASSWORD alone fails identity passphrase policy. */
const TESTER2_DEVICE_PASSWORD = `${TESTER2.password}!!`;

function loadPlaywright() {
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

const log = (message) => console.log(`[s-pool-l3] ${message}`);
const isLocalUrl = (url) => /localhost:7000|127\.0\.0\.1:7000/i.test(String(url ?? ""));

async function isShell(page) {
  const href = page.url();
  if (/\/profiles(?:\/|$|\?)/i.test(href)) {
    return false;
  }

  // Prefer one evaluate — CDP locator.isVisible can stall Soft L3 for minutes.
  // Slice main text — relay toast spam makes full body.innerText CDP-hostile.
  const quick = await page.evaluate(() => {
    const root = document.querySelector("main") || document.body;
    const text = (root?.innerText ?? "").slice(0, 8_000);
    const hasNsec = Boolean(document.querySelector('input[placeholder*="nsec" i]'));
    const hasPassword = Boolean(document.querySelector('input[type="password"]'));
    const buttons = [...document.querySelectorAll("button")].map((b) => (b.textContent ?? "").trim());
    const hasLogInWithKey = buttons.some((t) => /log in with key/i.test(t));
    const hasContinueWith = buttons.some((t) => /continue with/i.test(t));
    const welcomeBack = /welcome back/i.test(text);
    const lockedUi = /identity locked|unlock identity/i.test(text)
      && (hasPassword || /passphrase/i.test(text));
    if (hasNsec || hasLogInWithKey || (welcomeBack && hasContinueWith) || lockedUi) {
      return { ok: false, reason: "auth_or_locked" };
    }
    const session = window.obscurWindowRuntime?.getSnapshot?.()?.session;
    if (session?.identityStatus === "unlocked" && session?.unlockedPublicKeyHex) {
      return { ok: true, reason: "session_unlocked" };
    }
    // Chrome-only is insufficient while native session remains stored_locked / auth_required.
    // Soft-nav to / or Profiles → Sign in recovers unlock (see Soft L3 credential unlock).
    if (
      session?.identityStatus === "locked"
      || (session?.startupState?.kind === "stored_locked")
      || (session && !session.unlockedPublicKeyHex && /auth_required/i.test(String(session?.startupState?.runtimePhaseHint ?? "")))
    ) {
      return { ok: false, reason: "session_locked" };
    }
    const links = [...document.querySelectorAll("a")].map((a) => (a.textContent ?? "").trim());
    const hasChrome = ["Settings", "Network", "Search", "Chats"].some((label) => links.includes(label))
      || buttons.some((t) => /^chats$/i.test(t))
      || (/OBSCUR/i.test(text) && (/Chats|DIRECT MESSAGES|Connected \d+\/\d+|Relays|TESTER\s*[12]|CONNECTION PROFILE|Public contact|Friend Code|Resend Invitation/i.test(text) || /\bSettings\b/.test(text)));
    return { ok: hasChrome, reason: hasChrome ? "chrome" : "none" };
  }).catch(() => ({ ok: false, reason: "evaluate_failed" }));

  if (quick.ok) {
    return true;
  }
  if (quick.reason === "auth_or_locked") {
    return false;
  }

  // Fallback shared helper (also evaluate-first for lock detection).
  if (await isShellUnlocked(page)) {
    return true;
  }
  return false;
}

async function readShellSessionProbe(page) {
  return page.evaluate(() => {
    const root = window.obscurWindowRuntime?.getSnapshot?.() ?? null;
    const session = root?.session ?? null;
    return {
      identityStatus: session?.identityStatus ?? null,
      unlockedPublicKeyHex: session?.unlockedPublicKeyHex ?? null,
      profileId: session?.profileId ?? root?.profileId ?? null,
      phase: root?.phase ?? null,
      hasDevLab: typeof window.obscurDevLab !== "undefined",
    };
  }).catch((error) => ({ error: String(error) }));
}

async function readRelayProbe(page) {
  return page.evaluate((agreedPath) => {
    const runtime = window.obscurRelayRuntime?.getSnapshot?.() ?? null;
    const bodyText = document.body?.innerText ?? "";
    const enabled = Array.isArray(runtime?.enabledRelayUrls) ? runtime.enabledRelayUrls : [];
    const writable = Number(
      runtime?.writableRelayCount
      ?? runtime?.recovery?.writableRelayCount
      ?? 0,
    );
    const publishPathMatch = bodyText.match(/DM publish path:\s*([^\n]+)/i)
      ?? bodyText.match(/Publish:\s*([^\n]+)/i);
    const publishPathLine = publishPathMatch?.[0] ?? null;
    const publishPathHosts = publishPathMatch?.[1]?.trim() ?? null;
    const hasAgreedInEnabled = enabled.some((url) => (
      String(url).includes("localhost:7000")
      || String(url).includes("127.0.0.1:7000")
      || String(url) === agreedPath
    ));
    const openRemoteHint = /nos\.lol|primal\.net|damus\.io/i.test(bodyText)
      && /\bQuiet\b|\bCONNECTED\b/i.test(bodyText);
    const localOnlyPublish = Boolean(
      publishPathHosts
      && /localhost|127\.0\.0\.1/i.test(publishPathHosts)
      && !/nos\.lol|primal|damus/i.test(publishPathHosts),
    );
    return {
      writable,
      enabled,
      hasAgreedInEnabled,
      publishPathLine,
      publishPathHosts,
      localOnlyPublish,
      openRemoteHint,
      bodyHasPublishPath: /DM publish path:|Publish:/i.test(bodyText),
      bodyHasCmScopedHint: /bound relay URL|never auto-selected as the community store|Workspace candidates/i.test(bodyText),
      href: location.href,
      phase: runtime?.phase ?? null,
    };
  }, AGREED_PATH);
}

async function openRelaysSettings(page) {
  await page.goto(`${APP_BASE.replace(/\/$/, "")}/settings`, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  await page.waitForTimeout(1_500);
  // Exact sidebar label "Relays" (avoid composite "Relaysnetwork").
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("button, a, [role='tab']")].find((node) => (
      (node.innerText || "").trim() === "Relays"
    ));
    el?.click();
  });
  await page.waitForTimeout(2_000);
  // Expand community section if present (S4 scoped-store copy).
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("button, summary, [role='button']")].find((node) => (
      /community|workspace candidates|scoped/i.test((node.innerText || "").trim())
    ));
    el?.click();
  });
  await page.waitForTimeout(800);
}

async function openChats(page) {
  const chats = page.getByRole("link", { name: /^chats$/i }).first();
  if (await chats.isVisible().catch(() => false)) {
    await chats.click();
    await page.waitForTimeout(1_500);
  }
}

async function openPeerThread(page, peerName) {
  const byName = page.getByText(new RegExp(peerName, "i")).first();
  if (await byName.isVisible().catch(() => false)) {
    await byName.click();
    await page.waitForTimeout(1_500);
    return true;
  }
  const networkLink = page.locator('a[href^="/network/"]').first();
  if (await networkLink.isVisible().catch(() => false)) {
    await networkLink.click();
    await page.waitForTimeout(1_500);
    return true;
  }
  return false;
}

async function hideGhostProtocolOverlay(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[title="Ghost Protocol (Dev Mode)"]')) {
      const host = el.closest("div.fixed") ?? el;
      host.style.setProperty("display", "none", "important");
      host.style.setProperty("pointer-events", "none", "important");
    }
  }).catch(() => {});
}

/** First-DM / trust-confirm ceremony blocks send until confirmed — Soft L3 must clear it. */
async function seedSendCeremonyAck(page, peerPublicKeyHex, profileId = "default") {
  return page.evaluate(({ peer, profile }) => {
    const key = `obscur.send_ceremony.v1::${peer}::${profile}`;
    localStorage.setItem(key, "1");
    return key;
  }, {
    peer: String(peerPublicKeyHex).toLowerCase(),
    profile: profileId,
  });
}

async function confirmSendCeremonyIfOpen(page) {
  const dialog = page.getByTestId("send-ceremony-dialog");
  if (!(await dialog.isVisible().catch(() => false))) {
    return false;
  }
  const confirm = dialog.getByRole("button", { name: /send to this identity|confirm/i }).first();
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click({ force: true });
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

async function sendMarkerViaCompose(page, marker) {
  const compose = page.getByPlaceholder(/type a (private )?message|type a message|verification question/i)
    .or(page.locator("textarea").first());
  if (!(await compose.first().isVisible().catch(() => false))) {
    return { ok: false, reason: "compose_missing" };
  }
  if (await compose.first().isDisabled().catch(() => false)) {
    return { ok: false, reason: "compose_disabled" };
  }
  await hideGhostProtocolOverlay(page);
  await compose.first().click();
  await compose.first().fill("");
  // pressSequentially keeps React controlled state in sync (fill alone can leave messageInput empty).
  await compose.first().pressSequentially(marker, { delay: 8 });
  try {
    await compose.first().press("Enter");
  } catch (error) {
    return { ok: false, reason: `compose_enter_failed:${String(error?.message ?? error).slice(0, 120)}` };
  }
  await page.waitForTimeout(600);
  const ceremonyConfirmed = await confirmSendCeremonyIfOpen(page);
  await page.waitForTimeout(ceremonyConfirmed ? 1_200 : 800);
  let stuckInCompose = (await compose.first().inputValue().catch(() => "")).includes(marker);
  if (stuckInCompose) {
    const sendBtn = page.locator('button[aria-label="Send"]').last();
    if (await sendBtn.isVisible().catch(() => false) && !(await sendBtn.isDisabled().catch(() => true))) {
      try {
        await sendBtn.click({ force: true });
      } catch (error) {
        return { ok: false, reason: `send_click_failed:${String(error?.message ?? error).slice(0, 120)}` };
      }
      await page.waitForTimeout(600);
      await confirmSendCeremonyIfOpen(page);
      await page.waitForTimeout(1_200);
    }
    stuckInCompose = (await compose.first().inputValue().catch(() => "")).includes(marker);
    if (stuckInCompose) {
      const ceremonyOpen = await page.getByTestId("send-ceremony-dialog").isVisible().catch(() => false);
      return {
        ok: false,
        reason: ceremonyOpen ? "send_ceremony_blocking" : "marker_stuck_in_compose",
      };
    }
  }
  const visible = await page.getByText(marker, { exact: true }).first().isVisible().catch(() => false);
  return { ok: visible, reason: visible ? "sent_visible_local" : "sent_not_echoed" };
}

async function waitForMarker(page, marker, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await page.getByText(marker).first().isVisible().catch(() => false)) {
      return true;
    }
    await page.waitForTimeout(1_000);
  }
  return false;
}

async function prepareImportKeyForm(page, keyMaterial) {
  return page.evaluate((hex) => {
    const keyEl = document.querySelector('input[placeholder="nsec1..."]')
      ?? document.querySelector('input[placeholder*="nsec"]');
    if (!keyEl) {
      return { ok: false, reason: "no_key_input" };
    }
    const propsKey = Object.keys(keyEl).find((k) => k.startsWith("__reactProps"));
    if (propsKey && typeof keyEl[propsKey]?.onChange === "function") {
      keyEl[propsKey].onChange({ target: { value: hex }, currentTarget: { value: hex } });
    } else {
      keyEl.value = hex;
      keyEl.dispatchEvent(new Event("input", { bubbles: true }));
    }

    let clearedPassword = false;
    const continueBtn = [...document.querySelectorAll("button")].find((b) => (
      /^Continue$/i.test((b.innerText || "").trim())
    ));
    if (!continueBtn) {
      return { ok: true, clearedPassword: false };
    }
    let fiber = continueBtn[Object.keys(continueBtn).find((k) => k.startsWith("__reactFiber"))];
    while (fiber && fiber.elementType?.name !== "AuthScreen") {
      fiber = fiber.return;
    }
    if (!fiber) {
      return { ok: true, clearedPassword: false };
    }
    let hook = fiber.memoizedState;
    let idx = 0;
    while (hook && idx < 90) {
      const dispatch = hook.queue?.dispatch;
      const value = hook.memoizedState;
      if (typeof dispatch === "function" && typeof value === "string") {
        const isPolicyError = /at least 12 characters/i.test(value);
        const isShortPassword = value.length > 0 && value.length < 64 && idx >= 70 && idx <= 76;
        if (isPolicyError || isShortPassword) {
          dispatch(isPolicyError ? null : "");
          if (isShortPassword) clearedPassword = true;
        }
      }
      hook = hook.next;
      idx += 1;
    }
    return { ok: true, clearedPassword };
  }, keyMaterial);
}

async function unlockTester2ViaImportKey(page) {
  if (await isShell(page)) {
    return { ok: true, method: "already_shell" };
  }

  // Seed BEFORE unlock Continue — DM sync runs immediately and stranger-blocks otherwise.
  await page.evaluate(({ owner, peer, agreedPath }) => {
    const trustKey = `obscur.peer_trust.v1.${owner}`;
    localStorage.setItem(trustKey, JSON.stringify({
      acceptedPeers: [peer],
      mutedPeers: [],
    }));
    const relayKeys = [
      `obscur.relay_list.v2.${owner}::default`,
      `obscur.relay_list.v2.${owner}::pk-${owner.slice(0, 8)}`,
    ];
    for (const key of relayKeys) {
      localStorage.setItem(key, JSON.stringify([
        { url: agreedPath, enabled: true },
        { url: "wss://nos.lol", enabled: true },
      ]));
    }
  }, {
    owner: TESTER2_PUBKEY.toLowerCase(),
    peer: TESTER1_PUBKEY.toLowerCase(),
    agreedPath: AGREED_PATH,
  });
  log("Tester2 pre-seeded peer_trust + agreed relay before unlock");

  log(`Tester2 unlock start url=${page.url()}`);
  const keyMaterial = TESTER2.nsec ?? TESTER2.privateKeyHex;
  const loginWithKey = page.getByRole("button", { name: /log in with key/i });
  const importKeyTab = page.getByRole("button", { name: /^Import Key$/i });
  const nsecInput = page.getByPlaceholder(/nsec/i).first();

  try {
    await Promise.race([
      loginWithKey.waitFor({ state: "visible", timeout: 30_000 }),
      importKeyTab.waitFor({ state: "visible", timeout: 30_000 }),
      nsecInput.waitFor({ state: "visible", timeout: 30_000 }),
    ]);
  } catch {
    log("Tester2 auth CTAs not visible within 30s — dumping state");
  }

  if (!(await nsecInput.isVisible().catch(() => false))) {
    if (await loginWithKey.isVisible().catch(() => false)) {
      log("Tester2 clicking Log In with Key");
      await loginWithKey.click();
    } else if (await importKeyTab.isVisible().catch(() => false)) {
      log("Tester2 clicking Import Key tab");
      await importKeyTab.click();
    }
    try {
      await nsecInput.waitFor({ state: "visible", timeout: 15_000 });
    } catch {
      const bodyHint = await page.evaluate(() => (document.body?.innerText ?? "").slice(0, 400));
      await page.screenshot({
        path: path.join(repoRoot, "test-results", "s-pool-l3-tester2-unlock-fail.png"),
        fullPage: true,
      }).catch(() => undefined);
      return { ok: false, reason: "no_nsec_input", url: page.url(), bodyHint };
    }
  }

  const prepared = await prepareImportKeyForm(page, keyMaterial);
  log(`Tester2 import prepared ok=${prepared?.ok !== false} clearedPassword=${Boolean(prepared?.clearedPassword)}`);
  await page.waitForTimeout(400);

  const optionalPw = page.getByPlaceholder(/set a password|device password|master password/i).first();
  if (await optionalPw.isVisible().catch(() => false)) {
    await optionalPw.fill(TESTER2_DEVICE_PASSWORD);
  }

  const continueBtn = page.getByRole("button", {
    name: /continue with (private )?key|^Continue$|^Unlock with key$/i,
  }).first();
  if (await continueBtn.isVisible().catch(() => false)) {
    log("Tester2 clicking Continue / Continue with private key");
    await continueBtn.click({ force: true });
    await page.waitForTimeout(1_200);
  }

  // Always set device password when offered — never skip (Edge loses key-only unlock on nav).
  async function completeDevicePasswordStep() {
    const onStep = await page.getByText(/set a device (login )?password|new device password/i).first()
      .isVisible().catch(() => false);
    const skipVisible = await page.getByRole("button", { name: /skip.*unlock with key|key-only|skip —/i }).first()
      .isVisible().catch(() => false);
    if (!onStep && !skipVisible) {
      return false;
    }
    log("Tester2 setting device password for session durability");
    const pwInputs = page.locator('input[type="password"]');
    const count = await pwInputs.count();
    for (let i = 0; i < Math.min(count, 2); i += 1) {
      await pwInputs.nth(i).fill(TESTER2_DEVICE_PASSWORD).catch(() => undefined);
    }
    const save = page.getByRole("button", { name: /^(Continue|Save|Unlock)/i }).first();
    if (await save.isVisible().catch(() => false)) {
      await save.click().catch(() => undefined);
    }
    await page.waitForTimeout(2_000);
    return true;
  }

  await completeDevicePasswordStep();

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await isShell(page)) {
      return { ok: true, method: "import_key" };
    }
    const clear2 = page.getByRole("button", { name: /Clear this window and continue/i });
    if (await clear2.isVisible().catch(() => false)) {
      log("Tester2 clearing occupied profile slot");
      await clear2.click();
      await page.waitForTimeout(1_200);
      if (await nsecInput.isVisible().catch(() => false)) {
        await prepareImportKeyForm(page, keyMaterial);
      }
    }
    if (await nsecInput.isVisible().catch(() => false)) {
      await prepareImportKeyForm(page, keyMaterial);
      const again = page.getByRole("button", {
        name: /continue with (private )?key|^Continue$/i,
      }).first();
      if (await again.isVisible().catch(() => false)) {
        await again.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(800);
      }
    }
    await completeDevicePasswordStep();
    await page.waitForTimeout(500);
  }

  const bodyHint = await page.evaluate(() => (document.body?.innerText ?? "").slice(0, 400));
  await page.screenshot({
    path: path.join(repoRoot, "test-results", "s-pool-l3-tester2-unlock-fail.png"),
    fullPage: true,
  }).catch(() => undefined);
  return { ok: false, reason: "timeout_after_import", url: page.url(), bodyHint };
}

async function readMyPubkey(page) {
  return page.evaluate(() => {
    const runtime = window.obscurWindowRuntime?.getSnapshot?.() ?? null;
    const fromSession = runtime?.session?.unlockedPublicKeyHex
      ?? runtime?.session?.storedPublicKeyHex
      ?? runtime?.publicKeyHex
      ?? null;
    const fromDiag = window.obscurDeliveryDiagnostics?.getSnapshot?.()?.myPublicKeyHex ?? null;
    if (fromSession || fromDiag) {
      return fromSession || fromDiag;
    }
    try {
      for (const key of Object.keys(localStorage)) {
        if (!/identity/i.test(key)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const hex = parsed?.publicKeyHex ?? parsed?.stored?.publicKeyHex;
        if (typeof hex === "string" && hex.length === 64) {
          return hex.toLowerCase();
        }
      }
    } catch {
      // ignore
    }
    return null;
  });
}

async function softNavigate(page, pathname) {
  const path = pathname.startsWith("http")
    ? new URL(pathname).pathname + new URL(pathname).search
    : pathname;
  let navigated = "timeout";
  try {
    navigated = await Promise.race([
      page.evaluate((targetPath) => {
        // Prefer an existing Next/app link so React soft-nav keeps in-memory unlock.
        const existing = [...document.querySelectorAll("a[href]")].find((a) => {
          try {
            const href = a.getAttribute("href") || "";
            return href === targetPath || href.endsWith(targetPath);
          } catch {
            return false;
          }
        });
        if (existing) {
          existing.click();
          return "existing_link";
        }
        const a = document.createElement("a");
        a.setAttribute("href", targetPath);
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
        return "synthetic_link";
      }, path),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("softNavigate evaluate timeout")), 8_000);
      }),
    ]);
  } catch (error) {
    log(`softNavigate failed (${error instanceof Error ? error.message : String(error)}) — caller may hard-goto`);
    return "timeout";
  }
  await page.waitForTimeout(1_800);
  return navigated;
}

async function openPeerByPubkey(page, peerPublicKeyHex, options = {}) {
  if (!peerPublicKeyHex) {
    return false;
  }
  const hex = String(peerPublicKeyHex).trim().toLowerCase();
  // Static shell blanks `/network/<hex>`; invite mesh uses query profile route.
  const peerPath = `/network/profile?pubkey=${hex}`;
  const onPeerPage = () => {
    const url = page.url().toLowerCase();
    return url.includes("/network/profile") && url.includes(`pubkey=${hex}`);
  };
  const base = APP_BASE.replace(/\/$/, "");
  // Only Edge/browser Tester2 sets options.reunlock — Tauri CDP keeps native unlock.
  const reunlock = options.reunlock === true;
  log(`openPeer ${hex.slice(0, 8)} reunlock=${reunlock} from=${page.url()}`);

  const hardGotoPeer = async () => {
    try {
      await page.goto(`${base}${peerPath}`, { waitUntil: "commit", timeout: 20_000 });
    } catch {
      await page.evaluate((target) => {
        window.location.assign(target);
      }, `${base}${peerPath}`).catch(() => undefined);
    }
    await page.waitForTimeout(2_000);
  };

  if (!onPeerPage()) {
    if (reunlock) {
      await hardGotoPeer();
    } else {
      const soft = await softNavigate(page, peerPath);
      if ((!onPeerPage() || soft === "timeout") && options.softOnly !== true) {
        await hardGotoPeer();
      }
      if (!onPeerPage() && options.softOnly === true) {
        log(`softOnly: still not on ${peerPath} — skipping hard goto`);
      }
    }
  }

  const lockVisible = await page.getByPlaceholder(/nsec/i).first().isVisible().catch(() => false);
  if (lockVisible && !reunlock) {
    log(`Peer nav hit lock screen — skipping reunlock (reunlock=false) for ${hex.slice(0, 8)}`);
    return false;
  }
  if (reunlock && lockVisible) {
    log(`Re-unlocking after peer nav (${hex.slice(0, 8)})…`);
    const unlocked = await unlockTester2ViaImportKey(page);
    if (!unlocked.ok) {
      log(`Re-unlock failed: ${unlocked.reason}`);
      return false;
    }
    // After unlock we are often on /. Hard-goto peer again + one more unlock if needed.
    if (!onPeerPage()) {
      await hardGotoPeer();
      if (await page.getByPlaceholder(/nsec/i).first().isVisible().catch(() => false)) {
        const unlocked2 = await unlockTester2ViaImportKey(page);
        if (!unlocked2.ok) {
          log(`Second re-unlock failed: ${unlocked2.reason}`);
          return false;
        }
      }
    }
  }

  const compose = page.getByPlaceholder(/type a (private )?message/i)
    .or(page.locator("textarea").first());

  const messageDeadline = Date.now() + 35_000;
  while (Date.now() < messageDeadline) {
    if (await page.getByPlaceholder(/nsec/i).first().isVisible().catch(() => false)) {
      log(`Peer open hit auth gate at ${page.url()} — re-unlock`);
      const unlocked = await unlockTester2ViaImportKey(page);
      if (!unlocked.ok) {
        break;
      }
      if (!onPeerPage()) {
        await hardGotoPeer();
      }
      continue;
    }
    if (await compose.first().isVisible().catch(() => false)) {
      log(`Compose visible for peer ${hex.slice(0, 8)} at ${page.url()}`);
      return true;
    }
    const messageBtn = page.getByRole("button", { name: /^Message$/i }).first();
    if (await messageBtn.isVisible().catch(() => false)) {
      log(`Clicking Message on profile ${hex.slice(0, 8)}…`);
      await messageBtn.click().catch(() => undefined);
      await page.waitForTimeout(1_500);
      continue;
    }
    if (options.peerName && await openPeerThread(page, options.peerName)) {
      if (await compose.first().isVisible().catch(() => false)) {
        return true;
      }
    }
    await page.waitForTimeout(500);
  }

  await page.screenshot({
    path: path.join(repoRoot, "test-results", `s-pool-l3-peer-open-fail-${hex.slice(0, 8)}.png`),
    fullPage: true,
  }).catch(() => undefined);
  log(`Compose missing for peer ${hex.slice(0, 8)} url=${page.url()}`);
  return false;
}

async function seedAcceptedPeer(page, ownerPublicKeyHex, peerPublicKeyHex) {
  return page.evaluate(({ owner, peer }) => {
    const key = `obscur.peer_trust.v1.${owner}`;
    let parsed = { acceptedPeers: [], mutedPeers: [] };
    try {
      parsed = JSON.parse(localStorage.getItem(key) ?? '{"acceptedPeers":[],"mutedPeers":[]}');
    } catch {
      // ignore
    }
    const acceptedPeers = Array.from(new Set([...(parsed.acceptedPeers ?? []), peer]));
    const next = JSON.stringify({
      ...parsed,
      acceptedPeers,
      mutedPeers: parsed.mutedPeers ?? [],
    });
    localStorage.setItem(key, next);
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: next }));
    return acceptedPeers.includes(peer);
  }, {
    owner: String(ownerPublicKeyHex).toLowerCase(),
    peer: String(peerPublicKeyHex).toLowerCase(),
  });
}

/** Ensure Soft L3 lab pool is agreed-path only (avoid S1 remote-first starving localhost). */
async function ensureAgreedRelayEnabled(page, label) {
  const patched = await page.evaluate((agreedPath) => {
    const keys = Object.keys(localStorage).filter((k) => /obscur\.relay_list\.v2\./i.test(k));
    let touched = 0;
    // Soft L3 lab: sole-enabled agreed path so publish/subscribe intersect on localhost.
    const labList = [{ url: agreedPath, enabled: true }];
    if (keys.length === 0) {
      const session = window.obscurWindowRuntime?.getSnapshot?.()?.session;
      const pk = session?.unlockedPublicKeyHex;
      const profileId = session?.profileId ?? "default";
      if (pk) {
        const key = `obscur.relay_list.v2.${pk}::${profileId}`;
        localStorage.setItem(key, JSON.stringify(labList));
        touched = 1;
      }
    } else {
      for (const key of keys) {
        try {
          localStorage.setItem(key, JSON.stringify(labList));
          touched += 1;
        } catch {
          // ignore
        }
      }
    }
    window.dispatchEvent(new Event("obscur:operator-trust-config-changed"));
    return { touched, keys: keys.length, labOnly: true };
  }, AGREED_PATH);
  log(`${label} agreed-relay patch ${JSON.stringify(patched)}`);

  const deadline = Date.now() + 30_000;
  let probe = await readRelayProbe(page);
  while (Date.now() < deadline && probe.writable < 1) {
    const retry = page.getByRole("button", { name: /^retry$/i }).first();
    if (await retry.isVisible().catch(() => false)) {
      await retry.click().catch(() => undefined);
    }
    await page.waitForTimeout(2_000);
    probe = await readRelayProbe(page);
  }
  log(`${label} relay probe writable=${probe.writable} hasAgreed=${probe.hasAgreedInEnabled} phase=${probe.phase}`);
  return probe;
}

async function readPublishEvidence(page) {
  return page.evaluate(() => {
    const snap = window.obscurRelayRuntime?.getSnapshot?.() ?? {};
    return {
      lastSuccessfulPublishAtUnixMs: snap.lastSuccessfulPublishAtUnixMs ?? null,
      writable: snap.writableRelayCount ?? 0,
      phase: snap.phase ?? null,
      pendingOutbound: snap.pendingOutboundCount ?? snap.pendingOutbound ?? null,
    };
  }).catch(() => ({
    lastSuccessfulPublishAtUnixMs: null,
    writable: 0,
    phase: null,
    pendingOutbound: null,
  }));
}

async function openPeerFromShell(page, peerName, peerPublicKeyHex, friendCode) {
  log(`Shell peer open for ${peerName} / ${String(peerPublicKeyHex).slice(0, 8)}…`);
  await openChats(page);
  await page.waitForTimeout(1_500);
  if (await openPeerThread(page, peerName)) {
    const compose = page.getByPlaceholder(/type a (private )?message/i)
      .or(page.locator("textarea").first());
    if (await compose.first().isVisible().catch(() => false)) {
      log(`Shell peer open via name ${peerName}`);
      return true;
    }
  }
  const hexPrefix = String(peerPublicKeyHex).slice(0, 8);
  const byHex = page.getByText(new RegExp(hexPrefix, "i")).first();
  if (await byHex.isVisible().catch(() => false)) {
    await byHex.click().catch(() => undefined);
    await page.waitForTimeout(1_500);
    const compose = page.getByPlaceholder(/type a (private )?message/i)
      .or(page.locator("textarea").first());
    if (await compose.first().isVisible().catch(() => false)) {
      log(`Shell peer open via hex prefix ${hexPrefix}`);
      return true;
    }
  }

  // Search users (no hard /network — preserves Edge unlock).
  const searchQueries = [
    String(peerPublicKeyHex),
    hexPrefix,
    friendCode,
    peerName,
  ].filter((value) => typeof value === "string" && value.trim().length > 0);
  const search = page.getByPlaceholder(/search users|search/i).first();
  if (await search.isVisible().catch(() => false)) {
    for (const query of searchQueries) {
      await search.click();
      await search.fill("");
      await search.fill(query);
      await page.waitForTimeout(2_500);
      const hit = page.getByText(new RegExp(peerName, "i")).first()
        .or(page.getByText(new RegExp(hexPrefix, "i")).first())
        .or(page.getByText(new RegExp(String(friendCode || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")).first());
      if (await hit.isVisible().catch(() => false)) {
        await hit.click().catch(() => undefined);
        await page.waitForTimeout(1_200);
        const messageBtn = page.getByRole("button", { name: /^Message$/i }).first();
        if (await messageBtn.isVisible().catch(() => false)) {
          await messageBtn.click().catch(() => undefined);
          await page.waitForTimeout(1_500);
        }
        const compose = page.getByPlaceholder(/type a (private )?message/i)
          .or(page.locator("textarea").first());
        if (await compose.first().isVisible().catch(() => false)) {
          log(`Shell peer open via search query=${query.slice(0, 16)}`);
          return true;
        }
      }
    }
  }

  // Network rail (people icon) — stay in SPA without hard reload.
  const networkRail = page.getByRole("button", { name: /^network$/i }).first()
    .or(page.getByRole("link", { name: /^network$/i }).first());
  if (await networkRail.isVisible().catch(() => false)) {
    await networkRail.click().catch(() => undefined);
    await page.waitForTimeout(1_500);
    const peer = page.getByText(new RegExp(peerName, "i")).first()
      .or(page.getByText(new RegExp(hexPrefix, "i")).first());
    if (await peer.isVisible().catch(() => false)) {
      await peer.click().catch(() => undefined);
      await page.waitForTimeout(1_000);
      const messageBtn = page.getByRole("button", { name: /^Message$/i }).first();
      if (await messageBtn.isVisible().catch(() => false)) {
        await messageBtn.click().catch(() => undefined);
        await page.waitForTimeout(1_500);
      }
    }
    const compose = page.getByPlaceholder(/type a (private )?message/i)
      .or(page.locator("textarea").first());
    if (await compose.first().isVisible().catch(() => false)) {
      log(`Shell peer open via Network rail`);
      return true;
    }
  }

  // Do NOT hard-nav or soft-nav to /network — Edge drops unlock.
  log(`Shell peer open failed for ${peerName}`);
  await page.screenshot({
    path: path.join(repoRoot, "test-results", "s-pool-l3-tester2-shell-peer-fail.png"),
    fullPage: true,
  }).catch(() => undefined);
  return false;
}

async function ensureLocalAgreedRelayHint(page) {
  // Best-effort: open Relays so pool dials; runtime may already include localhost from defaults.
  await openRelaysSettings(page).catch(() => undefined);
  await page.waitForTimeout(1_000);
}

async function launchBrowser(chromium) {
  const channel = process.env.OBSCUR_PLAYWRIGHT_CHANNEL
    ?? (process.platform === "win32" ? "msedge" : undefined);
  try {
    return await chromium.launch({
      headless: true,
      ...(channel ? { channel } : {}),
    });
  } catch (firstError) {
    log(`channel launch failed (${channel ?? "default"}): ${firstError instanceof Error ? firstError.message : String(firstError)}`);
    return chromium.launch({ headless: true });
  }
}

async function probeLocalRelayPort() {
  if (!isLocalUrl(AGREED_PATH)) {
    return { required: false, ok: true, detail: "non-local agreed path — skip TCP probe" };
  }
  const ok = await isHttpReachable("http://127.0.0.1:7000/", 1_000).catch(() => false);
  // Many lab relays answer only on WS; treat any TCP accept via fetch failure+connect as unknown.
  // Prefer a cheap TCP check via fetch to the HTTP upgrade port — if refused, mark down.
  try {
    const net = await import("node:net");
    const reachable = await new Promise((resolve) => {
      const socket = net.createConnection({ host: "127.0.0.1", port: 7000 });
      const done = (value) => {
        socket.destroy();
        resolve(value);
      };
      socket.setTimeout(1_000);
      socket.on("connect", () => done(true));
      socket.on("timeout", () => done(false));
      socket.on("error", () => done(false));
    });
    return {
      required: true,
      ok: reachable,
      detail: reachable ? "localhost:7000 accepting TCP" : "localhost:7000 not accepting TCP",
      httpProbeOk: ok,
    };
  } catch (error) {
    return {
      required: true,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runPreflight() {
  const resolved = await resolvePlaywrightAppBase();
  const cdpA = await isCdpReachable(CDP);
  const cdpB = await isCdpReachable(CDP_B);
  const appOk = await isHttpReachable(resolved.appBase);
  const relay = await probeLocalRelayPort();
  const ok = cdpA && appOk && (!relay.required || relay.ok);
  const report = {
    atUnixMs: Date.now(),
    mode: "preflight",
    recipe: "specs/backend/soft-l3-automation-track-a-design-2026-08.md",
    softL3Recipe: "specs/backend/relay-pool-delivery-l3-soft-recipe-2026-08.md",
    cdp: { url: CDP, ok: cdpA },
    cdpB: { url: CDP_B, ok: cdpB, optional: true },
    appBase: { ...resolved, httpOk: appOk },
    agreedRelay: { url: AGREED_PATH, ...relay },
    ok,
    agentRecipe: ok
      ? "Preflight green — run pnpm verify:s-pool-delivery-l3 (no maintainer dual-window required)"
      : [
          !cdpA ? `Start desktop with CDP ${CDP} (pnpm dev:desktop:online)` : null,
          !appOk ? `App base unreachable (${resolved.appBase}) — rebuild static shell or set PLAYWRIGHT_BASE_URL` : null,
          relay.required && !relay.ok ? "Start lab relay :7000 (pnpm dev:relay:lab or docker)" : null,
          !cdpB ? `Optional: open profile-2 CDP ${CDP_B} (Edge fallback used when missing)` : null,
        ].filter(Boolean),
  };
  const outPath = path.join(repoRoot, "test-results", `s-pool-delivery-l3-preflight-${today}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  log(`Preflight report: ${outPath}`);
  log(`preflight.ok=${ok} cdpA=${cdpA} cdpB=${cdpB} app=${resolved.appBase}(${resolved.source}) relay=${relay.detail}`);
  if (!ok) {
    for (const line of report.agentRecipe) {
      log(`recipe: ${line}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

async function main() {
  if (PREFLIGHT_ONLY) {
    await runPreflight();
    return;
  }

  const { chromium } = loadPlaywright();
  const resolvedApp = await resolvePlaywrightAppBase();
  APP_BASE = resolvedApp.appBase;
  if (ALLOW_RECEIVE_WITHOUT_ACK) {
    log("WARNING: OBSCUR_SOFT_L3_ALLOW_RECEIVE_WITHOUT_ACK=1 — F-ACK not required for Pass");
  }
  const rows = {
    A_pathHonesty: { pass: false, detail: "" },
    B_twoProfileDm: { pass: false, detail: "", blocked: false },
    C_cmScopedHint: { pass: false, detail: "" },
  };
  const marker = `${MARKER_PREFIX}-${Date.now().toString(36)}`;
  let fatalError = null;
  let cdpBrowser = null;
  let cdpBrowserB = null;
  let edgeBrowser = null;
  let pageA = null;
  let pageB = null;
  let tester2ViaCdp = false;

  try {
    log(`CDP ${CDP} · CDP_B ${CDP_B} · app ${APP_BASE} (${resolvedApp.source}) · agreed ${AGREED_PATH}`);
    cdpBrowser = await chromium.connectOverCDP(CDP);
    pageA = await waitForAppPageFromBrowser(cdpBrowser, {
      appBase: APP_BASE,
      timeoutMs: 30_000,
    });
    if (!pageA) {
      throw new Error(formatNoObscurPageError(cdpBrowser, CDP));
    }
    log(`Attached Tester1 CDP: ${pageA.url()}`);
    const sessionProbeA = await readShellSessionProbe(pageA);
    log(`Tester1 session probe ${JSON.stringify(sessionProbeA)}`);
    // stored_locked + interactive chrome: soft-home to recover native unlock (profiles → Sign in).
    if (
      sessionProbeA.identityStatus === "locked"
      || sessionProbeA.phase === "auth_required"
    ) {
      log("Tester1 session locked — soft-nav / to recover native unlock / profile picker");
      await pageA.evaluate((url) => { window.location.assign(url); }, `${APP_BASE}/`).catch(() => undefined);
      await pageA.waitForTimeout(2_500);
      await enterMessengerFromProfilePicker(pageA, { log });
    }
    const publishLogs = [];
    pageA.on("console", async (msg) => {
      let serialized = msg.text();
      try {
        const values = await Promise.all(
          msg.args().map(async (arg) => {
            try {
              return await arg.jsonValue();
            } catch {
              return undefined;
            }
          }),
        );
        const detail = values.find((value) => value && typeof value === "object");
        if (detail) {
          serialized = `${String(values[0] ?? serialized)} ${JSON.stringify(detail)}`;
        }
      } catch {
        // keep msg.text()
      }
      if (/\[dm-relay-transport\]|\[dm-send\]|publishToUrls|local agreed-path|ok_timeout|relay_not_connected/i.test(serialized)) {
        publishLogs.push(serialized.slice(0, 500));
        log(`consoleA ${serialized.slice(0, 320)}`);
      }
    });
    await applyDevOperatorBundle(pageA);
    await enterMessengerFromProfilePicker(pageA, { log });
    if (!(await isShell(pageA))) {
      log("Tester1 not unlocked — unlocking via auth UI / import key…");
      await ensureTester1Unlocked(pageA, { log, timeoutMs: 120_000 });
    }
    if (!(await isShell(pageA))) {
      await enterMessengerFromProfilePicker(pageA, { log });
    }
    if (!(await isShell(pageA))) {
      throw new Error("Tester1 shell not unlocked on CDP after unlock attempt");
    }
    log("Tester1 shell OK");
    {
      const after = await readShellSessionProbe(pageA);
      if (after.identityStatus && after.identityStatus !== "unlocked") {
        log(`WARNING: UI shell OK but session snapshot still ${after.identityStatus}/${after.phase} (native rehydrate divergence)`);
      }
    }
    // Hard reload so transport-kernel / mesh pool pick up agent diffs (avoids disposed HMR client).
    // Skip reload when already interactive — reload can drop native keychain session into a false auth gate.
    const skipReload = process.env.OBSCUR_SOFT_L3_SKIP_RELOAD === "1"
      || (sessionProbeA.identityStatus === "locked" && sessionProbeA.phase === "auth_required");
    if (skipReload) {
      log("Skipping hard reload (interactive shell with locked session snapshot)");
    } else {
      await pageA.reload({ waitUntil: "domcontentloaded" }).catch(() => undefined);
      await pageA.waitForTimeout(2_500);
      if (!(await isShell(pageA))) {
        await ensureTester1Unlocked(pageA, { log, timeoutMs: 90_000 });
      }
    }
    await ensureAgreedRelayEnabled(pageA, "Tester1");

    // Row A — path honesty (wait for lab dial after settings hop; pool may briefly drop)
    let probe = { writable: 0, hasAgreedInEnabled: false, enabled: [], openRemoteHint: false, localOnlyPublish: false };
    try {
      await openRelaysSettings(pageA);
      probe = await readRelayProbe(pageA);
      const pollDeadline = Date.now() + 60_000;
      while (Date.now() < pollDeadline && probe.writable < 1) {
        if (!(await isShell(pageA))) {
          log("Tester1 left shell during Row A wait — re-unlocking…");
          await ensureTester1Unlocked(pageA, { log, timeoutMs: 60_000 });
          await ensureAgreedRelayEnabled(pageA, "Tester1-rowA-reunlock");
          await openRelaysSettings(pageA).catch(() => undefined);
        }
        const retry = pageA.getByRole("button", { name: /^retry$/i }).first();
        if (await retry.isVisible().catch(() => false)) {
          await retry.click().catch(() => undefined);
        }
        await pageA.waitForTimeout(2_500);
        probe = await readRelayProbe(pageA).catch(() => probe);
      }
      // Re-assert Soft L3 lab pool if settings UI re-enabled public remotes.
      if (!probe.hasAgreedInEnabled || (probe.enabled?.length ?? 0) > 1) {
        await ensureAgreedRelayEnabled(pageA, "Tester1-rowA");
        probe = await readRelayProbe(pageA).catch(() => probe);
      }
    } catch (rowAError) {
      log(`Row A probe interrupted: ${rowAError instanceof Error ? rowAError.message : String(rowAError)}`);
      await ensureTester1Unlocked(pageA, { log, timeoutMs: 60_000 }).catch(() => undefined);
      await ensureAgreedRelayEnabled(pageA, "Tester1-rowA-recover");
      probe = await readRelayProbe(pageA).catch(() => probe);
    }

    const pathHonestyOk = probe.writable >= 1
      && (probe.hasAgreedInEnabled || isLocalUrl(AGREED_PATH))
      && (
        !probe.openRemoteHint
        || !probe.localOnlyPublish
        || probe.publishPathHosts === "none"
        || probe.publishPathHosts === "none open"
      );

    rows.A_pathHonesty = {
      pass: Boolean(pathHonestyOk),
      detail: pathHonestyOk
        ? `writable=${probe.writable} publishPath=${probe.publishPathLine ?? "n/a"}`
        : `path honesty weak: writable=${probe.writable} enabled=${JSON.stringify(probe.enabled)} publishPath=${probe.publishPathLine}`,
      probe,
    };
    log(`Row A: pass=${rows.A_pathHonesty.pass} ${rows.A_pathHonesty.detail}`);

    rows.C_cmScopedHint = {
      pass: Boolean(probe.bodyHasCmScopedHint || probe.bodyHasPublishPath),
      detail: probe.bodyHasCmScopedHint
        ? "community scoped-store / candidates copy visible"
        : (probe.bodyHasPublishPath
          ? "publish path visible (expand Relays community for full S4 copy)"
          : "scoped hint not found on Relays surface"),
    };
    log(`Row C: pass=${rows.C_cmScopedHint.pass} ${rows.C_cmScopedHint.detail}`);

    let unlockMethod = "unknown";
    // Row B — prefer Tauri profile CDP :9231 (Edge unlock/reunlock flakes).
    if (await isCdpReachable(CDP_B)) {
      log(`Attaching Tester2 CDP ${CDP_B}…`);
      cdpBrowserB = await chromium.connectOverCDP(CDP_B);
      pageB = await waitForAppPageFromBrowser(cdpBrowserB, {
        appBase: APP_BASE,
        timeoutMs: 30_000,
      });
      if (!pageB) {
        throw new Error(formatNoObscurPageError(cdpBrowserB, CDP_B));
      }
      tester2ViaCdp = true;
      log(`Attached Tester2 CDP: ${pageB.url()}`);
      await applyDevOperatorBundle(pageB);
      if (!(await isShell(pageB))) {
        log("Tester2 CDP not unlocked — unlocking via import key…");
        const unlock2 = await unlockTester2ViaImportKey(pageB);
        if (!unlock2.ok) {
          rows.B_twoProfileDm = {
            pass: false,
            blocked: true,
            detail: `Tester2 CDP unlock failed: ${unlock2.reason}`,
          };
          log(`Row B: BLOCKED ${rows.B_twoProfileDm.detail}`);
          return;
        }
        unlockMethod = unlock2.method ?? "cdp_import";
        log(`Tester2 CDP unlocked via ${unlockMethod}`);
      } else {
        unlockMethod = "cdp_already_unlocked";
        log("Tester2 CDP already unlocked");
      }
    } else {
      log(`CDP_B ${CDP_B} unreachable — launching Edge Tester2 context (flaky)…`);
      edgeBrowser = await launchBrowser(chromium);
      const contextB = await edgeBrowser.newContext({ baseURL: APP_BASE });
      pageB = await contextB.newPage();
      await pageB.goto("/");
      await pageB.waitForLoadState("domcontentloaded").catch(() => undefined);
      await applyDevOperatorBundle(pageB);
      await pageB.waitForTimeout(1_500);
      const unlock2 = await unlockTester2ViaImportKey(pageB);
      if (!unlock2.ok) {
        rows.B_twoProfileDm = {
          pass: false,
          blocked: true,
          detail: `Tester2 unlock failed: ${unlock2.reason} url=${unlock2.url ?? pageB.url()} hint=${(unlock2.bodyHint ?? "").slice(0, 120)}`,
        };
        log(`Row B: BLOCKED ${rows.B_twoProfileDm.detail}`);
        return;
      }
      unlockMethod = unlock2.method ?? "edge_import";
      log(`Tester2 unlocked via ${unlockMethod}`);
    }
    // Import / native rehydrate may leave identityStatus=locked while UI shell is interactive.
    const unlockDeadline = Date.now() + 45_000;
    while (Date.now() < unlockDeadline) {
      if (await isShell(pageB)) {
        const probe = await pageB.evaluate(() => ({
          identityStatus: window.obscurWindowRuntime?.getSnapshot?.()?.session?.identityStatus ?? null,
          unlockedHex: window.obscurWindowRuntime?.getSnapshot?.()?.session?.unlockedPublicKeyHex?.slice?.(0, 8) ?? null,
          nsecVisible: Boolean(document.querySelector('input[placeholder*="nsec"]')),
        })).catch(() => ({ identityStatus: null, unlockedHex: null, nsecVisible: true }));
        if (!probe.nsecVisible) {
          break;
        }
      }
      const pw = pageB.locator('input[type="password"]').first();
      if (await pw.isVisible().catch(() => false)) {
        await pw.fill(TESTER2_DEVICE_PASSWORD).catch(() => undefined);
        await pageB.getByRole("button", { name: /unlock|continue|open/i }).first().click().catch(() => undefined);
      }
      await pageB.waitForTimeout(1_500);
    }
    const shellProbe = await pageB.evaluate(() => ({
      url: location.href,
      identityStatus: window.obscurWindowRuntime?.getSnapshot?.()?.session?.identityStatus ?? null,
      unlockedHex: window.obscurWindowRuntime?.getSnapshot?.()?.session?.unlockedPublicKeyHex?.slice?.(0, 8) ?? null,
      nsecVisible: Boolean(document.querySelector('input[placeholder*="nsec"]')),
      bodyHint: (document.body?.innerText ?? "").slice(0, 160),
    }));
    log(`Tester2 shellProbe ${JSON.stringify(shellProbe)}`);
    const tester2ShellOk = await isShell(pageB);
    if (!tester2ShellOk || shellProbe.nsecVisible) {
      rows.B_twoProfileDm = {
        pass: false,
        blocked: true,
        detail: `Tester2 unlock false-positive: ${JSON.stringify(shellProbe)}`,
      };
      log(`Row B: BLOCKED ${rows.B_twoProfileDm.detail}`);
      return;
    }
    if (shellProbe.identityStatus !== "unlocked") {
      log(`WARNING: Tester2 UI shell OK but session snapshot still ${shellProbe.identityStatus}`);
    }
    // Wait for account restore / shell rail before peer open.
    const restoreDeadline = Date.now() + 45_000;
    while (Date.now() < restoreDeadline) {
      const restored = await pageB.evaluate(() => {
        const sync = window.obscurWindowRuntime?.getSnapshot?.()?.accountSync
          ?? window.obscurAccountSyncRuntime?.getSnapshot?.();
        const phase = sync?.phase ?? sync?.accountSyncPhase ?? null;
        const writable = window.obscurRelayRuntime?.getSnapshot?.()?.writableRelayCount ?? 0;
        return { phase, writable };
      }).catch(() => ({ phase: null, writable: 0 }));
      if ((restored.phase === "ready" || restored.writable >= 1)
        && (await pageB.getByRole("button", { name: /^Chats$/i }).isVisible().catch(() => false)
          || await pageB.getByRole("link", { name: /^chats$/i }).isVisible().catch(() => false))) {
        break;
      }
      await pageB.waitForTimeout(1_500);
    }
    await pageB.waitForTimeout(2_000);

    const pubkeyA = (await readMyPubkey(pageA)) ?? TESTER1_PUBKEY;
    const pubkeyB = (await readMyPubkey(pageB)) ?? TESTER2_PUBKEY;
    log(`pubkeys A=${pubkeyA.slice(0, 8)} B=${pubkeyB.slice(0, 8)}`);

    // Agreed path on Tester2 before DM (screenshot Offline 0/1 = no writable).
    await ensureAgreedRelayEnabled(pageB, "Tester2");

    // Mutual accepted peer — blocks stranger_dm_blocked on receive.
    const seededB = await seedAcceptedPeer(pageB, pubkeyB, pubkeyA);
    const seededA = await seedAcceptedPeer(pageA, pubkeyA, pubkeyB);
    log(`peer_trust seeded A=${seededA} B=${seededB}`);

    // Open Tester2→Tester1 while session is unlocked.
    // Edge: softOnly (hard goto → lock). Tauri CDP profile: hard nav OK.
    let openedB = await openPeerFromShell(pageB, "Tester1", pubkeyA, TESTER1_FRIEND_CODE);
    if (!openedB) {
      openedB = await openPeerByPubkey(pageB, pubkeyA, {
        reunlock: false,
        softOnly: !tester2ViaCdp,
        peerName: "Tester1",
      });
    }
    if (!openedB) {
      log(tester2ViaCdp
        ? "Tester2 CDP compose not open — will poll during receive"
        : "Tester2 compose not open — will poll chats during receive (no reunlock)");
      await openChats(pageB);
    } else {
      log("Tester2 compose open before send — receive path ready");
    }

    // Then Tester1 compose (CDP/Tauri stays unlocked across hard nav).
    let openedA = await openPeerByPubkey(pageA, pubkeyB, { peerName: "Tester2" });
    if (!openedA) {
      await openChats(pageA);
      openedA = await openPeerThread(pageA, "Tester2")
        || await openPeerByPubkey(pageA, TESTER2_PUBKEY, { peerName: "Tester2" });
    }
    if (!openedA) {
      rows.B_twoProfileDm = {
        pass: false,
        blocked: true,
        detail: `Tester1 compose missing (A=${openedA}) — accept Tester1↔Tester2 then re-run`,
      };
      log(`Row B: BLOCKED ${rows.B_twoProfileDm.detail}`);
      return;
    }

    await seedSendCeremonyAck(pageA, pubkeyB);
    await pageA.waitForTimeout(500);
    const send = await sendMarkerViaCompose(pageA, marker);
    log(`Tester1 send ${JSON.stringify(send)}`);
    if (!send.ok && send.reason === "compose_missing") {
      // One recovery: re-open Tester2 thread on A and retry once.
      openedA = await openPeerByPubkey(pageA, pubkeyB, { peerName: "Tester2" });
      const retrySend = openedA ? await sendMarkerViaCompose(pageA, marker) : send;
      if (!retrySend.ok) {
        rows.B_twoProfileDm = {
          pass: false,
          blocked: true,
          detail: "compose_missing on Tester1",
        };
        log(`Row B: BLOCKED ${rows.B_twoProfileDm.detail}`);
        return;
      }
      Object.assign(send, retrySend);
    }
    if (!send.ok) {
      rows.B_twoProfileDm = {
        pass: false,
        blocked: send.reason === "compose_disabled" || send.reason === "send_ceremony_blocking",
        detail: `Tester1 send failed: ${send.reason}`,
        marker,
        send,
      };
      log(`Row B: ${rows.B_twoProfileDm.blocked ? "BLOCKED" : "FAIL"} ${rows.B_twoProfileDm.detail}`);
      return;
    }

    // Wait briefly for Phase-2 publish OK (D2) before calling receive Fail.
    let publishEvidence = await readPublishEvidence(pageA);
    const publishDeadline = Date.now() + 20_000;
    while (
      Date.now() < publishDeadline
      && publishEvidence.lastSuccessfulPublishAtUnixMs == null
    ) {
      await pageA.waitForTimeout(1_000);
      publishEvidence = await readPublishEvidence(pageA);
    }
    log(`Tester1 publish evidence ${JSON.stringify(publishEvidence)}`);
    const sendSideDiag = await pageA.evaluate((markerText) => {
      const relay = window.obscurRelayRuntime?.getSnapshot?.() ?? null;
      const recent = window.obscurAppEvents?.getRecent?.(100) ?? [];
      const messaging = recent.filter((e) => (
        /dm-send|delivery|publish|messaging\.|relay\./i.test(String(e?.name ?? ""))
      ));
      return {
        markerInBody: (document.body?.innerText ?? "").includes(markerText),
        relayWritable: relay?.writableRelayCount ?? null,
        relayPhase: relay?.phase ?? null,
        lastPublish: relay?.lastSuccessfulPublishAtUnixMs ?? null,
        messagingEvents: messaging.slice(-12).map((e) => ({
          name: e.name,
          level: e.level,
          ctx: e.context,
        })),
      };
    }, marker).catch((err) => ({ error: String(err) }));
    log(`Tester1 send-side diag ${JSON.stringify(sendSideDiag)}`);
    log(
      publishLogs.length > 0
        ? `Tester1 publish console (${publishLogs.length}): ${publishLogs.slice(-8).join(" | ")}`
        : "Tester1 publish console: (none captured)",
    );
    rows.B_twoProfileDm.sendSideDiag = sendSideDiag;

    const publishAckFromLogs = publishLogs.some((line) => (
      /\[dm-send\] confirmed/.test(line) && /"success"\s*:\s*true/.test(line)
    ));
    const publishAck = publishEvidence.lastSuccessfulPublishAtUnixMs != null || publishAckFromLogs;

    // Receive window: never reunlock Edge Tester2 (timeout_after_import flake).
    // Prefer shell/friend-code while session stays unlocked; poll body for marker.
    const received = await (async () => {
      const deadline = Date.now() + 45_000;
      while (Date.now() < deadline) {
        if (!openedB) {
          openedB = await openPeerFromShell(pageB, "Tester1", pubkeyA, TESTER1_FRIEND_CODE);
          if (!openedB) {
            openedB = await openPeerByPubkey(pageB, pubkeyA, {
              reunlock: false,
              softOnly: true,
              peerName: "Tester1",
            });
          }
        }
        if (await pageB.getByText(marker).first().isVisible().catch(() => false)) {
          return true;
        }
        const bodyHit = await pageB.evaluate((m) => (document.body?.innerText ?? "").includes(m), marker);
        if (bodyHit) {
          return true;
        }
        await pageB.waitForTimeout(1_500);
      }
      return false;
    })();
    rows.B_twoProfileDm = {
      pass: received && (publishAck || ALLOW_RECEIVE_WITHOUT_ACK),
      received,
      blocked: !received && !openedB && publishAck,
      detail: !received
        ? `Tester2 did not observe ${marker} within 45s (send=${send.reason}, threadOpen=${openedB}, publishAck=${publishAck})`
        : (!publishAck && !ALLOW_RECEIVE_WITHOUT_ACK
          ? `Tester2 received ${marker} but publish ACK missing (F-ACK) (threadOpen=${openedB})`
          : `Tester2 received ${marker} within 45s (threadOpen=${openedB}, publishAck=${publishAck})`),
      marker,
      send,
      publishEvidence,
      publishAck,
      fAck: publishAck,
      failClass: !received
        ? "F-RECV"
        : (!publishAck && !ALLOW_RECEIVE_WITHOUT_ACK ? "F-ACK" : null),
      publishLogs: publishLogs.slice(-12),
      unlockMethod,
      tester2ViaCdp,
      openedB,
    };
    log(`Row B: pass=${rows.B_twoProfileDm.pass} ${rows.B_twoProfileDm.detail}`);
  } catch (error) {
    fatalError = error instanceof Error ? error.message : String(error);
    log(`FATAL: ${fatalError}`);
  } finally {
    const blocked = rows.B_twoProfileDm.blocked === true || Boolean(fatalError);
    const publishAckOk = rows.B_twoProfileDm.publishAck === true || ALLOW_RECEIVE_WITHOUT_ACK;
    const pass = !fatalError
      && rows.A_pathHonesty.pass
      && rows.B_twoProfileDm.pass
      && publishAckOk
      && !rows.B_twoProfileDm.blocked;

    const report = {
      atUnixMs: Date.now(),
      recipe: "specs/backend/relay-pool-delivery-l3-soft-recipe-2026-08.md",
      automationDesign: "specs/backend/soft-l3-automation-track-a-design-2026-08.md",
      agreedRelayUrl: AGREED_PATH,
      appBase: APP_BASE,
      appBaseSource: resolvedApp.source,
      cdp: CDP,
      cdpB: tester2ViaCdp ? CDP_B : null,
      accounts: { a: TESTER1.username, b: TESTER2.username },
      rows,
      fatalError,
      failClass: rows.B_twoProfileDm.failClass ?? null,
      fAck: rows.B_twoProfileDm.fAck ?? false,
      l3: {
        pass,
        soft: true,
        blocked,
        claim: pass
          ? "Soft L3 Pass — two-profile DM on agreed path + publish ACK (not public Nostr SLA; not Dev Lab)"
          : (fatalError
            ? `Soft L3 Blocked — ${fatalError}`
            : (rows.B_twoProfileDm.blocked
              ? `Soft L3 Blocked — ${rows.B_twoProfileDm.detail}`
              : `Soft L3 Fail — ${rows.B_twoProfileDm.failClass ?? "see rows"}`)),
      },
      forbidden: ["dev_lab_synthetic", "COM-RUN", "public_nostr_sla"],
    };

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`Report: ${reportPath}`);
    log(`l3.pass=${pass} blocked=${blocked} fAck=${report.fAck} failClass=${report.failClass ?? "none"}`);

    await edgeBrowser?.close().catch(() => undefined);
    // Do not close CDP browsers — they own the live desktop sessions.
    // CDP Playwright connections keep the event loop alive — always exit.

    if (blocked) {
      process.exit(2);
    }
    if (!pass) {
      process.exit(1);
    }
    process.exit(0);
  }
}

main().catch((error) => {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
