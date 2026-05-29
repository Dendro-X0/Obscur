"use client";

import React from "react";
import { cn } from "@dweb/ui-kit";

export function SettingsSectionCard({
    id,
    title,
    description,
    meta,
    onReset,
    resetLabel = "Reset",
    children,
    className,
}: Readonly<{
    id?: string;
    title: string;
    description?: string;
    meta?: React.ReactNode;
    onReset?: () => void;
    resetLabel?: string;
    children: React.ReactNode;
    className?: string;
}>): React.JSX.Element {
    return (
        <section
            id={id}
            className={cn(
                "group relative overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-white/80 to-zinc-50/40 p-5 backdrop-blur-md shadow-sm transition-all hover:shadow-md dark:border-white/10 dark:from-zinc-900/40 dark:to-zinc-950/20",
                className,
            )}
        >
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0 flex flex-col gap-0.5">
                    <h3 className="font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h3>
                    {description ? (
                        <p className="text-xs leading-relaxed text-zinc-500">{description}</p>
                    ) : null}
                    {meta ? <div className="mt-1">{meta}</div> : null}
                </div>
                {onReset ? (
                    <button
                        type="button"
                        onClick={onReset}
                        className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:bg-black/5 hover:text-zinc-800 dark:hover:bg-white/10 dark:hover:text-zinc-200"
                    >
                        {resetLabel}
                    </button>
                ) : null}
            </div>
            {children}
        </section>
    );
}
