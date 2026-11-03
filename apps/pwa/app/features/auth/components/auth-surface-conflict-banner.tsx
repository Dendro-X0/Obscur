"use client";

import type React from "react";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@dweb/ui-kit/button";
import { cn } from "@/app/lib/utils";
import type { AuthSurfaceConflict } from "@/app/features/auth/services/resolve-auth-surface-conflict";

const toneClasses: Readonly<Record<AuthSurfaceConflict["tone"], string>> = {
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  orange: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-200",
  rose: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200",
  red: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-200",
};

const titleToneClasses: Readonly<Record<AuthSurfaceConflict["tone"], string>> = {
  amber: "text-amber-600 dark:text-amber-400",
  orange: "text-orange-600 dark:text-orange-400",
  rose: "text-rose-600 dark:text-rose-400",
  red: "text-red-600 dark:text-red-400",
};

type Props = Readonly<{
  conflict: AuthSurfaceConflict;
  actions?: React.ReactNode;
  className?: string;
  /** Quiet status chip — title + one short line; hide hint essays. */
  compact?: boolean;
}>;

export function AuthSurfaceConflictBanner(props: Props): React.JSX.Element {
  const { t } = useTranslation();
  const compact = props.compact === true;
  const body = props.conflict.detailMessage?.trim()
    ? props.conflict.detailMessage
    : t(props.conflict.bodyKey);

  return (
    <div
      role="alert"
      aria-label={t(props.conflict.ariaLabelKey)}
      className={cn(
        "rounded-2xl border",
        compact ? "mb-4 px-3.5 py-2.5" : "mb-6 rounded-[28px] p-5",
        toneClasses[props.conflict.tone],
        props.className,
      )}
    >
      <div className={cn("flex items-start", compact ? "gap-2.5" : "gap-4")}>
        <AlertCircle className={cn(
          "shrink-0",
          compact ? "mt-0.5 h-4 w-4" : "mt-0.5 h-5 w-5",
          titleToneClasses[props.conflict.tone],
        )} />
        <div className={cn("min-w-0 flex-1", compact ? "space-y-0.5" : "space-y-3")}>
          <div>
            <p className={cn(
              "font-black uppercase tracking-[0.16em]",
              compact ? "text-[11px]" : "text-sm",
              titleToneClasses[props.conflict.tone],
            )}>
              {t(props.conflict.titleKey)}
            </p>
            <p className={cn(
              "font-medium leading-snug",
              compact ? "mt-0.5 text-xs opacity-90" : "mt-2 text-sm leading-relaxed",
            )}>
              {body}
            </p>
          </div>
          {!compact && props.conflict.hintKey ? (
            <p className="text-xs font-semibold opacity-80">
              {t(props.conflict.hintKey)}
            </p>
          ) : null}
          {props.actions}
        </div>
      </div>
    </div>
  );
}

type NativeMismatchActionsProps = Readonly<{
  onResetSecureStorage: () => void;
  disabled?: boolean;
}>;

export function AuthNativeMismatchBannerActions(props: NativeMismatchActionsProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={props.onResetSecureStorage}
        disabled={props.disabled}
        className="rounded-2xl border-amber-500/30 bg-white/70 text-amber-700 hover:bg-white dark:bg-zinc-950/30 dark:text-amber-300"
      >
        {t("auth.resetSecureStorage")}
      </Button>
    </div>
  );
}
