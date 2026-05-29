#!/usr/bin/env node
/**
 * Dev workspace stack: coordination worker + local Nostr relay + desktop shell.
 *
 *   node scripts/dev-workspace-stack.mjs --online
 *   node scripts/dev-workspace-stack.mjs --stack-only   (no desktop — for second A/B instance)
 */
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergePwaEnvLocal } from "./load-pwa-env-local.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flags = new Set(process.argv.slice(2));
const stackOnly = flags.has("--stack-only");

const env = mergePwaEnvLocal({ ...process.env });
if (flags.has("--online")) {
  env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE = "1";
} else if (flags.has("--offline")) {
  env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE = "0";
}
if (flags.has("--webpack")) {
  env.OBSCUR_DESKTOP_DEV_BUNDLER = "webpack";
}

const children = [];

const log = (message) => {
  console.log(`[workspace-stack] ${message}`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const probeHttpOk = async (url, timeoutMs = 3000) => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      return false;
    }
    const json = await response.json().catch(() => null);
    return Boolean(json?.ok);
  } catch {
    return false;
  }
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

const waitFor = async (label, probe, maxMs = 60_000) => {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if (await probe()) {
      log(`${label} ready`);
      return true;
    }
    await sleep(750);
  }
  log(`${label} not ready after ${maxMs}ms`);
  return false;
};

const spawnBackground = (label, command, args, extraEnv = {}) => {
  log(`starting ${label}`);
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: { ...env, ...extraEnv },
    stdio: "inherit",
    shell: true,
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
  if (await probeHttpOk("http://127.0.0.1:8787/health", 1500)) {
    log("coordination already running");
    return true;
  }
  spawnBackground("coordination", "pnpm", ["-C", "apps/coordination", "dev"]);
  return waitFor("coordination", () => probeHttpOk("http://127.0.0.1:8787/health", 2000));
};

const ensureRelay = async () => {
  if (await probeTcpOpen("127.0.0.1", 7000)) {
    log("relay already listening on :7000");
    return true;
  }
  spawnBackground("relay", process.execPath, [
    path.join(repoRoot, "scripts", "dev-relay-docker.mjs"),
  ], { OBSCUR_USE_DOCKER_RELAY: "1" });
  return waitFor("relay", () => probeTcpOpen("127.0.0.1", 7000), 90_000);
};

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
  log("bringing up workspace infrastructure (coordination + relay)…");
  const coordinationOk = await ensureCoordination();
  const relayOk = await ensureRelay();

  if (!coordinationOk) {
    console.error("[workspace-stack] FATAL: coordination did not become healthy.");
    console.error("  Run manually: pnpm dev:coordination");
    shutdown();
    process.exit(1);
  }
  if (!relayOk) {
    console.error("[workspace-stack] FATAL: local relay did not start on ws://localhost:7000.");
    console.error("  Ensure Docker Desktop is running, then: pnpm dev:relay:docker");
    shutdown();
    process.exit(1);
  }

  log("workspace infrastructure ready");
  if (stackOnly) {
    log("stack-only mode — leaving coordination and relay running");
    return;
  }

  log("starting desktop shell…");
  const desktop = spawn("pnpm", ["-C", "apps/desktop", "dev"], {
    cwd: repoRoot,
    stdio: "inherit",
    env,
    shell: true,
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
