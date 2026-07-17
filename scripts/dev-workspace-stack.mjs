#!/usr/bin/env node
/**
 * Dev workspace stack: coordination worker + local Nostr relay + desktop shell.
 *
 * Default online desktop (smooth nav + live relays):
 *   node scripts/dev-workspace-stack.mjs --online
 *   → static out/ shell + coordination + relay
 *
 * Webpack live reload (slow route compiles — UI HMR only):
 *   node scripts/dev-workspace-stack.mjs --online --live
 *
 *   node scripts/dev-workspace-stack.mjs --stack-only   (no desktop — for second A/B instance)
 *   node scripts/dev-workspace-stack.mjs --online --skip-coordination
 *
 * Recommended Windows workflow (avoids wrangler cold-start races):
 *   Terminal 1: pnpm dev:coordination   (leave running between sessions)
 *   Terminal 2: pnpm dev:desktop:no-coord -- --rebuild
 *
 * Source edits under apps/pwa/app require a static shell rebuild (auto-detected).
 * --skip-build refuses when the shell is stale unless OBSCUR_ALLOW_STALE_SHELL=1.
 * UI iteration without full rebuild: pnpm dev:desktop:online:live
 *
 * Windows note: wrangler dev can take 2–4 minutes on a cold start. The stack waits for an
 * external coordination worker before spawning a duplicate when OBSCUR_COORDINATION_GRACE_MS
 * allows it (default 90s on Windows).
 */
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergePwaEnvLocal } from "./load-pwa-env-local.mjs";
import { applyWindowsBuildTempEnv } from "./lib/windows-build-temp.mjs";
import {
  DEFAULT_COORDINATION_READY_TIMEOUT_MS,
  DEFAULT_RELAY_READY_TIMEOUT_MS,
  probeHttpOk,
  resolveReadyTimeoutMs,
  waitForReady,
} from "./lib/dev-stack-probes.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flags = new Set(process.argv.slice(2));
const stackOnly = flags.has("--stack-only");
const useLiveWebpack = flags.has("--live");
const skipCoordination = flags.has("--skip-coordination")
  || process.env.OBSCUR_SKIP_COORDINATION === "1";

const log = (message) => {
  console.log(`[workspace-stack] ${message}`);
};

const env = applyWindowsBuildTempEnv(mergePwaEnvLocal({ ...process.env }), { repoRoot, log });
if (flags.has("--online")) {
  env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE = "1";
  env.NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH = "0";
} else if (flags.has("--offline")) {
  env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE = "0";
}
if (flags.has("--webpack") || flags.has("--turbopack")) {
  env.OBSCUR_DESKTOP_DEV_BUNDLER = flags.has("--turbopack") ? "turbopack" : "webpack";
} else if (!env.OBSCUR_DESKTOP_DEV_BUNDLER) {
  env.OBSCUR_DESKTOP_DEV_BUNDLER = "webpack";
}

const children = [];
const coordinationReadyTimeoutMs = resolveReadyTimeoutMs(
  env.OBSCUR_COORDINATION_READY_TIMEOUT_MS,
  DEFAULT_COORDINATION_READY_TIMEOUT_MS,
);
const relayReadyTimeoutMs = resolveReadyTimeoutMs(
  env.OBSCUR_RELAY_READY_TIMEOUT_MS,
  DEFAULT_RELAY_READY_TIMEOUT_MS,
);
const coordinationGraceMs = resolveReadyTimeoutMs(
  env.OBSCUR_COORDINATION_GRACE_MS,
  process.platform === "win32" ? 90_000 : 30_000,
);

const COORDINATION_HEALTH_URL = "http://127.0.0.1:8787/health";
const COORDINATION_PORT = 8787;

