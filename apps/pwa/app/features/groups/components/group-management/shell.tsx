"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/app/lib/cn";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";
import { APP_OVERLAY_Z_INDEX_CLASS } from "@/app/components/app-overlay-layer";
import {
    GROUP_MANAGEMENT_TABS,
    GROUP_MANAGEMENT_TAB_COPY,
    type GroupManagementTabId,
} from "./constants";

/** Delay capture until real drag so tab clicks still work on phone-preview mouse. */
const TAB_DRAG_THRESHOLD_PX = 12;

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
    const { t } = useTranslation();
    const [mounted, setMounted] = useState(false);
    const tabScrollerRef = useRef<HTMLElement | null>(null);
    const tabDragRef = useRef<{
        pointerId: number;
        startX: number;
        startScrollLeft: number;
        moved: boolean;
        capturing: boolean;
    } | null>(null);
    const tabDragMovedRef = useRef(false);
    const [tabDragging, setTabDragging] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!isOpen || !compact) {
            return;
        }
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [compact, isOpen]);

    const onTabPointerDownCapture = useCallback((event: React.PointerEvent<HTMLElement>) => {
        if (!compact || event.pointerType === "touch" || event.button !== 0) {
            return;
        }
        const scroller = tabScrollerRef.current;
        if (!scroller || scroller.scrollWidth <= scroller.clientWidth) {
            return;
        }
        tabDragMovedRef.current = false;
        tabDragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startScrollLeft: scroller.scrollLeft,
            moved: false,
            capturing: false,
        };
    }, [compact]);

    const onTabPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
        const drag = tabDragRef.current;
        const scroller = tabScrollerRef.current;
        if (!drag || !scroller || drag.pointerId !== event.pointerId) {
            return;
        }
        const dx = event.clientX - drag.startX;
        if (!drag.moved && Math.abs(dx) > TAB_DRAG_THRESHOLD_PX) {
            drag.moved = true;
            tabDragMovedRef.current = true;
            setTabDragging(true);
            if (!drag.capturing) {
                scroller.setPointerCapture(event.pointerId);
                drag.capturing = true;
            }
        }
        if (drag.moved) {
            scroller.scrollLeft = drag.startScrollLeft - dx;
            event.preventDefault();
        }
    }, []);

    const endTabPointerDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
        const drag = tabDragRef.current;
        const scroller = tabScrollerRef.current;
        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }
        const didMove = drag.moved;
        tabDragRef.current = null;
        setTabDragging(false);
        if (scroller?.hasPointerCapture(event.pointerId)) {
            scroller.releasePointerCapture(event.pointerId);
        }
        if (didMove) {
            tabDragMovedRef.current = true;
            window.setTimeout(() => {
                tabDragMovedRef.current = false;
            }, 0);
        } else {
            tabDragMovedRef.current = false;
        }
    }, []);

    const onTabLostPointerCapture = useCallback((event: React.PointerEvent<HTMLElement>) => {
        const drag = tabDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }
        tabDragRef.current = null;
        tabDragMovedRef.current = false;
        setTabDragging(false);
    }, []);

    useEffect(() => {
        if (!compact || !isOpen) {
            return;
        }
        const scroller = tabScrollerRef.current;
        if (!scroller) {
            return;
        }
        const onWheel = (event: WheelEvent) => {
            if (scroller.scrollWidth <= scroller.clientWidth) {
                return;
            }
            if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) {
                return;
            }
            event.preventDefault();
            scroller.scrollLeft += event.deltaY;
        };
        scroller.addEventListener("wheel", onWheel, { passive: false });
        return () => scroller.removeEventListener("wheel", onWheel);
    }, [compact, isOpen, mounted]);

    const selectTab = useCallback((tabId: GroupManagementTabId) => {
        if (tabDragMovedRef.current) {
            return;
        }
        onTabChange(tabId);
    }, [onTabChange]);

    if (!isOpen || !mounted) {
        return null;
    }

    const tabCopy = GROUP_MANAGEMENT_TAB_COPY[activeTab];

    const panel = (
        <div
            className={cn(
                APP_OVERLAY_Z_INDEX_CLASS,
                "fixed inset-0 flex bg-black/50 backdrop-blur-md dark:bg-black/85",
                compact ? "items-stretch p-0" : "items-center justify-center p-3 sm:p-6",
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-management-title"
            data-testid="group-management-shell"
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
                    compact
                        ? "h-[100dvh] max-h-[100dvh] rounded-none"
                        : "h-[min(92vh,880px)] max-w-5xl rounded-2xl",
                )}
                onClick={(event) => event.stopPropagation()}
            >
                <div className={cn(
                    "flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800",
                    compact
                        ? "px-3 py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top,0px))]"
                        : "px-4 py-3 sm:px-5",
                )}>
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
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                        aria-label={t("groups.management.closeSettings")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                    <nav
                        ref={tabScrollerRef}
                        aria-label={t("groups.management.sectionsAria")}
                        data-testid="group-management-tab-scroller"
                        onPointerDownCapture={compact ? onTabPointerDownCapture : undefined}
                        onPointerMove={compact ? onTabPointerMove : undefined}
                        onPointerUp={compact ? endTabPointerDrag : undefined}
                        onPointerCancel={compact ? endTabPointerDrag : undefined}
                        onLostPointerCapture={compact ? onTabLostPointerCapture : undefined}
                        className={cn(
                            "flex shrink-0 gap-1 border-b border-zinc-200 dark:border-zinc-800 sm:w-52 sm:flex-col sm:overflow-y-auto sm:border-b-0 sm:border-r sm:px-2 sm:py-3",
                            compact
                                ? cn(
                                    "mobile-scroll-region cursor-grab touch-pan-x select-none flex-row overflow-x-auto overscroll-x-contain px-2 py-2 active:cursor-grabbing [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                                    tabDragging && "cursor-grabbing [&_*]:pointer-events-none",
                                )
                                : "overflow-x-auto px-2 py-2",
                        )}
                    >
                        {GROUP_MANAGEMENT_TABS.map((tab) => (
                            <NavButton
                                key={tab.id}
                                icon={tab.icon}
                                label={t(tab.labelKey)}
                                isActive={activeTab === tab.id}
                                badge={tab.id === "governance" ? governanceBadgeCount : 0}
                                compact={compact}
                                onClick={() => selectTab(tab.id)}
                            />
                        ))}
                    </nav>

                    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                        <header className={cn(
                            "flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800",
                            compact ? "px-3 py-3" : "px-4 py-4 sm:px-5",
                        )}>
                            <div className="min-w-0">
                                <h2 className="text-base font-semibold text-zinc-900 sm:text-lg dark:text-white">{t(tabCopy.titleKey)}</h2>
                                {!compact ? (
                                    <p className="mt-0.5 text-sm text-zinc-500">{t(tabCopy.descriptionKey)}</p>
                                ) : null}
                            </div>
                            {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
                        </header>

                        <div
                            className={cn(
                                "min-h-0 flex-1 overflow-y-auto overscroll-contain",
                                compact ? "px-3 py-3" : "px-4 py-4 sm:px-6",
                                footer
                                    ? (compact ? "pb-4" : "pb-8")
                                    : (compact ? "pb-3" : "pb-4"),
                            )}
                        >
                            {relayGateNotice ? (
                                <div className="mb-4">{relayGateNotice}</div>
                            ) : null}
                            {children}
                        </div>

                        {footer ? (
                            <footer
                                className={cn(
                                    "shrink-0 border-t border-zinc-200 bg-zinc-50/95 dark:border-zinc-800 dark:bg-zinc-950",
                                    compact
                                        ? "px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
                                        : "px-4 py-3 sm:px-5",
                                )}
                                data-testid="group-management-footer"
                            >
                                {footer}
                            </footer>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(panel, document.body);
}

function NavButton({
    icon: Icon,
    label,
    isActive,
    badge,
    compact,
    onClick,
}: Readonly<{
    icon: LucideIcon;
    label: string;
    isActive: boolean;
    badge: number;
    compact: boolean;
    onClick: () => void;
}>): React.JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors sm:w-full",
                compact ? "py-2.5" : "py-2",
                isActive
                    ? "bg-violet-100 text-violet-900 ring-1 ring-violet-300/80 dark:bg-violet-600/20 dark:text-violet-100 dark:ring-violet-500/40"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200",
            )}
        >
            <Icon className={cn("shrink-0", compact ? "h-5 w-5" : "h-4 w-4")} />
            <span className="whitespace-nowrap">{label}</span>
            {badge > 0 ? (
                <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-950">
                    {badge}
                </span>
            ) : null}
        </button>
    );
}
