/**
 * Pure helpers for Obscur automated runtime capture reports.
 */

export const RUNTIME_CAPTURE_SCHEMA = "obscur.runtime-capture-report.v1";

/** @typedef {"none" | "watch" | "high"} RiskLevel */

/**
 * @typedef {Readonly<{
 *   id: string;
 *   passed: boolean;
 *   severity: "error" | "warn";
 *   message: string;
 *   context?: Record<string, unknown>;
 * }>} GateResult
 */

/**
 * @typedef {Readonly<{
 *   schema: string;
 *   generatedAtUnixMs: number;
 *   surface: "chromium" | "tauri-webview-cdp" | "unknown";
 *   baseUrl: string;
 *   gitSha?: string | null;
 *   requireNative: boolean;
 *   scenarios: ReadonlyArray<Record<string, unknown>>;
 *   m0Bundle: unknown | null;
 *   crossDeviceDigest: unknown | null;
 *   runtimeCapabilities: unknown | null;
 *   dmKernelGate?: unknown | null;
 *   gates: ReadonlyArray<GateResult>;
 *   passed: boolean;
 * }>} RuntimeCaptureReport
 */

const RISK_ORDER = { none: 0, watch: 1, high: 2 };

/**
 * @param {RiskLevel | null | undefined} level
 * @param {RiskLevel} maxAllowed
 */
export function isRiskLevelAcceptable(level, maxAllowed = "watch") {
  const normalized = level ?? "none";
  return RISK_ORDER[normalized] <= RISK_ORDER[maxAllowed];
}

/**
 * @param {Readonly<{
 *   requireNative?: boolean;
 *   runtimeCapabilities?: Readonly<{ isNativeRuntime?: boolean }> | null;
 *   crossDeviceDigest?: Readonly<{
 *     summary?: Readonly<Record<string, Readonly<{ riskLevel?: RiskLevel }>>>;
 *     recentWarnOrError?: ReadonlyArray<unknown>;
 *   }> | null;
 *   m0Bundle?: Readonly<{
 *     checks?: Readonly<{
 *       requiredApis?: Readonly<Record<string, boolean>>;
 *     }>;
 *   }> | null;
 *   shellUnlocked?: boolean;
 *   shellHealth?: Readonly<{
 *     rootFatalBoundary?: boolean;
 *     fatalBoundaryMessage?: string | null;
 *   }> | null;
 *   dmKernelGate?: Readonly<{
 *     devLabAvailable?: boolean;
 *     writeProbe?: Readonly<{ ok?: boolean; reason?: string; errorMessage?: string | null }> | null;
 *     oneSidedConversations?: ReadonlyArray<unknown> | null;
 *   }> | null;
 * }>} input
 * @returns {{ gates: GateResult[]; passed: boolean }}
 */
