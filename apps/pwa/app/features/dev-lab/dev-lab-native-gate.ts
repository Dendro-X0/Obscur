import { DEV_LAB_ACCOUNTS } from "./dev-lab-accounts";
import type { DevLabAccountId } from "./dev-lab-accounts";
import { probeDevLabShellHealth, type DevLabShellHealth } from "./dev-lab-shell-health";
import { delay } from "./dev-lab-scenario-steps";
import type { DevLabScenarioResult, DevLabScenarioStepResult } from "./dev-lab-types";

export const NATIVE_GATE_REPORT_SCHEMA = "obscur.dev-lab-native-gate.v1";
export const NATIVE_GATE_PENDING_SCHEMA = "obscur.native-gate-pending.v1";
export const NATIVE_GATE_LISTENER_URL = "http://127.0.0.1:9876";
export const NATIVE_GATE_PENDING_STORAGE_KEY = "obscur.native-gate.pending";
export const NATIVE_GATE_COMPLETED_STORAGE_KEY = "obscur.native-gate.completed";

export type DevLabRuntimeCapabilities = Readonly<{
  isNativeRuntime: boolean;
  isDesktop: boolean;
  isMobile: boolean;
  hasCallableNativeBridge: boolean;
  hostname: string | null;
}>;

export type DmKernelGateSnapshot = Readonly<{
  devLabAvailable: boolean;
  writeProbe: Readonly<{
    ok: boolean;
    reason: string;
    errorMessage: string | null;
  }> | null;
  oneSidedConversations: ReadonlyArray<Readonly<{
    conversationId: string;
    peerPublicKeyHex: string;
    missingDirection: "incoming" | "outgoing";
  }>> | null;
  bidirectional: Readonly<{
    peerPublicKeyHex: string;
    total: number;
    outgoing: number;
    incoming: number;
    bidirectional: boolean;
    skipped: boolean;
    reason: string;
  }> | null;
}>;

export type DevLabNativeGateReport = Readonly<{
  schema: typeof NATIVE_GATE_REPORT_SCHEMA;
  generatedAtUnixMs: number;
  baseUrl: string;
  runtimeCapabilities: DevLabRuntimeCapabilities;
  shellHealth: DevLabShellHealth;
  dmKernelGate: DmKernelGateSnapshot;
  scenarios: ReadonlyArray<DevLabScenarioResult>;
  passed: boolean;
  allowEmptyBidirectional: boolean;
}>;

export type NativeGatePendingState = Readonly<{
  schema: typeof NATIVE_GATE_PENDING_SCHEMA;
  listenerUrl: string;
  startedAtUnixMs: number;
  markerText: string;
  peerHex: string;
  beforeCount: number;
  preReloadScenarios: ReadonlyArray<DevLabScenarioResult>;
  dmKernelGate: DmKernelGateSnapshot;
}>;

const step = (
  id: string,
  passed: boolean,
  message: string,
  startedAt: number,
  context?: Readonly<Record<string, unknown>>,
): DevLabScenarioStepResult => ({
  id,
  passed,
  message,
  durationMs: Date.now() - startedAt,
  context,
});

export const readDevLabRuntimeCapabilities = (): DevLabRuntimeCapabilities => {
  const w = window as Window & {
    __TAURI__?: { core?: { invoke?: unknown } };
    __TAURI_INTERNALS__?: { invoke?: unknown };
    __TAURI_IPC__?: unknown;
  };
  const hasCallableNativeBridge = (
    typeof w.__TAURI_INTERNALS__?.invoke === "function"
    || typeof w.__TAURI__?.core?.invoke === "function"
    || typeof w.__TAURI_IPC__ === "function"
  );
  return {
    isNativeRuntime: hasCallableNativeBridge,
    isDesktop: hasCallableNativeBridge,
    isMobile: false,
    hasCallableNativeBridge,
    hostname: window.location?.hostname ?? null,
  };
};

const waitForMessagingReady = async (timeoutMs = 90_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = window.obscurDevLab?.getMessagingStatus?.() ?? null;
    if (status === "ready") {
      return;
    }
    await delay(500);
  }
  throw new Error("Messaging bridge not ready");
};

