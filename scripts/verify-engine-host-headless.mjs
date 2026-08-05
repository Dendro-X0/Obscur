#!/usr/bin/env node
/**
 * Headless engine-host gate — libobscur dispatch tests + CLI smoke (no WebView).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const libobscurDir = join(repoRoot, "packages/libobscur");
const binaryName = process.platform === "win32" ? "engine-lab-headless.exe" : "engine-lab-headless";
/** Workspace Cargo.toml owns target/; package-local target/ is unused when members=[libobscur]. */
const resolveHeadlessBinaryPath = () => {
  const candidates = [
    join(repoRoot, "target", "debug", binaryName),
    join(libobscurDir, "target", "debug", binaryName),
  ];
  return candidates.find((path) => existsSync(path)) ?? candidates[0];
};

const run = (cwd, command, args) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status})\n${result.stderr || result.stdout}`,
    );
  }
  return result;
};

run(libobscurDir, "cargo", ["test", "engine_invoke", "--", "--nocapture"]);
run(libobscurDir, "cargo", ["build", "--bin", "engine-lab-headless"]);

const binaryPath = resolveHeadlessBinaryPath();
if (!existsSync(binaryPath)) {
  throw new Error(`engine-lab-headless binary missing: ${binaryPath}`);
}

const tempDir = mkdtempSync(join(tmpdir(), "obscur-engine-lab-"));
const dbPath = join(tempDir, "lab.sqlite");
const request = JSON.stringify({
  engine: "dm",
  method: "listConversations",
  scope: { profileId: "headless-gate" },
});

const smoke = spawnSync(binaryPath, ["--db", dbPath], {
  input: request,
  encoding: "utf8",
});

if (smoke.status !== 0) {
  throw new Error(`engine-lab-headless smoke failed: ${smoke.stderr || smoke.stdout}`);
}

const parsed = JSON.parse(smoke.stdout.trim());
if (!parsed.ok || !Array.isArray(parsed.data)) {
  throw new Error(`unexpected headless invoke result: ${smoke.stdout}`);
}

console.log("verify-engine-host-headless: ok");
