import { describe, expect, it } from "vitest";

import {
  createPageTransitionRecoveryState,
  PAGE_TRANSITION_TIMEOUT_DISABLE_THRESHOLD,
  recordPageTransitionWatchdogTimeout,
} from "./page-transition-recovery";

describe("page-transition-recovery", () => {
  it("keeps transitions enabled before timeout threshold", () => {
    let state = createPageTransitionRecoveryState();

    state = recordPageTransitionWatchdogTimeout(state);
    state = recordPageTransitionWatchdogTimeout(state);

    expect(state.timeoutCount).toBe(2);
    expect(state.transitionsDisabled).toBe(false);
  });

  it("disables transitions when timeout threshold is reached", () => {
    let state = createPageTransitionRecoveryState();

    for (let index = 0; index < PAGE_TRANSITION_TIMEOUT_DISABLE_THRESHOLD; index += 1) {
      state = recordPageTransitionWatchdogTimeout(state);
    }

    expect(state.timeoutCount).toBe(PAGE_TRANSITION_TIMEOUT_DISABLE_THRESHOLD);
    expect(state.transitionsDisabled).toBe(true);
  });

  it("keeps transitions disabled once they are disabled", () => {
    const disabledState = {
      timeoutCount: 10,
      transitionsDisabled: true,
    } as const;

    const nextState = recordPageTransitionWatchdogTimeout(disabledState);
    expect(nextState.timeoutCount).toBe(11);
    expect(nextState.transitionsDisabled).toBe(true);
  });

  it("falls back to default threshold when provided threshold is invalid", () => {
    let state = createPageTransitionRecoveryState();
    for (let index = 0; index < PAGE_TRANSITION_TIMEOUT_DISABLE_THRESHOLD - 1; index += 1) {
      state = recordPageTransitionWatchdogTimeout(state, 0);
    }

    expect(state.transitionsDisabled).toBe(false);

    state = recordPageTransitionWatchdogTimeout(state, Number.NaN);
    expect(state.transitionsDisabled).toBe(true);
  });
});
