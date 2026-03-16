"use client";

import React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@dweb/ui-kit";

type ProfileCompletenessIndicatorProps = Readonly<{
  hasAvatar: boolean;
  hasUsername: boolean;
  hasDescription: boolean;
  hasNip05: boolean;
  className?: string;
}>;

type Item = Readonly<{ label: string; complete: boolean }>;

export function ProfileCompletenessIndicator(props: ProfileCompletenessIndicatorProps) {
  const items: Item[] = [
    { label: "Avatar", complete: props.hasAvatar },
    { label: "Username", complete: props.hasUsername },
    { label: "Description", complete: props.hasDescription },
    { label: "NIP-05", complete: props.hasNip05 },
  ];
  const completed = items.filter((item) => item.complete).length;
  const percentage = Math.round((completed / items.length) * 100);

  return (
    <div className={cn("rounded-2xl border border-border/70 bg-card/60 p-3", props.className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Profile Completeness</p>
        <p className="text-xs font-semibold text-foreground">{completed}/{items.length}</p>
      </div>

      <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
          aria-hidden
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.label}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest",
              item.complete
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-border bg-background/60 text-muted-foreground"
            )}
          >
            {item.complete ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