const freeCoordinationPort = () => {
  spawnSync(process.execPath, [
    path.join(repoRoot, "scripts", "kill-listeners-on-port.mjs"),
    String(COORDINATION_PORT),
  ], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
};

const probeTcpOpen = (host, port, timeoutMs = 2000) => new Promise((resolve) => {
  const socket = net.connect({ host, port, timeout: timeoutMs });
  const finish = (value) => {
    socket.removeAllListeners();
    try {
      socket.destroy();
    } catch {
      // ignore
    }
    resolve(value);
  };
  socket.once("connect", () => finish(true));
  socket.once("error", () => finish(false));
  socket.once("timeout", () => finish(false));
});

const formatDuration = (ms) => `${Math.round(ms / 1000)}s`;

const waitForService = async (label, probe, maxMs) => {
  log(`waiting for ${label} (timeout ${formatDuration(maxMs)})…`);
  const result = await waitForReady(label, probe, {
    maxMs,
    pollMs: 750,
    progressEveryMs: 15_000,
    onProgress: ({ elapsedMs, maxMs: limitMs }) => {
      log(`${label} still starting (${formatDuration(elapsedMs)} / ${formatDuration(limitMs)})…`);
    },
  });
  if (result.ok) {
    log(`${label} ready in ${formatDuration(result.elapsedMs)}`);
    return true;
  }
  log(`${label} not ready after ${formatDuration(result.maxMs ?? maxMs)}`);
  return false;
};

const spawnBackground = (label, command, args, extraEnv = {}, spawnOptions = {}) => {
  log(`starting ${label}`);
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: { ...env, ...extraEnv },
    stdio: "inherit",
    shell: spawnOptions.shell ?? true,
    detached: false,
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      log(`${label} exited with code ${code}`);
    }
  });
  children.push(child);
  return child;
};

const ensureCoordination = async () => {
  if (skipCoordination) {
    log("skipping coordination spawn (--skip-coordination / OBSCUR_SKIP_COORDINATION=1)");
    const externalOk = await waitForService(
      "coordination (external)",
      () => probeHttpOk(COORDINATION_HEALTH_URL, 5000),
      coordinationReadyTimeoutMs,
    );
    if (!externalOk) {
      log("coordination was not started by this stack — run `pnpm dev:coordination` in another terminal first");
    }
    return externalOk;
  }

  if (await probeHttpOk(COORDINATION_HEALTH_URL, 3000)) {
    log("coordination already healthy");
    return true;
  }

  if (coordinationGraceMs > 0) {
    log(
      `coordination not healthy — waiting ${formatDuration(coordinationGraceMs)} for an external worker (e.g. pnpm dev:coordination) before spawning a new one`,
    );
    const graceOk = await waitForService(
      "coordination (external grace)",
      () => probeHttpOk(COORDINATION_HEALTH_URL, 5000),
      coordinationGraceMs,
    );
    if (graceOk) {
      return true;
    }
  }

  if (await probeTcpOpen("127.0.0.1", COORDINATION_PORT)) {
    log("coordination port is open but /health is not ready yet — waiting for mid-boot worker");
    const midBootOk = await waitForService(
      "coordination",
      () => probeHttpOk(COORDINATION_HEALTH_URL, 5000),
      coordinationReadyTimeoutMs,
    );
    if (midBootOk) {
      return true;
    }
    log("coordination port stayed unhealthy — restarting coordination");
  }

  freeCoordinationPort();
  spawnBackground(
    "coordination",
    process.execPath,
    [path.join(repoRoot, "scripts", "coordination-dev.mjs")],
    {
      OBSCUR_SKIP_PORT_CLEANUP: "1",
    },
    { shell: false },
  );

  return waitForService(
    "coordination",
    () => probeHttpOk(COORDINATION_HEALTH_URL, 5000),
    coordinationReadyTimeoutMs,
  );
};

const ensureRelay = async () => {
  if (await probeTcpOpen("127.0.0.1", 7000)) {
    log("relay already listening on :7000");
    return true;
  }
  spawnBackground("relay", process.execPath, [
    path.join(repoRoot, "scripts", "dev-relay-docker.mjs"),
  ], { OBSCUR_USE_DOCKER_RELAY: "1" }, { shell: false });

  return waitForService(
    "relay",
    () => probeTcpOpen("127.0.0.1", 7000),
    relayReadyTimeoutMs,
  );
};

