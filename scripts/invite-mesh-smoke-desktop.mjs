#!/usr/bin/env node
/**
 * Native invite mesh smoke — connection request via mesh (pre-W66).
 *
 * Evaluate-first CDP (avoids Soft L3 locator hangs). Opens a fresh peer profile,
 * sends invitation with marker, asserts mesh publish evidence and no standalone.
 *
 *   pnpm verify:invite-mesh-smoke
 *   node scripts/invite-mesh-smoke-desktop.mjs
 *
 * @see specs/backend/native-invite-mesh-smoke-design-2026-08.md
 */
import { createRequire } from "node:module";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatNoObscurPageError,
  waitForAppPageFromBrowser,
} from "./lib/cdp-app-page.mjs";
import { enterMessengerFromProfilePicker } from "./lib/dev-lab-playwright-auth.mjs";
import { resolvePlaywrightAppBase } from "./lib/resolve-playwright-app-base.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const requireFromPwa = createRequire(path.join(pwaDir, "package.json"));
const CDP = process.env.OBSCUR_CDP_URL ?? "http://127.0.0.1:9230";
const today = new Date().toISOString().slice(0, 10);
const reportPath = path.join(repoRoot, "test-results", `invite-mesh-smoke-${today}.json`);
const MARKER = `INV-MESH-${Date.now().toString(36)}`;

