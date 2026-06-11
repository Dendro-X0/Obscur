"use client";

import { useEffect, useRef } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { logAppEvent } from "@/app/shared/log-app-event";
import { isDmKernelAuthority } from "@/app/features/dm-kernel/dm-kernel-policy";
import {
  isExperimentOnlineEnabled,
  shouldDeferExperimentHeavyWork,
} from "@/app/features/runtime/experiment-shell-policy";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { isSecondaryProfileWindow } from "@/app/features/runtime/services/secondary-profile-post-login-refresh-policy";
import {
  hasIntelligentNavigationWarmupWork,
  resolveDevWebpackBootWarmupPlan,
  resolveIntelligentNavigationWarmupPlan,
  type NavigationWarmupSpecialTask,
} from "./intelligent-navigation-warmup-policy";
import { shouldPrewarmDevWebpackNavigationOnBoot } from "./sidebar-navigation-policy";
import { runIntelligentNavigationWarmup } from "./intelligent-navigation-warmup-runner";
import type { NavItem } from "../lib/navigation/nav-item";
import {
  NAVIGATION_QUIESCENCE_MS,
  recordPathnameCommitted,
  shouldRunBackgroundNavigationWarmup,
} from "./navigation-performance-coordinator";
import type { RouteSurface } from "./page-transition-recovery";

type IdleCallbackHandle = number;

const createIdleScheduler = (): Readonly<{
  schedule: (callback: () => void) => IdleCallbackHandle;
  cancel: (handle: IdleCallbackHandle) => void;
}> => {
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    return {
      schedule: (callback: () => void): IdleCallbackHandle => window.requestIdleCallback(() => callback()),
      cancel: (handle: IdleCallbackHandle): void => {
        if (typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(handle);
        }
      },
    };
  }

  return {
    schedule: (callback: () => void): IdleCallbackHandle => window.setTimeout(callback, 32),
    cancel: (handle: IdleCallbackHandle): void => {
      window.clearTimeout(handle);
    },
  };
};

export type NavigationWarmupOwnerParams = Readonly<{
  pathname: string;
  activeRouteSurface: RouteSurface;
  isDesktop: boolean;
  router: AppRouterInstance;
  navItems: ReadonlyArray<NavItem>;
}>;

/**
 * Single owner for post-quiescence intelligent navigation warm-up (P2).
 * AppShell records pathname commits and delegates background chunk work here.
 */
