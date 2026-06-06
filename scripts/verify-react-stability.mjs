#!/usr/bin/env node
/**
 * React stability gate — catches known infinite-render and duplicate-binding patterns.
 * See docs/program/ui-effect-stability-policy.md
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = path.join(repoRoot, "apps/pwa/app");

const IGNORE_SUFFIXES = [".test.ts", ".test.tsx", "/__tests__/"];

const normalizePath = (relativePath) => relativePath.replace(/\\/g, "/");

const walkTsFiles = async (dir, base = "") => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await walkTsFiles(path.join(dir, entry.name), relative));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) {
      continue;
    }
    const normalized = normalizePath(relative);
    if (IGNORE_SUFFIXES.some((suffix) => normalized.includes(suffix))) {
      continue;
    }
    files.push({ abs: path.join(dir, entry.name), relative: normalized });
  }
  return files;
};

const violations = [];

const recordViolation = (file, rule, detail) => {
  violations.push({ file, rule, detail });
};

/** Inline empty-object getSnapshot allocates every read → useSyncExternalStore loop. */
const detectInlineEmptyObjectSnapshot = (source, relativePath) => {
  if (!source.includes("useSyncExternalStore")) {
    return;
  }
  const pattern = /useSyncExternalStore\s*\([^)]*\(\s*\)\s*=>\s*\(\s*\{\s*\}\s*\)/s;
  if (pattern.test(source)) {
    recordViolation(
      relativePath,
      "inline-empty-object-snapshot",
      "useSyncExternalStore getSnapshot uses inline () => ({}) — use a module-level stable empty reference",
    );
  }
};

/** bindProfile/syncIdentity in consumer useEffect duplicates root binding owner. */
const BINDING_OWNER_ALLOWLIST = new Set([
  "features/runtime/services/window-runtime-binding.ts",
  "features/runtime/services/window-runtime-supervisor.ts",
]);

const detectDuplicateRuntimeBindingEffects = (source, relativePath) => {
  if (BINDING_OWNER_ALLOWLIST.has(relativePath)) {
    return;
  }
  if (!source.includes("useEffect")) {
    return;
  }
  if (
    /windowRuntimeSupervisor\.bindProfile/.test(source)
    || /windowRuntimeSupervisor\.syncIdentity/.test(source)
  ) {
    recordViolation(
      relativePath,
      "duplicate-runtime-binding-effect",
      "windowRuntimeSupervisor bind/sync in useEffect — use WindowRuntimeBindingOwner instead",
    );
  }
};

/** useWindowRuntime must not own binding effects (read-only + actions only). */
const detectBindingInsideUseWindowRuntime = (source, relativePath) => {
  if (relativePath !== "features/runtime/services/window-runtime-supervisor.ts") {
    return;
  }
  const hookMatch = source.match(/export const useWindowRuntime = \(\) => \{([\s\S]*?)\n\};/);
  if (!hookMatch) {
    return;
  }
  const hookBody = hookMatch[1];
  if (hookBody.includes("useEffect") && (
    hookBody.includes("bindProfile")
    || hookBody.includes("syncIdentity")
  )) {
    recordViolation(
      relativePath,
      "use-window-runtime-binding-effect",
      "useWindowRuntime still runs bind/sync in useEffect — binding must live in window-runtime-binding.ts only",
    );
  }
};

/** Root providers must mount the single binding owner. */
const assertBindingOwnerMounted = async () => {
  const providersPath = path.join(appRoot, "components/providers.tsx");
  const source = await readFile(providersPath, "utf8");
  if (!source.includes("WindowRuntimeBindingOwner")) {
    recordViolation(
      "components/providers.tsx",
      "missing-binding-owner",
      "AppProviders must mount <WindowRuntimeBindingOwner /> once at root",
    );
  }
};

const RELAY_POOL_EFFECT_ALLOWLIST = new Set([
  // Activation gate owner — relay connection snapshots are intentional convergence signals.
  "features/runtime/components/runtime-activation-manager.tsx",
]);

