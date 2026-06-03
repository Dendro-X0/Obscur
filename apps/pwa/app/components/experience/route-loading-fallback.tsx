"use client";

import type React from "react";
import { GlobalNavigationChunkLoadingBoundary } from "../global-navigation-loading";
import type { RouteSurface } from "../page-transition-recovery";
import { RouteWarmupSkeleton } from "./route-warmup-skeleton";

type RouteLoadingFallbackProps = Readonly<{
  title: string;
  detail: string;
  surface?: RouteSurface;
  pathname?: string;
  className?: string;
}>;

/** X1 — route chunk / Suspense fallback with stagger skeleton + global nav bar signal. */
export function RouteLoadingFallback(props: RouteLoadingFallbackProps): React.JSX.Element {
  return (
    <>
      <GlobalNavigationChunkLoadingBoundary />
      <RouteWarmupSkeleton
        title={props.title}
        detail={props.detail}
        surface={props.surface}
        pathname={props.pathname}
        className={props.className}
      />
    </>
  );
}
