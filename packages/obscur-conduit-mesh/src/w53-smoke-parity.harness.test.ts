import { describe, expect, it } from "vitest";

import { runW53SmokeParityHarness } from "./w53-smoke-parity-harness";

describe("w53 smoke parity harness", () => {
  it("meets multi-relay quorum and lane-switch parity without legacy pool", async () => {
    const report = await runW53SmokeParityHarness({
      now: () => 1_700_000_200_000,
    });

    expect(report.multiRelayQuorum.totalRelays).toBe(3);
    expect(report.multiRelayQuorum.successCount).toBeGreaterThanOrEqual(2);
    expect(report.multiRelayQuorum.metQuorum).toBe(true);
    expect(report.laneSwitchAccepted).toBe(true);
    expect(report.meshReadiness).toBe("healthy");
  });
});
