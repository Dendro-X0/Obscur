import type { NavItem } from "../lib/navigation/nav-item";

export type RoutePrefetchWarmupSkipReason = "no_targets";

export type RoutePrefetchWarmupPlan = Readonly<
  | {
    enabled: true;
    targets: ReadonlyArray<string>;
  }
  | {
    enabled: false;
    reason: RoutePrefetchWarmupSkipReason;
    targets: ReadonlyArray<string>;
  }
>;

/** Sidebar routes that use `next/dynamic` page clients — warm after initial shell mount. */
const PREFETCH_WARMUP_ALLOWED_HREFS = new Set<string>([
  "/network",
  "/vault",
  "/search",
  "/settings",
]);

export const resolveRoutePrefetchWarmupPlan = (
  options: Readonly<{
    pathname: string;
    navItems: ReadonlyArray<NavItem>;
    warmedHrefs: ReadonlySet<string>;
  }>,
): RoutePrefetchWarmupPlan => {
  const targets = options.navItems
    .map((item) => item.href)
    .filter((href, index, allHrefs) => (
      href !== options.pathname
      && allHrefs.indexOf(href) === index
      && PREFETCH_WARMUP_ALLOWED_HREFS.has(href)
      && !options.warmedHrefs.has(href)
    ));

  if (targets.length === 0) {
    return {
      enabled: false,
      reason: "no_targets",
      targets: [],
    };
  }

  return {
    enabled: true,
    targets,
  };
};
