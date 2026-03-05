import { describe, expect, it } from "vitest";
import {
  buildMediaViewerState,
  clampZoom,
  computePinchZoom,
  detectSwipeDirection,
  nextMediaIndex,
  prevMediaIndex,
} from "./media-viewer-interactions";

describe("media-viewer-interactions", () => {
  it("wraps media indices", () => {
    expect(nextMediaIndex(2, 3)).toBe(0);
    expect(prevMediaIndex(0, 3)).toBe(2);
  });

  it("clamps zoom values", () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(9)).toBe(4);
    expect(clampZoom(2.5)).toBe(2.5);
  });

  it("computes pinch zoom with clamping", () => {
    expect(computePinchZoom({ startDistance: 100, currentDistance: 200, startZoom: 1 })).toBe(2);
    expect(computePinchZoom({ startDistance: 100, currentDistance: 1000, startZoom: 1 })).toBe(4);
  });

  it("detects swipe direction by threshold", () => {
    expect(detectSwipeDirection(20)).toBeNull();
    expect(detectSwipeDirection(80)).toBe("prev");
    expect(detectSwipeDirection(-80)).toBe("next");
  });

  it("builds capability flags", () => {
    const state = buildMediaViewerState({
      activeIndex: 2,
      zoom: 1,
      pan: { x: 0, y: 0 },
      isPinching: false,
    });
    expect(state.canZoomOut).toBe(false);
    expect(state.canZoomIn).toBe(true);
  });
});

