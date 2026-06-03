"use client";

import {
  loadClientChunkSafely,
  preloadGroupHomePageClient,
  resolveRouteNavigationWarmupMode,
  warmRouteNavigationTargets,
  type RouteNavigationWarmupMode,
  type RouteNavigationWarmupResult,
} from "./route-navigation-warmup";
import { runWithNavigationChunkLoadAuthority } from "./navigation-chunk-load-authority";
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
        await loadClientChunkSafely(() => preloadGroupHomePageClient());
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

const waitForIdle = (
  scheduleIdle: (callback: () => void) => number,
): Promise<void> => new Promise((resolve) => {
  scheduleIdle(() => {
    void yieldToMainThread().then(resolve);
  });
});

const warmTargetsSequentially = async (
  router: RoutePrefetchRouter,
  targets: ReadonlyArray<string>,
  options: Readonly<{
    isStale: () => boolean;
    scheduleIdle: (callback: () => void) => number;
    mode: RouteNavigationWarmupMode;
    phase: NavigationWarmupPhase;
    onPhaseComplete?: (summary: NavigationWarmupPhaseSummary) => void;
  }>,
): Promise<ReadonlyArray<RouteNavigationWarmupResult>> => {
  const hrefResults: RouteNavigationWarmupResult[] = [];

  for (const href of targets) {
    if (options.isStale()) {
      break;
    }
    await waitForIdle(options.scheduleIdle);
    if (options.isStale()) {
      break;
    }

    const batch = await warmRouteNavigationTargets(router, [href], options.mode);
    hrefResults.push(...batch);
    options.onPhaseComplete?.({
      phase: options.phase,
      hrefResults: batch,
      specialTasks: [],
    });
  }

  return hrefResults;
};

/**
 * Runs phased navigation warm-up only during idle slices. Every target is warmed one-by-one so
 * rapid route changes can cancel in-flight work without blocking the main thread.
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
  await runWithNavigationChunkLoadAuthority(async () => {
    await runIntelligentNavigationWarmupInner(router, plan, options);
  });
};

const runIntelligentNavigationWarmupInner = async (
  router: RoutePrefetchRouter,
  plan: IntelligentNavigationWarmupPlan,
  options: Readonly<{
    isStale: () => boolean;
    scheduleIdle: (callback: () => void) => number;
    onPhaseComplete?: (summary: NavigationWarmupPhaseSummary) => void;
  }>,
): Promise<void> => {
  const { isStale, scheduleIdle, onPhaseComplete } = options;
  const warmupMode = resolveRouteNavigationWarmupMode();

  if (plan.critical.length > 0 && !isStale()) {
    await warmTargetsSequentially(router, plan.critical, {
      isStale,
      scheduleIdle,
      mode: warmupMode,
      phase: "critical",
      onPhaseComplete,
    });
  }
  if (isStale()) {
    return;
  }

  const contextTargets = plan.context;
  const specialTasks = plan.specialTasks;
  if (contextTargets.length > 0 && !isStale()) {
    await warmTargetsSequentially(router, contextTargets, {
      isStale,
      scheduleIdle,
      mode: warmupMode,
      phase: "context",
      onPhaseComplete,
    });
  }
  if (isStale()) {
    return;
  }

  if (specialTasks.length > 0 && !isStale()) {
    await waitForIdle(scheduleIdle);
    if (!isStale()) {
      await warmNavigationSpecialTasks(specialTasks);
      onPhaseComplete?.({ phase: "special", hrefResults: [], specialTasks });
    }
  }
  if (isStale() || plan.background.length === 0) {
    return;
  }

  await warmTargetsSequentially(router, plan.background, {
    isStale,
    scheduleIdle,
    mode: warmupMode,
    phase: "background",
    onPhaseComplete,
  });
};
