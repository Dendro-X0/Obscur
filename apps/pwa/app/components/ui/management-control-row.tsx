"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@dweb/ui-kit";

export function ManagementSectionHeader({
    title,
    description,
    tone = "neutral",
}: Readonly<{
    title: string;
    description?: string;
    tone?: "neutral" | "danger";
}>): React.JSX.Element {
    return (
        <div className="space-y-1 px-2">
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
            {description ? (
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
    return (
        <>
            {showDivider ? (
                <div className="mx-6 h-px bg-zinc-200/70 sm:mx-8 dark:bg-white/[0.06]" />
            ) : null}
            <button
                type="button"
                onClick={onClick}
                className="flex w-full items-center justify-between p-6 transition-colors hover:bg-rose-500/[0.02] group/item sm:p-8"
            >
                <div className="flex min-w-0 items-center gap-4 sm:gap-6">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 transition-transform group-hover/item:scale-105 sm:h-14 sm:w-14">
                        <Icon className="h-5 w-5 text-rose-500 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0 text-left space-y-1">
                        <p className="text-base font-black text-zinc-900 transition-colors group-hover/item:text-rose-500 dark:text-white sm:text-xl">
                            {title}
                        </p>
                        <p className="text-sm font-medium text-zinc-500">{description}</p>
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
    return (
        <div
            className={cn(
                "overflow-hidden rounded-[32px] border border-zinc-200/70 bg-white/88 backdrop-blur-xl dark:border-white/10 dark:bg-[#07101f]/88",
                className,
            )}
        >
            <div className="flex flex-col">{children}</div>
        </div>
    );
}
