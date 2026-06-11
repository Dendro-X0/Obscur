#!/usr/bin/env node
/**
 * P4 release perf parity — static reference vs candidate capture (e.g. second static run).
 *
 * Usage:
 *   node scripts/v2-perf-release-budget.mjs [reference.json] [candidate.json]
 *
 * Defaults: docs/assets/perf/v2-static-prod.json vs itself (sanity) or second path.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateReleasePerfParity,
  parseBaselineReport,
  RELEASE_PERF_MAX_DELTA_RATIO,
} from "./obscur-shell-perf-baseline-lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultReference = path.join(repoRoot, "docs", "assets", "perf", "v2-static-prod.json");
const args = process.argv.slice(2);
const referencePath = args[0] ?? defaultReference;
const candidatePath = args[1] ?? referencePath;

for (const filePath of [referencePath, candidatePath]) {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing capture: ${filePath}`);
    process.exit(1);
  }
}

const reference = parseBaselineReport(JSON.parse(fs.readFileSync(referencePath, "utf8")));
const candidate = parseBaselineReport(JSON.parse(fs.readFileSync(candidatePath, "utf8")));
const result = evaluateReleasePerfParity(reference, candidate);

console.log("[p4] Release perf parity:", result.pass ? "PASS" : "FAIL");
console.log("[p4] Max delta ratio budget:", RELEASE_PERF_MAX_DELTA_RATIO);
console.log("[p4] Median nav ratio:", result.medianNavRatio);
console.log("[p4] Reference median ms:", result.reference.medianNavMs);
console.log("[p4] Candidate median ms:", result.candidate.medianNavMs);
if (result.issues.length > 0) {
  console.log("[p4] Issues:", result.issues.join(", "));
}

process.exit(result.pass ? 0 : 1);
