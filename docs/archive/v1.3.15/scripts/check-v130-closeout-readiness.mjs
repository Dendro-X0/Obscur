#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const args = process.argv.slice(2);

const hasFlag = (flag) => args.includes(flag);
const getArgValue = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] ?? null;
};

const resolveCommand = (cmd) => {
  if (process.platform === "win32" && cmd === "pnpm") {
    return "pnpm.cmd";
  }
  return cmd;
};

const quoteShellArg = (value) => {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
};

const run = (cmd, commandArgs, options = {}) => {
  const command = resolveCommand(cmd);
  const baseOptions = {
    cwd: rootDir,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  };
  const result = process.platform === "win32"
    ? spawnSync([command, ...commandArgs].map(quoteShellArg).join(" "), {
      ...baseOptions,
      shell: true,
    })
    : spawnSync(command, commandArgs, {
      ...baseOptions,
    });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(output || `${cmd} ${commandArgs.join(" ")} failed`);
  }
  return result.stdout ?? "";
};

const readJson = (relativePath) => {
  const fullPath = resolve(rootDir, relativePath);
  return JSON.parse(readFileSync(fullPath, "utf8"));
};

const assertStrictBundleReady = () => {
  const passPayload = readJson("docs/assets/demo/v1.2.5/m10-v130-release-candidate-pass.json");
  if (passPayload?.releaseCandidateGate?.pass !== true) {
    throw new Error("release-candidate pass payload is not strict-ready.");
  }

  const digestPayload = readJson("docs/assets/demo/v1.2.5/m10-digest-summary.json");
  if (digestPayload?.summary?.m10TrustControls == null) {
    throw new Error("digest summary is missing summary.m10TrustControls.");
  }

  const slicesPayload = readJson("docs/assets/demo/v1.2.5/m10-event-slices.json");
  const requiredSliceKeys = [
    "cp2",
    "cp3Readiness",
    "cp3Suite",
    "cp4Closeout",
    "v130Closeout",
    "v130Evidence",
    "v130ReleaseCandidate",
  ];
  const missingKeys = requiredSliceKeys.filter((key) => (
    !Array.isArray(slicesPayload?.events?.[key]) || slicesPayload.events[key].length < 1
  ));
  if (missingKeys.length > 0) {
    throw new Error(`missing required non-empty event slices: ${missingKeys.join(", ")}`);
  }
};

const verifyWorkingTreeClean = () => {
  const status = run("git", ["status", "--porcelain"], { capture: true }).trim();
  if (status.length > 0) {
    throw new Error(
      "Working tree is not clean. Commit/stash changes or rerun with --allow-dirty for local-only checks."
    );
  }
};

const main = () => {
  const includePreflight = hasFlag("--include-preflight");
  const allowDirty = hasFlag("--allow-dirty");
  const refreshRcStatus = hasFlag("--refresh-rc-status");
  const strictManualPacket = hasFlag("--strict-manual-packet");
  const preflightTag = getArgValue("--tag") ?? "v1.3.0";

  if (!allowDirty) {
    console.log("[v130:closeout] Verifying clean working tree...");
    verifyWorkingTreeClean();
  } else {
    console.log("[v130:closeout] Skipping clean-tree gate (--allow-dirty).");
  }

  console.log("[v130:closeout] Running strict RC artifact verification...");
  run("pnpm", ["demo:m10:rc:check"]);
  if (refreshRcStatus) {
    run("pnpm", ["demo:m10:rc:status"]);
  }
  assertStrictBundleReady();

  console.log("[v130:closeout] Verifying v1.3.0 manual evidence packet...");
  if (strictManualPacket) {
    run("pnpm", ["demo:v130:check:strict"]);
  } else {
    run("pnpm", ["demo:v130:check"]);
  }

  console.log("[v130:closeout] Running documentation + version alignment checks...");
  run("pnpm", ["version:check"]);
  run("pnpm", ["docs:check"]);

  console.log("[v130:closeout] Running focused M10 validation...");
  run("pnpm", ["-C", "apps/pwa", "exec", "vitest", "run", "app/shared/m10-trust-controls-bridge.test.ts"]);
  run("pnpm", ["-C", "apps/pwa", "exec", "tsc", "--noEmit", "--pretty", "false"]);

  if (includePreflight) {
    console.log(`[v130:closeout] Running release preflight for ${preflightTag}...`);
    const preflightArgs = ["release:preflight", "--", "--tag", preflightTag];
    if (allowDirty) {
      preflightArgs.push("--allow-dirty", "1");
    }
    run("pnpm", preflightArgs);
  } else {
    console.log("[v130:closeout] Skipping release preflight (use --include-preflight to enable).");
  }

  console.log("[v130:closeout] Passed.");
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[v130:closeout] Failed: ${message}`);
  process.exit(1);
}
