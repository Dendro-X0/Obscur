#!/usr/bin/env node
/**
 * Flat transport-engine verify gate (w0–w68) — single-process vitest + cargo slices.
 * Avoids deep nested `pnpm verify:transport-engine-w*` chains (Windows PATH flake).
 */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const pwaRoot = join(repoRoot, "apps/pwa");
const engineLabDir = join(pwaRoot, "app/engine-lab");

const TRANSPORT_ENGINE_TEST = /^transport-engine-w\d+\.(?:harness\.)?contract\.test\.ts$/;

const run = (cwd, command, args, label) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    const detail = result.error?.message ?? "";
    throw new Error(
      `${label ?? `${command} ${args.join(" ")}`} failed (${result.status ?? "spawn error"})\n${detail}`,
    );
  }
};

const listTransportEngineLabTests = () => (
  readdirSync(engineLabDir)
    .filter((entry) => TRANSPORT_ENGINE_TEST.test(entry))
    .sort()
    .map((entry) => join("app/engine-lab", entry).replace(/\\/g, "/"))
);

const runPwaVitest = (...testPaths) => {
  run(
    pwaRoot,
    "npx",
    ["vitest", "run", ...testPaths],
    `vitest (${testPaths.length} paths)`,
  );
};

const runCargo = (relativeDir, cargoArgs, label) => {
  run(join(repoRoot, relativeDir), "cargo", cargoArgs, label);
};

runPwaVitest(
  ...listTransportEngineLabTests(),
  "../../packages/obscur-transport-engine/src/classify-transport-readiness.test.ts",
  "../../packages/obscur-transport-engine/src/transport-engine.headless.test.ts",
  "../../packages/obscur-transport-engine/src/transport-persistence.test.ts",
  "app/features/relays/services/relay-recovery-policy.test.ts",
  "app/features/relays/services/transport-relay-supervisor-bootstrap.test.ts",
  "app/features/relays/services/transport-relay-supervisor-evidence.test.ts",
  "app/features/relays/services/relay-runtime-supervisor.test.ts",
  "app/features/relays/services/transport-relay-pool-hydration.test.ts",
  "app/features/relays/services/transport-relay-pool-subscribe.test.ts",
  "app/features/transport-kernel/transport-kernel-policy.test.ts",
  "app/features/transport-kernel/transport-kernel-snapshot-port.test.ts",
  "app/features/transport-kernel/transport-kernel-recovery-port.test.ts",
  "app/features/relays/services/relay-recovery-metrics-refresher.test.ts",
  "app/features/transport-kernel/transport-kernel-engine-port.test.ts",
  "app/features/transport-kernel/transport-kernel-pool-hook-port.test.ts",
  "app/features/transport-kernel/transport-kernel-publish-port.test.ts",
  "app/features/relays/hooks/relay-standalone-publish-port.test.ts",
  "app/features/transport-kernel/transport-kernel-standalone-publish.test.ts",
  "app/features/relays/hooks/relay-standalone-publish-port-subtracted.test.ts",
);

runCargo("packages/libobscur", ["test", "transport_list", "--", "--nocapture"], "cargo transport_list");
runCargo(
  "packages/libobscur",
  ["test", "transport_publish_relay_event", "--", "--nocapture"],
  "cargo transport_publish_relay_event",
);
runCargo(
  "packages/libobscur",
  ["test", "transport_publish_relay_event_returns_dry_run_assembly", "--", "--nocapture"],
  "cargo transport_publish_relay_event_returns_dry_run_assembly",
);
runCargo(
  "packages/libobscur",
  [
    "test",
    "transport_publish_relay_event_returns_protocol_network_assembly_when_lab_gate_enabled",
    "--",
    "--nocapture",
  ],
  "cargo transport_publish_relay_event_returns_protocol_network_assembly_when_lab_gate_enabled",
);
runCargo("apps/desktop/src-tauri", ["check", "--quiet"], "cargo check desktop");

console.log("verify-transport-engine: ok (w0–w68 flat gate)");
