/**
 * Pure helpers for S0 shell perf baseline reports (no Playwright).
 */

/** @typedef {{ href: string; label: string; visit: number; elapsedMs: number; urlMatched: boolean; routeMountWorstMs?: number; routeMountSlowCount?: number; error?: string }} NavigationSample */

/** @typedef {{ schema: string; mode: 'prod' | 'dev'; baseUrl: string; recordedAt: string; coldStart?: { domContentLoadedMs: number }; checks: Record<string, unknown>; navigations: NavigationSample[]; warnings?: string[] }} BaselineReport */

export const BASELINE_SCHEMA = "obscur-shell-perf-baseline/v1";

export const DEFAULT_NAV_SEQUENCE = [
  { href: "/network", label: "Network", visits: [1] },
  { href: "/settings", label: "Settings", visits: [1, 2] },
  { href: "/vault", label: "Vault", visits: [1] },
  { href: "/search", label: "Search", visits: [1] },
  { href: "/", label: "Chats", visits: [1] },
];

/** Ten rapid sidebar hops for P2 gate (Chats → Network → Vault → Search → Settings ×2). */
export const RAPID_NAV_SEQUENCE = [
  { href: "/", label: "Chats" },
  { href: "/network", label: "Network" },
  { href: "/vault", label: "Vault" },
  { href: "/search", label: "Search" },
  { href: "/settings", label: "Settings" },
  { href: "/", label: "Chats" },
  { href: "/network", label: "Network" },
  { href: "/vault", label: "Vault" },
  { href: "/search", label: "Search" },
  { href: "/settings", label: "Settings" },
];

/** Initial P2 budgets — see docs/handoffs/v2-perf-baseline.md */
export const V2_PERF_NAV_MEDIAN_BUDGET_MS = 1500;
export const V2_PERF_ROUTE_MOUNT_BUDGET_MS = 200;

/**
 * @param {BaselineReport} report
 */
export function summarizeBaselineReport(report) {
  const navigations = report.navigations ?? [];
  const successful = navigations.filter((n) => !n.error && n.urlMatched);
  const elapsed = successful.map((n) => n.elapsedMs);
  const settingsCold = navigations.find(
    (n) => n.href === "/settings" && n.visit === 1 && !n.error,
  );
  const settingsWarm = navigations.find(
    (n) => n.href === "/settings" && n.visit === 2 && !n.error,
  );
  const routeMountSamples = successful
    .map((n) => n.routeMountWorstMs)
    .filter((value) => typeof value === "number" && Number.isFinite(value));

  const median = (values) => {
    if (values.length === 0) {
      return null;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];
  };

  return {
    mode: report.mode,
    navigationCount: navigations.length,
    successCount: successful.length,
    medianNavMs: median(elapsed),
    maxNavMs: elapsed.length > 0 ? Math.max(...elapsed) : null,
    settingsColdMs: settingsCold?.elapsedMs ?? null,
    settingsWarmMs: settingsWarm?.elapsedMs ?? null,
    settingsWarmSpeedupRatio:
      settingsCold?.elapsedMs && settingsWarm?.elapsedMs
        ? Number((settingsCold.elapsedMs / settingsWarm.elapsedMs).toFixed(2))
        : null,
    coldStartDomMs: report.coldStart?.domContentLoadedMs ?? null,
    shellPhase: report.checks?.shellPhase ?? null,
    experimentShell: report.checks?.experimentShell ?? null,
    maxRouteMountWorstMs:
      routeMountSamples.length > 0 ? Math.max(...routeMountSamples) : null,
  };
}

/**
 * @param {BaselineReport} report
 */
export function evaluateV2PerfGate(report) {
  const summary = summarizeBaselineReport(report);
  const issues = [];

  if (summary.shellPhase !== "unlocked") {
    issues.push(`shell_phase_${summary.shellPhase ?? "unknown"}`);
  }
  if (typeof summary.medianNavMs === "number" && summary.medianNavMs > V2_PERF_NAV_MEDIAN_BUDGET_MS) {
    issues.push(`median_nav_${summary.medianNavMs}ms`);
  }
  if (
    typeof summary.maxRouteMountWorstMs === "number"
    && summary.maxRouteMountWorstMs > V2_PERF_ROUTE_MOUNT_BUDGET_MS
  ) {
    issues.push(`route_mount_${summary.maxRouteMountWorstMs}ms`);
  }

  const rapidNav = report.checks?.rapidNav;
  if (rapidNav && typeof rapidNav === "object" && rapidNav.gatePass === false) {
    issues.push("rapid_nav_gate");
  }

  return {
    pass: issues.length === 0,
    issues,
    summary,
  };
}

/**
 * @param {ReadonlyArray<NavigationSample>} samples
 */
