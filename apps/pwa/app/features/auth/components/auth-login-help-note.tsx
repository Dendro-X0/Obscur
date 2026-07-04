"use client";
import type React from "react";
import { Info } from "lucide-react";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import {
  isDesktopOsSessionRestoreAvailable,
  SESSION_CREDENTIAL_PERSISTENCE_ENABLED,
} from "@/app/features/auth/services/session-credential-policy";
import { useTranslation } from "react-i18next";

export const shouldShowAuthLoginHelpNote = (): boolean => (
  hasNativeRuntime() || SESSION_CREDENTIAL_PERSISTENCE_ENABLED
);

export function AuthLoginHelpNote(): React.JSX.Element | null {
    const { t } = useTranslation();
    if (!shouldShowAuthLoginHelpNote()) {
        return null;
    }
    const title = hasNativeRuntime()
        ? t("auth.loginHelp.nativeTitle")
        : t("auth.loginHelp.webTitle");
    const body = hasNativeRuntime()
        ? (isDesktopOsSessionRestoreAvailable()
            ? t("auth.loginHelp.nativeBody")
            : t("auth.loginHelp.nativeBodyManualDesktop"))
        : t("auth.loginHelp.webBody");
    return (<div className="rounded-2xl border border-black/5 bg-white/40 px-4 py-3 dark:border-white/10 dark:bg-zinc-900/30">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden/>
        <div className="space-y-1">
          <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</div>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{body}</p>
        </div>
      </div>
    </div>);
}
