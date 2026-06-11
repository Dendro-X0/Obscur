#!/usr/bin/env node
/**
 * Handoff gate — one command before merge claims on desktop UX/DM/shell/relay.
 *
 *   Terminal A: pnpm dev:desktop:online
 *   Terminal B: pnpm verify:handoff
 *
 * Runs (in order):
 *   1. verify:stability
 *   2. verify:dev-lab
 *   3. dev:lab:benchmark
 *
 * Fails fast when the dev app is not reachable (default http://127.0.0.1:3340).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const readArg = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};

const appBase = (
  readArg("--base-url", null)
  ?? process.env.OBSCUR_DEV_LAB_BASE_URL?.trim()
  ?? "http://127.0.0.1:3340"
).replace(/\/$/, "");

const log = (message) => {
  console.log(`[verify:handoff] ${message}`);
};

const checkDevServer = async (baseUrl, timeoutMs = 8_000) => {
  const url = `${baseUrl}/`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
};

const runStep = (label, scriptName) => {
  log(label);
  const result = spawnSync("pnpm", [scriptName], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const main = async () => {
  log(`checking dev app at ${appBase}`);
  const health = await checkDevServer(appBase);
  if (!health.ok) {
    console.error(`[verify:handoff] Dev app not reachable at ${appBase} (${health.reason}).`);
    console.error("[verify:handoff] Start Terminal A: pnpm dev:desktop:online");
    console.error("[verify:handoff] Override URL: pnpm verify:handoff -- --base-url http://127.0.0.1:3340");
    process.exit(1);
  }

  runStep("step 1/3: verify:stability", "verify:stability");
  runStep("step 2/3: verify:dev-lab", "verify:dev-lab");
  runStep("step 3/3: dev:lab:benchmark", "dev:lab:benchmark");
  log("handoff gate passed (stability + dev-lab unit + core benchmark)");
};

main().catch((error) => {
  console.error("[verify:handoff]", error instanceof Error ? error.message : error);
  process.exit(1);
});
