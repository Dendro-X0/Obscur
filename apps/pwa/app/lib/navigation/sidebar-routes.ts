/**
 * Sidebar NAV route clients. Used for navigation warm-up and desktop eager bundling.
 * Paths must match `app/<segment>/<segment>-page-client.tsx` for each NAV href.
 */

export const SIDEBAR_ROUTE_HREFS = [
  "/network",
  "/vault",
  "/search",
  "/settings",
] as const;

export type SidebarRouteHref = (typeof SIDEBAR_ROUTE_HREFS)[number];

/** Lazy chunk loaders for non-desktop builds and idle warm-up. */
export const ROUTE_CLIENT_CHUNK_LOADERS: Readonly<
  Record<SidebarRouteHref, () => Promise<unknown>>
> = {
  "/network": () => import("@/app/network/network-page-client"),
  "/vault": () => import("@/app/vault/vault-page-client"),
  "/search": () => import("@/app/search/search-page-client"),
  "/settings": () => import("@/app/settings/settings-page-client"),
};

/** Heavy community detail client; preload only during idle on the Network route. */
export const preloadGroupHomePageClient = (): Promise<unknown> => (
  import("@/app/groups/[...id]/group-home-page-client").catch(() => undefined)
);
