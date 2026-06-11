#!/usr/bin/env node
/**
 * Start (or attach to) the Next dev server on :3340 for desktop shell dev.
 * Used by dev-desktop-fast.mjs — NOT Tauri beforeDevCommand (see dev-pwa-tauri-noop.mjs).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergePwaEnvLocal } from "./load-pwa-env-local.mjs";
import {
  probePwaDevReady,
  PWA_DEV_URL,
  waitForPwaDevReady,
} from "./lib/dev-stack-probes.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = mergePwaEnvLocal({
  ...process.env,
  NEXT_PUBLIC_DESKTOP_SHELL: "1",
  NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH: "0",
  TAURI_BUILD: "true",
  NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE: process.env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE ?? "0",
  OBSCUR_DESKTOP_DEV_BUNDLER: process.env.OBSCUR_DESKTOP_DEV_BUNDLER ?? "webpack",
});

const useWebpack = env.OBSCUR_DESKTOP_DEV_BUNDLER !== "turbopack";

const main = async () => {
  if (await probePwaDevReady(PWA_DEV_URL, 3000)) {
    console.log("[dev-pwa-tauri] :3340 already serving — attached");
    return;
  }

  console.log("[dev-pwa-tauri] waiting for :3340 (another process may be compiling)…");
  if (await waitForPwaDevReady({ maxMs: 15_000 })) {
    console.log("[dev-pwa-tauri] :3340 ready — attached");
    return;
  }

  const nextScript = useWebpack ? "dev:webpack" : "dev:turbo";
  console.log(`[dev-pwa-tauri] starting Next dev (${useWebpack ? "webpack" : "turbopack"}) on :3340…`);

  await new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["-C", "apps/pwa", "run", nextScript], {
      cwd: repoRoot,
      stdio: "inherit",
      env,
      shell: process.platform === "win32",
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if (code && code !== 0) {
        reject(new Error(`Next dev exited with code ${code}`));
        return;
      }
      resolve(undefined);
    });
  });
};

main().catch((error) => {
  console.error("[dev-pwa-tauri] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
