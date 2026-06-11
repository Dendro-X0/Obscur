import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleSidebarNavigation, yieldToNextPaint } from "./schedule-sidebar-navigation";

describe("scheduleSidebarNavigation", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback): number => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pushes through startTransition after yielding to paint", async () => {
    const push = vi.fn();
    scheduleSidebarNavigation({ push }, "/settings");
    expect(push).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(push).toHaveBeenCalledWith("/settings");
  });

  it("pushes immediately when requested", () => {
    const push = vi.fn();
    scheduleSidebarNavigation({ push }, "/settings", { immediate: true });
    expect(push).toHaveBeenCalledWith("/settings");
  });
});

describe("yieldToNextPaint", () => {
  it("resolves after animation frames when available", async () => {
    let frame = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback): number => {
      frame += 1;
      callback(frame);
      return frame;
    });
    await yieldToNextPaint();
    expect(frame).toBeGreaterThanOrEqual(1);
    vi.unstubAllGlobals();
  });
});
