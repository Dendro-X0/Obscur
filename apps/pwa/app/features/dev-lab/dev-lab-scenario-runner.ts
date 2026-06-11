import { DEV_LAB_VERSION } from "./dev-lab-policy";
import { probeDevLabShellHealth } from "./dev-lab-shell-health";
import {
  listDevLabScenarios,
  resolveDevLabScenario,
  resolveDevLabSuiteScenarioIds,
} from "./dev-lab-scenario-catalog";
import { delay } from "./dev-lab-scenario-steps";
import type {
  DevLabBenchmarkReport,
  DevLabScenarioCategory,
  DevLabScenarioContext,
  DevLabScenarioResult,
  DevLabSuiteId,
} from "./dev-lab-types";
import { DEV_LAB_BENCHMARK_SCHEMA } from "./dev-lab-types";
import type { DevLabAccountId } from "./dev-lab-accounts";

type RunBenchmarkOptions = Readonly<{
  suite?: DevLabSuiteId | string;
  scenarioIds?: ReadonlyArray<string>;
  surface?: DevLabBenchmarkReport["surface"];
  baseUrl?: string;
  skipUnlock?: boolean;
}>;

const buildSummary = (
  scenarios: ReadonlyArray<DevLabScenarioResult>,
): DevLabBenchmarkReport["summary"] => {
  const categories: Record<DevLabScenarioCategory, { total: number; passed: number }> = {
    auth: { total: 0, passed: 0 },
    shell: { total: 0, passed: 0 },
    navigation: { total: 0, passed: 0 },
    settings: { total: 0, passed: 0 },
    runtime: { total: 0, passed: 0 },
    messaging: { total: 0, passed: 0 },
    network: { total: 0, passed: 0 },
  };
  for (const scenario of scenarios) {
    const bucket = categories[scenario.category];
    bucket.total += 1;
    if (scenario.passed) {
      bucket.passed += 1;
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
};

export const runDevLabScenario = async (
  scenarioId: string,
  ctx: DevLabScenarioContext,
): Promise<DevLabScenarioResult> => {
  const definition = resolveDevLabScenario(scenarioId);
  if (!definition) {
    return {
      id: scenarioId,
      name: scenarioId,
      category: "runtime",
      passed: false,
      durationMs: 0,
      steps: [],
      error: `Unknown scenario: ${scenarioId}`,
    };
  }

  const startedAt = Date.now();
  try {
    const steps = await definition.run(ctx);
    const passed = steps.every((step) => step.passed);
    return {
      id: definition.id,
      name: definition.name,
      category: definition.category,
      passed,
      durationMs: Date.now() - startedAt,
      steps,
    };
  } catch (error) {
    return {
      id: definition.id,
      name: definition.name,
      category: definition.category,
      passed: false,
      durationMs: Date.now() - startedAt,
      steps: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const runDevLabBenchmark = async (
  unlock: (accountId?: DevLabAccountId) => Promise<void>,
  options: RunBenchmarkOptions = {},
): Promise<DevLabBenchmarkReport> => {
  const suite = (options.suite ?? "core") as DevLabSuiteId;
  const scenarioIds = (options.scenarioIds
    ?? resolveDevLabSuiteScenarioIds(suite, { includeTerminal: false }))
    .filter((id) => !resolveDevLabScenario(id)?.tags.includes("cli-only"));

  const ctx: DevLabScenarioContext = {
    unlock,
    delay,
  };

  const results: DevLabScenarioResult[] = [];

  for (const scenarioId of scenarioIds) {
    if (scenarioId === "cold-reload") {
      continue;
    }
    results.push(await runDevLabScenario(scenarioId, ctx));
    const last = results[results.length - 1];
    const hasFatalBoundary = last.steps.some((step) => {
      const health = step.context?.health;
      return (
        typeof health === "object"
        && health !== null
        && "rootFatalBoundary" in health
        && (health as { rootFatalBoundary?: boolean }).rootFatalBoundary === true
      );
    });
    if (!last.passed && hasFatalBoundary) {
      break;
    }
  }

  return finalizeReport(results, suite, options);
};

const finalizeReport = (
  scenarios: ReadonlyArray<DevLabScenarioResult>,
  suite: string,
  options: RunBenchmarkOptions,
): DevLabBenchmarkReport => {
  const shellHealth = probeDevLabShellHealth();
  const m0 = typeof window.obscurM0Triage?.capture === "function"
    ? window.obscurM0Triage.capture(120)
    : null;
  const digest = typeof window.obscurAppEvents?.getCrossDeviceSyncDigest === "function"
    ? window.obscurAppEvents.getCrossDeviceSyncDigest(200)
    : null;
  const summary = buildSummary(scenarios);
  return {
    schema: DEV_LAB_BENCHMARK_SCHEMA,
    version: DEV_LAB_VERSION,
    generatedAtUnixMs: Date.now(),
    suite,
    surface: options.surface ?? "in-app",
    baseUrl: options.baseUrl ?? window.location.origin,
    passed: summary.failed === 0,
    scenarios,
    summary,
    shellHealth,
    capture: { m0, digest },
  };
};

export const devLabRunnerExports = {
  listDevLabScenarios,
  runDevLabScenario,
  runDevLabBenchmark,
};
