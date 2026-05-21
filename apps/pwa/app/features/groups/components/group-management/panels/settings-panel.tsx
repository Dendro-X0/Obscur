"use client";

import React from "react";
import { Bell, Download, Loader2, LogOut, RotateCcw, Share2, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/lib/cn";
import { mgmtSectionClass } from "../constants";

function SettingRow({
    icon,
    title,
    description,
    action,
}: Readonly<{
    icon: React.ReactNode;
    title: string;
    description: string;
    action: React.ReactNode;
}>): React.JSX.Element {
    return (
        <div className={`${mgmtSectionClass} flex flex-col gap-4 sm:flex-row sm:items-center`}>
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{title}</p>
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
    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div className="space-y-3">
                <SettingRow
                    icon={<Bell className="h-5 w-5" />}
                    title="Notifications"
                    description="Community activity alerts on this device."
                    action={
                        <button
                            type="button"
                            onClick={onToggleNotifications}
                            className={cn(
                                "relative h-7 w-12 rounded-full transition-colors",
                                notificationsEnabled ? "bg-violet-600" : "bg-zinc-700",
                            )}
                            aria-pressed={notificationsEnabled}
                        >
                            <span
                                className={cn(
                                    "absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform",
                                    notificationsEnabled ? "left-5" : "left-0.5",
                                )}
                            />
                        </button>
                    }
                />
                <SettingRow
                    icon={<Share2 className="h-5 w-5" />}
                    title="Invite link"
                    description="QR code and link for others to join."
                    action={
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={onShareInvite}
                            disabled={managedWorkspaceActionsBlocked}
                        >
                            Share
                        </Button>
                    }
                />
                <SettingRow
                    icon={<RotateCcw className="h-5 w-5" />}
                    title="Rotate room key"
                    description="Distribute a new encryption key to active members."
                    action={
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={onRotateKey}
                            disabled={isRotatingKey || managedWorkspaceActionsBlocked}
                        >
                            {isRotatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rotate"}
                        </Button>
                    }
                />
                <SettingRow
                    icon={<Download className="h-5 w-5" />}
                    title="Backup"
                    description="Download metadata and keys as JSON."
                    action={
                        <Button type="button" variant="secondary" size="sm" onClick={onExport}>
                            Export
                        </Button>
                    }
                />
            </div>

            <div className="space-y-3 border-t border-zinc-800 pt-5">
                <p className="text-xs font-medium uppercase tracking-wide text-rose-400">Danger zone</p>
                <SettingRow
                    icon={<LogOut className="h-5 w-5 text-rose-400" />}
                    title="Leave community"
                    description="Remove yourself from this room. If you are the last member, the community disbands."
                    action={
                        <Button type="button" variant="secondary" size="sm" onClick={onLeave} className="text-rose-400">
                            Leave
                        </Button>
                    }
                />
                {showPurge ? (
                    <SettingRow
                        icon={<Trash2 className="h-5 w-5 text-rose-400" />}
                        title="Delete community data"
                        description="Irreversible purge on this device."
                        action={
                            <Button type="button" variant="danger" size="sm" onClick={onPurge}>
                                Purge
                            </Button>
                        }
                    />
                ) : null}
            </div>
        </div>
    );
}
