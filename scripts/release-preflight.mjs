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
    "scripts/check-release-source-integrity.mjs",
    "scripts/check-release-artifact-version-contract.mjs",
    "scripts/check-streaming-update-contract.mjs",
    "apps/desktop/src-tauri/tauri.conf.json",
    "apps/desktop/release/streaming-update-policy.example.json",
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

const verifyWorkingTreeClean = () => {
  const status = run("git", ["status", "--porcelain"], { capture: true }).trim();
  if (status.length > 0) {
    throw new Error("Working tree is not clean. Commit or stash changes before running release preflight.");
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

const verifyLocalTagPointsToHead = (tagName) => {
  let localRef = "";
  try {
    localRef = run("git", ["show-ref", "--tags", "--verify", `refs/tags/${tagName}`], { capture: true }).trim();
  } catch {
    localRef = "";
  }
  if (!localRef) {
    return;
  }
  const localTagCommit = localRef.split(" ")[0];
  const headCommit = run("git", ["rev-parse", "HEAD"], { capture: true }).trim();
  if (localTagCommit !== headCommit) {
    throw new Error(
      `Local tag ${tagName} already exists but does not point to HEAD (${localTagCommit} != ${headCommit}).`
    );
  }
};

const verifyVersionConsistency = () => {
  const rootVersion = getRootVersion();
  const versionJson = JSON.parse(readFileSync(resolve(rootDir, "version.json"), "utf8"));
  if (versionJson.version !== rootVersion) {
    throw new Error(`version.json (${versionJson.version}) does not match package.json (${rootVersion}).`);
  }
};

const verifyV090FlagPolicyCoherence = () => {
  const privacySettingsPath = resolve(
    rootDir,
    "apps/pwa/app/features/settings/services/privacy-settings-service.ts"
  );
  const rolloutPolicyPath = resolve(
    rootDir,
    "apps/pwa/app/features/settings/services/v090-rollout-policy.ts"
  );
  const privacySource = readFileSync(privacySettingsPath, "utf8");
  const rolloutSource = readFileSync(rolloutPolicyPath, "utf8");
  const requiredPrivacyDefaults = [
    "stabilityModeV090: true",
    "deterministicDiscoveryV090: false",
    "protocolCoreRustV090: false",
    "x3dhRatchetV090: false",
  ];
  for (const needle of requiredPrivacyDefaults) {
    if (!privacySource.includes(needle)) {
      throw new Error(`Missing required v0.9 default policy in privacy settings: ${needle}`);
    }
  }
  const requiredPolicyRules = [
    "normalized.stabilityModeV090",
    "normalized.deterministicDiscoveryV090 = false",
    "normalized.protocolCoreRustV090 = false",
    "normalized.x3dhRatchetV090 = false",
    "if (!normalized.protocolCoreRustV090)",
  ];
  for (const needle of requiredPolicyRules) {
    if (!rolloutSource.includes(needle)) {
      throw new Error(`Missing required v0.9 rollout policy rule: ${needle}`);
    }
  }
};

const extractQuotedCommands = (source) => {
  const matches = source.match(/"([a-z0-9_]+)"/g) ?? [];
  return new Set(matches.map((value) => value.slice(1, -1)));
};

const verifyProtocolAclParity = () => {
  const aclPath = resolve(rootDir, "apps/desktop/src-tauri/permissions/app.toml");
  const aclSource = readFileSync(aclPath, "utf8");
  const adapterPath = resolve(rootDir, "apps/pwa/app/features/runtime/protocol-core-adapter.ts");
  const powPath = resolve(rootDir, "apps/pwa/app/features/crypto/pow-service.ts");
  const adapterSource = readFileSync(adapterPath, "utf8");
  const powSource = readFileSync(powPath, "utf8");

  const invokedFromAdapter = [...adapterSource.matchAll(/"(protocol_[a-z0-9_]+)"/g)].map((m) => m[1]);
  const invokedFromPow = [...powSource.matchAll(/"(mine_pow)"/g)].map((m) => m[1]);
  const invoked = new Set([...invokedFromAdapter, ...invokedFromPow]);
  const aclCommands = extractQuotedCommands(aclSource);

  const missing = [...invoked].filter((cmd) => !aclCommands.has(cmd));
  if (missing.length > 0) {
    throw new Error(`ACL parity failed. Missing Tauri permissions for commands:\n- ${missing.join("\n- ")}`);
  }
};

const main = () => {
  const requestedTag = getArg("--tag");
  const allowDirty = getArg("--allow-dirty") === "1" || getArg("--allow-dirty") === "true";
  const rootVersion = getRootVersion();
  const defaultTag = `v${rootVersion}`;
  const tag = requestedTag ?? defaultTag;

  console.log(`[release:preflight] Target tag: ${tag}`);
  verifyRequiredPaths();
  verifyBranchContext();
  if (!allowDirty) {
    verifyWorkingTreeClean();
  }
  verifyVersionConsistency();
  verifyV090FlagPolicyCoherence();
  verifyProtocolAclParity();
  verifyTagDoesNotExistRemotely(tag);
  verifyLocalTagPointsToHead(tag);

  console.log("[release:preflight] Running release source integrity check...");
  run("pnpm", ["release:integrity-check"]);
  console.log("[release:preflight] Verifying artifact version parity workflow contract...");
  run("pnpm", ["release:artifact-version-contract-check"]);
  console.log("[release:preflight] Running version alignment check...");
  run("pnpm", ["version:check"]);
  console.log("[release:preflight] Running docs check...");
  run("pnpm", ["docs:check"]);
  console.log("[release:preflight] Verifying streaming update contract...");
  run("pnpm", ["release:streaming-update-contract:check"]);
  console.log("[release:preflight] Verifying release artifact matrix workflow...");
  run("pnpm", ["release:artifact-matrix-check"]);
  console.log("[release:preflight] Verifying CI signal contract...");
  run("pnpm", ["release:ci-signal-check"]);

  console.log("[release:preflight] Passed");
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[release:preflight] Failed: ${message}`);
  process.exit(1);
}
