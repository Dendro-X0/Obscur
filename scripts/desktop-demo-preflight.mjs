#!/usr/bin/env node
/**
 * Cheap gates before a long desktop:package / demo recording session.
 * Does not replace release-exe smoke or installer L3.
 *
 *   pnpm desktop:demo-preflight
 *   pnpm desktop:demo-preflight -- --skip-tests   # shell gate + ladder only
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertProductionStaticShellReady } from "./lib/static-shell-stale.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const skipTests = args.includes("--skip-tests");

const resolveSpawn = (command, commandArgs) => {
  if (process.platform === "win32" && typeof command === "string" && command.toLowerCase().endsWith(".cmd")) {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...commandArgs] };
  }
  return { command, args: commandArgs };
};

const run = (label, command, commandArgs) => {
  console.log(`\n[desktop:demo-preflight] ${label}…`);
  const { command: spawnCommand, args: spawnArgs } = resolveSpawn(command, commandArgs);
  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    const detail = result.error ? ` (${result.error.message})` : "";
    throw new Error(`${label} failed (exit ${result.status ?? "unknown"})${detail}`);
  }
};

const VITEST_TARGETS = [
  "app/features/auth/components/auth-gateway.test.tsx",
  "app/features/relays/hooks/native-relay.test.ts",
  "app/features/transport-kernel/conduit-mesh-nostr-ws-client.test.ts",
  "app/features/transport-kernel/transport-preset-apply-policy.test.ts",
];

const checkProductionShell = () => {
  console.log("\n[desktop:demo-preflight] production shell gate…");
  // Stale is expected before desktop:build:exe rebuilds — warn only.
  // Offline stub / DEV_LAB shells are hard fails (wrong product contract).
  const gate = assertProductionStaticShellReady(repoRoot, { allowStale: true });
  if (!gate.ok) {
    if (gate.reason.includes("missing apps/pwa/out/obscur-shell-manifest.json")) {
      console.warn(`[desktop:demo-preflight] WARN: ${gate.reason}`);
      console.warn("[desktop:demo-preflight] Next: pnpm desktop:build:exe (rebuilds online shell)");
      return;
    }
    throw new Error(`production shell gate failed: ${gate.reason}`);
  }
  if (gate.staleWarning) {
    console.warn(`[desktop:demo-preflight] WARN: shell stale (${gate.staleWarning}) — desktop:build:exe will rebuild`);
  }
  console.log(
    `[desktop:demo-preflight] shell OK experimentOnline=${gate.manifest.experimentOnline} builtAt=${gate.manifest.builtAt ?? "?"}`,
  );
};

const printLadder = () => {
  console.log(`
[desktop:demo-preflight] Recovery ladder (demo/recording frozen until P2–P4 green)

  Default \`pnpm dev:desktop\` = production parity (live relays).
  Offline stub only: \`pnpm dev:desktop:stub\`
  Next HMR (\`dev:desktop:live\`) is UI-only — not a release proof.

  1. This preflight (L1 + shell gate) — done when exit 0
  2. Production release exe (rebuilds online shell unless --skip-shell passes gate):
       pnpm desktop:build:exe
  3. Smoke on release exe (parity contract P2–P4):
       apps/desktop/src-tauri/target/release/obscur_desktop_app.exe
       ☐ Account create / unlock lands in shell
       ☐ Public relays online with Tor off
       ☐ F5 exits "Restoring session…" within ~2.5s
  4. Only then — one installer:
       pnpm desktop:package
  5. Record

Spec: specs/backend/production-dev-parity-recovery-2026-07.md
`);
};

const main = () => {
  if (!skipTests) {
    run("prod-parity vitest (auth reload · NativeRelay · mesh WS · Tor apply)", "pnpm", [
      "-C",
      "apps/pwa",
      "exec",
      "vitest",
      "run",
      ...VITEST_TARGETS,
    ]);
  } else {
    console.log("[desktop:demo-preflight] skipping tests (--skip-tests)");
  }
  checkProductionShell();
  printLadder();
  console.log("[desktop:demo-preflight] L1 OK — still run release-exe smoke before desktop:package.");
};

try {
  main();
} catch (error) {
  console.error(`[desktop:demo-preflight] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
