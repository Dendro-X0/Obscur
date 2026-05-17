import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "../lib/navigation/nav-items";
import { resolveRoutePrefetchWarmupPlan } from "./navigation-prefetch-warmup-policy";

describe("resolveRoutePrefetchWarmupPlan", () => {
  it("warms all dynamic sidebar routes except the active pathname", () => {
    expect(resolveRoutePrefetchWarmupPlan({
      pathname: "/",
      navItems: NAV_ITEMS,
      warmedHrefs: new Set<string>(),
    })).toEqual({
      enabled: true,
      targets: ["/network", "/vault", "/search", "/settings"],
    });
  });

  it("skips routes that were already warmed", () => {
    expect(resolveRoutePrefetchWarmupPlan({
      pathname: "/",
      navItems: NAV_ITEMS,
      warmedHrefs: new Set<string>(["/network", "/vault", "/search", "/settings"]),
    })).toEqual({
      enabled: false,
      reason: "no_targets",
      targets: [],
    });
  });

  it("does not warm the current route", () => {
    expect(resolveRoutePrefetchWarmupPlan({
      pathname: "/network",
      navItems: NAV_ITEMS,
      warmedHrefs: new Set<string>(),
    })).toEqual({
      enabled: true,
      targets: ["/vault", "/search", "/settings"],
    });
  });
});
