#!/usr/bin/env node
/**
 * Fast desktop dev — Tauri + Next only (no coordination/relay workspace stack).
 *
 * Use for UI / shell iteration. For DM relay + membership integration use:
 *   pnpm dev:desktop:online
 *
 *   pnpm dev:desktop:fast
 *   pnpm dev:desktop:fast -- --online   (sets experiment online env, still no wrangler)
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergePwaEnvLocal } from "./load-pwa-env-local.mjs";
import {
  buildPwaDevStackFingerprint,
  freePwaDevPort,
  probePwaDevReady,
  probePwaDevStackFingerprint,
  PWA_DEV_URL,
  waitForPwaDevReady,
} from "./lib/dev-stack-probes.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flags = new Set(process.argv.slice(2));
const online = flags.has("--online");

const env = mergePwaEnvLocal({
  ...process.env,
  NEXT_PUBLIC_DESKTOP_SHELL: "1",
  NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH: "0",
  TAURI_BUILD: "true",
  OBSCUR_DESKTOP_DEV_BUNDLER: process.env.OBSCUR_DESKTOP_DEV_BUNDLER ?? "webpack",
  NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE: online ? "1" : (process.env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE ?? "0"),
});

const log = (message) => console.log(`[desktop-fast] ${message}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  let next = null;
  let ownsNextProcess = false;
  const expectedFingerprint = buildPwaDevStackFingerprint(env);

  let alreadyReady = await probePwaDevReady(PWA_DEV_URL, 3000);
  if (alreadyReady) {
    const fingerprintMatch = await probePwaDevStackFingerprint(expectedFingerprint);
    if (fingerprintMatch === true) {
      log(`:3340 already serving matching dev stack (${expectedFingerprint})`);
    } else {
      log(
        fingerprintMatch === false
          ? `:3340 dev stack mismatch (expected ${expectedFingerprint}) — restarting Next…`
          : `:3340 missing dev stack fingerprint — restarting Next…`,
      );
      freePwaDevPort(repoRoot);
      await sleep(1_000);
      alreadyReady = false;
    }
  }

  if (!alreadyReady) {
    log("starting Next dev (webpack default) on :3340…");
    next = spawn("node", [path.join(repoRoot, "scripts", "dev-pwa-tauri.mjs")], {
      cwd: repoRoot,
      env,
      stdio: "inherit",
      shell: false,
    });
    ownsNextProcess = true;

    next.on("exit", (code) => {
      if (code && code !== 0) {
        log(`Next dev exited with code ${code}`);
      }
    });

    log("waiting for Next dev to serve / …");
    const ready = await waitForPwaDevReady();
    if (!ready) {
      log("FATAL: Next dev did not become ready on :3340 within 3 minutes.");
      try {
        next.kill("SIGTERM");
      } catch {
        // ignore
      }
      process.exit(1);
    }
  }

  log("Next dev ready — starting Tauri (beforeDevCommand noop; CSP disabled in tauri.dev.conf.json)…");

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

  const desktop = spawn("pnpm", ["-C", "apps/desktop", "dev:live"], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  desktop.on("exit", (code) => {
    killNext();
    process.exit(code ?? 1);
  });

  desktop.on("error", (error) => {
    console.error("[desktop-fast] failed to start Tauri:", error instanceof Error ? error.message : error);
    killNext();
    process.exit(1);
  });
};

run().catch((error) => {
  console.error("[desktop-fast] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
