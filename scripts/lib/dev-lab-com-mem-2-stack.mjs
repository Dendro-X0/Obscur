/**
 * COM-MEM-2 infrastructure bootstrap — coordination :8787 + relay :7000.
 *
 * Used by verify:com-mem-2 when dev:desktop:online is not already running.
 * Spawns workers only when probes fail; optional grace for external stacks.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import {
  DEFAULT_COORDINATION_READY_TIMEOUT_MS,
  DEFAULT_RELAY_READY_TIMEOUT_MS,
  probeHttpOk,
  probePortOpen,
  waitForReady,
} from "./dev-stack-probes.mjs";

export const COM_MEM_2_COORDINATION_HEALTH_URL = "http://127.0.0.1:8787/health";
export const COM_MEM_2_RELAY_PORT = 7000;

/** @type {import('node:child_process').ChildProcess[]} */
const spawnedChildren = [];

const spawnBackground = (repoRoot, label, command, args, extraEnv = {}) => {
  const child = spawn(command, args, {
    cwd: repoRoot,
    stdio: "ignore",
    shell: false,
    env: { ...process.env, ...extraEnv },
  });
  spawnedChildren.push(child);
  return child;
};

export const probeComMem2InfraFromNode = async () => {
  const coordinationOk = await probeHttpOk(COM_MEM_2_COORDINATION_HEALTH_URL, 5000);
  const relayOk = await probePortOpen("127.0.0.1", COM_MEM_2_RELAY_PORT, 1500);
  return {
    ok: coordinationOk && relayOk,
    coordinationOk,
    relayOk,
    coordinationStatus: coordinationOk ? 200 : 0,
  };
};

/**
 * @param {Readonly<{ repoRoot: string; log?: (msg: string) => void }>} options
 */
export const ensureComMem2InfraReady = async ({ repoRoot, log = () => undefined }) => {
  if (process.env.OBSCUR_COM_MEM_2_SKIP_INFRA === "1") {
    const probe = await probeComMem2InfraFromNode();
    return { ...probe, spawned: false, skipped: true };
  }

  const graceMs = Number.parseInt(process.env.OBSCUR_COM_MEM_2_INFRA_GRACE_MS ?? "15000", 10);
  let coordinationOk = await probeHttpOk(COM_MEM_2_COORDINATION_HEALTH_URL, 3000);
  let relayOk = await probePortOpen("127.0.0.1", COM_MEM_2_RELAY_PORT, 1500);
  let spawned = false;

  if (!coordinationOk && graceMs > 0) {
    log(`coordination not ready — waiting ${graceMs}ms for external worker (pnpm dev:coordination / dev:desktop:online)…`);
    const grace = await waitForReady(
      "coordination (external grace)",
      () => probeHttpOk(COM_MEM_2_COORDINATION_HEALTH_URL, 5000),
      { maxMs: graceMs, onProgress: ({ elapsedMs }) => log(`… still waiting for coordination (${elapsedMs}ms)`) },
    );
    coordinationOk = grace.ok;
  }

  if (!coordinationOk) {
    log("spawning coordination worker (scripts/coordination-dev.mjs)…");
    spawnBackground(
      repoRoot,
      "coordination",
      process.execPath,
      [path.join(repoRoot, "scripts", "coordination-dev.mjs")],
      { OBSCUR_SKIP_PORT_CLEANUP: "1" },
    );
    spawned = true;
    const wait = await waitForReady(
      "coordination",
      () => probeHttpOk(COM_MEM_2_COORDINATION_HEALTH_URL, 5000),
      {
        maxMs: DEFAULT_COORDINATION_READY_TIMEOUT_MS,
        onProgress: ({ elapsedMs }) => log(`… coordination boot (${elapsedMs}ms)`),
      },
    );
    coordinationOk = wait.ok;
    if (!coordinationOk) {
      return {
        ok: false,
        coordinationOk: false,
        relayOk,
        coordinationStatus: 0,
        spawned,
        error: "coordination_boot_timeout",
      };
    }
  }

  if (!relayOk && graceMs > 0 && !spawned) {
    const grace = await waitForReady(
      "relay (external grace)",
      () => probePortOpen("127.0.0.1", COM_MEM_2_RELAY_PORT, 1500),
      { maxMs: Math.min(graceMs, 30_000) },
    );
    relayOk = grace.ok;
  }

  if (!relayOk) {
    log("spawning local relay on :7000 (scripts/dev-relay-docker.mjs)…");
    spawnBackground(
      repoRoot,
      "relay",
      process.execPath,
      [path.join(repoRoot, "scripts", "dev-relay-docker.mjs")],
      { OBSCUR_USE_DOCKER_RELAY: "1" },
    );
    spawned = true;
    const wait = await waitForReady(
      "relay",
      () => probePortOpen("127.0.0.1", COM_MEM_2_RELAY_PORT, 1500),
      {
        maxMs: DEFAULT_RELAY_READY_TIMEOUT_MS,
        onProgress: ({ elapsedMs }) => log(`… relay boot (${elapsedMs}ms)`),
      },
    );
    relayOk = wait.ok;
  }

  return {
    ok: coordinationOk && relayOk,
    coordinationOk,
    relayOk,
    coordinationStatus: coordinationOk ? 200 : 0,
    spawned,
    error: coordinationOk && relayOk ? null : (coordinationOk ? "relay_boot_timeout" : "coordination_boot_timeout"),
  };
};

export const stopComMem2InfraSpawned = () => {
  for (const child of spawnedChildren.splice(0)) {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
};
