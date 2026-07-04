"use client";
import React, { useId } from "react";
import { Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@dweb/ui-kit";
import { cn } from "@/app/lib/utils";
import { getDeviceTrustSnapshot } from "@/app/features/auth/services/device-trust-service";
type DeviceTrustControlProps = Readonly<{
    profileId: string;
    checked: boolean;
    onCheckedChange: (trusted: boolean) => void;
    variant?: "compact" | "card";
    idPrefix?: string;
    className?: string;
}>;
export function DeviceTrustControl({ profileId, checked, onCheckedChange, variant = "compact", idPrefix = "device-trust", className, }: DeviceTrustControlProps): React.JSX.Element {
    const { t } = useTranslation();
    const reactId = useId();
    const inputId = `${idPrefix}-${reactId.replace(/:/g, "")}`;
    const snapshot = getDeviceTrustSnapshot(profileId);
    const restoreHint = snapshot.usesNativeSecureStore
        ? t("auth.deviceTrust.subtitle.native")
        : t("auth.deviceTrust.subtitle.web");
    if (variant === "card") {
        return (<div className={cn("rounded-[28px] border border-emerald-500/20 bg-emerald-500/5 p-4 text-left", className)}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15">
            <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden/>
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox id={inputId} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} className="mt-1 h-5 w-5 rounded-lg border-zinc-300 dark:border-zinc-700 data-[state=checked]:bg-emerald-600"/>
              <div className="space-y-1">
                <label htmlFor={inputId} className="cursor-pointer text-sm font-bold text-zinc-800 dark:text-zinc-100">
                  {t("auth.deviceTrust.title")}
                </label>
                <p className="text-xs font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {restoreHint}
                </p>
              </div>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              {checked
                ? t("auth.deviceTrust.status.enabled")
                : t("auth.deviceTrust.status.disabled")}
            </p>
          </div>
        </div>
      </div>);
    }
    return (<div className={cn("space-y-1 px-2", className)}>
      <div className="flex items-start gap-3">
        <Checkbox id={inputId} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} className="mt-0.5 h-5 w-5 rounded-lg border-zinc-300 dark:border-zinc-700 data-[state=checked]:bg-purple-600"/>
        <div className="min-w-0 space-y-1">
          <label htmlFor={inputId} className="cursor-pointer text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            {t("auth.deviceTrust.title")}
          </label>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {restoreHint}
          </p>
        </div>
      </div>
    </div>);
}
