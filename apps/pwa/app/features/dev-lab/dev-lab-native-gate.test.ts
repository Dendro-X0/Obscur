import { describe, expect, it } from "vitest";
import {
  evaluateNativeGateReport,
  NATIVE_GATE_REPORT_SCHEMA,
  readDevLabRuntimeCapabilities,
} from "./dev-lab-native-gate";
import type { DevLabNativeGateReport } from "./dev-lab-native-gate";

const baseReport = (): DevLabNativeGateReport => ({
  schema: NATIVE_GATE_REPORT_SCHEMA,
  generatedAtUnixMs: Date.now(),
  baseUrl: "http://127.0.0.1:1430",
  runtimeCapabilities: {
    isNativeRuntime: true,
    isDesktop: true,
    isMobile: false,
    hasCallableNativeBridge: true,
    hostname: "127.0.0.1",
  },
  shellHealth: {
    version: "obscur.dev-lab.shell-health.v1",
    checkedAtUnixMs: Date.now(),
    healthy: true,
    shellUnlocked: true,
    rootFatalBoundary: false,
    settingsTabBoundary: false,
    issues: [],
    fatalBoundaryMessage: null,
  },
  dmKernelGate: {
    devLabAvailable: true,
    writeProbe: { ok: true, reason: "roundtrip_ok", errorMessage: null },
    oneSidedConversations: [],
    bidirectional: {
      peerPublicKeyHex: "abc",
      total: 4,
      outgoing: 2,
      incoming: 2,
      bidirectional: true,
      skipped: false,
      reason: "bidirectional_ok",
    },
  },
  scenarios: [{
    id: "dm-native-persist",
    name: "Native DM history survives reload",
    category: "messaging",
    passed: true,
    durationMs: 1,
    steps: [],
  }],
  passed: true,
  allowEmptyBidirectional: false,
});

describe("dev-lab-native-gate", () => {
  it("passes a complete native gate report", () => {
    const evaluation = evaluateNativeGateReport(baseReport());
    expect(evaluation.passed).toBe(true);
    expect(evaluation.failures).toEqual([]);
  });

  it("fails when write probe fails", () => {
    const report = {
      ...baseReport(),
      dmKernelGate: {
        ...baseReport().dmKernelGate,
        writeProbe: { ok: false, reason: "invoke_failed", errorMessage: "db_insert_message not allowed" },
      },
    };
    const evaluation = evaluateNativeGateReport(report);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.failures.some((failure) => failure.startsWith("write_probe:"))).toBe(true);
  });

  it("readDevLabRuntimeCapabilities is false without Tauri bridge", () => {
    const capabilities = readDevLabRuntimeCapabilities();
    expect(capabilities.isNativeRuntime).toBe(false);
  });
});
