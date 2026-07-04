"use client";
import React from "react";
import { Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/app/lib/utils";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { isMobileShellProduct } from "@/app/features/runtime/shell-contract";
import {
  NATIVE_SECURE_SESSION_RESTORE_ENABLED,
  SESSION_CREDENTIAL_PERSISTENCE_ENABLED,
} from "@/app/features/auth/services/session-credential-policy";
type AuthSessionPolicyNoticeProps = Readonly<{
    variant?: "compact" | "card";
    className?: string;
}>;
export function AuthSessionPolicyNotice({ variant = "compact", className, }: AuthSessionPolicyNoticeProps): React.JSX.Element {
    const { t } = useTranslation();
    const isNative = hasNativeRuntime();
    const isMobileShellBrowser = isMobileShellProduct() && !isNative && SESSION_CREDENTIAL_PERSISTENCE_ENABLED;
    const isNativeRestoreProduct = isNative && NATIVE_SECURE_SESSION_RESTORE_ENABLED;
    const title = isNativeRestoreProduct
        ? t("auth.sessionPolicy.nativeTitle")
        : isMobileShellBrowser
            ? t("auth.sessionPolicy.mobileShellTitle")
            : t("auth.sessionPolicy.title");
    const body = isNativeRestoreProduct
        ? t("auth.sessionPolicy.nativeBody")
        : isMobileShellBrowser
            ? t("auth.sessionPolicy.mobileShellBody")
            : t("auth.sessionPolicy.body");
    const shortCopy = isNativeRestoreProduct
        ? t("auth.sessionPolicy.nativeShort")
        : isMobileShellBrowser
            ? t("auth.sessionPolicy.mobileShellShort")
            : t("auth.sessionPolicy.short");
    if (variant === "card") {
        return (<div className={cn("rounded-[28px] border border-zinc-500/20 bg-zinc-500/5 p-4 text-left", className)}>
        <PolicyCardBody title={title} body={body}/>
      </div>);
    }
    return (<p className={cn("px-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400", className)}>
      <span className="font-semibold text-zinc-600 dark:text-zinc-300">
        {title}
      </span>
      {" — "}
      {shortCopy}
    </p>);
}
function PolicyCardBody(props: Readonly<{
    title: string;
    body: string;
}>): React.JSX.Element {
    return (<div className="flex items-start gap-3">
      <Shield className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" aria-hidden/>
      <div className="space-y-1">
        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{props.title}</p>
        <p className="text-xs font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">{props.body}</p>
      </div>
    </div>);
}
