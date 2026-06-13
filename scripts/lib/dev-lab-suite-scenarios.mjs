/** Loaded from apps/pwa/app/features/dev-lab/dev-lab-suite-manifest.json (single source of truth). */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const manifestPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../apps/pwa/app/features/dev-lab/dev-lab-suite-manifest.json",
);

/** @type {{ schema: string; cliOnly: string[]; terminal: string[]; suites: Record<string, string[]> }} */
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

export const DEV_LAB_SUITE_SCENARIOS = manifest.suites;

const CLI_ONLY = new Set(manifest.cliOnly);
const TERMINAL = new Set(manifest.terminal);

export function resolveSuiteScenarioIds(suite, options = {}) {
  const ids = DEV_LAB_SUITE_SCENARIOS[suite] ?? DEV_LAB_SUITE_SCENARIOS.core;
  return ids.filter((id) => {
    if (!options.includeCliOnly && CLI_ONLY.has(id)) {
      return false;
    }
    if (!options.includeTerminal && TERMINAL.has(id)) {
      return false;
    }
    return true;
  });
}

export function buildBenchmarkSummary(scenarios) {
  const categories = {
    auth: { total: 0, passed: 0 },
    shell: { total: 0, passed: 0 },
    navigation: { total: 0, passed: 0 },
    settings: { total: 0, passed: 0 },
    runtime: { total: 0, passed: 0 },
    messaging: { total: 0, passed: 0 },
    network: { total: 0, passed: 0 },
    security: { total: 0, passed: 0 },
  };
  for (const scenario of scenarios) {
    const bucket = categories[scenario.category];
    if (bucket) {
      bucket.total += 1;
      if (scenario.passed) {
        bucket.passed += 1;
      }
    }
  }
  const failedScenarioIds = scenarios.filter((s) => !s.passed).map((s) => s.id);
  return {
    total: scenarios.length,
    passed: scenarios.filter((s) => s.passed).length,
    failed: failedScenarioIds.length,
    failedScenarioIds,
    categories,
  };
}

export function loadDevLabSuiteManifest() {
  return manifest;
}
