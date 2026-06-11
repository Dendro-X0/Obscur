import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateDevLabBenchmark, summarizeDevLabBenchmark } from "./dev-lab-benchmark-lib.mjs";

describe("dev-lab-benchmark-lib", () => {
  it("passes clean benchmark report", () => {
    const report = {
      schema: "obscur.dev-lab.benchmark.v1",
      passed: true,
      suite: "core",
      summary: { total: 3, passed: 3, failed: 0, failedScenarioIds: [] },
      shellHealth: { rootFatalBoundary: false },
      scenarios: [{ id: "auth-unlock", passed: true }],
    };
    const { passed } = evaluateDevLabBenchmark(report);
    assert.equal(passed, true);
    assert.equal(summarizeDevLabBenchmark(report).passed, true);
  });

  it("fails when fatal boundary present", () => {
    const report = {
      passed: false,
      summary: { total: 1, passed: 0, failed: 1, failedScenarioIds: ["nav-matrix"] },
      shellHealth: { rootFatalBoundary: true, fatalBoundaryMessage: "Maximum update depth exceeded" },
    };
    const { passed, gates } = evaluateDevLabBenchmark(report);
    assert.equal(passed, false);
    assert.equal(gates.find((g) => g.id === "shell.no_fatal_boundary")?.passed, false);
  });
});
