#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const mustExist = [
  ".github/workflows/release.yml",
  ".github/workflows/docs-check.yml",
  ".github/workflows/version-check.yml",
  ".github/workflows/reliability-gates.yml",
];

const requiredReleaseWorkflowSnippets = [
  "name: Obscur Full Release",
  "preflight-checks:",
  "build-web-pwa:",
  "verify-artifacts:",
  "publish-release:",
  "Check version alignment",
  "Check release source integrity",
  "Check docs consistency",
  "Run release test pack (reliability gate)",
  "Verify required artifact matrix",
  "Run desktop artifact version parity check",
  "Run Android artifact version parity check (non-blocking)",
  "pnpm release:artifact-version-parity -- --assets-dir release-assets",
  "Download Web/PWA Artifact",
  "web pwa bundle (.tar.gz)",
  "github.event_name == 'workflow_dispatch'",
  "inputs.publish_release == true",
  "android_signing_state",
  "ios_lane_state",
];

const requiredReliabilityWorkflowSnippets = [
  "name: reliability-gates",
  "pull_request:",
  "push:",
  "release-test-pack:",
  "Detect reliability-scope changes",
  "dorny/paths-filter@v3",
  "Run release test pack (CI gate)",
  "pnpm release:test-pack -- --skip-preflight",
  "Skip release test pack (non-reliability changes only)",
];

const missing = [];

for (const rel of mustExist) {
  const full = resolve(rootDir, rel);
  let content = "";
  try {
    content = readFileSync(full, "utf8");
  } catch {
    missing.push(rel);
    continue;
  }
  if (rel.endsWith("release.yml")) {
    for (const snippet of requiredReleaseWorkflowSnippets) {
      if (!content.includes(snippet)) {
        missing.push(`${rel} :: missing snippet "${snippet}"`);
      }
    }
  }
  if (rel.endsWith("reliability-gates.yml")) {
    for (const snippet of requiredReliabilityWorkflowSnippets) {
      if (!content.includes(snippet)) {
        missing.push(`${rel} :: missing snippet "${snippet}"`);
      }
    }
  }
}

if (missing.length > 0) {
  console.error("[release:ci-signal-check] Missing required CI signal contracts:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("[release:ci-signal-check] CI signal contracts are present.");
