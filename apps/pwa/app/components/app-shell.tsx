"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Menu, MessageSquare, Search, Settings, SidebarClose, SidebarOpen, UserPlus, X } from "lucide-react";
import { cn } from "../lib/cn";
import { NAV_ITEMS } from "../lib/navigation/nav-items";
import { UserAvatarMenu } from "./user-avatar-menu";
import { useIsDesktop } from "../lib/desktop/use-tauri";
import { useKeyboardShortcuts } from "../lib/desktop/use-keyboard-shortcuts";
import { useDesktopLayout } from "../lib/desktop/use-desktop-layout";

type NavItem = Readonly<{ href: string; label: string }>;

type NavIcon = (props: Readonly<{ className?: string }>) => React.JSX.Element;

type AppShellProps = Readonly<{
  sidebarContent: React.ReactNode;
  children: React.ReactNode;
  navBadgeCounts?: Readonly<Record<string, number>>;
}>;

const STORAGE_KEY: string = "dweb.nostr.pwa.ui.sidebarExpanded";

const ICON_BY_HREF: Readonly<Record<string, NavIcon>> = {
  "/": (props: Readonly<{ className?: string }>): React.JSX.Element => <MessageSquare className={props.className} />,
  "/invites": (props: Readonly<{ className?: string }>): React.JSX.Element => <UserPlus className={props.className} />,
  "/search": (props: Readonly<{ className?: string }>): React.JSX.Element => <Search className={props.className} />,
  "/settings": (props: Readonly<{ className?: string }>): React.JSX.Element => <Settings className={props.className} />,
};

const loadExpanded = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const raw: string | null = window.localStorage.getItem(STORAGE_KEY);
    return raw === "1";
  } catch {
    return false;
  }
};

const saveExpanded = (expanded: boolean): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
  } catch {
    return;
  }
};

const AppShell = (props: AppShellProps): React.JSX.Element => {
  const pathname: string = usePathname();
  const [expanded, setExpanded] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const isDesktop = useIsDesktop();
  const { isCompact } = useDesktopLayout();
  
  // Register keyboard shortcuts for desktop
  useKeyboardShortcuts();
  
  useEffect((): void => {
    queueMicrotask((): void => {
      setExpanded(loadExpanded());
    });
  }, []);
  useEffect((): void => {
    saveExpanded(expanded);
  }, [expanded]);

  const activeHref: string = useMemo((): string => {
    const exact: NavItem | undefined = NAV_ITEMS.find((item: NavItem): boolean => item.href === pathname);
    return exact?.href ?? "/";
  }, [pathname]);

  const navBadgeCounts: Readonly<Record<string, number>> = useMemo((): Readonly<Record<string, number>> => {
    return props.navBadgeCounts ?? {};
  }, [props.navBadgeCounts]);

  return (
    <div className={cn(
      "flex min-h-dvh overflow-hidden bg-gradient-main text-zinc-900 dark:text-zinc-100",
      isDesktop && "desktop-mode"
    )}>
      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={(): void => setMobileSidebarOpen(false)}
            aria-label="Close navigation"
          />
          <div className="absolute left-0 top-0 flex h-full w-[86vw] max-w-sm flex-col border-r border-black/10 bg-gradient-sidebar dark:border-white/10">
            <div className="flex items-center justify-between border-b border-black/10 px-3 py-3 dark:border-white/10">
              <div className="text-sm font-semibold">Obscur</div>
              <button
                type="button"
                className="btn-enhanced inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-gradient-card text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
                onClick={(): void => setMobileSidebarOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="border-b border-black/10 p-3 dark:border-white/10">
              <div className="grid grid-cols-3 gap-2">
                {NAV_ITEMS.map((item: NavItem) => {
                  const Icon: NavIcon | undefined = ICON_BY_HREF[item.href];
                  const isActive: boolean = activeHref === item.href;
                  const badgeCount: number = navBadgeCounts[item.href] ?? 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "nav-link relative flex flex-col items-center justify-center gap-1 rounded-xl border border-black/10 bg-zinc-50 px-2 py-2 text-xs text-zinc-700 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-200",
                        isActive && "active bg-zinc-100 dark:bg-zinc-900/40"
                      )}
                      onClick={(): void => setMobileSidebarOpen(false)}
                      aria-label={item.label}
                    >
                      {Icon ? <Icon className="h-4 w-4" /> : null}
                      <span className="truncate">{item.label}</span>
                      {badgeCount > 0 ? (
                        <span
                          className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white"
                          aria-label={`${item.label} unread count ${badgeCount}`}
                        >
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{props.sidebarContent}</div>
          </div>
        </div>
      ) : null}

      <div className="relative hidden md:flex">
        <div className="flex w-14 flex-col items-center justify-between border-r border-black/10 bg-gradient-sidebar py-3 dark:border-white/10">
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              className="btn-enhanced inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-gradient-card text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
              onClick={() => setExpanded((v: boolean): boolean => !v)}
              aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            >
              {expanded ? <SidebarClose className="h-4 w-4" /> : <SidebarOpen className="h-4 w-4" />}
            </button>

            {NAV_ITEMS.map((item: NavItem) => {
              const Icon: NavIcon | undefined = ICON_BY_HREF[item.href];
              const isActive: boolean = activeHref === item.href;
              const badgeCount: number = navBadgeCounts[item.href] ?? 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "nav-link relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900/40",
                    isActive && "active border-black/10 bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/60"
                  )}
                  aria-label={item.label}
                >
                  {Icon ? <Icon className="h-4 w-4" /> : null}
                  {badgeCount > 0 ? (
                    <span
                      className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white"
                      aria-label={`${item.label} unread count ${badgeCount}`}
                    >
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-2">
            <UserAvatarMenu compact preferUp alignStart />
          </div>
        </div>

        <div className="w-80 border-r border-black/10 bg-gradient-sidebar dark:border-white/10">
          {expanded ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-black/10 p-3 dark:border-white/10">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Menu</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {NAV_ITEMS.map((item: NavItem) => {
                    const badgeCount: number = navBadgeCounts[item.href] ?? 0;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "nav-link flex items-center justify-between rounded-xl border border-black/10 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-200 dark:hover:bg-zinc-900/40",
                          activeHref === item.href && "active bg-zinc-100 dark:bg-zinc-900/40"
                        )}
                        onClick={() => setExpanded(false)}
                      >
                        <span>{item.label}</span>
                        {badgeCount > 0 ? (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white">
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">{props.sidebarContent}</div>
            </div>
          ) : (
            props.sidebarContent
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-black/10 bg-gradient-sidebar/80 px-3 py-2 backdrop-blur dark:border-white/10 md:hidden">
          <button
            type="button"
            className="btn-enhanced inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-gradient-card text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
            onClick={(): void => setMobileSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1 px-3">
            <div className="truncate text-sm font-semibold">Obscur</div>
          </div>
          <UserAvatarMenu compact />
        </header>
        {props.children}
      </div>
    </div>
  );
};

export { AppShell };
