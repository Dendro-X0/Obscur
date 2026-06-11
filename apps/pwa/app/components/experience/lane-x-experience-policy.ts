import { shouldEnableNavigationProgressUx } from "@/app/features/runtime/experiment-shell-policy";
import type { RouteSurface } from "../page-transition-recovery";
import { getRouteSurfaceFromPathname } from "../page-transition-recovery";

/** Lane X — visual warm-up and transition shells (distinct from route prefetch warm-up). */
export const shouldRenderLaneXExperience = (): boolean => shouldEnableNavigationProgressUx();

export const resolveRouteWarmupSurface = (
  pathname: string | null | undefined,
  explicit?: RouteSurface,
): RouteSurface => {
  if (explicit) {
    return explicit;
  }
  if (pathname && pathname.trim().length > 0) {
    return getRouteSurfaceFromPathname(pathname);
  }
  return "unknown";
};

export const laneXStaggerDelayMs = (index: number): number => Math.min(index * 70, 420);
