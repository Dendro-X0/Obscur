"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { useTranslation } from "react-i18next";
import { MobileTabBar } from "./mobile-tab-bar";
import { AppLoadingScreen } from "./app-loading-screen";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
  createRouteMountDiagnosticsState,
  createPageTransitionRecoveryState,
  getRouteSurfaceFromPathname,
  hardNavigate,
  PAGE_TRANSITION_WATCHDOG_MS,
  ROUTE_MOUNT_PROBE_WARN_THRESHOLD_MS,
  ROUTE_NAVIGATION_STALL_HARD_FALLBACK_MS,
  recordRouteMountProbeSample,
  recordPageTransitionWatchdogTimeout,
  type RouteMountDiagnosticsState,
} from "./page-transition-recovery";

type NavIcon = (props: Readonly<{ className?: string }>) => React.ReactNode;

type AppShellProps = Readonly<{
  sidebarContent?: React.ReactNode;
  children: React.ReactNode;
  navBadgeCounts?: Readonly<Record<string, number>>;
  hideSidebar?: boolean;
  hideHeader?: boolean;
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

const AppShell = (props: AppShellProps): React.JSX.Element => {
  const { t } = useTranslation();
  const pathname: string = usePathname();
  const activeRouteSurface = useMemo(() => getRouteSurfaceFromPathname(pathname), [pathname]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [hasMounted, setHasMounted] = useState<boolean>(false);
  const [isPageTransitionActive, setIsPageTransitionActive] = useState<boolean>(false);
  const [arePageTransitionsEnabled, setArePageTransitionsEnabled] = useState<boolean>(true);
  const pageTransitionRecoveryRef = useRef(createPageTransitionRecoveryState());
  const pageTransitionWatchdogIdRef = useRef<number | null>(null);
  const pageTransitionAnimationFrameIdRef = useRef<number | null>(null);
  const pageTransitionSequenceRef = useRef<number>(0);
  const pageTransitionStartedAtUnixMsRef = useRef<number>(0);
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

  const clearPageTransitionTimers = useCallback((): void => {
    const watchdogId = pageTransitionWatchdogIdRef.current;
    if (typeof watchdogId === "number") {
      window.clearTimeout(watchdogId);
      pageTransitionWatchdogIdRef.current = null;
    }
    const animationFrameId = pageTransitionAnimationFrameIdRef.current;
    if (typeof animationFrameId === "number") {
      window.cancelAnimationFrame(animationFrameId);
      pageTransitionAnimationFrameIdRef.current = null;
    }
  }, []);

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
      clearRouteFallback();
      hardNavigate(targetHref);
    }, ROUTE_NAVIGATION_STALL_HARD_FALLBACK_MS);
  }, [activeRouteSurface, clearRouteFallback, pathname]);

  useEffect((): (() => void) => {
    pageTransitionSequenceRef.current += 1;
    const transitionSequence = pageTransitionSequenceRef.current;
    pageTransitionStartedAtUnixMsRef.current = Date.now();
    clearPageTransitionTimers();

    if (!arePageTransitionsEnabled) {
      setIsPageTransitionActive(false);
      return clearPageTransitionTimers;
    }

    setIsPageTransitionActive(true);
    logAppEvent({
      name: "navigation.page_transition_start",
      level: "debug",
      scope: { feature: "navigation", action: "page_transition" },
      context: {
        pathname,
        routeSurface: activeRouteSurface,
      },
    });

    pageTransitionAnimationFrameIdRef.current = window.requestAnimationFrame((): void => {
      if (pageTransitionSequenceRef.current !== transitionSequence) {
        return;
      }
      pageTransitionAnimationFrameIdRef.current = null;
      const watchdogId = pageTransitionWatchdogIdRef.current;
      if (typeof watchdogId === "number") {
        window.clearTimeout(watchdogId);
        pageTransitionWatchdogIdRef.current = null;
      }
      setIsPageTransitionActive(false);
      logAppEvent({
        name: "navigation.page_transition_settled",
        level: "debug",
        scope: { feature: "navigation", action: "page_transition" },
        context: {
          pathname,
          routeSurface: activeRouteSurface,
          elapsedMs: Math.max(0, Date.now() - pageTransitionStartedAtUnixMsRef.current),
          transitionsEnabled: true,
        },
      });
    });

    pageTransitionWatchdogIdRef.current = window.setTimeout((): void => {
      if (pageTransitionSequenceRef.current !== transitionSequence) {
        return;
      }
      pageTransitionWatchdogIdRef.current = null;
      const animationFrameId = pageTransitionAnimationFrameIdRef.current;
      if (typeof animationFrameId === "number") {
        window.cancelAnimationFrame(animationFrameId);
        pageTransitionAnimationFrameIdRef.current = null;
      }
      setIsPageTransitionActive(false);

      const nextRecoveryState = recordPageTransitionWatchdogTimeout(pageTransitionRecoveryRef.current);
      pageTransitionRecoveryRef.current = nextRecoveryState;
      const elapsedMs = Math.max(0, Date.now() - pageTransitionStartedAtUnixMsRef.current);

      logAppEvent({
        name: "navigation.page_transition_watchdog_timeout",
        level: "warn",
        scope: { feature: "navigation", action: "page_transition" },
        context: {
          pathname,
          routeSurface: activeRouteSurface,
          elapsedMs,
          timeoutCount: nextRecoveryState.timeoutCount,
          transitionsDisabled: nextRecoveryState.transitionsDisabled,
          watchdogTimeoutMs: PAGE_TRANSITION_WATCHDOG_MS,
        },
      });

      if (nextRecoveryState.transitionsDisabled) {
        setArePageTransitionsEnabled(false);
        logAppEvent({
          name: "navigation.page_transition_effects_disabled",
          level: "warn",
          scope: { feature: "navigation", action: "page_transition" },
          context: {
            pathname,
            routeSurface: activeRouteSurface,
            timeoutCount: nextRecoveryState.timeoutCount,
          },
        });
      }
    }, PAGE_TRANSITION_WATCHDOG_MS);

    return clearPageTransitionTimers;
  }, [activeRouteSurface, arePageTransitionsEnabled, clearPageTransitionTimers, pathname]);

  useEffect((): (() => void) => {
    return (): void => {
      clearPageTransitionTimers();
    };
  }, [clearPageTransitionTimers]);

  useEffect((): (() => void) => {
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
            transitionWatchdogTimeoutCount: pageTransitionRecoveryRef.current.timeoutCount,
          },
        );

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
            transitionWatchdogTimeoutCount: pageTransitionRecoveryRef.current.timeoutCount,
          },
        });
      });
    });

    return clearRouteMountProbeTimers;
  }, [activeRouteSurface, clearRouteMountProbeTimers, pathname]);

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
    clearRouteFallback();
  }, [activeRouteSurface, clearRouteFallback, pathname]);

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
              {props.sidebarContent ? (
                <div className="space-y-6">
                  {props.sidebarContent}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center opacity-40">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-zinc-100 dark:bg-zinc-900 border border-black/5 dark:border-white/5">
                    <Menu className="h-6 w-6 text-zinc-400" />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{t("common.noContent", "No Options")}</h3>
                  <p className="mt-1 text-[10px] px-8 leading-relaxed">
                    {t("nav.menuEmptyDesc", "Specific options for this page appear here.")}
                  </p>
                </div>
              )}
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
                    onClick={(event): void => {
                      if (event.defaultPrevented) {
                        return;
                      }
                      if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
                        return;
                      }
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

          {props.sidebarContent ? (
            <div className="relative z-10 h-full w-80 border-r border-black/10 bg-white/60 shadow-lg backdrop-blur-xl dark:bg-black/60">
              <div className="flex h-full flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {props.sidebarContent}
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
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-black/10 bg-gradient-sidebar/80 px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur dark:border-white/10 md:hidden">
            {!props.hideSidebar && (
              <button
                type="button"
                className="btn-enhanced inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-gradient-card text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
                onClick={(): void => setMobileSidebarOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <div className="min-w-0 flex-1 px-3">
              <div className="truncate text-sm font-semibold text-center uppercase tracking-widest text-zinc-500">Obscur</div>
            </div>
            <div className="w-11" /> {/* Spacer to balance hamburger menu */}
          </header>
        )}
        <div className="relative flex flex-1 flex-col min-h-0 pb-[calc(env(safe-area-inset-bottom)+4.25rem)] md:pb-0">
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 z-10 bg-gradient-to-br from-zinc-300/20 via-transparent to-zinc-300/10 dark:from-zinc-200/10 dark:to-transparent transition-opacity duration-300",
              isPageTransitionActive && arePageTransitionsEnabled ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            className={cn(
              "relative z-0 flex min-h-0 flex-1 flex-col",
              arePageTransitionsEnabled ? "transition-all duration-300" : "transition-none",
              isPageTransitionActive && arePageTransitionsEnabled ? "translate-y-1 opacity-95" : "translate-y-0 opacity-100",
            )}
          >
            <React.Suspense fallback={
              <div className="animate-in fade-in duration-200">
                <AppLoadingScreen fullScreen={false} title="Loading page" detail="Preparing view..." />
              </div>
            }>
              <div className="flex min-h-0 flex-1 flex-col animate-in fade-in slide-in-from-bottom-1 duration-200">
                {props.children}
              </div>
            </React.Suspense>
          </div>
        </div>
      </div>
      {!props.hideSidebar && <MobileTabBar navBadgeCounts={navBadgeCounts} />}
    </div>
  );
};

export default AppShell;
