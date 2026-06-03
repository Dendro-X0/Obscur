import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NAVIGATION_QUIESCENCE_MS,
  getNavigationPerformanceSnapshot,
  isRapidNavigationMode,
  recordNavigationIntent,
  recordPathnameCommitted,
  resetNavigationPerformanceCoordinatorForTests,
  shouldRunBackgroundNavigationWarmup,
} from "./navigation-performance-coordinator";

describe("navigation-performance-coordinator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetNavigationPerformanceCoordinatorForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetNavigationPerformanceCoordinatorForTests();
  });

  it("enters rapid navigation mode when intents arrive within the rolling window", () => {
    recordNavigationIntent("/network");
    expect(isRapidNavigationMode()).toBe(false);

    recordNavigationIntent("/vault");
    expect(isRapidNavigationMode()).toBe(true);
    expect(shouldRunBackgroundNavigationWarmup()).toBe(false);
  });

  it("becomes quiesced after pathname commit and suppresses warmup during rapid mode", () => {
    recordNavigationIntent("/network");
    recordNavigationIntent("/vault");
    recordPathnameCommitted("/vault");

    expect(getNavigationPerformanceSnapshot().isQuiesced).toBe(false);
    expect(shouldRunBackgroundNavigationWarmup()).toBe(false);

    vi.advanceTimersByTime(NAVIGATION_QUIESCENCE_MS);
    expect(getNavigationPerformanceSnapshot().isQuiesced).toBe(true);
    expect(isRapidNavigationMode()).toBe(false);
    expect(shouldRunBackgroundNavigationWarmup()).toBe(true);
  });
});