const waitForDevLabMessaging = async (timeoutMs = 60_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const lab = window.obscurDevLab;
    if (lab?.sendSyntheticDm && lab.getSqliteMessagesForPeer) {
      return;
    }
    await delay(500);
  }
  throw new Error("obscurDevLab messaging API not available");
};

export const captureDmKernelGateSnapshot = async (
  peerPublicKeyHex: string,
): Promise<DmKernelGateSnapshot> => {
  const lab = window.obscurDevLab;
  if (!lab) {
    return {
      devLabAvailable: false,
      writeProbe: null,
      oneSidedConversations: null,
      bidirectional: null,
    };
  }

  const writeProbe = typeof lab.probeNativeDmSqliteWrite === "function"
    ? await lab.probeNativeDmSqliteWrite()
    : null;
  const oneSidedConversations = typeof lab.scanOneSidedNativeDmConversations === "function"
    ? await lab.scanOneSidedNativeDmConversations()
    : null;

  let bidirectional: DmKernelGateSnapshot["bidirectional"] = null;
  if (typeof lab.getSqliteMessagesForPeer === "function") {
    const snapshots = await lab.getSqliteMessagesForPeer(peerPublicKeyHex);
    let outgoing = 0;
    let incoming = 0;
    for (const row of snapshots) {
      if (row.isOutgoing) {
        outgoing += 1;
      } else {
        incoming += 1;
      }
    }
    if (snapshots.length === 0) {
      bidirectional = {
        peerPublicKeyHex,
        total: 0,
        outgoing: 0,
        incoming: 0,
        bidirectional: false,
        skipped: true,
        reason: "no_sqlite_thread",
      };
    } else {
      bidirectional = {
        peerPublicKeyHex,
        total: snapshots.length,
        outgoing,
        incoming,
        bidirectional: outgoing > 0 && incoming > 0,
        skipped: false,
        reason: outgoing > 0 && incoming > 0 ? "bidirectional_ok" : "one_sided_thread",
      };
    }
  }

  return {
    devLabAvailable: true,
    writeProbe,
    oneSidedConversations,
    bidirectional,
  };
};

const readPeerSqliteSnapshot = async (
  peerHex: string,
  markerText: string,
): Promise<Readonly<{ count: number; hasMarker: boolean }>> => {
  const lab = window.obscurDevLab;
  const messages = lab?.getSqliteMessagesForPeer
    ? await lab.getSqliteMessagesForPeer(peerHex)
    : lab?.getMessagesForPeer?.(peerHex) ?? [];
  return {
    count: messages.length,
    hasMarker: messages.some((message) => message.content === markerText),
  };
};

