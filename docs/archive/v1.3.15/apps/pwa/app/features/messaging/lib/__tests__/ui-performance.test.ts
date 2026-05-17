import { describe, expect, it } from "vitest";
import { resolveUiPerformancePolicy } from "../ui-performance";

describe("ui-performance policy", () => {
  it("keeps strict thresholds in production mode", () => {
    expect(resolveUiPerformancePolicy("production")).toEqual({
      warningThresholdMs: 100,
      degradedScoreThreshold: 90,
    });
  });

  it("relaxes thresholds in non-production modes", () => {
    expect(resolveUiPerformancePolicy("development")).toEqual({
      warningThresholdMs: 300,
      degradedScoreThreshold: 70,
    });
    expect(resolveUiPerformancePolicy("test")).toEqual({
      warningThresholdMs: 300,
      degradedScoreThreshold: 70,
    });
  });
});