export function evaluateRapidNavGate(samples) {
  const successful = samples.filter((sample) => !sample.error && sample.urlMatched);
  const maxNavMs = successful.length > 0
    ? Math.max(...successful.map((sample) => sample.elapsedMs))
    : null;
  const routeMountSamples = successful
    .map((sample) => sample.routeMountWorstMs)
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  const maxRouteMountWorstMs = routeMountSamples.length > 0
    ? Math.max(...routeMountSamples)
    : null;

  const issues = [];
  if (successful.length < RAPID_NAV_SEQUENCE.length) {
    issues.push(`samples_${successful.length}_of_${RAPID_NAV_SEQUENCE.length}`);
  }
  if (typeof maxRouteMountWorstMs === "number" && maxRouteMountWorstMs > V2_PERF_ROUTE_MOUNT_BUDGET_MS) {
    issues.push(`route_mount_${maxRouteMountWorstMs}ms`);
  }

  return {
    gatePass: issues.length === 0,
    issues,
    maxNavMs,
    maxRouteMountWorstMs,
    sampleCount: successful.length,
  };
}

/**
 * @param {BaselineReport} devReport
 * @param {BaselineReport} prodReport
 */
export function compareBaselineReports(devReport, prodReport) {
  const dev = summarizeBaselineReport(devReport);
  const prod = summarizeBaselineReport(prodReport);

  const devMedian = dev.medianNavMs;
  const prodMedian = prod.medianNavMs;

  let verdict = "inconclusive";
  let rationale =
    "Insufficient navigation samples or shell did not reach unlocked phase in one or both runs.";

  if (
    typeof devMedian === "number"
    && typeof prodMedian === "number"
    && dev.shellPhase === "unlocked"
    && prod.shellPhase === "unlocked"
  ) {
    const ratio = devMedian / Math.max(prodMedian, 1);
    if (ratio >= 2 && devMedian >= 1500) {
      verdict = "toolchain";
      rationale =
        "Dev median navigation is much slower than prod static shell — prioritize S6 (dev compile) before more in-app gates.";
    } else if (devMedian >= 1500 && prodMedian >= 1500) {
      verdict = "architecture";
      rationale =
        "Both dev and prod navigations are slow — app architecture (boot gates, chrome, route weight) dominates; continue S1/S5 lanes.";
    } else if (devMedian < 1500 && prodMedian < 1500) {
      verdict = "acceptable";
      rationale =
        "Both modes show sub-threshold sidebar navigation medians in this harness — re-check subjective UX on real Tauri WebView.";
    } else {
      verdict = "mixed";
      rationale =
        "Prod and dev differ but not enough for a toolchain-only call — inspect per-route samples and mount diagnostics.";
    }
  }

  const settingsCompileSignal =
    typeof dev.settingsColdMs === "number"
    && typeof dev.settingsWarmMs === "number"
    && dev.settingsColdMs >= 1500
    && dev.settingsWarmMs < dev.settingsColdMs * 0.6;

  return {
    schema: BASELINE_SCHEMA,
    comparedAt: new Date().toISOString(),
    dev,
    prod,
    devToProdMedianRatio:
      typeof devMedian === "number" && typeof prodMedian === "number"
        ? Number((devMedian / Math.max(prodMedian, 1)).toFixed(2))
        : null,
    settingsCompileSignal,
    verdict,
    rationale,
  };
}

/**
 * @param {unknown} value
 * @returns {BaselineReport}
 */
/** P4: release capture must stay within this ratio of static reference medians. */
export const RELEASE_PERF_MAX_DELTA_RATIO = 1.2;

/**
 * @param {BaselineReport} referenceReport
 * @param {BaselineReport} candidateReport
 * @param {{ maxDeltaRatio?: number }} [options]
 */
export function evaluateReleasePerfParity(referenceReport, candidateReport, options = {}) {
  const maxDeltaRatio = options.maxDeltaRatio ?? RELEASE_PERF_MAX_DELTA_RATIO;
  const reference = summarizeBaselineReport(referenceReport);
  const candidate = summarizeBaselineReport(candidateReport);
  const issues = [];

  if (reference.shellPhase !== "unlocked" || candidate.shellPhase !== "unlocked") {
    issues.push("shell_not_unlocked");
  }

  const compareMetric = (name, refValue, candValue) => {
    if (typeof refValue !== "number" || typeof candValue !== "number" || refValue <= 0) {
      issues.push(`${name}_missing`);
      return;
    }
    const ratio = candValue / refValue;
    if (ratio > maxDeltaRatio) {
      issues.push(`${name}_${Math.round(ratio * 100) / 100}x`);
    }
  };

  compareMetric("median_nav", reference.medianNavMs, candidate.medianNavMs);
  compareMetric("cold_dom", reference.coldStartDomMs, candidate.coldStartDomMs);

  return {
    pass: issues.length === 0,
    issues,
    maxDeltaRatio,
    reference,
    candidate,
    medianNavRatio:
      typeof reference.medianNavMs === "number"
      && typeof candidate.medianNavMs === "number"
      && reference.medianNavMs > 0
        ? Number((candidate.medianNavMs / reference.medianNavMs).toFixed(2))
        : null,
  };
}

/**
 * @param {unknown} value
 * @returns {BaselineReport}
 */
export function parseBaselineReport(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Baseline report must be a JSON object");
  }
  const report = /** @type {BaselineReport} */ (value);
  if (report.schema !== BASELINE_SCHEMA) {
    throw new Error(`Unexpected schema: ${String(report.schema)}`);
  }
  if (report.mode !== "dev" && report.mode !== "prod") {
    throw new Error(`Unexpected mode: ${String(report.mode)}`);
  }
  return report;
}
