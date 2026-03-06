#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

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

const run = (cmd, args, options = {}) => {
  const command = resolveCommand(cmd);
  const baseOptions = {
    cwd: rootDir,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  };
  const result = process.platform === "win32"
    ? spawnSync([command, ...args].map(quoteShellArg).join(" "), {
      ...baseOptions,
      shell: true,
    })
    : spawnSync(command, args, baseOptions);
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(output || `${cmd} ${args.join(" ")} failed`);
  }
  return result.stdout ?? "";
};

const getArg = (name) => {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
};

const verifyRequiredPaths = () => {
  const required = [
    ".github/workflows/release.yml",
    "scripts/check-version-alignment.mjs",
    "scripts/docs-check.mjs",
    "apps/desktop/src-tauri/tauri.conf.json",
    "version.json",
  ];
  const missing = required.filter((relPath) => !existsSync(resolve(rootDir, relPath)));
  if (missing.length > 0) {
    throw new Error(`Missing required release paths:\n- ${missing.join("\n- ")}`);
  }
};

const verifyBranchContext = () => {
  const branch = run("git", ["branch", "--show-current"], { capture: true }).trim();
  if (!branch) {
    throw new Error("Detached HEAD is not allowed for release preflight.");
  }
  if (branch !== "main") {
    throw new Error(`Release preflight requires main branch. Current branch: ${branch}`);
  }
};

const getRootVersion = () => {
  const rootPkg = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8"));
  if (!rootPkg.version || typeof rootPkg.version !== "string") {
    throw new Error("package.json missing valid version field.");
  }
  return rootPkg.version;
};

const verifyTagDoesNotExistRemotely = (tagName) => {
  const output = run("git", ["ls-remote", "--tags", "origin"], { capture: true });
  const lines = output.split(/\r?\n/).filter(Boolean);
  const refs = new Set(lines.map((line) => line.split("\t")[1]).filter(Boolean));
  if (refs.has(`refs/tags/${tagName}`) || refs.has(`refs/tags/${tagName}^{}`)) {
    throw new Error(`Remote tag already exists: ${tagName}. Never retag. Bump version and tag next patch.`);
  }
};

const verifyVersionConsistency = () => {
  const rootVersion = getRootVersion();
  const versionJson = JSON.parse(readFileSync(resolve(rootDir, "version.json"), "utf8"));
  if (versionJson.version !== rootVersion) {
    throw new Error(`version.json (${versionJson.version}) does not match package.json (${rootVersion}).`);
  }
};

const main = () => {
  const requestedTag = getArg("--tag");
  const rootVersion = getRootVersion();
  const defaultTag = `v${rootVersion}`;
  const tag = requestedTag ?? defaultTag;

  console.log(`[release:preflight] Target tag: ${tag}`);
  verifyRequiredPaths();
  verifyBranchContext();
  verifyVersionConsistency();
  verifyTagDoesNotExistRemotely(tag);

  console.log("[release:preflight] Running version alignment check...");
  run("pnpm", ["version:check"]);
  console.log("[release:preflight] Running docs check...");
  run("pnpm", ["docs:check"]);
  console.log("[release:preflight] Verifying release artifact matrix workflow...");
  run("pnpm", ["release:artifact-matrix-check"]);

  console.log("[release:preflight] Passed");
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[release:preflight] Failed: ${message}`);
  process.exit(1);
}