export const useNavigationWarmupOwner = (params: NavigationWarmupOwnerParams): void => {
  const navigationWarmupGenerationRef = useRef(0);
  const warmedPrefetchTargetsRef = useRef<Set<string>>(new Set());
  const warmedSpecialWarmupTasksRef = useRef<Set<NavigationWarmupSpecialTask>>(new Set());
  const devWebpackBootWarmupStartedRef = useRef(false);
  const idleSchedulerRef = useRef(createIdleScheduler());

  const { pathname, activeRouteSurface, isDesktop, router, navItems } = params;

  useEffect((): (() => void) => {
    recordPathnameCommitted(pathname);

    const warmupRunId = navigationWarmupGenerationRef.current + 1;
    navigationWarmupGenerationRef.current = warmupRunId;
    const isStale = (): boolean => navigationWarmupGenerationRef.current !== warmupRunId;

    if (shouldDeferExperimentHeavyWork()) {
      logAppEvent({
        name: "navigation.intelligent_warmup_skipped",
        level: "debug",
        scope: { feature: "navigation", action: "route_prefetch" },
        context: {
          pathname,
          routeSurface: activeRouteSurface,
          reason: "experiment_offline_stub",
          isDesktop,
        },
      });
      return (): void => {
        navigationWarmupGenerationRef.current += 1;
      };
    }

    if (isDmKernelAuthority() && !isExperimentOnlineEnabled()) {
      logAppEvent({
        name: "navigation.intelligent_warmup_skipped",
        level: "debug",
        scope: { feature: "navigation", action: "route_prefetch" },
        context: {
          pathname,
          routeSurface: activeRouteSurface,
          reason: "dm_kernel_offline_first",
          isDesktop,
        },
      });
      return (): void => {
        navigationWarmupGenerationRef.current += 1;
      };
    }

    const profileId = getResolvedProfileId();
    if (isSecondaryProfileWindow(profileId)) {
      logAppEvent({
        name: "navigation.intelligent_warmup_skipped",
        level: "debug",
        scope: { feature: "navigation", action: "route_prefetch" },
        context: {
          pathname,
          routeSurface: activeRouteSurface,
          reason: "secondary_profile_window",
          profileId,
          isDesktop,
        },
      });
      return (): void => {
        navigationWarmupGenerationRef.current += 1;
      };
    }

    if (shouldPrewarmDevWebpackNavigationOnBoot() && !devWebpackBootWarmupStartedRef.current) {
      devWebpackBootWarmupStartedRef.current = true;
      const bootPlan = resolveDevWebpackBootWarmupPlan(navItems);
      if (hasIntelligentNavigationWarmupWork(bootPlan)) {
        logAppEvent({
          name: "navigation.dev_webpack_boot_warmup_started",
          level: "info",
          scope: { feature: "navigation", action: "route_prefetch" },
          context: {
            pathname,
            routeSurface: activeRouteSurface,
            criticalCount: bootPlan.critical.length,
            specialTaskCount: bootPlan.specialTasks.length,
            isDesktop,
          },
        });
        const scheduler = idleSchedulerRef.current;
        void runIntelligentNavigationWarmup(router, bootPlan, {
          isStale,
          scheduleIdle: (callback) => scheduler.schedule(callback),
          onPhaseComplete: (summary) => {
            if (isStale()) {
              return;
            }
            for (const result of summary.hrefResults) {
              if (result.status === "fulfilled") {
                warmedPrefetchTargetsRef.current.add(result.href);
              }
            }
            for (const task of summary.specialTasks) {
              warmedSpecialWarmupTasksRef.current.add(task);
            }
          },
        });
      }
    }

    const quiescenceTimerId = window.setTimeout((): void => {
      if (isStale()) {
        return;
      }
      if (!shouldRunBackgroundNavigationWarmup()) {
        logAppEvent({
          name: "navigation.intelligent_warmup_skipped",
          level: "debug",
          scope: { feature: "navigation", action: "route_prefetch" },
          context: {
            pathname,
            routeSurface: activeRouteSurface,
            reason: "navigation_not_quiesced",
            isDesktop,
          },
        });
        return;
      }

      const warmupPlan = resolveIntelligentNavigationWarmupPlan({
        pathname,
        routeSurface: activeRouteSurface,
        navItems,
        warmedHrefs: warmedPrefetchTargetsRef.current,
        warmedSpecialTasks: warmedSpecialWarmupTasksRef.current,
      });

      if (!hasIntelligentNavigationWarmupWork(warmupPlan)) {
        logAppEvent({
          name: "navigation.intelligent_warmup_skipped",
          level: "debug",
          scope: { feature: "navigation", action: "route_prefetch" },
          context: {
            pathname,
            routeSurface: activeRouteSurface,
            reason: "no_targets",
            isDesktop,
          },
        });
        return;
      }

      logAppEvent({
        name: "navigation.intelligent_warmup_started",
        level: "info",
        scope: { feature: "navigation", action: "route_prefetch" },
        context: {
          pathname,
          routeSurface: activeRouteSurface,
          criticalCount: warmupPlan.critical.length,
          contextCount: warmupPlan.context.length,
          backgroundCount: warmupPlan.background.length,
          specialTaskCount: warmupPlan.specialTasks.length,
          isDesktop,
          deferredMs: NAVIGATION_QUIESCENCE_MS,
        },
      });

      const scheduler = idleSchedulerRef.current;
      void runIntelligentNavigationWarmup(router, warmupPlan, {
        isStale,
        scheduleIdle: (callback) => scheduler.schedule(callback),
        onPhaseComplete: (summary) => {
          if (isStale()) {
            return;
          }
          for (const result of summary.hrefResults) {
            if (result.status === "fulfilled") {
              warmedPrefetchTargetsRef.current.add(result.href);
            }
          }
          for (const task of summary.specialTasks) {
            warmedSpecialWarmupTasksRef.current.add(task);
          }
          const failedTargets = summary.hrefResults.flatMap((result) => (
            result.status === "rejected" ? [result.href] : []
          ));
          logAppEvent({
            name: "navigation.intelligent_warmup_phase_completed",
            level: failedTargets.length > 0 ? "warn" : "debug",
            scope: { feature: "navigation", action: "route_prefetch" },
            context: {
              pathname,
              routeSurface: activeRouteSurface,
              phase: summary.phase,
              warmedHrefCount: summary.hrefResults.length,
              failedTargetCount: failedTargets.length,
              failedTargetsSummary: failedTargets.join(","),
              specialTasksSummary: summary.specialTasks.join(","),
              isDesktop,
            },
          });
        },
      }).then(() => {
        if (isStale()) {
          return;
        }
        logAppEvent({
          name: "navigation.intelligent_warmup_settled",
          level: "info",
          scope: { feature: "navigation", action: "route_prefetch" },
          context: {
            pathname,
            routeSurface: activeRouteSurface,
            isDesktop,
          },
        });
      });
    }, NAVIGATION_QUIESCENCE_MS);

    return (): void => {
      window.clearTimeout(quiescenceTimerId);
      navigationWarmupGenerationRef.current += 1;
    };
  }, [activeRouteSurface, isDesktop, navItems, pathname, router]);
};