export const readNativeGatePending = (): NativeGatePendingState | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.sessionStorage.getItem(NATIVE_GATE_PENDING_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as NativeGatePendingState;
    if (parsed.schema !== NATIVE_GATE_PENDING_SCHEMA) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearNativeGatePending = (): void => {
  window.sessionStorage.removeItem(NATIVE_GATE_PENDING_STORAGE_KEY);
};

export const markNativeGateCompleted = (): void => {
  window.sessionStorage.setItem(NATIVE_GATE_COMPLETED_STORAGE_KEY, String(Date.now()));
  clearNativeGatePending();
};

export const isNativeGateCompleted = (): boolean => (
  typeof window !== "undefined"
  && window.sessionStorage.getItem(NATIVE_GATE_COMPLETED_STORAGE_KEY) !== null
);

const buildScenario = (
  id: string,
  name: string,
  steps: ReadonlyArray<DevLabScenarioStepResult>,
  startedAt: number,
): DevLabScenarioResult => ({
  id,
  name,
  category: "messaging",
  passed: steps.every((entry) => entry.passed),
  durationMs: Date.now() - startedAt,
  steps,
});

export const evaluateNativeGateReport = (
  report: DevLabNativeGateReport,
): Readonly<{ passed: boolean; failures: ReadonlyArray<string> }> => {
  const failures: string[] = [];
  const capabilities = report.runtimeCapabilities;
  if (!capabilities.isNativeRuntime) {
    failures.push("native_runtime_missing");
  }
  if (!report.shellHealth.healthy) {
    failures.push("shell_unhealthy");
  }
  if (!report.dmKernelGate.devLabAvailable) {
    failures.push("dev_lab_unavailable");
  }
  if (!report.dmKernelGate.writeProbe?.ok) {
    failures.push(`write_probe:${report.dmKernelGate.writeProbe?.reason ?? "failed"}`);
  }
  const oneSided = report.dmKernelGate.oneSidedConversations?.length ?? 0;
  if (oneSided > 0) {
    failures.push(`one_sided_sqlite:${oneSided}`);
  }
  const bidirectional = report.dmKernelGate.bidirectional;
  if (
    !report.allowEmptyBidirectional
    && bidirectional
    && (bidirectional.skipped || !bidirectional.bidirectional)
  ) {
    failures.push(`bidirectional:${bidirectional.reason}`);
  }
  for (const scenario of report.scenarios) {
    if (!scenario.passed) {
      failures.push(`scenario:${scenario.id}`);
    }
  }
  return { passed: failures.length === 0, failures };
};

export const resumeNativeGateAfterReload = async (
  pending: NativeGatePendingState,
  unlock: (accountId?: DevLabAccountId) => Promise<void>,
): Promise<DevLabNativeGateReport> => {
  const capabilities = readDevLabRuntimeCapabilities();
  const shellHealth = probeDevLabShellHealth();
  const scenarioStarted = Date.now();
  const steps: DevLabScenarioStepResult[] = [];

  const runtimeStarted = Date.now();
  steps.push(step(
    "native_runtime",
    capabilities.isNativeRuntime,
    capabilities.isNativeRuntime
      ? "Native Tauri bridge detected after reload."
      : "Native Tauri bridge missing after reload.",
    runtimeStarted,
    { capabilities },
  ));

  await waitForDevLabMessaging();
  try {
    await unlock("tester1");
    steps.push(step("dm_unlock_after_reload", true, "Tester1 unlock attempted after reload.", Date.now()));
  } catch (error) {
    steps.push(step(
      "dm_unlock_after_reload",
      false,
      error instanceof Error ? error.message : "Unlock after reload failed.",
      Date.now(),
    ));
    clearNativeGatePending();
    const scenarios = [
      ...pending.preReloadScenarios,
      buildScenario("dm-native-persist", "Native DM history survives reload", steps, scenarioStarted),
    ];
    return {
      schema: NATIVE_GATE_REPORT_SCHEMA,
      generatedAtUnixMs: Date.now(),
      baseUrl: window.location.origin,
      runtimeCapabilities: capabilities,
      shellHealth,
      dmKernelGate: pending.dmKernelGate,
      scenarios,
      passed: false,
      allowEmptyBidirectional: process.env.NEXT_PUBLIC_OBSCUR_DM_KERNEL_ALLOW_EMPTY_BIDIRECTIONAL === "1",
    };
  }

  await waitForMessagingReady();

  let after = { count: 0, hasMarker: false };
  const hydrateDeadline = Date.now() + 60_000;
  while (Date.now() < hydrateDeadline) {
    after = await readPeerSqliteSnapshot(pending.peerHex, pending.markerText);
    if (after.hasMarker && after.count >= pending.beforeCount) {
      break;
    }
    await delay(500);
  }

  const historyPassed = after.hasMarker && after.count >= pending.beforeCount;
  steps.push(step(
    "dm_count_after_reload",
    historyPassed,
    historyPassed
      ? `Native history preserved (${pending.beforeCount} → ${after.count}).`
      : `Native history lost after reload (before=${pending.beforeCount}, after=${after.count}).`,
    Date.now(),
    { beforeCount: pending.beforeCount, after, markerText: pending.markerText },
  ));

  const digest = window.obscurAppEvents?.getCrossDeviceSyncDigest?.(400) ?? null;
  const riskLevel = digest?.summary?.selfAuthoredDmContinuity?.riskLevel ?? "none";
  const riskOrder: Record<string, number> = { none: 0, watch: 1, high: 2 };
  const continuityPassed = (riskOrder[riskLevel] ?? 0) <= riskOrder.watch;
  steps.push(step(
    "dm_continuity_digest",
    continuityPassed,
    continuityPassed
      ? `DM continuity digest acceptable (${riskLevel}).`
      : `DM continuity digest too high (${riskLevel}).`,
    Date.now(),
    { riskLevel },
  ));

  const scenarios = [
    ...pending.preReloadScenarios,
    buildScenario("dm-native-persist", "Native DM history survives reload", steps, scenarioStarted),
  ];
  const allowEmptyBidirectional = process.env.NEXT_PUBLIC_OBSCUR_DM_KERNEL_ALLOW_EMPTY_BIDIRECTIONAL === "1";
  const report: DevLabNativeGateReport = {
    schema: NATIVE_GATE_REPORT_SCHEMA,
    generatedAtUnixMs: Date.now(),
    baseUrl: window.location.origin,
    runtimeCapabilities: capabilities,
    shellHealth: probeDevLabShellHealth(),
    dmKernelGate: pending.dmKernelGate,
    scenarios,
    passed: false,
    allowEmptyBidirectional,
  };
  const evaluation = evaluateNativeGateReport({ ...report, passed: false });
  markNativeGateCompleted();
  return { ...report, passed: evaluation.passed };
};

export const runDevLabNativeGate = async (
  unlock: (accountId?: DevLabAccountId) => Promise<void>,
  options: Readonly<{ listenerUrl?: string }> = {},
): Promise<DevLabNativeGateReport> => {
  const listenerUrl = options.listenerUrl ?? NATIVE_GATE_LISTENER_URL;
  const peerHex = DEV_LAB_ACCOUNTS.tester2.publicKeyHex ?? "";
  const allowEmptyBidirectional = process.env.NEXT_PUBLIC_OBSCUR_DM_KERNEL_ALLOW_EMPTY_BIDIRECTIONAL === "1";

  await unlock("tester1");
  await waitForDevLabMessaging();
  await waitForMessagingReady();

  const capabilities = readDevLabRuntimeCapabilities();
  const shellHealth = probeDevLabShellHealth();
  const dmKernelGate = await captureDmKernelGateSnapshot(peerHex);
  const preReloadScenarios: DevLabScenarioResult[] = [];

  const kernelStarted = Date.now();
  const kernelSteps: DevLabScenarioStepResult[] = [];
  kernelSteps.push(step(
    "dm_kernel_write_probe",
    dmKernelGate.writeProbe?.ok === true,
    dmKernelGate.writeProbe?.ok === true
      ? "SQLite write probe roundtrip ok."
      : `Write probe failed: ${dmKernelGate.writeProbe?.errorMessage ?? dmKernelGate.writeProbe?.reason ?? "unavailable"}`,
    kernelStarted,
    { writeProbe: dmKernelGate.writeProbe },
  ));
  const oneSidedCount = dmKernelGate.oneSidedConversations?.length ?? 0;
  kernelSteps.push(step(
    "dm_kernel_one_sided_scan",
    oneSidedCount === 0,
    oneSidedCount === 0
      ? "No one-sided native DM conversations."
      : `${oneSidedCount} one-sided conversation(s) detected.`,
    kernelStarted,
    { oneSidedCount },
  ));
  const bidirectional = dmKernelGate.bidirectional;
  const bidirectionalOk = allowEmptyBidirectional
    || (bidirectional !== null && !bidirectional.skipped && bidirectional.bidirectional);
  kernelSteps.push(step(
    "dm_kernel_bidirectional",
    bidirectionalOk,
    bidirectionalOk
      ? `Bidirectional gate ok (${bidirectional?.reason ?? "allowed_empty"}).`
      : `Bidirectional gate failed (${bidirectional?.reason ?? "missing"}).`,
    kernelStarted,
    { bidirectional, allowEmptyBidirectional },
  ));
  preReloadScenarios.push(buildScenario(
    "dm-kernel-runtime",
    "dm-kernel native runtime gate",
    kernelSteps,
    kernelStarted,
  ));

  if (!capabilities.isNativeRuntime) {
    return {
      schema: NATIVE_GATE_REPORT_SCHEMA,
      generatedAtUnixMs: Date.now(),
      baseUrl: window.location.origin,
      runtimeCapabilities: capabilities,
      shellHealth,
      dmKernelGate,
      scenarios: preReloadScenarios,
      passed: false,
      allowEmptyBidirectional,
    };
  }

  const persistStarted = Date.now();
  const persistSteps: DevLabScenarioStepResult[] = [];
  const markerText = `dev-lab-native-persist-${Date.now()}`;
  const sendStarted = Date.now();
  const sendResult = await window.obscurDevLab!.sendSyntheticDm!({
    peerPublicKeyHex: peerHex,
    text: markerText,
  });
  const sendPassed = sendResult.success !== false && sendResult.deliveryStatus !== "failed";
  persistSteps.push(step(
    "dm_seed_send",
    sendPassed,
    sendPassed
      ? `Seed message accepted (${sendResult.deliveryStatus ?? "ok"}).`
      : `Seed send failed: ${sendResult.error ?? sendResult.deliveryStatus ?? "unknown"}`,
    sendStarted,
    { sendResult, markerText },
  ));
  if (!sendPassed) {
    preReloadScenarios.push(buildScenario("dm-native-persist", "Native DM history survives reload", persistSteps, persistStarted));
    const report: DevLabNativeGateReport = {
      schema: NATIVE_GATE_REPORT_SCHEMA,
      generatedAtUnixMs: Date.now(),
      baseUrl: window.location.origin,
      runtimeCapabilities: capabilities,
      shellHealth,
      dmKernelGate,
      scenarios: preReloadScenarios,
      passed: false,
      allowEmptyBidirectional,
    };
    markNativeGateCompleted();
    return { ...report, passed: evaluateNativeGateReport(report).passed };
  }

  await delay(1500);
  const before = await readPeerSqliteSnapshot(peerHex, markerText);
  persistSteps.push(step(
    "dm_count_before_reload",
    before.hasMarker,
    before.hasMarker
      ? `Peer thread has ${before.count} message(s) before native reload.`
      : `Marker missing before reload (count=${before.count}).`,
    Date.now(),
    { before, markerText },
  ));
  if (!before.hasMarker) {
    preReloadScenarios.push(buildScenario("dm-native-persist", "Native DM history survives reload", persistSteps, persistStarted));
    const report: DevLabNativeGateReport = {
      schema: NATIVE_GATE_REPORT_SCHEMA,
      generatedAtUnixMs: Date.now(),
      baseUrl: window.location.origin,
      runtimeCapabilities: capabilities,
      shellHealth,
      dmKernelGate,
      scenarios: preReloadScenarios,
      passed: false,
      allowEmptyBidirectional,
    };
    markNativeGateCompleted();
    return { ...report, passed: evaluateNativeGateReport(report).passed };
  }

  const pending: NativeGatePendingState = {
    schema: NATIVE_GATE_PENDING_SCHEMA,
    listenerUrl,
    startedAtUnixMs: Date.now(),
    markerText,
    peerHex,
    beforeCount: before.count,
    preReloadScenarios,
    dmKernelGate,
  };
  window.sessionStorage.setItem(NATIVE_GATE_PENDING_STORAGE_KEY, JSON.stringify(pending));
  window.location.reload();
  return new Promise(() => {
    // reload continues in resumeNativeGateAfterReload
  });
};

export const postNativeGateReport = async (
  report: DevLabNativeGateReport,
  listenerUrl: string = NATIVE_GATE_LISTENER_URL,
): Promise<boolean> => {
  try {
    const response = await fetch(`${listenerUrl.replace(/\/$/, "")}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const probeNativeGateListener = async (
  listenerUrl: string = NATIVE_GATE_LISTENER_URL,
): Promise<boolean> => {
  try {
    const response = await fetch(`${listenerUrl.replace(/\/$/, "")}/ping`, {
      signal: AbortSignal.timeout(800),
    });
    return response.ok;
  } catch {
    return false;
  }
};
