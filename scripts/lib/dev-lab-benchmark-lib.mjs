/**
 * Pure evaluation for Dev Lab benchmark reports.
 */

export const DEV_LAB_BENCHMARK_SCHEMA = "obscur.dev-lab.benchmark.v1";

/**
 * @param {Readonly<{
 *   passed?: boolean;
 *   summary?: Readonly<{ failed?: number; failedScenarioIds?: ReadonlyArray<string> }>;
 *   shellHealth?: Readonly<{ rootFatalBoundary?: boolean; fatalBoundaryMessage?: string | null }> | null;
 *   scenarios?: ReadonlyArray<Readonly<{ id: string; passed: boolean }>>;
 * }>} report
 */
export function evaluateDevLabBenchmark(report) {
  /** @type {Array<{ id: string; passed: boolean; severity: string; message: string }>} */
  const gates = [];

  const push = (id, passed, severity, message) => {
    gates.push({ id, passed, severity, message });
  };

  const scenarioFailed = (report.summary?.failed ?? 0) > 0;
  push(
    "benchmark.scenarios",
    !scenarioFailed,
    "error",
    scenarioFailed
      ? `Failed scenarios: ${(report.summary?.failedScenarioIds ?? []).join(", ")}`
      : "All benchmark scenarios passed.",
  );

  const fatal = report.shellHealth?.rootFatalBoundary === true;
  push(
    "shell.no_fatal_boundary",
    !fatal,
    "error",
    fatal
      ? `Root fatal boundary: ${report.shellHealth?.fatalBoundaryMessage ?? "active"}`
      : "No root fatal boundary at report time.",
  );

  const passed = gates.every((gate) => gate.passed);
  return { gates, passed };
}

/**
 * @param {unknown} report
 */
export function summarizeDevLabBenchmark(report) {
  const evaluation = evaluateDevLabBenchmark(report);
  return {
    schema: report?.schema ?? DEV_LAB_BENCHMARK_SCHEMA,
    passed: evaluation.passed && report?.passed === true,
    suite: report?.suite ?? "unknown",
    scenarioTotal: report?.summary?.total ?? 0,
    scenarioFailed: report?.summary?.failed ?? 0,
    failedScenarioIds: report?.summary?.failedScenarioIds ?? [],
    failedGateIds: evaluation.gates.filter((g) => !g.passed).map((g) => g.id),
  };
}
