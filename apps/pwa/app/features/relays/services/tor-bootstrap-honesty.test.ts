import { describe, expect, it } from "vitest";
import {
  assessTorBootstrapStall,
  formatTorBootstrapProgressSuffix,
  isTorBootstrapStuckDetail,
  summarizeTorBootstrapStall,
} from "./tor-bootstrap-honesty";

describe("formatTorBootstrapProgressSuffix", () => {
  it("appends percent only while Warming (0–99)", () => {
    expect(formatTorBootstrapProgressSuffix(0)).toBe(" 0%");
    expect(formatTorBootstrapProgressSuffix(50)).toBe(" 50%");
    expect(formatTorBootstrapProgressSuffix(99)).toBe(" 99%");
  });

  it("omits 100% and missing values so Ready copy stays the owner", () => {
    expect(formatTorBootstrapProgressSuffix(100)).toBe("");
    expect(formatTorBootstrapProgressSuffix(undefined)).toBe("");
    expect(formatTorBootstrapProgressSuffix(null)).toBe("");
  });
});

describe("tor bootstrap stall honesty", () => {
  const stuckDetail =
    "Problem bootstrapping. Stuck at 10% (conn_done): Connected to a relay. (unexpected eof while reading; TLS_ERROR; count 31)";

  it("detects stuck / TLS_ERROR detail", () => {
    expect(isTorBootstrapStuckDetail(stuckDetail)).toBe(true);
    expect(isTorBootstrapStuckDetail("waiting for Bootstrapped 100%")).toBe(false);
  });

  it("summarizes TLS stall for operators", () => {
    const summary = summarizeTorBootstrapStall(stuckDetail, 10);
    expect(summary).toContain("stuck");
    expect(summary).toContain("~10%");
    expect(summary).toMatch(/TLS|VPN|firewall|DPI/i);
  });

  it("summarizes TIMEOUT / WSAETIMEDOUT stalls", () => {
    const timeoutDetail =
      "Problem bootstrapping. Stuck at 5% (conn): Connecting to a relay. (Connection timed out [WSAETIMEDOUT ]; TIMEOUT; count 16)";
    const summary = summarizeTorBootstrapStall(timeoutDetail, 5);
    expect(summary).toContain("~5%");
    expect(summary).toMatch(/timed out/i);
  });

  it("flags explicit stall immediately", () => {
    const assessment = assessTorBootstrapStall({
      preferenceOn: true,
      lifecycleReady: false,
      detail: stuckDetail,
      bootstrapPercent: 10,
      warmingElapsedMs: 1_000,
    });
    expect(assessment.stalled).toBe(true);
    expect(assessment.explicit).toBe(true);
    expect(assessment.reason).toContain("stuck");
  });

  it("does not stall while still waiting without stuck evidence", () => {
    const assessment = assessTorBootstrapStall({
      preferenceOn: true,
      lifecycleReady: false,
      detail: "waiting for Bootstrapped 100%",
      bootstrapPercent: 5,
      warmingElapsedMs: 5_000,
    });
    expect(assessment.stalled).toBe(false);
  });

  it("soft-stalls after timeout when detail exists but not Ready", () => {
    const assessment = assessTorBootstrapStall({
      preferenceOn: true,
      lifecycleReady: false,
      detail: "waiting for Bootstrapped 100%",
      bootstrapPercent: 5,
      warmingElapsedMs: 25_000,
      softStallMs: 20_000,
    });
    expect(assessment.stalled).toBe(true);
    expect(assessment.explicit).toBe(false);
    expect(assessment.reason).toMatch(/waiting for Bootstrapped 100%/i);
  });

  it("soft-stalls after timeout even when gateway detail is missing", () => {
    const assessment = assessTorBootstrapStall({
      preferenceOn: true,
      lifecycleReady: false,
      warmingElapsedMs: 25_000,
      softStallMs: 20_000,
    });
    expect(assessment.stalled).toBe(true);
    expect(assessment.explicit).toBe(false);
    expect(assessment.reason).toMatch(/no usable bootstrap progress/i);
  });

  it("recovers Stuck/TIMEOUT reason from tor logs when snapshot detail was cleared", () => {
    const assessment = assessTorBootstrapStall({
      preferenceOn: true,
      lifecycleReady: false,
      detail: "waiting for Bootstrapped 100%",
      logLines: [
        "R4: gateway start → starting ready=false",
        "R4: gateway detail: Problem bootstrapping. Stuck at 14% (handshake): Connection timed out [WSAETIMEDOUT ]; TIMEOUT",
        "R4: gateway detail: waiting for Bootstrapped 100%",
      ],
      warmingElapsedMs: 5_000,
    });
    expect(assessment.stalled).toBe(true);
    expect(assessment.explicit).toBe(true);
    expect(assessment.reason).toMatch(/timed out/i);
    expect(assessment.reason).toContain("~14%");
  });

  it("clears stall when Ready or preference off", () => {
    expect(assessTorBootstrapStall({
      preferenceOn: true,
      lifecycleReady: true,
      detail: stuckDetail,
    }).stalled).toBe(false);
    expect(assessTorBootstrapStall({
      preferenceOn: false,
      lifecycleReady: false,
      detail: stuckDetail,
    }).stalled).toBe(false);
  });
});
