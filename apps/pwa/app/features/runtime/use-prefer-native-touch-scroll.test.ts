import { describe, expect, it, vi, afterEach } from "vitest";
import { getPreferNativeTouchScrollSnapshot } from "@/app/features/runtime/use-prefer-native-touch-scroll.snapshot";

describe("getPreferNativeTouchScrollSnapshot", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("returns true when pointer is coarse", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(pointer: coarse)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    expect(getPreferNativeTouchScrollSnapshot()).toBe(true);
  });

  it("returns false for fine pointer when not mobile shell build", () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    expect(getPreferNativeTouchScrollSnapshot()).toBe(false);
  });
});