export function evaluateRuntimeCaptureGates(input) {
  /** @type {GateResult[]} */
  const gates = [];

  const push = (id, passed, severity, message, context = undefined) => {
    gates.push({ id, passed, severity, message, context });
  };

  if (input.shellUnlocked === false) {
    push("shell.unlocked", false, "error", "Messenger shell did not reach unlocked state.");
  } else {
    push("shell.unlocked", true, "error", "Messenger shell unlocked.");
  }

  const shellHealth = input.shellHealth ?? null;
  const noFatalBoundary = shellHealth?.rootFatalBoundary !== true;
  push(
    "shell.no_fatal_boundary",
    noFatalBoundary,
    "error",
    noFatalBoundary
      ? "No root fatal error boundary detected."
      : `Root fatal error boundary active: ${shellHealth?.fatalBoundaryMessage ?? "unknown"}.`,
    { shellHealth },
  );

  const apis = input.m0Bundle?.checks?.requiredApis ?? {};
  const m0Ready = apis.appEvents === true && apis.relayRuntime === true;
  push(
    "capture.m0_apis",
    m0Ready,
    "error",
    m0Ready
      ? "M0 triage APIs available (appEvents + relayRuntime)."
      : "M0 triage APIs missing — capture incomplete.",
    { requiredApis: apis },
  );

  const isNative = input.runtimeCapabilities?.isNativeRuntime === true;
  if (input.requireNative) {
    push(
      "runtime.native_required",
      isNative,
      "error",
      isNative
        ? "Native Tauri bridge detected (__TAURI__ invoke callable)."
        : "Native runtime required but Playwright hit browser-only :3340. Use --cdp against Tauri WebView.",
      { isNativeRuntime: isNative },
    );
  } else {
    push(
      "runtime.native_observed",
      true,
      "warn",
      isNative
        ? "Native Tauri bridge detected."
        : "Chromium-only surface (no native SQLite). Persistence gates are digest-only.",
      { isNativeRuntime: isNative },
    );
  }

  const summary = input.crossDeviceDigest?.summary ?? {};
  const dm = summary.selfAuthoredDmContinuity;
  const dmOk = isRiskLevelAcceptable(dm?.riskLevel, "watch");
  push(
    "dm_continuity.risk",
    dmOk,
    dmOk ? "warn" : "error",
    dmOk
      ? `DM continuity risk acceptable (${dm?.riskLevel ?? "none"}).`
      : `DM continuity risk too high (${dm?.riskLevel ?? "unknown"}).`,
    { selfAuthoredDmContinuity: dm ?? null },
  );

  const ui = summary.uiResponsiveness;
  if (ui) {
    const uiOk = isRiskLevelAcceptable(ui.riskLevel, "watch");
    push(
      "ui_responsiveness.risk",
      uiOk,
      uiOk ? "warn" : "error",
      uiOk
        ? `UI responsiveness risk acceptable (${ui.riskLevel}).`
        : `UI responsiveness risk too high (${ui.riskLevel}).`,
      { uiResponsiveness: ui },
    );
  }

  const scope = summary.accountSwitchScopeConvergence;
  if (scope) {
    const scopeOk = isRiskLevelAcceptable(scope.riskLevel, "watch");
    push(
      "account_scope.risk",
      scopeOk,
      scopeOk ? "warn" : "error",
      scopeOk
        ? `Account scope convergence acceptable (${scope.riskLevel}).`
        : `Account scope convergence risk too high (${scope.riskLevel}).`,
      { accountSwitchScopeConvergence: scope },
    );
  }

  const recentWarnOrError = input.crossDeviceDigest?.recentWarnOrError ?? [];
  const noRecentErrors = recentWarnOrError.filter((e) => (
    typeof e === "object"
    && e !== null
    && "level" in e
    && e.level === "error"
  )).length === 0;
  push(
    "digest.recent_errors",
    noRecentErrors,
    noRecentErrors ? "warn" : "error",
    noRecentErrors
      ? "No recent error-level events in cross-device digest window."
      : "Recent error-level events present in cross-device digest.",
    { recentErrorCount: recentWarnOrError.length },
  );

  const needsDmKernelGate =
    input.requireNative === true && input.runtimeCapabilities?.isNativeRuntime === true;

  if (needsDmKernelGate) {
    const dmGate = input.dmKernelGate ?? null;
    const devLabAvailable = dmGate?.devLabAvailable === true;
    push(
      "dm_kernel.dev_lab",
      devLabAvailable,
      "error",
      devLabAvailable
        ? "Dev Lab bridge available for dm-kernel gate."
        : "Dev Lab bridge missing — cannot run dm-kernel programmatic gate.",
      { devLabAvailable },
    );

    const writeProbe = dmGate?.writeProbe ?? null;
    const writeProbeOk = writeProbe?.ok === true;
    push(
      "dm_kernel.write_probe",
      writeProbeOk,
      "error",
      writeProbeOk
        ? `dm-kernel SQLite write roundtrip OK (${writeProbe?.reason ?? "roundtrip_ok"}).`
        : `dm-kernel write probe failed (${writeProbe?.reason ?? "unavailable"}).`,
      { writeProbe },
    );

    const oneSided = dmGate?.oneSidedConversations ?? null;
    const oneSidedCount = Array.isArray(oneSided) ? oneSided.length : null;
    const noOneSided = oneSidedCount === 0;
    push(
      "dm_kernel.one_sided_sqlite",
      noOneSided,
      "error",
      noOneSided
        ? "No one-sided DM conversations in SQLite scan."
        : `One-sided DM conversations detected (${oneSidedCount ?? "scan_unavailable"}).`,
      {
        oneSidedCount,
        oneSidedConversations: Array.isArray(oneSided) ? oneSided.slice(0, 5) : null,
      },
    );

    const bidirectional = dmGate?.bidirectional ?? null;
    const allowEmptyBidirectional = input.allowEmptyBidirectional === true;
    const bidirectionalOk = allowEmptyBidirectional
      ? true
      : bidirectional?.skipped === true
        ? false
        : bidirectional?.bidirectional === true;
    push(
      "dm_kernel.bidirectional",
      bidirectionalOk,
      allowEmptyBidirectional ? "warn" : "error",
      allowEmptyBidirectional
        ? "Bidirectional gate skipped via OBSCUR_DM_KERNEL_ALLOW_EMPTY_BIDIRECTIONAL."
        : bidirectional?.bidirectional === true
          ? `Bidirectional SQLite thread OK (out=${bidirectional?.outgoing ?? 0} in=${bidirectional?.incoming ?? 0}).`
          : `Bidirectional SQLite evidence missing (${bidirectional?.reason ?? "unavailable"}).`,
      { bidirectional, allowEmptyBidirectional },
    );
  } else {
    push(
      "dm_kernel.write_probe",
      true,
      "warn",
      "dm-kernel native write probe skipped (Chromium-only or native not required).",
    );
    push(
      "dm_kernel.one_sided_sqlite",
      true,
      "warn",
      "dm-kernel one-sided scan skipped (Chromium-only or native not required).",
    );
    push(
      "dm_kernel.bidirectional",
      true,
      "warn",
      "dm-kernel bidirectional gate skipped (Chromium-only or native not required).",
    );
  }

  const passed = gates.every((gate) => gate.passed || gate.severity === "warn");
  const errors = gates.filter((gate) => !gate.passed && gate.severity === "error");
  return {
    gates,
    passed: errors.length === 0,
  };
}