const runStaticShellBuild = () => new Promise((resolve) => {
  const args = [path.join(repoRoot, "scripts", "dev-desktop-static.mjs")];
  if (flags.has("--online")) {
    args.push("--online");
  }
  if (flags.has("--rebuild")) {
    args.push("--rebuild");
  }
  args.push("--build-only");

  log("building static shell in parallel with infrastructure…");
  const child = spawn(process.execPath, args, {
    cwd: repoRoot,
    env,
    stdio: "inherit",
    shell: false,
  });
  children.push(child);
  child.on("exit", (code) => {
    resolve(code === 0);
  });
});

const shutdown = () => {
  children.forEach((child) => {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
  });
};

process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(143);
});

const run = async () => {
  if (useLiveWebpack) {
    log("online desktop — webpack live shell (expect route compile stalls; use for UI HMR only)");
  } else if (process.platform === "win32" && !skipCoordination) {
    log("Windows AIO — for faster boots use two terminals:");
    log("  1) pnpm dev:coordination");
    log("  2) pnpm dev:desktop:no-coord -- --rebuild");
  } else {
    log("AIO dev — coordination + relay + desktop in one terminal");
  }

  log("phase 1: coordination + relay (+ static shell build when not using live webpack)…");

  const shellBuildPromise = (!stackOnly && !useLiveWebpack)
    ? runStaticShellBuild()
    : Promise.resolve(true);

  const [coordinationOk, relayOk, shellBuildOk] = await Promise.all([
    ensureCoordination(),
    ensureRelay(),
    shellBuildPromise,
  ]);

  if (!coordinationOk) {
    console.error("[workspace-stack] FATAL: coordination did not become healthy.");
    console.error(`  Waited up to ${formatDuration(coordinationReadyTimeoutMs)}. Options:`);
    console.error("  • Two-terminal (recommended on Windows):");
    console.error("      Terminal 1: pnpm dev:coordination");
    console.error("      Terminal 2: pnpm dev:desktop:no-coord -- --rebuild");
    console.error("  • Increase timeout: OBSCUR_COORDINATION_READY_TIMEOUT_MS=600000 pnpm dev");
    console.error("  • Skip coordination: pnpm dev:desktop:no-coord");
    shutdown();
    process.exit(1);
  }
  if (!relayOk) {
    console.warn("[workspace-stack] WARN: local relay did not start on ws://localhost:7000.");
    console.warn("  Continuing without Docker relay — use public relays in Settings → Relays,");
    console.warn("  or set NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE=true for membership-only dev.");
    console.warn("  To require Docker: OBSCUR_REQUIRE_DOCKER_RELAY=1 pnpm dev:desktop:online");
    console.warn("  Manual relay: pnpm dev:relay:docker (Docker Desktop must be running)");
    if (process.env.OBSCUR_REQUIRE_DOCKER_RELAY === "1") {
      console.error("[workspace-stack] FATAL: OBSCUR_REQUIRE_DOCKER_RELAY=1 and relay is down.");
      shutdown();
      process.exit(1);
    }
  }
  if (!shellBuildOk) {
    console.error("[workspace-stack] FATAL: static shell build failed.");
    shutdown();
    process.exit(1);
  }

  log("workspace infrastructure ready");
  if (stackOnly) {
    log("stack-only mode — leaving coordination and relay running");
    return;
  }

  const desktopScript = useLiveWebpack
    ? path.join(repoRoot, "scripts", "dev-desktop-fast.mjs")
    : path.join(repoRoot, "scripts", "dev-desktop-static.mjs");
  const desktopArgs = [desktopScript];
  if (flags.has("--online")) {
    desktopArgs.push("--online");
  }
  if (flags.has("--rebuild")) {
    desktopArgs.push("--rebuild");
  }
  if (!useLiveWebpack) {
    desktopArgs.push("--skip-build");
  }
  if (useLiveWebpack) {
    log("phase 2: starting desktop shell (Next dev + webpack, then Tauri)…");
  } else {
    log("phase 2: starting Tauri (static shell already built)…");
  }
  const desktop = spawn(process.execPath, desktopArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    env,
    shell: false,
  });
  desktop.on("exit", (code) => {
    shutdown();
    process.exit(code ?? 1);
  });
};

run().catch((error) => {
  console.error("[workspace-stack] failed:", error instanceof Error ? error.message : error);
  shutdown();
  process.exit(1);
});
