import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BASELINE_SCHEMA,
  compareBaselineReports,
  evaluateRapidNavGate,
  evaluateReleasePerfParity,
  evaluateV2PerfGate,
  parseBaselineReport,
  summarizeBaselineReport,
} from "./obscur-shell-perf-baseline-lib.mjs";

/** @param {'dev' | 'prod'} mode @param {number} medianMs */
function stubReport(mode, medianMs) {
  return {
    schema: BASELINE_SCHEMA,
    mode,
    baseUrl: "http://127.0.0.1:1",
    recordedAt: "2026-05-22T00:00:00.000Z",
    checks: { shellPhase: "unlocked", experimentShell: true },
    navigations: [
      { href: "/network", label: "Network", visit: 1, elapsedMs: medianMs, urlMatched: true },
      { href: "/settings", label: "Settings", visit: 1, elapsedMs: medianMs, urlMatched: true },
      { href: "/settings", label: "Settings", visit: 2, elapsedMs: Math.floor(medianMs * 0.4), urlMatched: true },
    ],
  };
}

describe("obscur-shell-perf-baseline-lib", () => {
  it("summarizes settings cold vs warm", () => {
    const summary = summarizeBaselineReport(stubReport("dev", 2000));
    assert.equal(summary.settingsColdMs, 2000);
    assert.equal(summary.settingsWarmMs, 800);
    assert.equal(summary.medianNavMs, 2000);
  });

  it("detects toolchain verdict when dev is much slower than prod", () => {
    const comparison = compareBaselineReports(stubReport("dev", 4000), stubReport("prod", 400));
    assert.equal(comparison.verdict, "toolchain");
    assert.ok(comparison.devToProdMedianRatio >= 2);
  });

  it("detects architecture verdict when both are slow", () => {
    const comparison = compareBaselineReports(stubReport("dev", 3000), stubReport("prod", 2500));
    assert.equal(comparison.verdict, "architecture");
  });

  it("parses schema", () => {
    const report = parseBaselineReport(stubReport("prod", 100));
    assert.equal(report.mode, "prod");
  });

  it("tracks max route mount worst ms", () => {
    const report = stubReport("prod", 400);
    report.navigations[0].routeMountWorstMs = 120;
    report.navigations[1].routeMountWorstMs = 240;
    const summary = summarizeBaselineReport(report);
    assert.equal(summary.maxRouteMountWorstMs, 240);
  });

  it("evaluates v2 perf gate pass and fail", () => {
    const passing = stubReport("prod", 400);
    passing.navigations.forEach((nav) => {
      nav.routeMountWorstMs = 80;
    });
    assert.equal(evaluateV2PerfGate(passing).pass, true);

    const failing = stubReport("prod", 4000);
    assert.equal(evaluateV2PerfGate(failing).pass, false);
  });

  it("evaluates release perf parity within 20 percent budget", () => {
    const withColdStart = (report, domMs) => ({
      ...report,
      coldStart: { domContentLoadedMs: domMs },
    });
    const reference = withColdStart(stubReport("prod", 100), 80);
    const candidate = withColdStart(stubReport("prod", 115), 90);
    assert.equal(evaluateReleasePerfParity(reference, candidate).pass, true);
    const slow = withColdStart(stubReport("prod", 130), 80);
    assert.equal(evaluateReleasePerfParity(reference, slow).pass, false);
  });

  it("evaluates rapid nav gate from samples", () => {
    const gate = evaluateRapidNavGate([
      { href: "/", label: "Chats", visit: 1, elapsedMs: 120, urlMatched: true, routeMountWorstMs: 50 },
    ]);
    assert.equal(gate.gatePass, false);
    assert.ok(gate.issues.some((issue) => issue.startsWith("samples_")));
  });
});
