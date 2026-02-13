"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { cn } from "@/app/lib/utils";
import { NAV_ITEMS } from "../lib/navigation/nav-items";
import { useHorizontalScroll } from "@/app/features/messaging/hooks/use-horizontal-scroll";
import AppShell from "./app-shell";

import { useTranslation } from "react-i18next";

type PageShellProps = Readonly<{
  title: string;
  children: React.ReactNode;
  navBadgeCounts?: Readonly<Record<string, number>>;
  rightContent?: React.ReactNode;
}>;

const PageShell = (props: PageShellProps): React.JSX.Element => {
  const { t } = useTranslation();
  const pathname: string = usePathname();
  const navBadgeCounts: Readonly<Record<string, number>> = useMemo((): Readonly<Record<string, number>> => {
    return props.navBadgeCounts ?? {};
  }, [props.navBadgeCounts]);
  const navRef = useHorizontalScroll<HTMLElement>();

  return (
    <AppShell navBadgeCounts={navBadgeCounts}>
      <div className="flex min-h-dvh flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
        <header className="sticky top-0 z-20 border-b border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-black/70">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-6">
              <div className="shrink-0 truncate text-base font-semibold tracking-tight">{props.title}</div>
            </div>

            {props.rightContent ? <div className="flex items-center gap-2">{props.rightContent}</div> : null}
          </div>
        </header>

        <main className="page-transition min-h-0 flex-1">{props.children}</main>
      </div>
    </AppShell>
  );
};

export { PageShell };
