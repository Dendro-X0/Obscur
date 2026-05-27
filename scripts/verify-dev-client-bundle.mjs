#!/usr/bin/env node
/**
 * Verify the dev server on :3340 is reachable and (optionally) serving a fresh Turbopack build.
 *
 * Usage:
 *   node scripts/verify-dev-client-bundle.mjs
 *   node scripts/verify-dev-client-bundle.mjs --stamp 2026-05-23-product-shell-b
 *
 * In the running app (DevTools console):
 *   window.__OBSCUR_DEV_CLIENT_STAMP
 * Should match apps/pwa/app/features/runtime/experiment-shell-policy.ts OBSCUR_DEV_CLIENT_STAMP.
 */

const baseUrl = process.env.OBSCUR_DEV_URL ?? "http://127.0.0.1:3340";
const expectedStamp = (() => {
  const index = process.argv.indexOf("--stamp");
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return null;
})();

async function main() {
  let response;
  try {
    response = await fetch(baseUrl, { redirect: "follow" });
  } catch (error) {
    console.error(`[verify-dev] Cannot reach ${baseUrl}`);
    console.error(error instanceof Error ? error.message : String(error));
    console.error("\nStart: pnpm dev:desktop (or pnpm -C apps/pwa dev)");
    process.exit(1);
  }

  const html = await response.text();
  const nextVersion = html.match(/Next\.js[^<]*/)?.[0] ?? "unknown";
  const hasTurbopack = html.includes("turbopack") || html.includes("Turbopack");

  console.log(`[verify-dev] ${baseUrl} → HTTP ${response.status}`);
  console.log(`[verify-dev] Detected: ${nextVersion}${hasTurbopack ? " (turbopack hints in HTML)" : ""}`);
  console.log("[verify-dev] Browser console must show:");
  console.log("  window.__OBSCUR_DEV_CLIENT_STAMP");
  if (expectedStamp) {
    console.log(`  expected: "${expectedStamp}"`);
  } else {
    console.log("  (compare to OBSCUR_DEV_CLIENT_STAMP in experiment-shell-policy.ts)");
  }
  console.log("\nIf overlay shows Next.js (stale): hard refresh (Ctrl+Shift+R) or:");
  console.log("  pnpm cache:clear && pnpm dev:desktop");
  console.log("\nIf stamp mismatches: you are on an old client bundle — not a git problem, an HMR/cache problem.");
}

main();
