"use client";

type RoutePrefetchRouter = Readonly<{
  prefetch: (href: string) => void;
}>;

/** Matches `dynamic(() => import("./…-page-client"))` entry points for sidebar routes. */
export const ROUTE_CLIENT_CHUNK_LOADERS: Readonly<Record<string, () => Promise<unknown>>> = {
  "/network": () => import("@/app/network/network-page-client"),
  "/vault": () => import("@/app/vault/vault-page-client"),
  "/search": () => import("@/app/search/search-page-client"),
  "/settings": () => import("@/app/settings/settings-page-client"),
};

/** Heavy community detail client; preloaded when Network shell is warm. */
export const preloadGroupHomePageClient = (): Promise<unknown> => (
  import("@/app/groups/[...id]/group-home-page-client")
);

export type RouteNavigationWarmupResult = Readonly<{
  href: string;
  status: "fulfilled" | "rejected";
}>;

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
      const loadClientChunk = ROUTE_CLIENT_CHUNK_LOADERS[href];
      await Promise.all([
        Promise.resolve(router.prefetch(href)),
        loadClientChunk ? loadClientChunk() : Promise.resolve(),
        href === "/network" ? preloadGroupHomePageClient() : Promise.resolve(),
      ]);
    }),
  );

  return results.map((result, index) => ({
    href: targets[index] ?? "",
    status: result.status,
  }));
};
