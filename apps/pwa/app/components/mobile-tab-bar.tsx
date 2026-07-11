"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, MessageSquare, Search, Settings, UserPlus, Users, FolderLock } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/app/lib/utils";
import { NAV_ITEMS } from "../lib/navigation/nav-items";
import { useTranslation } from "react-i18next";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
  hardNavigate,
  recoverFromRouteStall,
  shouldArmRouteStallWatchdog,
} from "./route-stall-recovery.client";
import { ROUTE_NAVIGATION_STALL_HARD_FALLBACK_MS } from "./page-transition-recovery";
import { prefetchRouteShell, prefetchSidebarRouteClientOnIntent } from "./route-navigation-warmup";
import { isMobileShellProduct } from "@/app/features/runtime/shell-contract";
import { recordNavigationIntent } from "./navigation-performance-coordinator";
import { useSecondaryPageLayoutTier } from "@/app/features/runtime/use-mobile-compact-layout";

const ICON_BY_HREF: Record<string, any> = {
    "/": MessageSquare,
    "/network": Users,
    "/vault": FolderLock,
    "/search": Search,
    "/requests": Bell,
    "/settings": Settings,
};

interface MobileTabBarProps {
    navBadgeCounts?: Record<string, number>;
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({ navBadgeCounts = {} }) => {
    const { t } = useTranslation();
    const router = useRouter();
    const pathname = usePathname();
    const layoutTier = useSecondaryPageLayoutTier();
    const showOnViewport = isMobileShellProduct() || layoutTier !== "desktop";
    const routeFallbackTimeoutIdRef = React.useRef<number | null>(null);
    const routePendingTargetRef = React.useRef<string | null>(null);
    const routePendingStartedAtUnixMsRef = React.useRef<number>(0);
    const idleScheduler = React.useMemo((): Readonly<{
        schedule: (callback: () => void) => number;
    }> | null => {
        if (typeof window === "undefined") {
            return null;
        }
        if (typeof window.requestIdleCallback === "function") {
            return {
                schedule: (callback: () => void): number => window.requestIdleCallback(() => callback()),
            };
        }
        return {
            schedule: (callback: () => void): number => window.setTimeout(callback, 32),
        };
    }, []);

    const clearRouteFallback = React.useCallback((): void => {
        const timeoutId = routeFallbackTimeoutIdRef.current;
        if (typeof timeoutId === "number") {
            window.clearTimeout(timeoutId);
            routeFallbackTimeoutIdRef.current = null;
        }
        routePendingTargetRef.current = null;
        routePendingStartedAtUnixMsRef.current = 0;
    }, []);

    const armRouteHardFallback = React.useCallback((targetHref: string): void => {
        if (!shouldArmRouteStallWatchdog()) {
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
                guardSource: "mobile_tab_bar",
                fromPathname: pathname,
                targetHref,
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
                    guardSource: "mobile_tab_bar",
                    fromPathname: pathname,
                    currentPathname,
                    targetHref,
                    elapsedMs: Math.max(0, Date.now() - routePendingStartedAtUnixMsRef.current),
                    hardFallbackAfterMs: ROUTE_NAVIGATION_STALL_HARD_FALLBACK_MS,
                },
            });
            clearRouteFallback();
            recoverFromRouteStall(targetHref, router);
        }, ROUTE_NAVIGATION_STALL_HARD_FALLBACK_MS);
    }, [clearRouteFallback, pathname, router]);

    React.useEffect((): void => {
        const pendingTarget = routePendingTargetRef.current;
        if (!pendingTarget || pathname !== pendingTarget) {
            return;
        }
        logAppEvent({
            name: "navigation.route_settled",
            level: "info",
            scope: { feature: "navigation", action: "route_guard" },
            context: {
                guardSource: "mobile_tab_bar",
                pathname,
                elapsedMs: Math.max(0, Date.now() - routePendingStartedAtUnixMsRef.current),
            },
        });
        clearRouteFallback();
    }, [clearRouteFallback, pathname]);

    React.useEffect((): (() => void) => {
        return (): void => {
            clearRouteFallback();
        };
    }, [clearRouteFallback]);

    if (!showOnViewport) {
        return null;
    }

    return (
        <nav
            data-testid="mobile-tab-bar"
            className="fixed bottom-0 left-0 right-0 z-50 block border-t border-black/10 bg-white/80 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 backdrop-blur-xl dark:border-white/10 dark:bg-black/80"
        >
            <div className="flex items-center justify-around px-2">
                {NAV_ITEMS.map((item) => {
                    const Icon = ICON_BY_HREF[item.href];
                    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                    const badgeCount = navBadgeCounts[item.href] ?? 0;
                    const label = item.i18nKey ? t(item.i18nKey) : item.label;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onPointerEnter={(): void => {
                                if (item.href === pathname) {
                                    return;
                                }
                                prefetchRouteShell(router, item.href);
                                if (idleScheduler) {
                                    prefetchSidebarRouteClientOnIntent(item.href, idleScheduler);
                                }
                            }}
                            onFocus={(): void => {
                                if (item.href === pathname) {
                                    return;
                                }
                                prefetchRouteShell(router, item.href);
                                if (idleScheduler) {
                                    prefetchSidebarRouteClientOnIntent(item.href, idleScheduler);
                                }
                            }}
                            onClick={(event): void => {
                                if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
                                    return;
                                }
                                if (item.href === pathname) {
                                    event.preventDefault();
                                    return;
                                }
                                recordNavigationIntent(item.href);
                                armRouteHardFallback(item.href);
                            }}
                            className={cn(
                                "relative flex flex-col items-center justify-center gap-1 px-3 py-1 transition-colors",
                                isActive ? "text-purple-600 dark:text-purple-400" : "text-zinc-500 dark:text-zinc-400"
                            )}
                        >
                            <div className="relative">
                                <Icon className={cn("h-6 w-6 transition-transform", isActive && "scale-110")} />
                                {badgeCount > 0 && (
                                    <span className="absolute -right-2 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-black">
                                        {badgeCount > 99 ? "99+" : badgeCount}
                                    </span>
                                )}
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTabGlow"
                                        className="absolute -inset-2 -z-10 rounded-full bg-purple-500/10 blur-sm dark:bg-purple-400/10"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.2 }}
                                    />
                                )}
                            </div>
                            <span className="text-[10px] font-medium leading-none">{label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};
