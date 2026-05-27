#!/usr/bin/env node
/**
 * clear-dev-cache.mjs
 *
 * Clears all build/dev caches across the monorepo so that the next
 * `pnpm dev:desktop` or `pnpm dev:pwa` performs a full fresh compile.
 *
 * Targets:
 *   - apps/pwa/.next          (Next.js / Turbopack dev + build cache)
 *   - apps/pwa/.turbo         (Turbo incremental cache for PWA)
 *   - apps/desktop/.next      (Next.js cache if desktop uses a local next)
 *   - apps/desktop/.turbo
 *   - apps/api/.next
 *   - apps/api/.turbo
 *   - .turbo                  (root-level turbo cache)
 *   - node_modules/.cache     (various tool caches: esbuild, SWC, etc.)
 *
 * Usage:
 *   node scripts/clear-dev-cache.mjs
 *   pnpm cache:clear
 */

import { rmSync, existsSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

const targets = [
  "apps/pwa/.next",
  "apps/pwa/.turbo",
  "apps/desktop/.next",
  "apps/desktop/.turbo",
  "apps/api/.next",
  "apps/api/.turbo",
  ".turbo",
  "node_modules/.cache",
];

let cleared = 0;
let skipped = 0;

for (const rel of targets) {
  const abs = join(ROOT, rel);
  if (existsSync(abs)) {
    try {
      rmSync(abs, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      console.log(`[clear-dev-cache] ✓ removed  ${rel}`);
      cleared++;
    } catch (err) {
      console.error(`[clear-dev-cache] ✗ failed   ${rel}: ${err.message}`);
      console.error(`[clear-dev-cache]   hint: quit dev:desktop / close the app, then delete ${rel} manually`);
    }
  } else {
    console.log(`[clear-dev-cache] - skipped  ${rel} (not found)`);
    skipped++;
  }
}

console.log(`\n[clear-dev-cache] done — ${cleared} removed, ${skipped} skipped.`);
console.log("[clear-dev-cache] Run your dev command to start fresh:\n");
console.log("  pnpm dev:desktop   # Tauri desktop");
console.log("  pnpm dev:pwa       # PWA only");
console.log("\nIf desktop fails with \"failed to read plugin permissions\" on Windows:");
console.log("  pnpm desktop:repair   # cargo clean for Tauri permission cache");
