"use client";

import type React from "react";
import { cn } from "@/app/lib/utils";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";

export function SettingsCompactCard(props: Readonly<{
  title?: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}>): React.JSX.Element {
  const compact = useMobileCompactLayout();
  return (
    <section
      className={cn(
        "w-full border border-black/5 bg-gradient-card text-zinc-900 shadow-sm backdrop-blur-xl dark:border-white/5 dark:bg-zinc-900/40 dark:text-zinc-100",
        compact ? "rounded-2xl p-4" : "rounded-3xl p-6 ring-1 ring-black/[0.02] dark:ring-white/[0.05]",
        props.className,
      )}
    >
      {!compact && props.title ? (
        <div className="text-sm font-bold tracking-tight text-zinc-950 dark:text-zinc-50">{props.title}</div>
      ) : null}
      {!compact && props.description ? (
        <div className="mt-1 text-xs font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
          {props.description}
        </div>
      ) : null}
      <div className={cn(!compact && (props.title || props.description) ? "mt-5" : "", "text-sm leading-relaxed")}>
        {props.children}
      </div>
    </section>
  );
}

export function SettingsCompactSection(props: Readonly<{
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}>): React.JSX.Element {
  const compact = useMobileCompactLayout();
  if (compact) {
    return (
      <div className={cn("space-y-3 border-b border-black/5 pb-4 last:border-b-0 last:pb-0 dark:border-white/10", props.className)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{props.title}</div>
            {props.hint ? (
              <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{props.hint}</div>
            ) : null}
          </div>
          {props.action}
        </div>
        {props.children}
      </div>
    );
  }
  return (
    <div className={cn("group relative overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-white/80 to-zinc-50/40 p-5 shadow-sm dark:border-white/10 dark:from-zinc-900/40 dark:to-zinc-950/20", props.className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{props.title}</div>
          {props.hint ? (
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{props.hint}</p>
          ) : null}
        </div>
        {props.action}
      </div>
      {props.children}
    </div>
  );
}
