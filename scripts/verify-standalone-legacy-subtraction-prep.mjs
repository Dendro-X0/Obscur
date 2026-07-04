#!/usr/bin/env node
/**
 * Read-only prep band readiness report for standalone legacy subtraction (w55–w67).
 * Does not delete files or flip pins.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const pwaRoot = join(repoRoot, "apps/pwa");
const signOffPath = join(repoRoot, "docs/handoffs/transport-engine-smoke-sign-off-recorded.md");
const signOffMarkdown = readFileSync(signOffPath, "utf8");

const gateApproved = (
  /\*\*Decision:\*\*\s*PASS\b/.test(signOffMarkdown)
  && process.env.NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED === "1"
);

const pwaRequiredPaths = [
  "app/features/transport-kernel/transport-kernel-standalone-publish-legacy.ts",
  "app/features/transport-kernel/transport-kernel-standalone-publish.ts",
  "app/engine-lab/fixtures/transport-kernel-standalone-publish-legacy.archive.ts",
  "app/features/relays/hooks/relay-standalone-publish-port-subtracted.ts",
  "app/features/relays/hooks/relay-standalone-publish-port-thin.ts",
  "app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-prep-band-closure-readiness.ts",
];

const repoRequiredPaths = [
  "docs/program/transport-engine-w68-standalone-legacy-subtraction-prep-band-closure.md",
];

const artifactsPresent = (
  pwaRequiredPaths.every((rel) => existsSync(join(pwaRoot, rel)))
  && repoRequiredPaths.every((rel) => existsSync(join(repoRoot, rel)))
);

const portText = readFileSync(
  join(pwaRoot, "app/features/relays/hooks/relay-standalone-publish-port.ts"),
  "utf8",
);
const portImportsLegacy = portText.includes("transport-kernel-standalone-publish-legacy");

const prepBandComplete = artifactsPresent && portImportsLegacy;

const report = {
  gateApproved,
  prepBandComplete,
  readyForMaintainerExecution: gateApproved && prepBandComplete,
  artifactsPresent,
  portImportsLegacy,
};

console.log("verify-standalone-legacy-subtraction-prep:");
console.log(JSON.stringify(report, null, 2));

if (!prepBandComplete) {
  process.exit(1);
}

if (report.readyForMaintainerExecution) {
  console.log("prep band complete — maintainer may execute W66/W67 subtraction");
} else {
  console.log("prep band complete — awaiting W53 smoke sign-off (Decision: PASS + deletion env)");
}
