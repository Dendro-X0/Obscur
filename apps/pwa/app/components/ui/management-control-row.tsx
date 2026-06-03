"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@dweb/ui-kit";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";

export function ManagementSectionHeader({
    title,
    description,
    tone = "neutral",
}: Readonly<{
    title: string;
    description?: string;
    tone?: "neutral" | "danger";
}>): React.JSX.Element {
    const compact = useMobileCompactLayout();
    return (
        <div className={cn("space-y-1", compact ? "px-0" : "px-2")}>
            <div className="flex items-center gap-3">
                <div
                    className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        tone === "danger" ? "bg-rose-500" : "bg-zinc-400 dark:bg-zinc-500",
                    )}
                />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-500">
                    {title}
                </h3>
            </div>
            {description && !compact ? (
                <p className="pl-5 text-xs leading-relaxed text-zinc-500">{description}</p>
            ) : null}
        </div>
    );
}

export function ManagementControlRow({
    icon: Icon,
    title,
    description,
    onClick,
    showDivider = false,
}: Readonly<{
    icon: LucideIcon;
    title: string;
    description: string;
    onClick: () => void;
    showDivider?: boolean;
}>): React.JSX.Element {
    const compact = useMobileCompactLayout();
    return (
        <>
            {showDivider ? (
                <div className={cn("h-px bg-zinc-200/70 dark:bg-white/[0.06]", compact ? "mx-3" : "mx-6 sm:mx-8")} />
            ) : null}
            <button
                type="button"
                onClick={onClick}
                className={cn(
                    "flex w-full items-center justify-between transition-colors hover:bg-rose-500/[0.02] group/item",
                    compact ? "gap-3 p-3" : "p-6 sm:p-8",
                )}
            >
                <div className={cn("flex min-w-0 items-center", compact ? "gap-3" : "gap-4 sm:gap-6")}>
                    <div className={cn(
                        "flex shrink-0 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 transition-transform group-hover/item:scale-105",
                        compact ? "h-9 w-9" : "h-12 w-12 sm:h-14 sm:w-14",
                    )}>
                        <Icon className={cn("text-rose-500", compact ? "h-4 w-4" : "h-5 w-5 sm:h-6 sm:w-6")} />
                    </div>
                    <div className="min-w-0 text-left space-y-0.5">
                        <p className={cn(
                            "font-black text-zinc-900 transition-colors group-hover/item:text-rose-500 dark:text-white",
                            compact ? "text-sm" : "text-base sm:text-xl",
                        )}>
                            {title}
                        </p>
                        {!compact ? (
                            <p className="text-sm font-medium text-zinc-500">{description}</p>
                        ) : null}
                    </div>
                </div>
            </button>
        </>
    );
}

export function ManagementControlCard({
    children,
    className,
}: Readonly<{
    children: React.ReactNode;
    className?: string;
}>): React.JSX.Element {
    const compact = useMobileCompactLayout();
    return (
        <div
            className={cn(
                "overflow-hidden border border-zinc-200/70 bg-white/88 backdrop-blur-xl dark:border-white/10 dark:bg-[#07101f]/88",
                compact ? "rounded-2xl" : "rounded-[32px]",
                className,
            )}
        >
            <div className="flex flex-col">{children}</div>
        </div>
    );
}
