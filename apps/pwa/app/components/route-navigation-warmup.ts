import {
  preloadGroupHomePageClient,
  ROUTE_CLIENT_CHUNK_LOADERS,
  type SidebarRouteHref,
} from "@/app/lib/navigation/sidebar-routes";
import { isDesktopShellBuild } from "@/app/features/runtime/shell-contract";
import {
  assertNavigationChunkLoadAuthorized,
  runWithNavigationChunkLoadAuthority,
} from "./navigation-chunk-load-authority";

export { ROUTE_CLIENT_CHUNK_LOADERS, preloadGroupHomePageClient };

export type RouteNavigationWarmupMode = "shell-only" | "full";

/**
 * Production desktop: eager page clients — warm-up is shell prefetch only.
 * Dev desktop: full chunk preload during idle warm-up (webpack compile happens off the click path).
 */
export const resolveRouteNavigationWarmupMode = (): RouteNavigationWarmupMode => (
  isDesktopShellBuild() && process.env.NODE_ENV === "production" ? "shell-only" : "full"
);

/** Swallows chunk load failures so dev warm-up does not surface a runtime overlay. */
export const loadClientChunkSafely = async (
  loader: () => Promise<unknown>,
): Promise<"fulfilled" | "rejected"> => {
  try {
    await loader();
    return "fulfilled";
  } catch {
    return "rejected";
  }
};

type RoutePrefetchRouter = Readonly<{
  prefetch: (href: string) => void;
}>;

export type RouteNavigationWarmupResult = Readonly<{
  href: string;
  status: "fulfilled" | "rejected";
}>;

const isSidebarRouteHref = (href: string): href is SidebarRouteHref => (
  href in ROUTE_CLIENT_CHUNK_LOADERS
);

/**
 * Prefetch only the Next route shell. Safe on hover / intent — does not import page clients.
 */
export const prefetchRouteShell = (
  router: RoutePrefetchRouter,
  href: string,
): void => {
  if (!href.trim()) {
    return;
  }
  router.prefetch(href);
};

type IdleScheduler = Readonly<{
  schedule: (callback: () => void) => number;
}>;

/**
 * Preloads a sidebar route client chunk during pointer/focus intent so the first
 * navigation does not pay the full parse cost on the transition frame.
 */
export const prefetchSidebarRouteClientOnIntent = (
  href: string,
  idleScheduler: IdleScheduler,
): void => {
  if (!isSidebarRouteHref(href)) {
    return;
  }
  idleScheduler.schedule((): void => {
    void runWithNavigationChunkLoadAuthority(async () => {
      await loadClientChunkSafely(ROUTE_CLIENT_CHUNK_LOADERS[href]);
    });
  });
};

/**
 * Prefetch the Next route shell and optionally load client page chunks.
 * Full chunk loads require navigation-chunk-load-authority (see navigation-performance-contract.md).
 */
export const warmRouteNavigationTargets = async (
  router: RoutePrefetchRouter,
  targets: ReadonlyArray<string>,
  mode: RouteNavigationWarmupMode = "full",
): Promise<ReadonlyArray<RouteNavigationWarmupResult>> => {
  assertNavigationChunkLoadAuthorized("warmRouteNavigationTargets", mode);

  const results = await Promise.allSettled(
    targets.map(async (href) => {
      const loadClientChunk = mode === "full" && isSidebarRouteHref(href)
        ? ROUTE_CLIENT_CHUNK_LOADERS[href]
        : undefined;
      await Promise.all([
        Promise.resolve(router.prefetch(href)),
        loadClientChunk ? loadClientChunkSafely(loadClientChunk) : Promise.resolve(),
      ]);
    }),
  );

  return results.map((result, index) => ({
    href: targets[index] ?? "",
    status: result.status,
  }));
};
