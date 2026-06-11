"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, FolderLock, Menu, MessageSquare, Search, Settings, Users, X } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { NAV_ITEMS } from "../lib/navigation/nav-items";
import type { NavItem } from "../lib/navigation/nav-item";
import { UserAvatarMenu } from "./user-avatar-menu";
import { useIsDesktop } from "@/app/features/desktop/hooks/use-tauri";
import { useKeyboardShortcuts } from "@/app/features/desktop/hooks/use-keyboard-shortcuts";
import { useDesktopLayout } from "@/app/features/desktop/hooks/use-desktop-layout";
import { RelayStatusBadge } from "./relay-status-badge";
import { RelayTransportShellBanner } from "@/app/features/relays/components/relay-transport-shell-banner";
import { useTranslation } from "react-i18next";
import { MobileTabBar } from "./mobile-tab-bar";
import { isMobileShellProduct } from "@/app/features/runtime/shell-contract";
import { RouteLoadingFallback } from "./experience";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
  createRouteMountDiagnosticsState,
  getRouteSurfaceFromPathname,
  hardNavigate,
  ROUTE_MOUNT_SLOW_DISABLE_THRESHOLD,
  ROUTE_MOUNT_PROBE_WARN_THRESHOLD_MS,
  ROUTE_NAVIGATION_STALL_HARD_FALLBACK_MS,
  recordRouteMountProbeSample,
  type RouteMountDiagnosticsState,
} from "./page-transition-recovery";
import {
  shouldDeferExperimentHeavyWork,
  shouldRunNavigationInstrumentation,
} from "@/app/features/runtime/experiment-shell-policy";
import {
  recordNavigationIntent,
  isRapidNavigationMode,
} from "./navigation-performance-coordinator";
import { useNavigationWarmupOwner } from "./navigation-warmup-owner";
import { prefetchRouteShell, prefetchSidebarRouteClientOnIntent } from "./route-navigation-warmup";
import { SidebarPortalHost } from "./app-shell-sidebar-portal";

type NavIcon = (props: Readonly<{ className?: string }>) => React.ReactNode;

type AppShellProps = Readonly<{
  children: React.ReactNode;
  navBadgeCounts?: Readonly<Record<string, number>>;
  hideSidebar?: boolean;
  hideHeader?: boolean;
  /** Mobile shell DM-first slice: no bottom tab bar and reduced bottom padding. */
  mobileDmMode?: boolean;
}>;

const FOOTER_RELEASE_LABEL: string = process.env.NEXT_PUBLIC_RELEASE_LABEL?.trim() || "Preview";
const APP_FOOTER_TEXT: string = `Obscur ${FOOTER_RELEASE_LABEL}`;
const ICON_BY_HREF: Readonly<Record<string, NavIcon>> = {
  "/": MessageSquare,
  "/network": Users,
  "/vault": FolderLock,
  "/search": Search,
  "/requests": Bell,
  "/settings": Settings,
};

type RouteMountDiagnosticsApi = Readonly<{
  getSnapshot: () => RouteMountDiagnosticsState;
  reset: () => void;
}>;

type AppShellWindow = Window & {
  obscurRouteMountDiagnostics?: RouteMountDiagnosticsApi;
};

const isKeyboardEditableTarget = (target: EventTarget | null): boolean => {
  const element = target as Partial<HTMLElement> | null;
  if (!element) {
    return false;
  }
  if (Boolean(element.isContentEditable)) {
    return true;
  }
  const tagName = typeof element.tagName === "string" ? element.tagName.toLowerCase() : "";
  if (!tagName) {
    return false;
  }
  return tagName === "input" || tagName === "textarea" || tagName === "select";
};

type IdleCallbackHandle = number;
type IdleCallback = (callback: () => void) => IdleCallbackHandle;
type IdleCancel = (handle: IdleCallbackHandle) => void;

