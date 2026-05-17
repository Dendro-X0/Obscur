import { describe, expect, it } from "vitest";
import { PRESENCE_STALE_AFTER_MS } from "./realtime-presence";
import { isRecentPresenceEvidenceActive, presenceEvidenceInternals } from "./presence-evidence";

describe("isRecentPresenceEvidenceActive", () => {
  it("returns true when evidence falls within stale window", () => {
    const nowMs = 1_000_000;
    expect(isRecentPresenceEvidenceActive({
      nowMs,
      lastObservedAtMs: nowMs - PRESENCE_STALE_AFTER_MS + 1,
    })).toBe(true);
  });

  it("returns false when evidence is older than stale window", () => {
    const nowMs = 1_000_000;
    expect(isRecentPresenceEvidenceActive({
      nowMs,
      lastObservedAtMs: nowMs - PRESENCE_STALE_AFTER_MS - 1,
    })).toBe(false);
  });

  it("allows bounded future skew and rejects larger future drift", () => {
    const nowMs = 1_000_000;
    expect(isRecentPresenceEvidenceActive({
      nowMs,
      lastObservedAtMs: nowMs + presenceEvidenceInternals.MAX_FUTURE_CLOCK_SKEW_MS,
    })).toBe(true);
    expect(isRecentPresenceEvidenceActive({
      nowMs,
      lastObservedAtMs: nowMs + presenceEvidenceInternals.MAX_FUTURE_CLOCK_SKEW_MS + 1,
    })).toBe(false);
  });

  it("returns false for invalid evidence inputs", () => {
    expect(isRecentPresenceEvidenceActive({
      nowMs: null,
      lastObservedAtMs: Date.now(),
    })).toBe(false);
    expect(isRecentPresenceEvidenceActive({
      nowMs: Date.now(),
      lastObservedAtMs: Number.NaN,
    })).toBe(false);
  });
});

