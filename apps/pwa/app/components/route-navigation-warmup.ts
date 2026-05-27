import {
  preloadGroupHomePageClient,
  ROUTE_CLIENT_CHUNK_LOADERS,
  type SidebarRouteHref,
} from "@/app/lib/navigation/sidebar-routes";

export { ROUTE_CLIENT_CHUNK_LOADERS, preloadGroupHomePageClient };

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
 * Prefetch the Next route shell and eagerly load client page chunks so the first
 * sidebar click does not pay dynamic-import latency.
 */
export const warmRouteNavigationTargets = async (
  router: RoutePrefetchRouter,
  targets: ReadonlyArray<string>,
): Promise<ReadonlyArray<RouteNavigationWarmupResult>> => {
  const results = await Promise.allSettled(
    targets.map(async (href) => {
      const loadClientChunk = isSidebarRouteHref(href)
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