/**
 * @param {Partial<RuntimeCaptureReport> & Pick<RuntimeCaptureReport, "baseUrl" | "surface">} partial
 * @returns {RuntimeCaptureReport}
 */
export function buildRuntimeCaptureReport(partial) {
  const shellUnlocked = partial.shellUnlocked
    ?? partial.scenarios?.some((s) => s.id === "shell_unlock")
    ?? undefined;
  const evaluation = evaluateRuntimeCaptureGates({
    requireNative: partial.requireNative ?? false,
    runtimeCapabilities: partial.runtimeCapabilities,
    crossDeviceDigest: partial.crossDeviceDigest,
    m0Bundle: partial.m0Bundle,
    shellUnlocked,
    shellHealth: partial.shellHealth ?? null,
    dmKernelGate: partial.dmKernelGate ?? null,
  });

  return {
    schema: RUNTIME_CAPTURE_SCHEMA,
    generatedAtUnixMs: Date.now(),
    surface: partial.surface,
    baseUrl: partial.baseUrl,
    gitSha: partial.gitSha ?? null,
    requireNative: partial.requireNative ?? false,
    scenarios: partial.scenarios ?? [],
    m0Bundle: partial.m0Bundle ?? null,
    crossDeviceDigest: partial.crossDeviceDigest ?? null,
    runtimeCapabilities: partial.runtimeCapabilities ?? null,
    gates: evaluation.gates,
    passed: evaluation.passed,
  };
}

/**
 * @param {RuntimeCaptureReport} report
 */
export function summarizeRuntimeCaptureReport(report) {
  const failed = report.gates.filter((g) => !g.passed && g.severity === "error");
  const warned = report.gates.filter((g) => !g.passed && g.severity === "warn");
  return {
    schema: report.schema,
    passed: report.passed,
    surface: report.surface,
    isNativeRuntime: report.runtimeCapabilities?.isNativeRuntime ?? false,
    gateErrorCount: failed.length,
    gateWarnCount: warned.length,
    failedGateIds: failed.map((g) => g.id),
  };
}
