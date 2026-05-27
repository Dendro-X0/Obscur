import { describe, expect, it } from "vitest";
import {
  appChromeOverridesEqual,
  mergeAppChromeSlots,
  navBadgeCountsEqual,
  serializeAppChromeOverrides,
} from "./app-chrome-registry";

describe("mergeAppChromeSlots", () => {
  it("merges nav badges and boolean flags", () => {
    const merged = mergeAppChromeSlots([
      { navBadgeCounts: { "/": 2 }, hideSidebar: true },
      { navBadgeCounts: { "/settings": 1 } },
      { hideHeader: true },
    ]);

    expect(merged.navBadgeCounts).toEqual({ "/": 2, "/settings": 1 });
    expect(merged.hideSidebar).toBe(true);
    expect(merged.hideHeader).toBe(true);
  });

  it("returns defaults when no registrations exist", () => {
    const merged = mergeAppChromeSlots([]);
    expect(merged.navBadgeCounts).toEqual({});
    expect(merged.hideSidebar).toBe(false);
    expect(merged.hideHeader).toBe(false);
    expect(merged.mobileDmMode).toBe(false);
  });
});

describe("appChromeOverridesEqual", () => {
  it("compares nav badge maps by value", () => {
    expect(navBadgeCountsEqual({ "/": 1 }, { "/": 1 })).toBe(true);
    expect(appChromeOverridesEqual(
      { navBadgeCounts: { "/": 1 }, hideSidebar: false },
      { navBadgeCounts: { "/": 1 }, hideSidebar: false },
    )).toBe(true);
    expect(appChromeOverridesEqual(
      { navBadgeCounts: { "/": 1 } },
      { navBadgeCounts: { "/": 2 } },
    )).toBe(false);
  });

  it("serializes stable keys for effect dependencies", () => {
    const a = serializeAppChromeOverrides({ navBadgeCounts: { "/": 3 }, hideHeader: true });
    const b = serializeAppChromeOverrides({ navBadgeCounts: { "/": 3 }, hideHeader: true });
    expect(a).toBe(b);
  });
});
