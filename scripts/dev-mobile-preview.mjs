#!/usr/bin/env node
/**
 * Mobile preview shell — phone-sized Tauri window + native SQLite + mobile UI.
 *
 * Same PWA mobile shell as Android (`NEXT_PUBLIC_MOBILE_SHELL=1`), hosted in
 * desktop Tauri so auth/persist use SQLite — not Chrome DevTools device mode.
 *
 *   pnpm dev:mobile-preview:online
 *   pnpm dev:mobile-preview:offline
 *
 * Isolated data: OBSCUR_DATA_ROOT → .obscur-mobile-preview-data/
 * Do not run beside pnpm dev:desktop:* or pnpm dev:mobile-shell:* (same :3340).
 *
 * Chrome layout-only: pnpm dev:mobile-shell:online
 * Ship gate: Android emulator / APK
 */
import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergePwaEnvLocal } from "./load-pwa-env-local.mjs";
import { spawnPnpm } from "./lib/spawn-pnpm.mjs";
import { assertHostHasHeadroom } from "./lib/host-pressure.mjs";
import {
  buildPwaDevStackFingerprint,
  freePwaDevPort,
  probePortOpen,
  probePwaDevReady,
  probePwaDevStackFingerprint,
  PWA_DEV_PORT,
  PWA_DEV_URL,
  waitForPwaDevReady,
} from "./lib/dev-stack-probes.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flags = new Set(process.argv.slice(2));
const online = flags.has("--online");
const previewDataRoot = path.join(repoRoot, ".obscur-mobile-preview-data");

const env = mergePwaEnvLocal({
  ...process.env,
  NEXT_PUBLIC_MOBILE_SHELL: "1",
  NEXT_PUBLIC_DESKTOP_SHELL: "0",
  NEXT_PUBLIC_MOBILE_PREVIEW: "1",
  NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH: "0",
  TAURI_BUILD: "true",
  OBSCUR_MOBILE_PREVIEW: "1",
  OBSCUR_DATA_ROOT: process.env.OBSCUR_DATA_ROOT || previewDataRoot,
  OBSCUR_DESKTOP_DEV_BUNDLER: process.env.OBSCUR_DESKTOP_DEV_BUNDLER ?? "webpack",
  NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE: online
    ? "1"
    : (process.env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE ?? "0"),
});

const log = (message) => console.log(`[mobile-preview] ${message}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  const headroom = await assertHostHasHeadroom(log);
  if (!headroom.allowed) {
    process.exit(2);
  }

  mkdirSync(env.OBSCUR_DATA_ROOT, { recursive: true });
  log(`data root (SQLite): ${env.OBSCUR_DATA_ROOT}`);
  log("MOBILE_SHELL=1 + Tauri native bridge — phone window, not Chrome device mode");

  let next = null;
  let ownsNextProcess = false;
  const expectedFingerprint = buildPwaDevStackFingerprint(env);

  let alreadyReady = await probePwaDevReady(PWA_DEV_URL, 3000);
  if (alreadyReady) {
    const fingerprintMatch = await probePwaDevStackFingerprint(expectedFingerprint);
    if (fingerprintMatch === true) {
      log(`:3340 already serving matching stack (${expectedFingerprint})`);
    } else {
      log(
        fingerprintMatch === false
          ? `:3340 stack mismatch (expected ${expectedFingerprint}) — restarting Next…`
          : `:3340 missing stack fingerprint — restarting Next…`,
      );
      freePwaDevPort(repoRoot);
      await sleep(1_000);
      alreadyReady = false;
    }
  } else if (await probePortOpen("127.0.0.1", PWA_DEV_PORT, 1500)) {
    log(`:3340 is listening but not serving HTML — freeing hung Next…`);
    freePwaDevPort(repoRoot);
    await sleep(1_000);
  }

  if (!alreadyReady) {
    log("starting Next (mobile shell) on :3340…");
    const useWebpack = env.OBSCUR_DESKTOP_DEV_BUNDLER !== "turbopack";
    const nextScript = useWebpack ? "dev:webpack" : "dev:turbo";
    next = spawnPnpm(["-C", "apps/pwa", "run", nextScript], {
      cwd: repoRoot,
      env,
      stdio: "inherit",
    });
    ownsNextProcess = true;

    next.on("exit", (code) => {
      if (code && code !== 0) {
        log(`Next exited with code ${code}`);
      }
    });

    log("waiting for Next to serve / …");
    const ready = await waitForPwaDevReady();
    if (!ready) {
      log("FATAL: Next did not become ready on :3340 within 3 minutes.");
      try {
        next.kill("SIGTERM");
      } catch {
        // ignore
      }
      process.exit(1);
    }
  }

  log("Next ready — starting Tauri phone preview (live.dev, CSP off)…");

  const killNext = () => {
    if (!ownsNextProcess || !next) {
      return;
    }
    try {
      next.kill("SIGTERM");
    } catch {
      // ignore
    }
  };

  process.on("SIGINT", () => {
    killNext();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    killNext();
    process.exit(143);
  });

  const desktop = spawnPnpm(["-C", "apps/desktop", "dev:live"], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });

  desktop.on("exit", (code) => {
    killNext();
    process.exit(code ?? 1);
  });

  desktop.on("error", (error) => {
    console.error(
      "[mobile-preview] failed to start Tauri:",
      error instanceof Error ? error.message : error,
    );
    killNext();
    process.exit(1);
  });
};

run().catch((error) => {
  console.error(
    "[mobile-preview] failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
