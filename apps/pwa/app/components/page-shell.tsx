"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { cn } from "../lib/cn";
import { NAV_ITEMS } from "../lib/navigation/nav-items";

type PageShellProps = Readonly<{
  title: string;
  children: React.ReactNode;
  navBadgeCounts?: Readonly<Record<string, number>>;
  rightContent?: React.ReactNode;
}>;

const PageShell = (props: PageShellProps): React.JSX.Element => {
  const pathname: string = usePathname();
  const navBadgeCounts: Readonly<Record<string, number>> = useMemo((): Readonly<Record<string, number>> => {
    return props.navBadgeCounts ?? {};
  }, [props.navBadgeCounts]);
  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-black/70">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold tracking-tight">{props.title}</div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item): React.JSX.Element => {
              const isActive: boolean = pathname === item.href;
              const badgeCount: number = navBadgeCounts[item.href] ?? 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900/40",
                    isActive && "bg-zinc-100 text-zinc-900 dark:bg-zinc-900/40 dark:text-zinc-100"
                  )}
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
          </nav>

          {props.rightContent ? <div className="flex items-center gap-2">{props.rightContent}</div> : null}
        </div>
      </header>

      <main className="min-h-0 flex-1">{props.children}</main>
    </div>
  );
};

export { PageShell };
