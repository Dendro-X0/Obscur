/**
 * Validates in-app native gate reports (no CDP).
 */

export const NATIVE_GATE_REPORT_SCHEMA = "obscur.dev-lab-native-gate.v1";

/**
 * @param {unknown} report
 * @returns {{ passed: boolean; failures: string[] }}
 */
export function evaluateDevLabNativeGateReport(report) {
  /** @type {string[]} */
  const failures = [];
  if (!report || typeof report !== "object") {
    return { passed: false, failures: ["invalid_report"] };
  }
  const value = /** @type {Record<string, unknown>} */ (report);
  if (value.schema !== NATIVE_GATE_REPORT_SCHEMA) {
    failures.push(`schema:${String(value.schema)}`);
  }

  const capabilities = /** @type {Record<string, unknown>} */ (value.runtimeCapabilities ?? {});
  if (capabilities.isNativeRuntime !== true) {
    failures.push("native_runtime_missing");
  }

  const shellHealth = /** @type {Record<string, unknown>} */ (value.shellHealth ?? {});
  if (shellHealth.healthy !== true) {
    failures.push("shell_unhealthy");
  }

  const dmKernelGate = /** @type {Record<string, unknown>} */ (value.dmKernelGate ?? {});
  if (dmKernelGate.devLabAvailable !== true) {
    failures.push("dev_lab_unavailable");
  }

  const writeProbe = /** @type {Record<string, unknown>} */ (dmKernelGate.writeProbe ?? {});
  if (writeProbe.ok !== true) {
    failures.push(`write_probe:${writeProbe.reason ?? "failed"}`);
  }

  const oneSided = Array.isArray(dmKernelGate.oneSidedConversations)
    ? dmKernelGate.oneSidedConversations.length
    : 0;
  if (oneSided > 0) {
    failures.push(`one_sided_sqlite:${oneSided}`);
  }

  const allowEmpty = value.allowEmptyBidirectional === true
    || process.env.OBSCUR_DM_KERNEL_ALLOW_EMPTY_BIDIRECTIONAL === "1";
  const bidirectional = /** @type {Record<string, unknown>} */ (dmKernelGate.bidirectional ?? {});
  if (
    !allowEmpty
    && (bidirectional.skipped === true || bidirectional.bidirectional !== true)
  ) {
    failures.push(`bidirectional:${bidirectional.reason ?? "failed"}`);
  }

  const scenarios = Array.isArray(value.scenarios) ? value.scenarios : [];
  for (const scenario of scenarios) {
    if (scenario && typeof scenario === "object" && /** @type {{ passed?: boolean }} */ (scenario).passed === false) {
      failures.push(`scenario:${/** @type {{ id?: string }} */ (scenario).id ?? "unknown"}`);
    }
  }

  return { passed: failures.length === 0, failures };
}
