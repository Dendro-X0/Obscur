import { describe, expect, it } from "vitest";

import {
  createRouteMountDiagnosticsState,
  createPageTransitionRecoveryState,
  getRouteSurfaceFromPathname,
  PAGE_TRANSITION_TIMEOUT_DISABLE_THRESHOLD,
  ROUTE_MOUNT_PROBE_MAX_SAMPLES,
  ROUTE_MOUNT_SLOW_DISABLE_THRESHOLD,
  ROUTE_MOUNT_PROBE_WARN_THRESHOLD_MS,
  recordRouteMountProbeSample,
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

  it("records route mount samples and marks slow settles", () => {
    let state = createRouteMountDiagnosticsState();
    state = recordRouteMountProbeSample(state, {
      pathname: "/network",
      routeSurface: "network",
      startedAtUnixMs: 10,
      settledAtUnixMs: 210,
      elapsedMs: 200,
      firstFrameDelayMs: 120,
      secondFrameDelayMs: 80,
      routeRequestElapsedMs: 205,
      pageTransitionsEnabled: true,
      transitionWatchdogTimeoutCount: 0,
    });
    expect(state.recentSamples).toHaveLength(1);
    expect(state.slowSampleCount).toBe(0);
    expect(state.consecutiveSlowSampleCount).toBe(0);
    expect(state.worstElapsedMs).toBe(200);
    expect(state.lastSlowAtUnixMs).toBeNull();

    state = recordRouteMountProbeSample(state, {
      pathname: "/",
      routeSurface: "chats",
      startedAtUnixMs: 220,
      settledAtUnixMs: 2_020,
      elapsedMs: ROUTE_MOUNT_PROBE_WARN_THRESHOLD_MS + 10,
      firstFrameDelayMs: 1_000,
      secondFrameDelayMs: 510,
      routeRequestElapsedMs: 1_900,
      pageTransitionsEnabled: true,
      transitionWatchdogTimeoutCount: 1,
    });
    expect(state.slowSampleCount).toBe(1);
    expect(state.consecutiveSlowSampleCount).toBe(1);
    expect(state.worstElapsedMs).toBe(ROUTE_MOUNT_PROBE_WARN_THRESHOLD_MS + 10);
    expect(state.lastSlowAtUnixMs).toBe(2_020);
  });

  it("tracks consecutive slow samples and resets on a fast sample", () => {
    let state = createRouteMountDiagnosticsState();
    for (let index = 0; index < ROUTE_MOUNT_SLOW_DISABLE_THRESHOLD; index += 1) {
      state = recordRouteMountProbeSample(state, {
        pathname: `/slow-${index}`,
        routeSurface: "chats",
        startedAtUnixMs: index * 1000,
        settledAtUnixMs: index * 1000 + ROUTE_MOUNT_PROBE_WARN_THRESHOLD_MS + 5,
        elapsedMs: ROUTE_MOUNT_PROBE_WARN_THRESHOLD_MS + 5,
        firstFrameDelayMs: 800,
        secondFrameDelayMs: 710,
        routeRequestElapsedMs: null,
        pageTransitionsEnabled: true,
        transitionWatchdogTimeoutCount: 0,
      });
    }
    expect(state.consecutiveSlowSampleCount).toBe(ROUTE_MOUNT_SLOW_DISABLE_THRESHOLD);

    state = recordRouteMountProbeSample(state, {
      pathname: "/fast",
      routeSurface: "chats",
      startedAtUnixMs: 9_000,
      settledAtUnixMs: 9_020,
      elapsedMs: 20,
      firstFrameDelayMs: 10,
      secondFrameDelayMs: 10,
      routeRequestElapsedMs: null,
      pageTransitionsEnabled: true,
      transitionWatchdogTimeoutCount: 0,
    });
    expect(state.consecutiveSlowSampleCount).toBe(0);
  });

  it("keeps route mount sample ring bounded and normalizes invalid thresholds", () => {
    let state = createRouteMountDiagnosticsState();
    for (let index = 0; index < ROUTE_MOUNT_PROBE_MAX_SAMPLES + 3; index += 1) {
      state = recordRouteMountProbeSample(
        state,
        {
          pathname: `/route-${index}`,
          routeSurface: "unknown",
          startedAtUnixMs: index * 10,
          settledAtUnixMs: index * 10 + 5,
          elapsedMs: 5,
          firstFrameDelayMs: 3,
          secondFrameDelayMs: 2,
          routeRequestElapsedMs: null,
          pageTransitionsEnabled: false,
          transitionWatchdogTimeoutCount: 2,
        },
        Number.NaN,
        0,
      );
    }
    expect(state.recentSamples).toHaveLength(ROUTE_MOUNT_PROBE_MAX_SAMPLES);
    expect(state.recentSamples[0]?.pathname).toBe("/route-3");
  });

  it("maps pathname to deterministic route surface labels", () => {
    expect(getRouteSurfaceFromPathname("/")).toBe("chats");
    expect(getRouteSurfaceFromPathname("/network/profile")).toBe("network");
    expect(getRouteSurfaceFromPathname("/groups/view")).toBe("groups");
    expect(getRouteSurfaceFromPathname("/profiles")).toBe("profile");
    expect(getRouteSurfaceFromPathname("/unknown-path")).toBe("unknown");
  });
});