/** Relay transport bootstrap must not subscribe to full window runtime (feedback loop risk). */
const assertRelayProviderUsesShellTransportReady = async () => {
  const relayProviderPath = path.join(appRoot, "features/relays/providers/relay-provider.tsx");
  const source = await readFile(relayProviderPath, "utf8");
  if (source.includes("useWindowRuntime")) {
    recordViolation(
      "features/relays/providers/relay-provider.tsx",
      "relay-provider-window-runtime-subscription",
      "RelayProvider must use useShellTransportReady — not useWindowRuntime (relay↔window feedback loop)",
    );
  }
  if (!source.includes("useShellTransportReady")) {
    recordViolation(
      "features/relays/providers/relay-provider.tsx",
      "relay-provider-missing-shell-transport-ready",
      "RelayProvider must import useShellTransportReady for transport bootstrap gating",
    );
  }
  if (/syncRelayRuntime\s*\(/.test(source)) {
    recordViolation(
      "features/relays/providers/relay-provider.tsx",
      "relay-provider-sync-relay-runtime",
      "RelayProvider must not call syncRelayRuntime — relay metrics stay on RelayContext / obscurRelayRuntime (STAB-R1)",
    );
  }
};

/** Experiment shell must not bridge relay into window runtime either. */
const assertExperimentShellNoSyncRelayRuntime = async () => {
  const shellPath = path.join(appRoot, "features/relays/providers/experiment-relay-shell.tsx");
  const source = await readFile(shellPath, "utf8");
  if (/syncRelayRuntime\s*\(/.test(source)) {
    recordViolation(
      "features/relays/providers/experiment-relay-shell.tsx",
      "experiment-shell-sync-relay-runtime",
      "ExperimentRelayShell must not call syncRelayRuntime — same STAB-R1 rule as RelayProvider",
    );
  }
};

/** useEffect must not depend on high-churn window relay snapshot fields. */
const detectWindowRelayRuntimeEffectDeps = (source, relativePath) => {
  if (relativePath.includes(".test.")) {
    return;
  }
  if (!source.includes("useEffect")) {
    return;
  }
  if (/runtime\.snapshot\.relayRuntime/.test(source) && /useEffect\s*\([\s\S]*?\[[\s\S]*?runtime\.snapshot\.relayRuntime/.test(source)) {
    recordViolation(
      relativePath,
      "window-relay-runtime-effect-dep",
      "useEffect depends on runtime.snapshot.relayRuntime — use RelayContext or phase-only hooks (STAB-R2)",
    );
  }
};

/** Primary selection must not auto-reconcile on hintsSignature (supervisor-owned failover). */
const assertRelayPrimarySelectionNoHintsReconcile = async () => {
  const selectionPath = path.join(appRoot, "features/relays/hooks/use-relay-primary-selection.ts");
  const source = await readFile(selectionPath, "utf8");
  if (/useEffect\s*\([\s\S]*hintsSignature[\s\S]*reconcilePrimarySelection/.test(source)) {
    recordViolation(
      "features/relays/hooks/use-relay-primary-selection.ts",
      "relay-primary-hints-reconcile-effect",
      "useRelayPrimarySelection must not auto-reconcile on hintsSignature — causes relay render loop",
    );
  }
  if (/hintsSignature\s*=\s*""/.test(source) || /,\s*hintsSignature/.test(source)) {
    recordViolation(
      "features/relays/hooks/use-relay-primary-selection.ts",
      "relay-primary-hints-signature-param",
      "Remove hintsSignature param from useRelayPrimarySelection — use reconcileHintsSignature at pool layer only",
    );
  }
};

/** profile.revert in useEffect cleanup with [profile] dep retriggers revert every store notify. */
const detectProfileRevertCleanupDepLoop = (source, relativePath) => {
  if (!source.includes("profile.revert")) {
    return;
  }
  if (
    /useEffect\s*\(\s*\(\)\s*=>\s*\(\)\s*=>\s*\{[\s\S]*profile\.revert[\s\S]*\}\s*,\s*\[\s*profile\s*\]\s*\)/.test(source)
  ) {
    recordViolation(
      relativePath,
      "profile-revert-cleanup-dep-loop",
      "useEffect cleanup calls profile.revert with [profile] deps — use a ref and unmount-only [] deps",
    );
  }
};

/** relayPool object identity in effect deps — prefer useRelayPoolRef(). */
const detectRelayPoolObjectInEffectDeps = (source, relativePath) => {
  if (RELAY_POOL_EFFECT_ALLOWLIST.has(relativePath)) {
    return;
  }
  const effectBlocks = source.matchAll(/useEffect\s*\(\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[([\s\S]*?)\]\s*\)/g);
  for (const match of effectBlocks) {
    const body = match[1].trim();
    const deps = match[2];
    if (!/\brelayPool\b/.test(deps)) {
      continue;
    }
    if (/\brelayPoolRef\b/.test(deps) || /\brelayPoolStable\b/.test(deps)) {
      continue;
    }
    const normalizedBody = body.replace(/\s+/g, " ");
    if (/^relayPoolRef\.current = relayPool;?$/.test(normalizedBody)) {
      continue;
    }
    if (/^latestRelayCountsRef\.current = getRelayCounts\(relayPool\.connections\);?$/.test(normalizedBody)) {
      continue;
    }
    recordViolation(
      relativePath,
      "relay-pool-object-effect-dep",
      "useEffect dependency list includes relayPool — use useRelayPoolRef() or a stable ref",
    );
    break;
  }
};

const main = async () => {
  const files = await walkTsFiles(appRoot);
  for (const file of files) {
    const source = await readFile(file.abs, "utf8");
    detectInlineEmptyObjectSnapshot(source, file.relative);
    detectDuplicateRuntimeBindingEffects(source, file.relative);
    detectBindingInsideUseWindowRuntime(source, file.relative);
    detectRelayPoolObjectInEffectDeps(source, file.relative);
    detectWindowRelayRuntimeEffectDeps(source, file.relative);
    detectProfileRevertCleanupDepLoop(source, file.relative);
  }
  await assertBindingOwnerMounted();
  await assertRelayProviderUsesShellTransportReady();
  await assertExperimentShellNoSyncRelayRuntime();
  await assertRelayPrimarySelectionNoHintsReconcile();

  if (violations.length === 0) {
    console.log("verify-react-stability: OK");
    return;
  }

  console.error(`verify-react-stability: ${violations.length} violation(s)\n`);
  for (const violation of violations) {
    console.error(`  [${violation.rule}] ${violation.file}`);
    console.error(`    ${violation.detail}\n`);
  }
  process.exit(1);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
