import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDevLabNativeGateReport } from "./dev-lab-native-gate-lib.mjs";

test("evaluateDevLabNativeGateReport passes a valid report", () => {
  const result = evaluateDevLabNativeGateReport({
    schema: "obscur.dev-lab-native-gate.v1",
    runtimeCapabilities: { isNativeRuntime: true },
    shellHealth: { healthy: true },
    dmKernelGate: {
      devLabAvailable: true,
      writeProbe: { ok: true, reason: "roundtrip_ok" },
      oneSidedConversations: [],
      bidirectional: {
        bidirectional: true,
        skipped: false,
        reason: "bidirectional_ok",
      },
    },
    scenarios: [{ id: "dm-native-persist", passed: true }],
    allowEmptyBidirectional: false,
  });
  assert.equal(result.passed, true);
});

test("evaluateDevLabNativeGateReport fails without native runtime", () => {
  const result = evaluateDevLabNativeGateReport({
    schema: "obscur.dev-lab-native-gate.v1",
    runtimeCapabilities: { isNativeRuntime: false },
    shellHealth: { healthy: true },
    dmKernelGate: {
      devLabAvailable: true,
      writeProbe: { ok: true, reason: "roundtrip_ok" },
      oneSidedConversations: [],
      bidirectional: { bidirectional: true, skipped: false },
    },
    scenarios: [],
    allowEmptyBidirectional: false,
  });
  assert.equal(result.passed, false);
  assert.ok(result.failures.includes("native_runtime_missing"));
});
