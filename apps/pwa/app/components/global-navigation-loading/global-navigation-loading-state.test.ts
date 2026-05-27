import { describe, expect, it } from "vitest";
import {
  beginGlobalNavLoading,
  canSettleGlobalNavLoading,
  createGlobalNavLoadingControllerState,
  decrementGlobalNavChunkLoad,
  GLOBAL_NAV_LOADING_MIN_VISIBLE_MS,
  incrementGlobalNavChunkLoad,
  normalizeInternalNavigationHref,
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

  it("blocks settle while chunks are loading", () => {
    const beganAt = 1_000;
    let state = beginGlobalNavLoading(createGlobalNavLoadingControllerState(), beganAt, "/search");
    state = incrementGlobalNavChunkLoad(state, beganAt + 10);
    const afterMin = beganAt + GLOBAL_NAV_LOADING_MIN_VISIBLE_MS + 1;
    expect(canSettleGlobalNavLoading(state, afterMin)).toBe(false);
    state = decrementGlobalNavChunkLoad(state);
    expect(canSettleGlobalNavLoading(state, afterMin)).toBe(true);
  });

  it("forces completion after max active duration", () => {
    const beganAt = 0;
    const state = beginGlobalNavLoading(createGlobalNavLoadingControllerState(), beganAt);
    expect(shouldForceCompleteGlobalNavLoading(state, 44_999)).toBe(false);
    expect(shouldForceCompleteGlobalNavLoading(state, 45_000)).toBe(true);
  });

  it("enters completing phase at 100% progress", () => {
    const complete = startGlobalNavLoadingComplete(
      beginGlobalNavLoading(createGlobalNavLoadingControllerState(), 0),
    );
    expect(complete.completing).toBe(true);
    expect(complete.progress).toBe(100);
    expect(complete.active).toBe(false);
  });
});
