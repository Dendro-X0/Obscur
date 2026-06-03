"use client";

import React from "react";
import Image from "next/image";
import { X, type LucideIcon } from "lucide-react";
import { cn } from "@/app/lib/cn";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";
import {
    GROUP_MANAGEMENT_TABS,
    GROUP_MANAGEMENT_TAB_COPY,
    type GroupManagementTabId,
} from "./constants";

export function GroupManagementShell({
    isOpen,
    onClose,
    communityTitle,
    communityInitial,
    avatarUrl,
    relayHost,
    communityModeLabel,
    activeTab,
    onTabChange,
    governanceBadgeCount,
    headerAction,
    footer,
    relayGateNotice,
    children,
}: Readonly<{
    isOpen: boolean;
    onClose: () => void;
    communityTitle: string;
    communityInitial: string;
    avatarUrl?: string;
    relayHost: string;
    communityModeLabel: string;
    activeTab: GroupManagementTabId;
    onTabChange: (tab: GroupManagementTabId) => void;
    governanceBadgeCount: number;
    headerAction?: React.ReactNode;
    footer?: React.ReactNode;
    /** Shown above tab content when Managed Workspace relay tier is insufficient (P3.1). */
    relayGateNotice?: React.ReactNode;
    children: React.ReactNode;
}>): React.JSX.Element | null {
    const compact = useMobileCompactLayout();
    if (!isOpen) {
        return null;
    }

    const tabCopy = GROUP_MANAGEMENT_TAB_COPY[activeTab];

    return (
        <div
            className={cn(
                "fixed inset-0 z-[200] flex bg-black/50 backdrop-blur-md dark:bg-black/85",
                compact ? "items-stretch p-0" : "items-center justify-center p-3 sm:p-6",
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-management-title"
            onClick={onClose}
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    onClose();
                }
            }}
        >
            <div
                className={cn(
                    "flex min-h-0 w-full flex-col overflow-hidden border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950",
                    compact ? "h-full max-h-none rounded-none" : "h-[min(92vh,880px)] max-w-5xl rounded-2xl",
                )}
                onClick={(event) => event.stopPropagation()}
            >
                <div className={cn("flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800", compact ? "px-3 py-2.5" : "px-4 py-3 sm:px-5")}>
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
                            {avatarUrl ? (
                                <Image src={avatarUrl} alt="" fill unoptimized className="object-cover" />
                            ) : (
                                <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                                    {communityInitial}
                                </span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p id="community-management-title" className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                                {communityTitle}
                            </p>
                            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span className="shrink-0 rounded-md border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                                    {communityModeLabel}
                                </span>
                                {!compact ? (
                                    <span className="truncate text-xs text-zinc-500">{relayHost}</span>
                                ) : (
                                    <span className="truncate text-[10px] text-zinc-500" title={relayHost}>
                                        {relayHost.replace(/^wss?:\/\//, "").split("/")[0]}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                        aria-label="Close community settings"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                    <nav
                        className="flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-200 px-2 py-2 sm:w-52 sm:flex-col sm:border-b-0 sm:border-r sm:px-2 sm:py-3 dark:border-zinc-800"
                        aria-label="Community settings sections"
                    >
                        {GROUP_MANAGEMENT_TABS.map((tab) => (
                            <NavButton
                                key={tab.id}
                                icon={tab.icon}
                                label={tab.label}
                                isActive={activeTab === tab.id}
                                badge={tab.id === "governance" ? governanceBadgeCount : 0}
                                onClick={() => onTabChange(tab.id)}
                            />
                        ))}
                    </nav>

                    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                        <header className={cn(
                            "flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800",
                            compact ? "px-3 py-3" : "px-4 py-4 sm:px-5",
                        )}>
                            <div className="min-w-0">
                                <h2 className="text-base font-semibold text-zinc-900 sm:text-lg dark:text-white">{tabCopy.title}</h2>
                                {!compact ? (
                                    <p className="mt-0.5 text-sm text-zinc-500">{tabCopy.description}</p>
                                ) : null}
                            </div>
                            {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
                        </header>

                        <div
                            className={cn(
                                "min-h-0 flex-1 overflow-y-auto overscroll-contain",
                                compact ? "px-3 py-3" : "px-4 py-4 sm:px-6",
                                footer ? (compact ? "pb-6" : "pb-8") : (compact ? "pb-3" : "pb-4"),
                            )}
                        >
                            {relayGateNotice ? (
                                <div className="mb-4">{relayGateNotice}</div>
                            ) : null}
                            {children}
                        </div>

                        {footer ? (
                            <footer className="shrink-0 border-t border-zinc-200 bg-zinc-50/80 px-4 py-3 sm:px-5 dark:border-zinc-800 dark:bg-zinc-950">
                                {footer}
                            </footer>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}

function NavButton({
    icon: Icon,
    label,
    isActive,
    badge,
    onClick,
}: Readonly<{
    icon: LucideIcon;
    label: string;
    isActive: boolean;
    badge: number;
    onClick: () => void;
}>): React.JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:w-full",
                isActive
                    ? "bg-violet-100 text-violet-900 ring-1 ring-violet-300/80 dark:bg-violet-600/20 dark:text-violet-100 dark:ring-violet-500/40"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200",
            )}
        >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">{label}</span>
            {badge > 0 ? (
                <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-950">
                    {badge}
                </span>
            ) : null}
        </button>
    );
}
