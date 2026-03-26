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

const run = (cmd, commandArgs) => {
  const command = resolveCommand(cmd);
  const result = process.platform === "win32"
    ? spawnSync([command, ...commandArgs].map(quoteShellArg).join(" "), {
      cwd: rootDir,
      stdio: "inherit",
      shell: true,
    })
    : spawnSync(command, commandArgs, {
      cwd: rootDir,
      stdio: "inherit",
    });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${commandArgs.join(" ")} failed`);
  }
};

const assertStrictReady = () => {
  const statusPath = resolve(rootDir, "docs/assets/demo/v1.2.5/m10-status.json");
  const status = JSON.parse(readFileSync(statusPath, "utf8"));
  if (status?.strictReady !== true) {
    throw new Error("m10-status strictReady is not true. Run demo:m10:rc flow first.");
  }
};

const main = () => {
  const includePreflight = hasFlag("--include-preflight");
  const allowDirty = hasFlag("--allow-dirty");
  const preflightTag = getArgValue("--tag") ?? "v1.3.0";

  console.log("[v130:closeout] Running strict RC artifact verification...");
  run("pnpm", ["demo:m10:rc:check"]);
  run("pnpm", ["demo:m10:rc:status"]);
  assertStrictReady();

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
