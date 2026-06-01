#!/usr/bin/env node
/**
 * Fast mobile-shell iteration — same PWA bundle as Android, hot reload via Next dev.
 * Use this to debug relay/UI issues before running a full APK build.
 *
 *   pnpm dev:mobile-shell:online
 *   pnpm dev:mobile-shell:offline
 *
 * Open http://127.0.0.1:3340 in Chrome DevTools device mode (Pixel 5).
 * For WebView logcat on device: adb logcat -s Tauri/Console
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergePwaEnvLocal } from "./load-pwa-env-local.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flags = new Set(process.argv.slice(2));
const env = mergePwaEnvLocal({
  ...process.env,
  NEXT_PUBLIC_MOBILE_SHELL: "1",
  NEXT_PUBLIC_DESKTOP_SHELL: "0",
  // Mobile shell: persisted chat-state is durable local truth (matches APK build script).
  NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH: "0",
});

if (flags.has("--online")) {
  env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE = "1";
} else if (flags.has("--offline")) {
  env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE = "0";
}

console.log("[dev:mobile-shell] NEXT_PUBLIC_MOBILE_SHELL=1 — use Chrome device mode for layout");
console.log("[dev:mobile-shell] URL: http://127.0.0.1:3340");

const child = spawn("pnpm", ["-C", "apps/pwa", "dev"], {
  cwd: repoRoot,
  stdio: "inherit",
  env,
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
