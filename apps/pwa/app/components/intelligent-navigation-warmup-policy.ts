import type { NavItem } from "../lib/navigation/nav-item";
import type { RouteSurface } from "./page-transition-recovery";

/** Sidebar routes backed by `next/dynamic` page clients. */
export const NAVIGATION_WARMUP_ALLOWED_HREFS = new Set<string>([
  "/network",
  "/vault",
  "/search",
  "/settings",
]);

export type NavigationWarmupSpecialTask = "group_home_client";

export type IntelligentNavigationWarmupPlan = Readonly<{
  critical: ReadonlyArray<string>;
  context: ReadonlyArray<string>;
  background: ReadonlyArray<string>;
  specialTasks: ReadonlyArray<NavigationWarmupSpecialTask>;
}>;

const SURFACE_CONTEXT_HREFS: Partial<Record<RouteSurface, ReadonlyArray<string>>> = {
  chats: ["/network"],
  network: ["/vault"],
  groups: ["/network"],
  search: ["/network"],
  vault: ["/search"],
  settings: [],
  requests: ["/network"],
  profile: ["/network"],
  invites: ["/network"],
};

const SURFACE_SPECIAL_TASKS: Partial<Record<RouteSurface, ReadonlyArray<NavigationWarmupSpecialTask>>> = {
  chats: ["group_home_client"],
  network: ["group_home_client"],
  groups: ["group_home_client"],
  search: ["group_home_client"],
};

export const resolveWarmableNavHref = (pathnameInput: string): string | null => {
  const pathname = pathnameInput.trim() || "/";
  for (const href of NAVIGATION_WARMUP_ALLOWED_HREFS) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      return href;
    }
  }
  return null;
};

const uniqueHrefs = (hrefs: ReadonlyArray<string>): ReadonlyArray<string> => (
  hrefs.filter((href, index, all) => all.indexOf(href) === index)
);

/**
 * Phased warm-up plan: critical (current surface) → context (related nav) → background (remaining).
 * Special tasks preload heavy non-nav chunks (e.g. group home) when the surface implies community work.
 */
export const resolveIntelligentNavigationWarmupPlan = (
  options: Readonly<{
    pathname: string;
    routeSurface: RouteSurface;
    navItems: ReadonlyArray<NavItem>;
    warmedHrefs: ReadonlySet<string>;
    warmedSpecialTasks?: ReadonlySet<NavigationWarmupSpecialTask>;
  }>,
): IntelligentNavigationWarmupPlan => {
  const currentHref = resolveWarmableNavHref(options.pathname);
  const warmedHrefs = options.warmedHrefs;
  const warmedSpecialTasks = options.warmedSpecialTasks ?? new Set<NavigationWarmupSpecialTask>();

  const critical = currentHref && !warmedHrefs.has(currentHref) ? [currentHref] : [];

  const contextCandidates = SURFACE_CONTEXT_HREFS[options.routeSurface] ?? [];
  const context = uniqueHrefs(
    contextCandidates.filter((href) => (
      NAVIGATION_WARMUP_ALLOWED_HREFS.has(href)
      && href !== currentHref
      && !warmedHrefs.has(href)
    )),
  );

  const reserved = new Set<string>([...critical, ...context]);
  const background = uniqueHrefs(
    options.navItems
      .map((item) => item.href)
      .filter((href, index, allHrefs) => (
        allHrefs.indexOf(href) === index
        && NAVIGATION_WARMUP_ALLOWED_HREFS.has(href)
        && !reserved.has(href)
        && !warmedHrefs.has(href)
      )),
  );

  const specialTasks = (SURFACE_SPECIAL_TASKS[options.routeSurface] ?? []).filter(
    (task) => !warmedSpecialTasks.has(task),
  );

  return {
    critical,
    context,
    background,
    specialTasks,
  };
};

export const hasIntelligentNavigationWarmupWork = (
  plan: IntelligentNavigationWarmupPlan,
): boolean => (
  plan.critical.length > 0
  || plan.context.length > 0
  || plan.background.length > 0
  || plan.specialTasks.length > 0
);
