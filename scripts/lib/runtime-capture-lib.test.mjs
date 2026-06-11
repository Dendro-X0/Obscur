import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRuntimeCaptureReport,
  evaluateRuntimeCaptureGates,
  isRiskLevelAcceptable,
  summarizeRuntimeCaptureReport,
} from "./runtime-capture-lib.mjs";

describe("runtime-capture-lib", () => {
  it("rejects high DM continuity risk", () => {
    const { passed, gates } = evaluateRuntimeCaptureGates({
      shellUnlocked: true,
      m0Bundle: { checks: { requiredApis: { appEvents: true, relayRuntime: true } } },
      crossDeviceDigest: {
        summary: {
          selfAuthoredDmContinuity: { riskLevel: "high", idSplitDetectedCount: 1 },
        },
        recentWarnOrError: [],
      },
    });
    assert.equal(passed, false);
    assert.equal(gates.find((g) => g.id === "dm_continuity.risk")?.passed, false);
  });

  it("passes watch-level risks", () => {
    const { passed } = evaluateRuntimeCaptureGates({
      shellUnlocked: true,
      m0Bundle: { checks: { requiredApis: { appEvents: true, relayRuntime: true } } },
      crossDeviceDigest: {
        summary: {
          selfAuthoredDmContinuity: { riskLevel: "watch" },
          uiResponsiveness: { riskLevel: "watch" },
        },
        recentWarnOrError: [],
      },
    });
    assert.equal(passed, true);
  });

  it("fails when root fatal error boundary is active", () => {
    const { passed, gates } = evaluateRuntimeCaptureGates({
      shellUnlocked: false,
      shellHealth: {
        rootFatalBoundary: true,
        fatalBoundaryMessage: "Maximum update depth exceeded",
      },
      m0Bundle: { checks: { requiredApis: { appEvents: true, relayRuntime: true } } },
      crossDeviceDigest: { summary: {}, recentWarnOrError: [] },
    });
    assert.equal(passed, false);
    assert.equal(gates.find((g) => g.id === "shell.no_fatal_boundary")?.passed, false);
  });

  it("fails when native required but absent", () => {
    const { passed } = evaluateRuntimeCaptureGates({
      requireNative: true,
      runtimeCapabilities: { isNativeRuntime: false },
      shellUnlocked: true,
      m0Bundle: { checks: { requiredApis: { appEvents: true, relayRuntime: true } } },
      crossDeviceDigest: { summary: {}, recentWarnOrError: [] },
    });
    assert.equal(passed, false);
  });

  it("builds report with summary", () => {
    const report = buildRuntimeCaptureReport({
      surface: "chromium",
      baseUrl: "http://127.0.0.1:3340",
      scenarios: [{ id: "shell_unlock" }],
      crossDeviceDigest: {
        summary: { selfAuthoredDmContinuity: { riskLevel: "none" } },
        recentWarnOrError: [],
      },
      m0Bundle: { checks: { requiredApis: { appEvents: true, relayRuntime: true } } },
    });
    const summary = summarizeRuntimeCaptureReport(report);
    assert.equal(report.schema, "obscur.runtime-capture-report.v1");
    assert.equal(summary.passed, true);
  });

  it("orders risk levels", () => {
    assert.equal(isRiskLevelAcceptable("watch", "watch"), true);
    assert.equal(isRiskLevelAcceptable("high", "watch"), false);
    assert.equal(isRiskLevelAcceptable("none", "watch"), true);
  });

  it("fails native dm-kernel gate when write probe fails", () => {
    const { passed, gates } = evaluateRuntimeCaptureGates({
      requireNative: true,
      runtimeCapabilities: { isNativeRuntime: true },
      shellUnlocked: true,
      m0Bundle: { checks: { requiredApis: { appEvents: true, relayRuntime: true } } },
      crossDeviceDigest: { summary: {}, recentWarnOrError: [] },
      dmKernelGate: {
        devLabAvailable: true,
        writeProbe: { ok: false, reason: "invoke_failed", errorMessage: "db_insert_message not allowed" },
        oneSidedConversations: [],
      },
    });
    assert.equal(passed, false);
    assert.equal(gates.find((g) => g.id === "dm_kernel.write_probe")?.passed, false);
  });

  it("fails native dm-kernel gate when one-sided conversations exist", () => {
    const { passed, gates } = evaluateRuntimeCaptureGates({
      requireNative: true,
      runtimeCapabilities: { isNativeRuntime: true },
      shellUnlocked: true,
      m0Bundle: { checks: { requiredApis: { appEvents: true, relayRuntime: true } } },
      crossDeviceDigest: { summary: {}, recentWarnOrError: [] },
      dmKernelGate: {
        devLabAvailable: true,
        writeProbe: { ok: true, reason: "roundtrip_ok" },
        oneSidedConversations: [{ conversationId: "dm:a:b", missingDirection: "incoming" }],
      },
    });
    assert.equal(passed, false);
    assert.equal(gates.find((g) => g.id === "dm_kernel.one_sided_sqlite")?.passed, false);
  });

  it("passes native dm-kernel gate when write probe ok and no one-sided threads", () => {
    const { passed, gates } = evaluateRuntimeCaptureGates({
      requireNative: true,
      runtimeCapabilities: { isNativeRuntime: true },
      shellUnlocked: true,
      m0Bundle: { checks: { requiredApis: { appEvents: true, relayRuntime: true } } },
      crossDeviceDigest: { summary: {}, recentWarnOrError: [] },
      dmKernelGate: {
        devLabAvailable: true,
        writeProbe: { ok: true, reason: "roundtrip_ok" },
        oneSidedConversations: [],
        bidirectional: {
          peerPublicKeyHex: "bb",
          total: 2,
          outgoing: 1,
          incoming: 1,
          bidirectional: true,
          skipped: false,
          reason: "bidirectional_ok",
        },
      },
    });
    assert.equal(passed, true);
    assert.equal(gates.find((g) => g.id === "dm_kernel.write_probe")?.passed, true);
    assert.equal(gates.find((g) => g.id === "dm_kernel.one_sided_sqlite")?.passed, true);
    assert.equal(gates.find((g) => g.id === "dm_kernel.bidirectional")?.passed, true);
  });

  it("allows empty bidirectional gate when OBSCUR_DM_KERNEL_ALLOW_EMPTY_BIDIRECTIONAL is set", () => {
    const { passed, gates } = evaluateRuntimeCaptureGates({
      requireNative: true,
      allowEmptyBidirectional: true,
      runtimeCapabilities: { isNativeRuntime: true },
      shellUnlocked: true,
      m0Bundle: { checks: { requiredApis: { appEvents: true, relayRuntime: true } } },
      crossDeviceDigest: { summary: {}, recentWarnOrError: [] },
      dmKernelGate: {
        devLabAvailable: true,
        writeProbe: { ok: true, reason: "roundtrip_ok" },
        oneSidedConversations: [],
        bidirectional: {
          peerPublicKeyHex: "bb",
          total: 0,
          outgoing: 0,
          incoming: 0,
          bidirectional: false,
          skipped: true,
          reason: "no_sqlite_thread",
        },
      },
    });
    assert.equal(passed, true);
    assert.equal(gates.find((g) => g.id === "dm_kernel.bidirectional")?.severity, "warn");
  });
});
