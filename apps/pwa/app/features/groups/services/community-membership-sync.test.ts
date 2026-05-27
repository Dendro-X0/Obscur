import { describe, expect, it } from "vitest";
import { resolveCoordinationPollBackoffMs } from "./community-membership-sync";

describe("resolveCoordinationPollBackoffMs", () => {
  it("returns base interval when there are no failures", () => {
    expect(resolveCoordinationPollBackoffMs(5_000, 0)).toBe(5_000);
  });

  it("exponentially backs off and caps at 120s", () => {
    expect(resolveCoordinationPollBackoffMs(5_000, 1)).toBe(10_000);
    expect(resolveCoordinationPollBackoffMs(5_000, 2)).toBe(20_000);
    expect(resolveCoordinationPollBackoffMs(5_000, 5)).toBe(120_000);
    expect(resolveCoordinationPollBackoffMs(30_000, 5)).toBe(120_000);
    expect(resolveCoordinationPollBackoffMs(30_000, 10)).toBe(120_000);
  });
});
