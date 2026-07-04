/**
 * Resolve how dev-lab Playwright should attach: Next :3340, Tauri CDP, or static out/ serve.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { probeCdpObscurPage } from "./cdp-app-page.mjs";
import {
  freePwaDevPort,
  probePwaDevReady,
  PWA_DEV_URL,
} from "./dev-stack-probes.mjs";
import {
  isStaticShellDevLabMismatch,
  isStaticShellExperimentModeMismatch,
  isStaticShellStale,
} from "./static-shell-stale.mjs";

const DEFAULT_CDP_URL = "http://127.0.0.1:9222";

export async function probeCdpEndpoint(cdpUrl, timeoutMs = 3000) {
  try {
    const versionUrl = `${cdpUrl.replace(/\/$/, "")}/json/version`;
    const response = await fetch(versionUrl, { signal: AbortSignal.timeout(timeoutMs) });
    return response.ok;
  } catch {
    return false;
  }
}

/** @returns {import('node:child_process').ChildProcess} */
export function startStaticShellServer(repoRoot, port = 3340) {
  const outDir = path.join(repoRoot, "apps", "pwa", "out");
  const serveRoot = path.relative(repoRoot, outDir).split(path.sep).join("/") || ".";
  const proc = spawn(
    "npx",
    ["--yes", "serve", "-s", serveRoot, "-l", String(port)],
    {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
      env: { ...process.env, CI: "true" },
    },
  );
  return proc;
}

export async function waitForHttpReady(url, timeoutMs = 45_000, pollMs = 400) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probePwaDevReady(url, Math.min(pollMs + 500, 5000))) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return false;
}

/**
 * @param {{
 *   repoRoot: string;
 *   appBase: string;
 *   explicitCdpUrl?: string | null;
 *   requireOnlineShell?: boolean;
 *   log: (msg: string) => void;
 * }} options
 * @returns {Promise<{
 *   mode: "playwright" | "cdp";
 *   baseUrl: string;
 *   cdpUrl?: string;
 *   staticServerProc?: import('node:child_process').ChildProcess | null;
 * }>}
 */
export async function resolveDevLabConnection({
  repoRoot,
  appBase,
  explicitCdpUrl,
  requireOnlineShell = false,
  log,
}) {
  if (explicitCdpUrl) {
    log(`using explicit CDP ${explicitCdpUrl}`);
    return { mode: "cdp", baseUrl: appBase, cdpUrl: explicitCdpUrl };
  }

  if (await probePwaDevReady(`${appBase}/`, 5000)) {
    log(`using HTTP shell at ${appBase}`);
    return { mode: "playwright", baseUrl: appBase };
  }

  const autoCdpUrl = process.env.OBSCUR_CDP_URL?.trim() || DEFAULT_CDP_URL;
  if (await probeCdpEndpoint(autoCdpUrl)) {
    if (await probeCdpObscurPage(autoCdpUrl)) {
      log(`:3340 unavailable — using Tauri CDP at ${autoCdpUrl}`);
      return { mode: "cdp", baseUrl: appBase, cdpUrl: autoCdpUrl };
    }
    log(`CDP at ${autoCdpUrl} reachable but no Obscur page — falling back to static shell serve`);
  }

  const outIndex = path.join(repoRoot, "apps", "pwa", "out", "index.html");
  if (fs.existsSync(outIndex)) {
    const stale = isStaticShellStale(repoRoot);
    if (stale.stale) {
      throw new Error(
        `${stale.reason}. Rebuild static shell: pnpm dev:desktop:online -- --rebuild (or use Next live: pnpm dev:desktop:online:live).`,
      );
    }
    const devLabMode = isStaticShellDevLabMismatch(repoRoot);
    if (devLabMode.mismatch) {
      throw new Error(
        `${devLabMode.reason}. Rebuild: pnpm dev:desktop:online -- --rebuild (or pnpm dev:desktop:online:live for Next :3340).`,
      );
    }
    if (requireOnlineShell) {
      const onlineMode = isStaticShellExperimentModeMismatch(repoRoot, true);
      if (onlineMode.mismatch) {
        throw new Error(
          `${onlineMode.reason}. Rebuild: pnpm dev:desktop:online -- --rebuild`,
        );
      }
    }
    const port = Number.parseInt(new URL(appBase).port || "3340", 10);
    if (port === 3340) {
      freePwaDevPort(repoRoot);
    }
    log(`starting static shell on ${appBase} (pnpm dev:desktop:online uses Tauri, not Next :3340)`);
    const staticServerProc = startStaticShellServer(repoRoot, port);
    const ready = await waitForHttpReady(`${appBase}/`, 45_000);
    if (!ready) {
      try {
        staticServerProc.kill("SIGTERM");
      } catch {
        // ignore
      }
      throw new Error(`Timed out waiting for static shell at ${appBase}`);
    }
    log(`static shell ready at ${appBase}`);
    return { mode: "playwright", baseUrl: appBase, staticServerProc };
  }

  throw new Error(
    [
      "No dev-lab target available.",
      "Start one of:",
      "  pnpm dev:desktop:online          (static Tauri + relays; smoke auto-serves out/ or use CDP)",
      "  pnpm dev:desktop:online:live     (Next dev on :3340 + relays)",
      "  pnpm dev:desktop:stack           (Next :3340 only)",
      "For native/CDP scenarios, launch Tauri with:",
      "  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222",
      `then: pnpm dev:lab:run -- --cdp ${DEFAULT_CDP_URL}`,
    ].join("\n"),
  );
}

export function stopStaticShellServer(proc) {
  if (!proc || proc.killed || !proc.pid) {
    return;
  }
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(proc.pid), "/f", "/t"], { stdio: "ignore", shell: true });
      return;
    }
    proc.kill("SIGTERM");
    proc.kill("SIGKILL");
  } catch {
    // ignore
  }
}

export { DEFAULT_CDP_URL, PWA_DEV_URL };
