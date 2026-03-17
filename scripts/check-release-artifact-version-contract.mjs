#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const workflowPath = resolve(rootDir, ".github/workflows/release.yml");

const source = readFileSync(workflowPath, "utf8");

const requiredSnippets = [
  "Check release source integrity",
  "pnpm release:integrity-check",
  "Upload Android Build Metadata",
  "output-metadata.json",
  "Run artifact version parity check",
  "pnpm release:artifact-version-parity -- --assets-dir release-assets",
  "android_signing_state",
  "ios_lane_state",
];

const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));

const legacyAutoPublishCondition = "(github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v'))";
if (source.includes(legacyAutoPublishCondition)) {
  missing.push(
    "publish-release still contains push-tag auto publish condition; publish must be manual workflow_dispatch only"
  );
}

const manualPublishContractSnippets = [
  "github.event_name == 'workflow_dispatch'",
  "inputs.publish_release == true",
  "startsWith(github.ref, 'refs/tags/v')",
];
for (const snippet of manualPublishContractSnippets) {
  if (!source.includes(snippet)) {
    missing.push(`missing manual publish contract snippet "${snippet}"`);
  }
}

if (missing.length > 0) {
  console.error("[release:artifact-version-contract-check] Missing required release workflow contract snippets:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("[release:artifact-version-contract-check] Release artifact-version and publish-mode contracts are present.");
