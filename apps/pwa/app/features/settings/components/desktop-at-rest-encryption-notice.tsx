"use client";
import type React from "react";
import { HardDrive, Shield } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { useTranslation } from "react-i18next";
import { resolveAtRestEncryptionUiPolicy } from "@/app/features/settings/services/storage-at-rest-ui-policy";
type DesktopAtRestEncryptionNoticeProps = Readonly<{
    variant?: "inline" | "card" | "lock";
    className?: string;
}>;
export function DesktopAtRestEncryptionNotice({ variant = "inline", className, }: DesktopAtRestEncryptionNoticeProps): React.JSX.Element | null {
    const { t } = useTranslation();
    const policy = resolveAtRestEncryptionUiPolicy();
    if (!policy.desktopAtRestEncryptionActive) {
        return null;
    }
    const message = t("settings.security.encryption.desktopActive.notice");
    if (variant === "inline") {
        return (<p className={cn("text-[11px] text-emerald-600/90 dark:text-emerald-400/90 leading-relaxed", className)}>
        {message}
      </p>);
    }
    if (variant === "lock") {
        return (<div className={cn("flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-left", className)}>
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"/>
        <p className="text-xs font-medium leading-relaxed text-emerald-800/90 dark:text-emerald-200/90">{message}</p>
      </div>);
    }
    return (<div className={cn("rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4", className)}>
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2">
          <HardDrive className="h-4 w-4 text-emerald-600 dark:text-emerald-400"/>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            {t("settings.security.encryption.desktopActive.title")}
          </div>
          <p className="text-xs leading-relaxed text-emerald-800/80 dark:text-emerald-200/80">{message}</p>
        </div>
      </div>
    </div>);
}
