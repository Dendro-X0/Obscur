"use client";

import type React from "react";
import { Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/app/lib/utils";

type SecurityLiteracyNoteProps = Readonly<{
  className?: string;
  compact?: boolean;
}>;

export function SecurityLiteracyNote({ className, compact = false }: SecurityLiteracyNoteProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 dark:border-emerald-400/20 dark:bg-emerald-500/10",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <div className="space-y-1">
          <div className={cn("font-semibold text-emerald-800 dark:text-emerald-200", compact ? "text-xs" : "text-sm")}>
            {t("security.literacy.title")}
          </div>
          <p className={cn("leading-relaxed text-emerald-700/90 dark:text-emerald-300/90", compact ? "text-[11px]" : "text-xs")}>
            {t("security.literacy.neverAskForSecrets")}
          </p>
        </div>
      </div>
    </div>
  );
}
