"use client";

import React from "react";
import { Bell, Download, Loader2, LogOut, RotateCcw, Share2, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/lib/cn";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";
import { SettingsToggle } from "@/app/settings/settings-tab-panel-shared";
import { mgmtCompactSectionClass, mgmtSectionClass } from "../constants";

function SettingRow({
    icon,
    title,
    description,
    action,
    compact,
    danger,
}: Readonly<{
    icon: React.ReactNode;
    title: string;
    description: string;
    action: React.ReactNode;
    compact: boolean;
    danger?: boolean;
}>): React.JSX.Element {
    if (compact) {
        return (
            <div className={cn(
                "flex items-center justify-between gap-3 px-3 py-3",
                danger ? "text-rose-400" : undefined,
            )}>
                <div className="flex min-w-0 items-center gap-3">
                    <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        danger ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                    )}>
                        {icon}
                    </div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</p>
                </div>
                <div className="shrink-0">{action}</div>
            </div>
        );
    }

    return (
        <div className={`${mgmtSectionClass} flex flex-col gap-4 sm:flex-row sm:items-center`}>
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{title}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
                </div>
            </div>
            <div className="shrink-0">{action}</div>
        </div>
    );
}

export function GroupManagementSettingsPanel({
    notificationsEnabled,
    onToggleNotifications,
    onShareInvite,
    isRotatingKey,
    onRotateKey,
    onExport,
    onLeave,
    onPurge,
    showPurge,
    managedWorkspaceActionsBlocked,
}: Readonly<{
    notificationsEnabled: boolean;
    onToggleNotifications: () => void;
    onShareInvite: () => void;
    isRotatingKey: boolean;
    onRotateKey: () => void;
    onExport: () => void;
    onLeave: () => void;
    onPurge: () => void;
    showPurge: boolean;
    managedWorkspaceActionsBlocked: boolean;
}>): React.JSX.Element {
    const compact = useMobileCompactLayout();

    const rows = (
        <>
            <SettingRow
                compact={compact}
                icon={<Bell className="h-4 w-4" />}
                title="Notifications"
                description="Community activity alerts on this device."
                action={
                    <SettingsToggle
                        checked={notificationsEnabled}
                        onChange={() => onToggleNotifications()}
                    />
                }
            />
            <SettingRow
                compact={compact}
                icon={<Share2 className="h-4 w-4" />}
                title="Invite link"
                description="QR code and link for others to join."
                action={
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className={compact ? "h-8 px-3 text-xs" : undefined}
                        onClick={onShareInvite}
                        disabled={managedWorkspaceActionsBlocked}
                    >
                        Share
                    </Button>
                }
            />
            <SettingRow
                compact={compact}
                icon={<RotateCcw className="h-4 w-4" />}
                title="Rotate room key"
                description="Distribute a new encryption key to active members."
                action={
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className={compact ? "h-8 px-3 text-xs" : undefined}
                        onClick={onRotateKey}
                        disabled={isRotatingKey || managedWorkspaceActionsBlocked}
                    >
                        {isRotatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rotate"}
                    </Button>
                }
            />
            <SettingRow
                compact={compact}
                icon={<Download className="h-4 w-4" />}
                title="Backup"
                description="Download metadata and keys as JSON."
                action={
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className={compact ? "h-8 px-3 text-xs" : undefined}
                        onClick={onExport}
                    >
                        Export
                    </Button>
                }
            />
        </>
    );

    const dangerRows = (
        <>
            <SettingRow
                compact={compact}
                danger
                icon={<LogOut className="h-4 w-4" />}
                title="Leave community"
                description="Remove yourself from this room. If you are the last member, the community disbands."
                action={
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className={compact ? "h-8 px-3 text-xs text-rose-400" : "text-rose-400"}
                        onClick={onLeave}
                    >
                        Leave
                    </Button>
                }
            />
            {showPurge ? (
                <SettingRow
                    compact={compact}
                    danger
                    icon={<Trash2 className="h-4 w-4" />}
                    title="Delete community data"
                    description="Irreversible purge on this device."
                    action={
                        <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            className={compact ? "h-8 px-3 text-xs" : undefined}
                            onClick={onPurge}
                        >
                            Purge
                        </Button>
                    }
                />
            ) : null}
        </>
    );

    if (compact) {
        return (
            <div className="mx-auto max-w-2xl space-y-4">
                <div className={cn(mgmtCompactSectionClass, "divide-y divide-zinc-200 overflow-hidden p-0 dark:divide-zinc-800 dark:bg-zinc-900/80")}>
                    {rows}
                </div>
                <div className="space-y-2">
                    <p className="px-1 text-xs font-medium uppercase tracking-wide text-rose-400">Danger zone</p>
                    <div className={cn(mgmtCompactSectionClass, "divide-y divide-zinc-200 overflow-hidden p-0 dark:divide-zinc-800 dark:bg-zinc-900/80")}>
                        {dangerRows}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div className="space-y-3">{rows}</div>
            <div className="space-y-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
                <p className="text-xs font-medium uppercase tracking-wide text-rose-400">Danger zone</p>
                {dangerRows}
            </div>
        </div>
    );
}
