"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/app/lib/cn";
import {
  listWorkspaceKernelBackupRestoreDeferredScope,
  listWorkspaceKernelBackupRestoreIncludedScope,
} from "@/app/features/workspace-kernel/workspace-kernel-backup-restore-scope";
import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";

export function WorkspaceKernelBackupRestoreScopeNotice(props: Readonly<{
  className?: string;
  compact?: boolean;
}>): React.JSX.Element | null {
  const { t } = useTranslation();
  if (!isWorkspaceKernelAuthority()) {
    return null;
  }

  const included = listWorkspaceKernelBackupRestoreIncludedScope();
  const deferred = listWorkspaceKernelBackupRestoreDeferredScope();

  if (props.compact) {
    return (
      <p
        className={cn(
          "rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400",
          props.className,
        )}
        role="status"
        data-testid="workspace-kernel-backup-restore-scope-notice"
      >
        {t("settings.accountSync.workspaceBackupScope.summary", "Workspace backup includes room list and message history on this device. Membership rosters re-sync from coordination when online.")}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-sm text-violet-100",
        props.className,
      )}
      role="status"
      data-testid="workspace-kernel-backup-restore-scope-notice"
    >
      <p className="font-semibold text-violet-50">
        {t("settings.accountSync.workspaceBackupScope.title", "Managed workspace backup scope")}
      </p>
      <ul className="mt-2 space-y-1 text-xs text-violet-100/90">
        {included.map((item) => (
          <li key={item.id}>
            {t(item.userCopyKey, item.id)}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs font-medium text-violet-50/90">
        {t("settings.accountSync.workspaceBackupScope.deferredHeading", "Re-synced after restore (not in backup payload):")}
      </p>
      <ul className="mt-1 space-y-1 text-xs text-violet-100/90">
        {deferred.map((item) => (
          <li key={item.id}>
            {t(item.userCopyKey, item.id)}
          </li>
        ))}
      </ul>
    </div>
  );
}
