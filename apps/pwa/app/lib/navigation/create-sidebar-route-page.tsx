import type React from "react";
import dynamic from "next/dynamic";
import { RouteLoadingFallback } from "@/app/components/experience";
import { isDesktopShellBuild } from "@/app/features/runtime/shell-contract";

type SidebarRouteLoadingCopy = Readonly<{
  title: string;
  detail: string;
}>;

type SidebarRouteClientModule = Readonly<{
  default: React.ComponentType;
}>;

export type SidebarRouteClientLoaders = Readonly<{
  /** Must live in the route's `page.tsx` so webpack resolves the client module correctly. */
  eager: () => SidebarRouteClientModule;
  lazy: () => Promise<SidebarRouteClientModule>;
}>;

const createLazySidebarRoutePage = (
  loadClient: () => Promise<SidebarRouteClientModule>,
  loading: SidebarRouteLoadingCopy,
): React.ComponentType => {
  const LazyClient = dynamic(loadClient, {
    loading: () => (
      <RouteLoadingFallback
        title={loading.title}
        detail={loading.detail}
        className="min-h-[320px]"
      />
    ),
  });

  return function LazySidebarRoutePage(): React.JSX.Element {
    return <LazyClient />;
  };
};

const createEagerSidebarRoutePage = (
  loadClient: () => SidebarRouteClientModule,
): React.ComponentType => {
  return function EagerSidebarRoutePage(): React.JSX.Element {
    // `loadClient` is defined in each route's page.tsx — not here — so `require` resolves per route.
    const clientModule = loadClient();
    const EagerClient = clientModule.default;
    return <EagerClient />;
  };
};

/**
 * Desktop shell builds link the page client synchronously (no `next/dynamic` spinner on repeat nav).
 * Web/mobile builds keep lazy chunks behind a loading boundary.
 *
 * First visit to a route on `next dev --webpack` still pays compile time (S6); this only removes
 * repeat dynamic-import boundaries on desktop static/Tauri and warm dev navigations.
 */
export function createSidebarRoutePage(
  loaders: SidebarRouteClientLoaders,
  loading: SidebarRouteLoadingCopy,
): React.ComponentType {
  if (isDesktopShellBuild()) {
    return createEagerSidebarRoutePage(loaders.eager);
  }
  return createLazySidebarRoutePage(loaders.lazy, loading);
}