const createIdleScheduler = (): Readonly<{
  schedule: IdleCallback;
  cancel: IdleCancel;
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

const AppShell = (props: AppShellProps): React.JSX.Element => {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname: string = usePathname();
  const activeRouteSurface = useMemo(() => getRouteSurfaceFromPathname(pathname), [pathname]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [hasMounted, setHasMounted] = useState<boolean>(false);
  const [arePageTransitionsEnabled, setArePageTransitionsEnabled] = useState<boolean>(false);
  const routeFallbackTimeoutIdRef = useRef<number | null>(null);
  const routePendingTargetRef = useRef<string | null>(null);
  const routePendingStartedAtUnixMsRef = useRef<number>(0);
  const routeMountDiagnosticsRef = useRef<RouteMountDiagnosticsState>(createRouteMountDiagnosticsState());
  const routeMountProbeSequenceRef = useRef<number>(0);
  const routeMountProbeSlowTimeoutIdRef = useRef<number | null>(null);
  const routeMountProbeAnimationFrameOneIdRef = useRef<number | null>(null);
  const routeMountProbeAnimationFrameTwoIdRef = useRef<number | null>(null);
  const routeMountProbeStartedAtUnixMsRef = useRef<number>(0);
  const arePageTransitionsEnabledRef = useRef<boolean>(true);
  const routeStallHardFallbackCountRef = useRef<number>(0);
  const navigationFailOpenEnabledRef = useRef<boolean>(false);
  const idleSchedulerRef = useRef(createIdleScheduler());
  const isDesktop = useIsDesktop();
  useDesktopLayout();

  // Register keyboard shortcuts for desktop
  useKeyboardShortcuts();

  useEffect((): void => {
    queueMicrotask((): void => {
      setHasMounted(true);
    });
  }, []);

  useEffect((): void => {
    arePageTransitionsEnabledRef.current = arePageTransitionsEnabled;
  }, [arePageTransitionsEnabled]);

  useNavigationWarmupOwner({
    pathname,
    activeRouteSurface,
    isDesktop,
    router,
    navItems: NAV_ITEMS,
  });

  const clearRouteMountProbeTimers = useCallback((): void => {
    const slowTimeoutId = routeMountProbeSlowTimeoutIdRef.current;
    if (typeof slowTimeoutId === "number") {
      window.clearTimeout(slowTimeoutId);
      routeMountProbeSlowTimeoutIdRef.current = null;
    }
    const animationFrameOneId = routeMountProbeAnimationFrameOneIdRef.current;
    if (typeof animationFrameOneId === "number") {
      window.cancelAnimationFrame(animationFrameOneId);
      routeMountProbeAnimationFrameOneIdRef.current = null;
    }
    const animationFrameTwoId = routeMountProbeAnimationFrameTwoIdRef.current;
    if (typeof animationFrameTwoId === "number") {
      window.cancelAnimationFrame(animationFrameTwoId);
      routeMountProbeAnimationFrameTwoIdRef.current = null;
    }
  }, []);

  const clearRouteFallback = useCallback((): void => {
    const timeoutId = routeFallbackTimeoutIdRef.current;
    if (typeof timeoutId === "number") {
      window.clearTimeout(timeoutId);
      routeFallbackTimeoutIdRef.current = null;
    }
    routePendingTargetRef.current = null;
    routePendingStartedAtUnixMsRef.current = 0;
  }, []);

  const enableNavigationFailOpen = useCallback((disableReason: string): void => {
    const wasFailOpenEnabled = navigationFailOpenEnabledRef.current;
    navigationFailOpenEnabledRef.current = true;
    setMobileSidebarOpen(false);
    routeMountProbeSequenceRef.current += 1;
    clearRouteMountProbeTimers();
    clearRouteFallback();
    if (arePageTransitionsEnabledRef.current) {
      arePageTransitionsEnabledRef.current = false;
      setArePageTransitionsEnabled(false);
    }
    if (!wasFailOpenEnabled) {
      logAppEvent({
        name: "navigation.page_transition_effects_disabled",
        level: "warn",
        scope: { feature: "navigation", action: "page_transition" },
        context: {
          pathname,
          routeSurface: activeRouteSurface,
          disableReason,
          consecutiveSlowSampleCount: routeMountDiagnosticsRef.current.consecutiveSlowSampleCount,
          disableThreshold: ROUTE_MOUNT_SLOW_DISABLE_THRESHOLD,
        },
      });
    }
  }, [
    activeRouteSurface,
    clearRouteFallback,
    clearRouteMountProbeTimers,
    pathname,
  ]);

  useEffect((): (() => void) => {
    const root = window as AppShellWindow;
    const diagnosticsApi: RouteMountDiagnosticsApi = {
      getSnapshot: (): RouteMountDiagnosticsState => routeMountDiagnosticsRef.current,
      reset: (): void => {
        routeMountDiagnosticsRef.current = createRouteMountDiagnosticsState();
      },
    };
    root.obscurRouteMountDiagnostics = diagnosticsApi;
    return (): void => {
      if (root.obscurRouteMountDiagnostics === diagnosticsApi) {
        delete root.obscurRouteMountDiagnostics;
      }
    };
  }, []);

  const armRouteHardFallback = useCallback((targetHref: string): void => {
    if (shouldDeferExperimentHeavyWork()) {
      return;
    }
    if (!targetHref || targetHref === pathname) {
      clearRouteFallback();
      return;
    }
    clearRouteFallback();
    routePendingTargetRef.current = targetHref;
    routePendingStartedAtUnixMsRef.current = Date.now();
    logAppEvent({
      name: "navigation.route_request",
      level: "info",
      scope: { feature: "navigation", action: "route_guard" },
      context: {
        guardSource: "app_shell",
        fromPathname: pathname,
        fromRouteSurface: activeRouteSurface,
        targetHref,
        targetRouteSurface: getRouteSurfaceFromPathname(targetHref),
        hardFallbackAfterMs: ROUTE_NAVIGATION_STALL_HARD_FALLBACK_MS,
      },
    });

    routeFallbackTimeoutIdRef.current = window.setTimeout((): void => {
      if (routePendingTargetRef.current !== targetHref) {
        return;
      }
      const currentPathname = window.location.pathname;
      if (currentPathname === targetHref) {
        clearRouteFallback();
        return;
      }
      logAppEvent({
        name: "navigation.route_stall_hard_fallback",
        level: "warn",
        scope: { feature: "navigation", action: "route_guard" },
        context: {
          guardSource: "app_shell",
          fromPathname: pathname,
          fromRouteSurface: activeRouteSurface,
          currentPathname,
          currentRouteSurface: getRouteSurfaceFromPathname(currentPathname),
          targetHref,
          targetRouteSurface: getRouteSurfaceFromPathname(targetHref),
          elapsedMs: Math.max(0, Date.now() - routePendingStartedAtUnixMsRef.current),
          hardFallbackAfterMs: ROUTE_NAVIGATION_STALL_HARD_FALLBACK_MS,
        },
      });
      routeStallHardFallbackCountRef.current += 1;
      if (routeStallHardFallbackCountRef.current >= 2) {
        enableNavigationFailOpen("route_stall_hard_fallback");
      }
      clearRouteFallback();
      hardNavigate(targetHref);
    }, ROUTE_NAVIGATION_STALL_HARD_FALLBACK_MS);
  }, [activeRouteSurface, clearRouteFallback, enableNavigationFailOpen, pathname]);

  const prefetchRouteOnIntent = useCallback((targetHref: string): void => {
    if (!targetHref || targetHref === pathname || isRapidNavigationMode()) {
      return;
    }
    prefetchRouteShell(router, targetHref);
    prefetchSidebarRouteClientOnIntent(targetHref, idleSchedulerRef.current);
  }, [pathname, router]);

  useEffect((): (() => void) => {
    if (!shouldRunNavigationInstrumentation()) {
      return (): void => {};
    }
    routeMountProbeSequenceRef.current += 1;
    const probeSequence = routeMountProbeSequenceRef.current;
    const startedAtUnixMs = Date.now();
    routeMountProbeStartedAtUnixMsRef.current = startedAtUnixMs;
    clearRouteMountProbeTimers();

    logAppEvent({
      name: "navigation.route_mount_probe_start",
      level: "debug",
      scope: { feature: "navigation", action: "route_guard" },
      context: {
        pathname,
        routeSurface: activeRouteSurface,
        warnThresholdMs: ROUTE_MOUNT_PROBE_WARN_THRESHOLD_MS,
      },
    });

    routeMountProbeSlowTimeoutIdRef.current = window.setTimeout((): void => {
      if (routeMountProbeSequenceRef.current !== probeSequence) {
        return;
      }
      logAppEvent({
        name: "navigation.route_mount_probe_slow",
        level: "warn",
        scope: { feature: "navigation", action: "route_guard" },
        context: {
          pathname,
          routeSurface: activeRouteSurface,
          elapsedMs: Math.max(0, Date.now() - routeMountProbeStartedAtUnixMsRef.current),
          warnThresholdMs: ROUTE_MOUNT_PROBE_WARN_THRESHOLD_MS,
          pendingTargetHref: routePendingTargetRef.current,
        },
      });
    }, ROUTE_MOUNT_PROBE_WARN_THRESHOLD_MS);

    routeMountProbeAnimationFrameOneIdRef.current = window.requestAnimationFrame((): void => {
      if (routeMountProbeSequenceRef.current !== probeSequence) {
        return;
      }
      routeMountProbeAnimationFrameOneIdRef.current = null;
      const firstFrameAtUnixMs = Date.now();
      routeMountProbeAnimationFrameTwoIdRef.current = window.requestAnimationFrame((): void => {
        if (routeMountProbeSequenceRef.current !== probeSequence) {
          return;
        }
        routeMountProbeAnimationFrameTwoIdRef.current = null;
        const settledAtUnixMs = Date.now();
        const firstFrameDelayMs = Math.max(0, firstFrameAtUnixMs - startedAtUnixMs);
        const secondFrameDelayMs = Math.max(0, settledAtUnixMs - firstFrameAtUnixMs);
        const elapsedMs = Math.max(0, settledAtUnixMs - startedAtUnixMs);
        const routeRequestElapsedMs = routePendingStartedAtUnixMsRef.current > 0
          ? Math.max(0, settledAtUnixMs - routePendingStartedAtUnixMsRef.current)
          : null;

        routeMountDiagnosticsRef.current = recordRouteMountProbeSample(
          routeMountDiagnosticsRef.current,
          {
            pathname,
            routeSurface: activeRouteSurface,
            startedAtUnixMs,
            settledAtUnixMs,
            elapsedMs,
            firstFrameDelayMs,
            secondFrameDelayMs,
            routeRequestElapsedMs,
            pageTransitionsEnabled: arePageTransitionsEnabledRef.current,
            transitionWatchdogTimeoutCount: 0,
          },
        );
        const latestRouteMountDiagnostics = routeMountDiagnosticsRef.current;

        const slowTimeoutId = routeMountProbeSlowTimeoutIdRef.current;
        if (typeof slowTimeoutId === "number") {
          window.clearTimeout(slowTimeoutId);
          routeMountProbeSlowTimeoutIdRef.current = null;
        }

        logAppEvent({
          name: "navigation.route_mount_probe_settled",
          level: elapsedMs >= ROUTE_MOUNT_PROBE_WARN_THRESHOLD_MS ? "warn" : "info",
          scope: { feature: "navigation", action: "route_guard" },
          context: {
            pathname,
            routeSurface: activeRouteSurface,
            elapsedMs,
            firstFrameDelayMs,
            secondFrameDelayMs,
            routeRequestElapsedMs,
            warnThresholdMs: ROUTE_MOUNT_PROBE_WARN_THRESHOLD_MS,
            pageTransitionsEnabled: arePageTransitionsEnabledRef.current,
            transitionWatchdogTimeoutCount: 0,
          },
        });

        const shouldEnablePerformanceGuard = (
          arePageTransitionsEnabledRef.current
          && latestRouteMountDiagnostics.consecutiveSlowSampleCount >= ROUTE_MOUNT_SLOW_DISABLE_THRESHOLD
        );
        if (shouldEnablePerformanceGuard) {
          logAppEvent({
            name: "navigation.route_mount_performance_guard_enabled",
            level: "warn",
            scope: { feature: "navigation", action: "route_guard" },
            context: {
              pathname,
              routeSurface: activeRouteSurface,
              elapsedMs,
              slowSampleCount: latestRouteMountDiagnostics.slowSampleCount,
              consecutiveSlowSampleCount: latestRouteMountDiagnostics.consecutiveSlowSampleCount,
              disableThreshold: ROUTE_MOUNT_SLOW_DISABLE_THRESHOLD,
              warnThresholdMs: ROUTE_MOUNT_PROBE_WARN_THRESHOLD_MS,
            },
          });
          enableNavigationFailOpen("route_mount_consecutive_slow");
        }
      });
    });

    return clearRouteMountProbeTimers;
  }, [activeRouteSurface, clearRouteMountProbeTimers, enableNavigationFailOpen, pathname]);

  useEffect((): void => {
    const pendingTarget = routePendingTargetRef.current;
    if (!pendingTarget || pathname !== pendingTarget) {
      return;
    }
    logAppEvent({
      name: "navigation.route_settled",
      level: "info",
      scope: { feature: "navigation", action: "route_guard" },
      context: {
        guardSource: "app_shell",
        pathname,
        routeSurface: activeRouteSurface,
        elapsedMs: Math.max(0, Date.now() - routePendingStartedAtUnixMsRef.current),
      },
    });
    routeStallHardFallbackCountRef.current = 0;
    clearRouteFallback();
  }, [activeRouteSurface, clearRouteFallback, pathname]);

  useEffect((): void => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  useEffect((): (() => void) => {
    return (): void => {
      clearRouteFallback();
    };
  }, [clearRouteFallback]);

  useEffect((): (() => void) => {
    const handleEscapeKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }

      if (mobileSidebarOpen) {
        event.preventDefault();
        event.stopPropagation();
        setMobileSidebarOpen(false);
        return;
      }

      if (isKeyboardEditableTarget(event.target)) {
        return;
      }

      const hasDismissableLayer = Boolean(document.querySelector('[data-escape-layer="open"]'));
      if (hasDismissableLayer) {
        return;
      }

      if (pathname === "/") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      logAppEvent({
        name: "navigation.escape_back",
        level: "info",
        scope: { feature: "navigation", action: "keyboard_back" },
        context: {
          pathname,
          routeSurface: activeRouteSurface,
          historyLength: window.history.length,
        },
      });

      if (window.history.length > 1) {
        window.history.back();
        return;
      }

      hardNavigate("/");
    };

    window.addEventListener("keydown", handleEscapeKey);
    return (): void => {
      window.removeEventListener("keydown", handleEscapeKey);
    };
  }, [activeRouteSurface, mobileSidebarOpen, pathname]);


  const activeHref: string = useMemo((): string => {
    const exact: NavItem | undefined = NAV_ITEMS.find((item: NavItem): boolean => item.href === pathname);
    return exact?.href ?? "/";
  }, [pathname]);

  const navBadgeCounts: Readonly<Record<string, number>> = useMemo((): Readonly<Record<string, number>> => {
    return props.navBadgeCounts ?? {};
  }, [props.navBadgeCounts]);

  const showMobileTabBar = !props.mobileDmMode && (
    !props.hideSidebar || isMobileShellProduct()
  );
  const mobileShellHeader = isMobileShellProduct();

  return (
    <div className={cn(
      "relative isolate flex flex-1 overflow-hidden bg-gradient-main text-zinc-900 dark:text-zinc-100",
      hasMounted && isDesktop && "desktop-mode"
    )}>
      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={(): void => setMobileSidebarOpen(false)}
            aria-label="Close navigation"
          />
          <div className="absolute left-0 top-0 flex h-full w-[86vw] max-w-sm flex-col border-r border-black/10 bg-white/90 dark:bg-black/90 backdrop-blur-xl shadow-2xl safe-top safe-bottom">
            <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] dark:border-white/10">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">{t("nav.menu")}</div>
              <button
                type="button"
                className="btn-enhanced inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-gradient-card text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
                onClick={(): void => setMobileSidebarOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
              <SidebarPortalHost variant="mobileDrawer" className="space-y-6 min-h-[120px]" />
            </div>
            <div className="border-t border-black/5 p-4 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50 safe-bottom">
              <div className="flex items-center justify-between opacity-50">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{APP_FOOTER_TEXT}</span>
                <RelayStatusBadge />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!props.hideSidebar && (
        <div className="sidebar-interactive relative z-[2600] hidden h-full pointer-events-auto md:flex">
          <div className="relative z-20 flex h-full w-14 shrink-0 select-none flex-col items-center justify-between border-r border-black/10 bg-gradient-sidebar py-3 dark:border-white/10">
            <div className="flex flex-col items-center gap-4 flex-none py-2">
              <RelayStatusBadge compact compactNavigateHref="/settings?tab=relays" />
            </div>

            <div className="flex flex-1 select-none flex-col items-center gap-2 overflow-y-auto no-scrollbar py-4 scroll-smooth">
              {NAV_ITEMS.map((item: NavItem) => {
                const Icon: NavIcon | undefined = ICON_BY_HREF[item.href];
                const isActive: boolean = activeHref === item.href;
                const badgeCount: number = navBadgeCounts[item.href] ?? 0;
                const label = item.i18nKey ? t(item.i18nKey) : item.label;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    suppressHydrationWarning
                    onPointerEnter={(): void => {
                      prefetchRouteOnIntent(item.href);
                    }}
                    onFocus={(): void => {
                      prefetchRouteOnIntent(item.href);
                    }}
                    onClick={(event): void => {
                      if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
                        return;
                      }
                      if (item.href === pathname) {
                        event.preventDefault();
                        return;
                      }
                      if (navigationFailOpenEnabledRef.current) {
                        event.preventDefault();
                        hardNavigate(item.href);
                        return;
                      }
                      recordNavigationIntent(item.href);
                      armRouteHardFallback(item.href);
                    }}
                    className={cn(
                      "nav-link group relative inline-flex h-10 w-10 select-none items-center justify-center rounded-xl border border-transparent transition-all shrink-0",
                      isActive
                        ? "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:border-purple-400/20 dark:bg-purple-400/10 dark:text-purple-400 shadow-[0_0_10px_oklch(0.6_0.2_270_/_0.15)]"
                        : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900/60"
                    )}
                    aria-label={label}
                  >
                    {Icon ? (
                      <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", isActive ? "scale-110" : "")} />
                    ) : null}
                    {badgeCount > 0 ? (
                      <span
                        className="absolute -right-0.5 -top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-600 px-0.5 text-[9px] font-bold text-white shadow-lg shadow-red-600/30"
                        aria-label={`${label} unread count ${badgeCount}`}
                      >
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>

            <div className="flex flex-col items-center gap-3 flex-none pt-2">
              <UserAvatarMenu compact preferUp alignStart />
            </div>
          </div>

          {pathname === "/" ? (
            <div className="relative z-10 h-full w-80 border-r border-black/10 bg-white/60 shadow-lg backdrop-blur-xl dark:bg-black/60">
              <div className="flex h-full flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <SidebarPortalHost variant="desktop" className="h-full min-h-[200px]" />
                </div>
                <div className="border-t border-black/5 p-4 dark:border-white/5 opacity-50">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    {APP_FOOTER_TEXT}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="relative z-0 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!props.hideHeader && (
          <header className={cn(
            "sticky top-0 z-20 grid items-center border-b border-black/10 bg-gradient-sidebar/80 backdrop-blur dark:border-white/10 md:hidden",
            mobileShellHeader
              ? "grid-cols-[2.5rem_1fr_2.5rem] px-2 py-1 pt-[calc(0.25rem+env(safe-area-inset-top))]"
              : "grid-cols-[2.75rem_1fr_2.75rem] px-2 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))]",
          )}>
            <div className="flex items-center justify-start">
              {!props.hideSidebar ? (
                <button
                  type="button"
                  className={cn(
                    "btn-enhanced inline-flex items-center justify-center rounded-xl border border-black/10 bg-gradient-card text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-zinc-900/40",
                    mobileShellHeader ? "h-10 w-10" : "h-11 w-11",
                  )}
                  onClick={(): void => setMobileSidebarOpen(true)}
                  aria-label="Open menu"
                >
                  <Menu className={mobileShellHeader ? "h-4 w-4" : "h-5 w-5"} />
                </button>
              ) : null}
            </div>
            <div className="min-w-0 px-1 text-center">
              <div className={cn(
                "truncate font-semibold uppercase tracking-widest text-zinc-500",
                mobileShellHeader ? "text-xs" : "text-sm",
              )}>Obscur</div>
            </div>
            <div className={cn("shrink-0", mobileShellHeader ? "w-10" : "w-11")} aria-hidden="true" />
          </header>
        )}
        <div className={cn(
          "relative flex flex-1 flex-col min-h-0 md:pb-0",
          props.mobileDmMode ? "pb-mobile-thread" : "pb-mobile-tab-bar",
        )}>
          <div className="relative z-0 flex min-h-0 flex-1 flex-col">
            <React.Suspense fallback={
              <div className="animate-in fade-in duration-200">
                <RouteLoadingFallback
                  title="Loading page"
                  detail="Preparing view..."
                  pathname={pathname}
                />
              </div>
            }>
              <div className={cn(
                "flex min-h-0 flex-1 flex-col",
                shouldRunNavigationInstrumentation()
                  ? "animate-in fade-in slide-in-from-bottom-1 duration-200"
                  : undefined,
              )}>
                {!isMobileShellProduct() ? <RelayTransportShellBanner /> : null}
                {props.children}
              </div>
            </React.Suspense>
          </div>
        </div>
      </div>
      {showMobileTabBar ? (
        <MobileTabBar navBadgeCounts={navBadgeCounts} />
      ) : null}
    </div>
  );
};

export default AppShell;
