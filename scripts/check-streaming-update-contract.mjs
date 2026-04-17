#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const UPDATE_POLICY_PATH = resolve(
  repoRoot,
  "apps/desktop/release/streaming-update-policy.example.json",
);
const TAURI_CONF_PATH = resolve(
  repoRoot,
  "apps/desktop/src-tauri/tauri.conf.json",
);

const isObject = (value) => typeof value === "object" && value !== null;
const isSemver = (value) => typeof value === "string" && /^\d+(\.\d+){1,3}(-[A-Za-z0-9.-]+)?$/.test(value.trim().replace(/^v/i, ""));
const isChecksum = (value) => typeof value === "string" && /^[a-fA-F0-9]{64}$/.test(value.trim());

const validateUpdatePolicy = (policy) => {
  const problems = [];
  if (!isObject(policy)) {
    return ["manifest must be an object"];
  }
  if (!isSemver(policy.version)) {
    problems.push("version must be semver-like");
  }
  if (!["stable", "beta", "canary"].includes(policy.channel)) {
    problems.push("channel must be stable|beta|canary");
  }
  if (!Number.isFinite(policy.rolloutPercentage) || policy.rolloutPercentage < 0 || policy.rolloutPercentage > 100) {
    problems.push("rolloutPercentage must be between 0 and 100");
  }
  if (typeof policy.killSwitch !== "boolean") {
    problems.push("killSwitch must be boolean");
  }
  if (policy.minSafeVersion && !isSemver(policy.minSafeVersion)) {
    problems.push("minSafeVersion must be semver-like when present");
  }
  if (policy.releaseNotesUrl && (typeof policy.releaseNotesUrl !== "string" || !/^https?:\/\//.test(policy.releaseNotesUrl))) {
    problems.push("releaseNotesUrl must be http(s) when present");
  }
  if (!isObject(policy.artifacts) || Object.keys(policy.artifacts).length === 0) {
    problems.push("artifacts must be a non-empty object");
  } else {
    for (const [platform, artifact] of Object.entries(policy.artifacts)) {
      if (!isObject(artifact)) {
        problems.push(`artifact for ${platform} must be an object`);
        continue;
      }
      if (typeof artifact.url !== "string" || !artifact.url.startsWith("https://")) {
        problems.push(`artifact ${platform}.url must be https://`);
      }
      if (typeof artifact.signature !== "string" || artifact.signature.trim().length === 0) {
        problems.push(`artifact ${platform}.signature must be non-empty`);
      }
      if (!isChecksum(artifact.checksumSha256)) {
        problems.push(`artifact ${platform}.checksumSha256 must be 64 hex chars`);
      }
    }
  }
  return problems;
};

const validateTauriUpdater = (config) => {
  const problems = [];
  if (!isObject(config)) {
    return ["tauri config must be an object"];
  }
  if (config.bundle?.createUpdaterArtifacts !== true) {
    problems.push("bundle.createUpdaterArtifacts must be true");
  }
  const updater = config.plugins?.updater;
  if (!isObject(updater)) {
    return ["plugins.updater is missing"];
  }
  if (updater.active !== true) {
    problems.push("plugins.updater.active must be true");
  }
  if (!Array.isArray(updater.endpoints) || updater.endpoints.length === 0) {
    problems.push("plugins.updater.endpoints must include at least one endpoint");
  } else {
    const hasLatestJson = updater.endpoints.some((endpoint) => typeof endpoint === "string" && endpoint.includes("latest.json"));
    if (!hasLatestJson) {
      problems.push("plugins.updater.endpoints must include a latest.json endpoint");
    }
  }
  if (typeof updater.pubkey !== "string" || updater.pubkey.trim().length === 0) {
    problems.push("plugins.updater.pubkey must be configured");
  }
  return problems;
};

const main = async () => {
  const [policyRaw, tauriRaw] = await Promise.all([
    readFile(UPDATE_POLICY_PATH, "utf8"),
    readFile(TAURI_CONF_PATH, "utf8"),
  ]);
  const policy = JSON.parse(policyRaw);
  const tauriConfig = JSON.parse(tauriRaw);

  const problems = [
    ...validateUpdatePolicy(policy).map((problem) => `update-policy: ${problem}`),
    ...validateTauriUpdater(tauriConfig).map((problem) => `tauri-updater: ${problem}`),
  ];

  if (problems.length > 0) {
    console.error("[release:streaming-update-contract] Failed:");
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }

  console.log("[release:streaming-update-contract] Streaming update contract checks passed.");
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[release:streaming-update-contract] Failed: ${message}`);
  process.exit(1);
});
