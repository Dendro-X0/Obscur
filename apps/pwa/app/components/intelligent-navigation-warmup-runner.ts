"use client";

import {
  preloadGroupHomePageClient,
  warmRouteNavigationTargets,
  type RouteNavigationWarmupResult,
} from "./route-navigation-warmup";
import type {
  IntelligentNavigationWarmupPlan,
  NavigationWarmupSpecialTask,
} from "./intelligent-navigation-warmup-policy";

type RoutePrefetchRouter = Readonly<{
  prefetch: (href: string) => void;
}>;

export type NavigationWarmupPhase = "critical" | "context" | "background" | "special";

export type NavigationWarmupPhaseSummary = Readonly<{
  phase: NavigationWarmupPhase;
  hrefResults: ReadonlyArray<RouteNavigationWarmupResult>;
  specialTasks: ReadonlyArray<NavigationWarmupSpecialTask>;
}>;

const warmNavigationSpecialTasks = async (
  tasks: ReadonlyArray<NavigationWarmupSpecialTask>,
): Promise<void> => {
  await Promise.allSettled(
    tasks.map(async (task) => {
      if (task === "group_home_client") {
        await preloadGroupHomePageClient();
      }
    }),
  );
};

const yieldToMainThread = (): Promise<void> => new Promise((resolve) => {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => resolve());
    return;
  }
  setTimeout(resolve, 0);
});

/**
 * Runs phased navigation warm-up without blocking the shell: critical first, then context/special,
 * then background targets one-by-one during idle time.
 */
export const runIntelligentNavigationWarmup = async (
  router: RoutePrefetchRouter,
  plan: IntelligentNavigationWarmupPlan,
  options: Readonly<{
    isStale: () => boolean;
    scheduleIdle: (callback: () => void) => number;
    onPhaseComplete?: (summary: NavigationWarmupPhaseSummary) => void;
  }>,
): Promise<void> => {
  const { isStale, scheduleIdle, onPhaseComplete } = options;

  if (plan.critical.length > 0 && !isStale()) {
    const hrefResults = await warmRouteNavigationTargets(router, plan.critical);
    onPhaseComplete?.({ phase: "critical", hrefResults, specialTasks: [] });
  }
  if (isStale()) {
    return;
  }

  const contextTargets = plan.context;
  const specialTasks = plan.specialTasks;
  if (contextTargets.length > 0 || specialTasks.length > 0) {
    const [hrefResults] = await Promise.all([
      contextTargets.length > 0
        ? warmRouteNavigationTargets(router, contextTargets)
        : Promise.resolve([] as ReadonlyArray<RouteNavigationWarmupResult>),
      specialTasks.length > 0 ? warmNavigationSpecialTasks(specialTasks) : Promise.resolve(),
    ]);
    onPhaseComplete?.({ phase: "context", hrefResults, specialTasks });
    if (specialTasks.length > 0) {
      onPhaseComplete?.({ phase: "special", hrefResults: [], specialTasks });
    }
  }
  if (isStale() || plan.background.length === 0) {
    return;
  }

  await new Promise<void>((resolveBackground) => {
    let backgroundIndex = 0;

    const runNextBackground = (): void => {
      if (isStale()) {
        resolveBackground();
        return;
      }
      const href = plan.background[backgroundIndex];
      if (!href) {
        resolveBackground();
        return;
      }
      backgroundIndex += 1;
      void warmRouteNavigationTargets(router, [href]).then((hrefResults) => {
        onPhaseComplete?.({ phase: "background", hrefResults, specialTasks: [] });
        if (isStale() || backgroundIndex >= plan.background.length) {
          resolveBackground();
          return;
        }
        scheduleIdle(() => {
          void yieldToMainThread().then(runNextBackground);
        });
      });
    };

    scheduleIdle(() => {
      void yieldToMainThread().then(runNextBackground);
    });
  });
};