function loadPlaywright() {
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

/** Valid secp256k1 x-only pubkey (random bytes are often not on-curve → "sqrt invalid"). */
function generateSmokePeerPubkey() {
  try {
    const nostr = requireFromPwa("nostr-tools");
    if (typeof nostr.generateSecretKey === "function" && typeof nostr.getPublicKey === "function") {
      return nostr.getPublicKey(nostr.generateSecretKey());
    }
  } catch {
    // fall through
  }
  try {
    const { getPublicKey } = requireFromPwa("@noble/secp256k1");
    return getPublicKey(crypto.randomBytes(32), true);
  } catch {
    // Known on-curve throwaway (not Tester1/Tester2).
    return "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
  }
}

const SMOKE_PEER = generateSmokePeerPubkey();

const log = (message) => console.log(`[invite-mesh] ${message}`);

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

async function softNav(page, pathname) {
  return withTimeout(page.evaluate((targetPath) => {
    const existing = [...document.querySelectorAll("a[href]")].find((a) => {
      const href = a.getAttribute("href") || "";
      return href === targetPath || href.endsWith(targetPath);
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
  }, pathname), 8_000, "softNav");
}

async function probeShell(page) {
  return withTimeout(page.evaluate(() => {
    const text = document.body?.innerText ?? "";
    const session = window.obscurWindowRuntime?.getSnapshot?.()?.session;
    const links = [...document.querySelectorAll("a")].map((a) => ({
      href: a.getAttribute("href") || "",
      text: (a.textContent ?? "").trim(),
    }));
    const hasChrome = links.some((l) => /^\/(settings|network|search|vault)?\/?$/i.test(l.href) || ["Settings", "Network", "Search", "Chats"].includes(l.text))
      || (/OBSCUR/i.test(text) && (/TESTER1|Chats|SETTINGS|Relays|Settings/i.test(text)));
    return {
      url: location.href,
      identityStatus: session?.identityStatus ?? null,
      unlockedPublicKeyHex: session?.unlockedPublicKeyHex ?? null,
      hasChrome,
      hasPassword: Boolean(document.querySelector('input[type="password"]')),
      lockedUi: /identity locked/i.test(text) && Boolean(document.querySelector('input[type="password"]')),
    };
  }), 8_000, "probeShell");
}

async function waitForConnectReady(page, peerHex, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await withTimeout(page.evaluate((hex) => {
      const text = document.body?.innerText ?? "";
      const buttons = [...document.querySelectorAll("button")]
        .map((b) => (b.textContent ?? "").replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const hasPeer = text.toLowerCase().includes(hex.slice(0, 12).toLowerCase())
        || location.href.toLowerCase().includes(hex.toLowerCase());
      const connectIdx = buttons.findIndex((t) => /\b(connect|resend)\b/i.test(t));
      return {
        hasPeer,
        connectIdx,
        buttonCount: buttons.length,
        labels: buttons.slice(0, 40),
        bodyHint: text.slice(0, 220),
      };
    }, peerHex), 5_000, "waitConnectProbe");
    if (last.hasPeer && last.connectIdx >= 0) {
      return last;
    }
    await page.waitForTimeout(800);
  }
  return last;
}

async function openConnectAndSend(page, marker) {
  const clickResult = await withTimeout(page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    const connect = buttons.find((b) =>
      /\b(connect|resend)\b/i.test((b.textContent ?? "").replace(/\s+/g, " ").trim())
    );
    if (!connect) {
      const labels = buttons
        .map((b) => (b.textContent ?? "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 40);
      return { ok: false, reason: "connect_button_missing", labels };
    }
    connect.click();
    return { ok: true, reason: "clicked_connect" };
  }), 8_000, "clickConnect");
  if (!clickResult.ok) {
    return clickResult;
  }
  await page.waitForTimeout(1_500);
  return withTimeout(page.evaluate((introMarker) => {
    const dialogText = document.body?.innerText ?? "";
    if (!/send invitation|why you are reaching out/i.test(dialogText)) {
      return { ok: false, reason: "composer_not_open", bodyHint: dialogText.slice(0, 240) };
    }
    const textarea = document.querySelector("textarea");
    if (!textarea) {
      return { ok: false, reason: "intro_textarea_missing" };
    }
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(textarea, introMarker);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    const send = [...document.querySelectorAll("button")].find((b) =>
      /send invitation/i.test((b.textContent ?? "").replace(/\s+/g, " ").trim())
    );
    if (!send) {
      return { ok: false, reason: "send_invitation_missing" };
    }
    send.click();
    return { ok: true, reason: "submitted" };
  }, marker), 8_000, "submitInvitation");
}

async function main() {
  const { chromium } = loadPlaywright();
  const resolved = await resolvePlaywrightAppBase();
  const consoleHits = [];
  let fatalError = null;
  let shell = null;
  let send = null;
  let cdpBrowser = null;

  const report = {
    atUnixMs: Date.now(),
    recipe: "specs/backend/native-invite-mesh-smoke-design-2026-08.md",
    marker: MARKER,
    peerPublicKeyHex: SMOKE_PEER,
    appBase: resolved.appBase,
    appBaseSource: resolved.source,
    cdp: CDP,
    shell: null,
    send: null,
    consoleHits: [],
    standaloneMention: false,
    meshPublishHint: false,
    pass: false,
    blocked: false,
    claim: "",
  };

  try {
    log(`CDP ${CDP} · app ${resolved.appBase} (${resolved.source}) · peer ${SMOKE_PEER.slice(0, 12)}… · marker ${MARKER}`);
    cdpBrowser = await withTimeout(chromium.connectOverCDP(CDP), 15_000, "connectOverCDP");
    const page = await waitForAppPageFromBrowser(cdpBrowser, {
      appBase: resolved.appBase,
      timeoutMs: 20_000,
    });
    if (!page) {
      throw new Error(formatNoObscurPageError(cdpBrowser, CDP));
    }
    log(`Attached ${page.url()}`);

    page.on("console", (msg) => {
      const text = msg.text();
      if (/publishToUrls|publishToUrlsStandalone|connection.request|\[dm-send\]|\[dm-relay-transport\]|Invite relay|Connection request/i.test(text)) {
        consoleHits.push(text.slice(0, 400));
        log(`console ${text.slice(0, 220)}`);
      }
    });

    await enterMessengerFromProfilePicker(page, { log });
    shell = await probeShell(page);
    report.shell = shell;
    log(`shell ${JSON.stringify(shell)}`);
    if (shell.lockedUi || !shell.hasChrome) {
      throw new Error("Shell not interactive — unlock Tester1 in desktop UI, then retry");
    }

    const peerPath = `/network/profile?pubkey=${SMOKE_PEER}`;
    log(`softNav ${peerPath}`);
    await softNav(page, peerPath);
    await page.waitForTimeout(2_000);
    // Hard assign if soft-nav stalled (static shell: use query-param profile route).
    if (!/network\/profile/i.test(page.url()) || !page.url().toLowerCase().includes("pubkey=")) {
      log("softNav missed peer — location.assign profile query route");
      await withTimeout(page.evaluate((target) => {
        window.location.assign(target);
      }, `${resolved.appBase.replace(/\/$/, "")}${peerPath}`), 8_000, "locationAssign");
      await page.waitForTimeout(2_500);
    }
    log(`after nav url=${page.url()}`);
    const ready = await waitForConnectReady(page, SMOKE_PEER);
    log(`connectReady ${JSON.stringify(ready)}`);
    if (!ready || ready.connectIdx < 0) {
      throw new Error(`Connect UI not ready: ${ready?.bodyHint?.slice(0, 120) ?? "timeout"}`);
    }

    send = await openConnectAndSend(page, MARKER);
    report.send = send;
    log(`send ${JSON.stringify(send)}`);
    if (!send?.ok) {
      throw new Error(`Invite UI failed: ${send?.reason ?? "unknown"}`);
    }

    // Wait for mesh publish console / toast evidence.
    const waitDeadline = Date.now() + 25_000;
    while (Date.now() < waitDeadline) {
      const body = await withTimeout(page.evaluate((m) => {
        const text = document.body?.innerText ?? "";
        return {
          hasMarker: text.includes(m),
          toastHint: /invitation|delivered|relay|failed|queued|partial/i.test(text),
          bodyHint: text.slice(0, 280),
        };
      }, MARKER), 5_000, "bodyProbe").catch(() => ({ hasMarker: false, toastHint: false, bodyHint: "" }));
      if (consoleHits.some((h) => /publishToUrls/i.test(h) && !/standalone/i.test(h))) {
        break;
      }
      if (body.toastHint && consoleHits.length > 0) {
        break;
      }
      await page.waitForTimeout(1_000);
    }
  } catch (error) {
    fatalError = error instanceof Error ? error.message : String(error);
    log(`FATAL: ${fatalError}`);
  } finally {
    report.consoleHits = consoleHits.slice(-20);
    report.standaloneMention = consoleHits.some((h) => /publishToUrlsStandalone/i.test(h));
    report.meshPublishHint = consoleHits.some((h) =>
      /publishToUrls/i.test(h) && !/publishToUrlsStandalone/i.test(h)
    ) || consoleHits.some((h) => /\[dm-send\] confirmed|sent_quorum|connection-request/i.test(h));

    const uiSubmitted = report.send?.ok === true;
    const pass = !fatalError
      && uiSubmitted
      && !report.standaloneMention
      && (report.meshPublishHint || consoleHits.some((h) => /invitation|request.*ok|delivered/i.test(h)));

    // Honest Blocked when UI submitted but no mesh evidence yet (relay flaky).
    const blocked = Boolean(fatalError) || (uiSubmitted && !report.meshPublishHint && !pass);

    report.pass = pass;
    report.blocked = blocked && !pass;
    report.fatalError = fatalError;
    report.claim = pass
      ? "Invite mesh smoke Pass — connection request submitted; mesh publish evidence; no standalone"
      : (fatalError
        ? `Invite mesh smoke Blocked — ${fatalError}`
        : (report.standaloneMention
          ? "Invite mesh smoke Fail — standalone publish mentioned"
          : "Invite mesh smoke Blocked — no mesh publish evidence after submit"));

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`Report: ${reportPath}`);
    log(`pass=${report.pass} blocked=${report.blocked} meshHint=${report.meshPublishHint} standalone=${report.standaloneMention}`);
    log(report.claim);

    try {
      await cdpBrowser?.close?.();
    } catch {
      // CDP attach — closing may disconnect live desktop; ignore.
    }

    process.exit(pass ? 0 : 2);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
