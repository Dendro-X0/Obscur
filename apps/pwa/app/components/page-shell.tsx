"use client";

import React from "react";
import { useMemo } from "react";
import { cn } from "@/app/lib/utils";
import { useRegisterAppChrome } from "./app-chrome-registry";

type PageShellProps = Readonly<{
  title: string;
  children: React.ReactNode;
  navBadgeCounts?: Readonly<Record<string, number>>;
  rightContent?: React.ReactNode;
  hideHeader?: boolean;
  /** When true, the shell does not scroll; children own vertical scroll (mobile settings, etc.). */
  containScroll?: boolean;
}>;

const PageShell = (props: PageShellProps): React.JSX.Element => {
  const navBadgeCounts: Readonly<Record<string, number>> = useMemo((): Readonly<Record<string, number>> => {
    return props.navBadgeCounts ?? {};
  }, [props.navBadgeCounts]);

  const chromeOverrides = useMemo(
    () => ({
      navBadgeCounts,
      hideHeader: props.hideHeader ?? false,
    }),
    [navBadgeCounts, props.hideHeader],
  );
  useRegisterAppChrome(chromeOverrides);

  return (
    <div className={cn(
      "flex flex-1 min-h-0 flex-col overflow-x-hidden",
      props.containScroll ? "overflow-hidden" : "overflow-y-auto",
    )}>
      <header className="sticky top-0 z-20 hidden border-b border-border bg-background/80 backdrop-blur-xl dark:border-white/5 md:block">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 relative min-h-[56px]">
          <div className="flex min-w-0 flex-1 items-center gap-6 z-10">
            {/* Left Slot (could be back button etc) */}
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden px-4 pointer-events-none max-w-[50%]">
            <div className="truncate text-sm font-black uppercase tracking-[0.2em] text-foreground/80">{props.title}</div>
          </div>

          <div className="flex items-center gap-2 z-10 shrink-0 min-w-[40px] justify-end">
            {props.rightContent || null}
          </div>
        </div>
      </header>

      <main className="page-transition min-h-0 flex-1">
        <React.Suspense fallback={
          <div className="flex h-full w-full items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }>
          {props.children}
        </React.Suspense>
      </main>
    </div>
  );
};

export { PageShell };
