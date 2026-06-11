import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "../lib/navigation/nav-items";
import {
  hasIntelligentNavigationWarmupWork,
  resolveIntelligentNavigationWarmupPlan,
} from "./intelligent-navigation-warmup-policy";

describe("resolveIntelligentNavigationWarmupPlan", () => {
  it("prioritizes network and group-home preload from chats home", () => {
    const plan = resolveIntelligentNavigationWarmupPlan({
      pathname: "/",
      routeSurface: "chats",
      navItems: NAV_ITEMS,
      warmedHrefs: new Set<string>(),
    });
    expect(plan.critical).toEqual([]);
    expect(plan.context).toEqual(["/network"]);
    expect(plan.specialTasks).toEqual(["group_home_client", "settings_page_client"]);
    expect(plan.background).toEqual(["/vault", "/search", "/settings"]);
    expect(hasIntelligentNavigationWarmupWork(plan)).toBe(true);
  });

  it("warms current route first when on a dynamic nav surface", () => {
    const plan = resolveIntelligentNavigationWarmupPlan({
      pathname: "/network",
      routeSurface: "network",
      navItems: NAV_ITEMS,
      warmedHrefs: new Set<string>(),
    });
    expect(plan.critical).toEqual(["/network"]);
    expect(plan.context).toEqual(["/vault"]);
    expect(plan.specialTasks).toEqual(["group_home_client", "settings_page_client"]);
    expect(plan.background).toEqual(["/search", "/settings"]);
  });

  it("prioritizes network context from group home without duplicating warmed hrefs", () => {
    const plan = resolveIntelligentNavigationWarmupPlan({
      pathname: "/groups/demo",
      routeSurface: "groups",
      navItems: NAV_ITEMS,
      warmedHrefs: new Set<string>(["/network"]),
      warmedSpecialTasks: new Set(["group_home_client", "settings_page_client"]),
    });
    expect(plan.critical).toEqual([]);
    expect(plan.context).toEqual([]);
    expect(plan.specialTasks).toEqual([]);
    expect(plan.background).toEqual(["/vault", "/search", "/settings"]);
  });

  it("reports no work when every target was already warmed", () => {
    const plan = resolveIntelligentNavigationWarmupPlan({
      pathname: "/",
      routeSurface: "chats",
      navItems: NAV_ITEMS,
      warmedHrefs: new Set<string>(["/network", "/vault", "/search", "/settings"]),
      warmedSpecialTasks: new Set(["group_home_client", "settings_page_client"]),
    });
    expect(hasIntelligentNavigationWarmupWork(plan)).toBe(false);
  });
});
