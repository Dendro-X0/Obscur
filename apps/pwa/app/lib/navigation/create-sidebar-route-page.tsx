import type React from "react";
import dynamic from "next/dynamic";
import { RouteLoadingFallback } from "@/app/components/experience";
import { isDesktopShellBuild, isMobileShellProduct } from "@/app/features/runtime/shell-contract";

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

/**
 * Production static shells (desktop + mobile): eager page clients from local disk.
 * Dev webpack: lazy chunks + boot-time warm-up (see navigation-warmup-owner) so
 * first compile stays off the critical click path when possible.
 */
const shouldUseEagerShellSidebarRoute = (): boolean => (
  process.env.NODE_ENV === "production"
  && (isDesktopShellBuild() || isMobileShellProduct())
);

/**
 * Production desktop/mobile static: eager page clients (on-device, no chunk wait).
 * Dev: lazy + idle warm-up.
 */
export function createSidebarRoutePage(
  loaders: SidebarRouteClientLoaders,
  loading: SidebarRouteLoadingCopy,
): React.ComponentType {
  if (shouldUseEagerShellSidebarRoute()) {
    return createEagerSidebarRoutePage(loaders.eager, loading);
  }
  return createLazySidebarRoutePage(loaders.lazy, loading);
}
