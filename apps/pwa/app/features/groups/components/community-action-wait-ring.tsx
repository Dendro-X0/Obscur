"use client";

import React from "react";
import { cn } from "@/app/lib/utils";
import type { CommunityActionWaitStep, CommunityActionWaitStepStatus } from "./community-action-wait-types";

export type CommunityActionWaitRingProps = Readonly<{
  title: string;
  subtitle?: string;
  steps: ReadonlyArray<CommunityActionWaitStep>;
  className?: string;
}>;

const statusStyles: Record<CommunityActionWaitStepStatus, string> = {
  pending:
    "border-zinc-200/80 bg-white/90 text-zinc-500 shadow-sm dark:border-white/10 dark:bg-[#141521]/90 dark:text-zinc-400",
  active:
    "border-violet-400/60 bg-violet-500/10 text-vinc-900 shadow-md ring-2 ring-violet-400/30 dark:border-violet-400/40 dark:bg-violet-500/15 dark:text-zinc-50",
  done:
    "border-emerald-400/50 bg-emerald-500/10 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
  skipped:
    "border-zinc-200/60 bg-zinc-100/80 text-zinc-400 dark:border-white/8 dark:bg-[#101018]/80 dark:text-zinc-500",
  failed:
    "border-rose-400/50 bg-rose-500/10 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100",
};

const statusGlyph: Record<CommunityActionWaitStepStatus, string> = {
  pending: "…",
  active: "●",
  done: "✓",
  skipped: "—",
  failed: "!",
};

export function CommunityActionWaitRing({
  title,
  subtitle,
  steps,
  className,
}: CommunityActionWaitRingProps) {
  const count = Math.max(steps.length, 1);
  const orbitRadiusPx = count <= 3 ? 108 : 124;

  return (
    <div
      className={cn("flex flex-col items-center justify-center py-6", className)}
      role="status"
      aria-live="polite"
      aria-busy={steps.some((step) => step.status === "active")}
    >
      <div className="text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-500 dark:text-violet-300">
          Working
        </p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div
        className="relative mt-10"
        style={{
          width: orbitRadiusPx * 2 + 140,
          height: orbitRadiusPx * 2 + 140,
        }}
      >
        <div
          className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-violet-400/35 dark:border-violet-300/25"
          aria-hidden
        />
        <div
          className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-violet-500/40 bg-violet-500/10 obscur-community-action-ring-pulse dark:border-violet-400/35 dark:bg-violet-500/15"
          aria-hidden
        />

        <div
          className="absolute inset-0 obscur-community-action-orbit"
          style={{ ["--orbit-radius" as string]: `${orbitRadiusPx}px` }}
          aria-hidden
        >
          {steps.map((step, index) => {
            const angleDeg = (360 / count) * index - 90;
            return (
              <div
                key={step.id}
                className="absolute left-1/2 top-1/2 w-[9.5rem] -translate-x-1/2 -translate-y-1/2"
                style={{
                  transform: `rotate(${angleDeg}deg) translateX(var(--orbit-radius)) rotate(${-angleDeg}deg)`,
                }}
              >
                <div
                  className={cn(
                    "rounded-2xl border px-3 py-2.5 text-left transition-colors duration-300",
                    statusStyles[step.status],
                    step.status === "active" && "scale-[1.02]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black",
                        step.status === "active" && "obscur-indeterminate-spin border border-current/30",
                      )}
                      aria-hidden
                    >
                      {step.status === "active" ? "" : statusGlyph[step.status]}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] leading-tight">
                      {step.label}
                    </span>
                  </div>
                  {step.detail ? (
                    <p className="mt-1 pl-7 text-[10px] leading-snug opacity-90">{step.detail}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
