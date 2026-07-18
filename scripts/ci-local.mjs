#!/usr/bin/env node
/**
 * Local CI tier runner — cheap gates before any Full Release / GitHub wait.
 *
 * Usage:
 *   node scripts/ci-local.mjs --tier t0
 *   node scripts/ci-local.mjs --tier all-cheap
 *   pnpm ci:local:t0
 *
 * Tiers mirror ci-rigor + Obscur Full Release preflight (not a substitute for
 * macOS/Linux runners when packaging .dmg / .AppImage).
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const isWin = process.platform === "win32";

const args = process.argv.slice(2).filter((a) => a !== "--");
const hasFlag = (name) => args.includes(name);
const getArg = (name) => {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
};

const TIER_HELP = `
Obscur local CI tiers (run lowest sufficient tier before pushing)

  t0            version:check                         (~30s)
  t1            docs:check                            (~1–2m)
  t2            PWA tsc + release-relevant vitest     (~2–5m)
  t3            verify:engine-lab                     (~5–15m)
  t4            release:test-pack --skip-preflight    (~20–45m)
  preflight     integrity + version + docs + optional relay smoke
  desktop-win   Windows Full Release desktop essentials (tauri package)
  all-cheap     t0 → t1 → t2 (default push gate for most changes)
  help          this message

Flags:
  --tier <name>     Tier to run (required unless help)
  --skip-relay      Skip Docker relay smoke in preflight
  --skip-typecheck  T2: run vitest only (when known tsc debt blocks)
  --list            List tiers and exit

Examples:
  pnpm ci:local:t0
  pnpm ci:local:all-cheap
  pnpm ci:local -- --tier t2 --skip-typecheck
  pnpm ci:local -- --tier preflight --skip-relay
  pnpm ci:local:desktop-win
`.trim();

const resolvePnpm = () => (isWin ? "pnpm.cmd" : "pnpm");

const run = (label, command, commandArgs, options = {}) => {
  console.log(`\n[ci:local] ▶ ${label}`);
  console.log(`[ci:local]   $ ${command} ${commandArgs.join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: isWin,
    env: {
      ...process.env,
      CI: process.env.CI ?? "true",
    },
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status ?? "unknown"})`);
  }
  console.log(`[ci:local] ✓ ${label}`);
};

const runPnpm = (label, pnpmArgs) => {
  run(label, resolvePnpm(), pnpmArgs);
};

const runPwaTypecheck = () => {
  const pwaCwd = resolve(repoRoot, "apps/pwa");
  if (isWin) {
    run("T2 typecheck (apps/pwa)", ".\\node_modules\\.bin\\tsc.CMD", [
      "--noEmit",
      "--pretty",
      "false",
    ], { cwd: pwaCwd, shell: true });
    return;
  }
  runPnpm("T2 typecheck (apps/pwa)", [
    "-C",
    "apps/pwa",
    "exec",
    "tsc",
    "--noEmit",
    "--pretty",
    "false",
  ]);
};

const runPwaVitest = (tests) => {
  const pwaCwd = resolve(repoRoot, "apps/pwa");
  if (isWin) {
    run("T2 vitest (release-relevant contracts)", ".\\node_modules\\.bin\\vitest.CMD", [
      "run",
      ...tests,
    ], { cwd: pwaCwd, shell: true });
    return;
  }
  runPnpm("T2 vitest (release-relevant contracts)", [
    "-C",
    "apps/pwa",
    "exec",
    "vitest",
    "run",
    ...tests,
  ]);
};

/** T2 vitest — cheap contracts that catch release/shell drift without full pack. */
const T2_VITEST = [
  "app/engine-lab/engine-lab-strict-quarantine.contract.test.ts",
  "app/engine-lab/ui-archive-boundary.contract.test.ts",
  "app/engine-lab/packages-boundary.contract.test.ts",
  "app/features/runtime/experiment-shell-policy.test.ts",
];

const runT2 = () => {
  if (hasFlag("--skip-typecheck")) {
    console.log("[ci:local] skipping PWA typecheck (--skip-typecheck)");
  } else {
    runPwaTypecheck();
  }
  runPwaVitest(T2_VITEST);
};

const runPreflight = ({ skipRelay }) => {
  runPnpm("preflight: release integrity", ["release:integrity-check"]);
  runPnpm("preflight: version alignment", ["version:check"]);
  runPnpm("preflight: docs check", ["docs:check"]);
  runPnpm("preflight: artifact matrix contract", ["release:artifact-matrix-check"]);

  if (skipRelay) {
    console.log("[ci:local] skipping relay smoke (--skip-relay)");
    return;
  }

  console.log(
    "[ci:local] relay smoke expects Docker Desktop + pnpm dev:relay:docker (or an existing :7000 relay)",
  );
  runPnpm("preflight: relay runtime smoke", [
    "ci:relay-runtime-smoke",
    "--",
    "--relay",
    "ws://127.0.0.1:7000",
    "--timeout-ms",
    "7000",
    "--skip-nip11",
  ]);
};

const runDesktopWin = () => {
  if (process.platform !== "win32") {
    console.log(`
[ci:local] desktop-win is for Windows hosts only (current: ${process.platform}).
[ci:local] On Linux/macOS use Full Release CI or a native host:
  pnpm version:sync
  pnpm -C apps/desktop tauri build
`.trim());
    throw new Error("desktop-win requires Windows");
  }
  runPnpm("desktop-win: ensure NSIS tools", ["desktop:ensure-nsis"]);
  runPnpm("desktop-win: package installer (version sync + tauri build + collect)", [
    "desktop:package",
  ]);
};

const TIERS = {
  t0: () => runPnpm("T0 version:check", ["version:check"]),
  t1: () => runPnpm("T1 docs:check", ["docs:check"]),
  t2: runT2,
  t3: () => runPnpm("T3 verify:engine-lab", ["verify:engine-lab"]),
  t4: () =>
    runPnpm("T4 release:test-pack (--skip-preflight)", [
      "release:test-pack",
      "--",
      "--skip-preflight",
    ]),
  preflight: () => runPreflight({ skipRelay: hasFlag("--skip-relay") }),
  "desktop-win": runDesktopWin,
  "all-cheap": () => {
    TIERS.t0();
    TIERS.t1();
    TIERS.t2();
  },
};

const main = () => {
  if (hasFlag("--list") || hasFlag("help") || hasFlag("--help") || args.length === 0) {
    console.log(TIER_HELP);
    if (hasFlag("--list")) {
      console.log("\nKnown tiers:", Object.keys(TIERS).join(", "));
    }
    process.exit(0);
  }

  const tier = (getArg("--tier") ?? args.find((a) => !a.startsWith("-")) ?? "").toLowerCase();
  if (!tier || tier === "help") {
    console.log(TIER_HELP);
    process.exit(tier ? 0 : 1);
  }

  const runner = TIERS[tier];
  if (!runner) {
    console.error(`[ci:local] unknown tier: ${tier}`);
    console.log(TIER_HELP);
    process.exit(1);
  }

  const started = Date.now();
  console.log(`[ci:local] tier=${tier} root=${repoRoot}`);
  try {
    runner();
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\n[ci:local] PASS tier=${tier} in ${seconds}s`);
    console.log(
      "[ci:local] Next: only push Full Release / tag after applicable tiers pass. See docs/program/ci-local-fast-loop.md",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n[ci:local] FAIL tier=${tier}: ${message}`);
    process.exit(1);
  }
};

main();
