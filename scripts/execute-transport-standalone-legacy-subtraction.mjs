#!/usr/bin/env node
/**
 * Maintainer gate for standalone legacy production subtraction.
 * Refuses execution until sign-off PASS and deletion approval env are both set.
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

const legacyFiles = [
  "app/features/transport-kernel/transport-kernel-standalone-publish-legacy.ts",
  "app/features/transport-kernel/transport-kernel-standalone-publish.ts",
];

const baselineReady = (
  legacyFiles.every((rel) => existsSync(join(pwaRoot, rel)))
  && existsSync(join(pwaRoot, "app/engine-lab/fixtures/transport-kernel-standalone-publish-legacy.archive.ts"))
  && existsSync(join(pwaRoot, "app/features/relays/hooks/relay-standalone-publish-port-subtracted.ts"))
  && existsSync(join(pwaRoot, "app/features/relays/hooks/relay-standalone-publish-port-thin.ts"))
);

if (!gateApproved || !baselineReady) {
  console.error("execute-transport-standalone-legacy-subtraction: BLOCKED");
  console.error(JSON.stringify({ gateApproved, baselineReady }, null, 2));
  process.exit(1);
}

console.log("execute-transport-standalone-legacy-subtraction: gate open — run W66 maintainer mechanical subtraction commit:");
console.log("See docs/program/transport-engine-w66-standalone-legacy-mechanical-subtraction-commit.md");
console.log("1. Delete STANDALONE_LEGACY_FILES_TO_DELETE");
console.log("2. Copy relay-standalone-publish-port-thin.ts into relay-standalone-publish-port.ts");
console.log("3. Remove transport-kernel-standalone-publish.test.ts or retarget archive");
console.log("4. Migrate gate-closed existence pins per STANDALONE_LEGACY_GATE_CLOSED_EXISTENCE_PIN_CONTRACTS");
console.log("5. Confirm evaluateStandaloneLegacyPostSubtractionBaseline → postSubtractionComplete");
console.log("6. pnpm verify:transport-engine-w67 && pnpm verify:engine-lab");
