import { describe, expect, it, beforeEach } from "vitest";
import {
  getSybilRiskSnapshot,
  recordIdentityActivationRisk,
  recordMalformedEventQuarantinedRisk,
  recordRequestSuppressedRisk,
  resetSybilRiskSignals
} from "./sybil-risk-signals";

describe("sybil risk signals", () => {
  beforeEach(() => {
    resetSybilRiskSignals();
  });

  it("elevates level under repeated request suppression", () => {
    for (let i = 0; i < 9; i += 1) {
      recordRequestSuppressedRisk();
    }
    const snapshot = getSybilRiskSnapshot();
    expect(snapshot.counts.request_suppressed).toBe(9);
    expect(snapshot.level).toBe("elevated");
    expect(snapshot.score).toBeGreaterThanOrEqual(35);
  });

  it("records identity churn when many identities activate in one window", () => {
    recordIdentityActivationRisk("a".repeat(64) as any);
    recordIdentityActivationRisk("b".repeat(64) as any);
    const noChurn = getSybilRiskSnapshot();
    expect(noChurn.counts.identity_churn).toBe(0);

    recordIdentityActivationRisk("c".repeat(64) as any);
    recordMalformedEventQuarantinedRisk();

    const snapshot = getSybilRiskSnapshot();
    expect(snapshot.distinctIdentityCount).toBe(3);
    expect(snapshot.counts.identity_churn).toBeGreaterThanOrEqual(1);
    expect(snapshot.counts.malformed_event_quarantined).toBe(1);
  });
});
