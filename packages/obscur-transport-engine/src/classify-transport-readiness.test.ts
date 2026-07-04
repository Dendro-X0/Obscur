import { describe, expect, it } from "vitest";
import { classifyTransportReadiness } from "./classify-transport-readiness";

describe("classifyTransportReadiness", () => {
  it("classifies startup warmup as recovering", () => {
    expect(classifyTransportReadiness({
      writableRelayCount: 0,
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: 0,
      recoveryAttemptCount: 0,
      recoveryReasonCode: "startup_warmup",
    })).toBe("recovering");
  });

  it("classifies healthy when writable and subscribable relays exist", () => {
    expect(classifyTransportReadiness({
      writableRelayCount: 2,
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: 2,
      recoveryAttemptCount: 0,
    })).toBe("healthy");
  });

  it("classifies degraded when only fallback writable relays exist", () => {
    expect(classifyTransportReadiness({
      writableRelayCount: 0,
      fallbackWritableRelayCount: 1,
      subscribableRelayCount: 0,
      recoveryAttemptCount: 0,
    })).toBe("degraded");
  });

  it("classifies recovering when attempts exist without writable relays", () => {
    expect(classifyTransportReadiness({
      writableRelayCount: 0,
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: 0,
      recoveryAttemptCount: 2,
    })).toBe("recovering");
  });

  it("classifies offline when recovery is exhausted", () => {
    expect(classifyTransportReadiness({
      writableRelayCount: 0,
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: 0,
      recoveryAttemptCount: 8,
      recoveryReasonCode: "recovery_exhausted",
    })).toBe("offline");
  });
});
