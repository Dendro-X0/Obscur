#!/usr/bin/env node
/**
 * Print current semver band and recommended next bump (no file writes).
 *
 * Bands (see docs/program/version-line-policy.md):
 *   1.7.x — Phase 3 closeout
 *   1.8.x — Lane C/T/X/P (community, trust, experience, platform prep)
 *   1.9.x — Lane K (kernel + coordination backend)
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8")).version;
const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
if (!match) {
  console.error(`[version:plan] Invalid root version: ${version}`);
  process.exit(1);
}

const major = Number(match[1]);
const minor = Number(match[2]);
const patch = Number(match[3]);

const bandLabel = (() => {
  if (major === 1 && minor === 7) return "v1.7.x — Phase 3 closeout";
  if (major === 1 && minor === 8) return "v1.8.x — Lane C / T / X / P";
  if (major === 1 && minor === 9) return "v1.9.x — Lane K (kernel + coordination)";
  return `${major}.${minor}.x — outside documented pre-2.0 bands`;
})();

const nextPatch = `${major}.${minor}.${patch + 1}`;
const nextMinor = `${major}.${minor + 1}.0`;
const nextMajor = `${major + 1}.0.0`;

console.log(`Current:  v${version}`);
console.log(`Band:     ${bandLabel}`);
console.log("");
console.log("Next tags (use pnpm version:bump <type>):");
console.log(`  patch  → v${nextPatch}   (default: one milestone / gate slice)`);
console.log(`  minor  → v${nextMinor}   (band opener when roadmap says so)`);
console.log(`  major  → v${nextMajor}   (reserved for breaking program jumps; v2.0.0 is the north star)`);
console.log("");
console.log("After bump: pnpm version:sync && pnpm version:check");
console.log("Pre-tag:    update CHANGELOG + docs/releases/v* gate row");
