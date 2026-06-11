import { describe, expect, it } from "vitest";
import {
  beginGlobalNavLoading,
  canSettleGlobalNavLoading,
  createGlobalNavLoadingControllerState,
  decrementGlobalNavChunkLoad,
  GLOBAL_NAV_LOADING_MIN_VISIBLE_MS,
  GLOBAL_NAV_CHUNK_LOAD_STALE_MS,
  incrementGlobalNavChunkLoad,
  normalizeInternalNavigationHref,
  pathnameMatchesNavTarget,
  shouldForceCompleteGlobalNavLoading,
  startGlobalNavLoadingComplete,
} from "./global-navigation-loading-state";

describe("global-navigation-loading-state", () => {
  it("normalizes same-origin hrefs and rejects external links", () => {
    const origin = "https://obscur.local";
    expect(normalizeInternalNavigationHref("/search?q=1", origin)).toBe("/search?q=1");
    expect(normalizeInternalNavigationHref("https://evil.example/x", origin)).toBeNull();
    expect(normalizeInternalNavigationHref("#section", origin)).toBeNull();
  });

  it("matches pathname targets with or without search params", () => {
    expect(pathnameMatchesNavTarget("/settings", "/settings")).toBe(true);
    expect(pathnameMatchesNavTarget("/settings", "/settings?tab=account")).toBe(true);
    expect(pathnameMatchesNavTarget("/network", "/settings")).toBe(false);
  });

  it("blocks settle until the current pathname matches the target", () => {
    const beganAt = 1_000;
    const state = beginGlobalNavLoading(createGlobalNavLoadingControllerState(), beganAt, "/settings");
    const afterMin = beganAt + GLOBAL_NAV_LOADING_MIN_VISIBLE_MS + 1;
    expect(canSettleGlobalNavLoading(state, afterMin, "/")).toBe(false);
    expect(canSettleGlobalNavLoading(state, afterMin, "/settings")).toBe(true);
  });

  it("blocks settle while chunks are loading", () => {
    const beganAt = 1_000;
    let state = beginGlobalNavLoading(createGlobalNavLoadingControllerState(), beganAt, "/search");
    state = incrementGlobalNavChunkLoad(state, beganAt + 10);
    const afterMin = beganAt + GLOBAL_NAV_LOADING_MIN_VISIBLE_MS + 1;
    expect(canSettleGlobalNavLoading(state, afterMin, "/search")).toBe(false);
    state = decrementGlobalNavChunkLoad(state);
    expect(canSettleGlobalNavLoading(state, afterMin, "/search")).toBe(true);
  });

  it("forces completion after max active duration", () => {
    const beganAt = 0;
    const state = beginGlobalNavLoading(createGlobalNavLoadingControllerState(), beganAt);
    expect(shouldForceCompleteGlobalNavLoading(state, 44_999)).toBe(false);
    expect(shouldForceCompleteGlobalNavLoading(state, 45_000)).toBe(true);
  });

  it("settles when chunk counters are stale", () => {
    const beganAt = 1_000;
    let state = beginGlobalNavLoading(createGlobalNavLoadingControllerState(), beganAt, "/settings");
    state = incrementGlobalNavChunkLoad(state, beganAt + 10);
    const staleAt = beganAt + GLOBAL_NAV_CHUNK_LOAD_STALE_MS + GLOBAL_NAV_LOADING_MIN_VISIBLE_MS;
    expect(canSettleGlobalNavLoading(state, staleAt, "/settings")).toBe(true);
  });

  it("enters completing phase while preserving destination copy", () => {
    const complete = startGlobalNavLoadingComplete(
      beginGlobalNavLoading(createGlobalNavLoadingControllerState(), 0, "/network"),
    );
    expect(complete.completing).toBe(true);
    expect(complete.progress).toBe(100);
    expect(complete.active).toBe(false);
    expect(complete.targetPathname).toBe("/network");
  });
});
