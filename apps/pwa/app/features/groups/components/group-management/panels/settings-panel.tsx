"use client";

import React from "react";
import { Bell, Download, Loader2, LogOut, RotateCcw, Share2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
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
    const { t } = useTranslation();

    const rows = (
        <>
            <SettingRow
                compact={compact}
                icon={<Bell className="h-4 w-4" />}
                title={t("groups.management.safety.notificationsTitle")}
                description={t("groups.management.safety.notificationsDesc")}
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
                title={t("groups.management.safety.inviteTitle")}
                description={t("groups.management.safety.inviteDesc")}
                action={
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className={compact ? "h-8 px-3 text-xs" : undefined}
                        onClick={onShareInvite}
                        disabled={managedWorkspaceActionsBlocked}
                    >
                        {t("groups.management.safety.share")}
                    </Button>
                }
            />
            <SettingRow
                compact={compact}
                icon={<RotateCcw className="h-4 w-4" />}
                title={t("groups.management.safety.rotateTitle")}
                description={t("groups.management.safety.rotateDesc")}
                action={
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className={compact ? "h-8 px-3 text-xs" : undefined}
                        onClick={onRotateKey}
                        disabled={isRotatingKey || managedWorkspaceActionsBlocked}
                    >
                        {isRotatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : t("groups.management.safety.rotate")}
                    </Button>
                }
            />
            <SettingRow
                compact={compact}
                icon={<Download className="h-4 w-4" />}
                title={t("groups.management.safety.backupTitle")}
                description={t("groups.management.safety.backupDesc")}
                action={
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className={compact ? "h-8 px-3 text-xs" : undefined}
                        onClick={onExport}
                    >
                        {t("groups.management.safety.export")}
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
                title={t("groups.management.safety.leaveTitle")}
                description={t("groups.management.safety.leaveDesc")}
                action={
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className={compact ? "h-8 px-3 text-xs text-rose-400" : "text-rose-400"}
                        onClick={onLeave}
                    >
                        {t("groups.management.safety.leave")}
                    </Button>
                }
            />
            {showPurge ? (
                <SettingRow
                    compact={compact}
                    danger
                    icon={<Trash2 className="h-4 w-4" />}
                    title={t("groups.management.safety.purgeTitle")}
                    description={t("groups.management.safety.purgeDesc")}
                    action={
                        <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            className={compact ? "h-8 px-3 text-xs" : undefined}
                            onClick={onPurge}
                        >
                            {t("groups.management.safety.purge")}
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
                    <p className="px-1 text-xs font-medium uppercase tracking-wide text-rose-400">{t("groups.management.safety.dangerZone")}</p>
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
                <p className="text-xs font-medium uppercase tracking-wide text-rose-400">{t("groups.management.safety.dangerZone")}</p>
                {dangerRows}
            </div>
        </div>
    );
}
