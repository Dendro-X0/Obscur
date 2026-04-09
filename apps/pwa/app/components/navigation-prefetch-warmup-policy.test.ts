import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "../lib/navigation/nav-items";
import { resolveRoutePrefetchWarmupPlan } from "./navigation-prefetch-warmup-policy";

describe("resolveRoutePrefetchWarmupPlan", () => {
  it("skips automatic warmup in desktop runtime", () => {
    expect(resolveRoutePrefetchWarmupPlan({
      pathname: "/",
      isDesktop: true,
      navItems: NAV_ITEMS,
      warmedHrefs: new Set<string>(),
    })).toEqual({
      enabled: false,
      reason: "desktop_runtime",
      targets: [],
    });
  });

  it("limits warmup to lightweight routes that are not already warmed", () => {
    expect(resolveRoutePrefetchWarmupPlan({
      pathname: "/",
      isDesktop: false,
      navItems: NAV_ITEMS,
      warmedHrefs: new Set<string>(["/network"]),
    })).toEqual({
      enabled: true,
      targets: ["/vault"],
    });
  });

  it("skips warmup when no eligible targets remain", () => {
    expect(resolveRoutePrefetchWarmupPlan({
      pathname: "/network",
      isDesktop: false,
      navItems: NAV_ITEMS,
      warmedHrefs: new Set<string>(["/vault"]),
    })).toEqual({
      enabled: false,
      reason: "no_targets",
      targets: [],
    });
  });
});
