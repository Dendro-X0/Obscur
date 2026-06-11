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

const createEagerSidebarRoutePage = (
  loadClient: () => SidebarRouteClientModule,
  loading: SidebarRouteLoadingCopy,
): React.ComponentType => {
  const EagerClient = dynamic(
    async () => {
      const clientModule = loadClient();
      return { default: clientModule.default };
    },
    {
      loading: () => (
        <RouteLoadingFallback
          title={loading.title}
          detail={loading.detail}
          className="min-h-[320px]"
        />
      ),
      ssr: true,
    },
  );

  return function EagerSidebarRoutePage(): React.JSX.Element {
    return <EagerClient />;
  };
};

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

const shouldUseEagerDesktopSidebarRoute = (): boolean => (
  isDesktopShellBuild() && process.env.NODE_ENV === "production"
);

/**
 * Production desktop static/Tauri: eager page clients.
 * Dev desktop webpack: lazy chunks + boot-time warm-up (see navigation-warmup-owner).
 */
export function createSidebarRoutePage(
  loaders: SidebarRouteClientLoaders,
  loading: SidebarRouteLoadingCopy,
): React.ComponentType {
  if (shouldUseEagerDesktopSidebarRoute()) {
    return createEagerSidebarRoutePage(loaders.eager, loading);
  }
  return createLazySidebarRoutePage(loaders.lazy, loading);
}
