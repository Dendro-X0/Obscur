"use client";

import React from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { Button } from "@dweb/ui-kit";
import { cn } from "@/app/lib/utils";
import { useTranslation } from "react-i18next";
import type { AuthAssistantEntry } from "@dweb/auth";

type AuthAssistantPanelProps = Readonly<{
  entry: AuthAssistantEntry;
  isBusy: boolean;
  onUnlock: () => void;
  className?: string;
}>;

export function AuthAssistantPanel(props: AuthAssistantPanelProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className={cn("rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3", props.className)}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600/15 text-purple-600 dark:text-purple-300">
          <Fingerprint className="h-5 w-5" />
        </div>
        <div className="min-w-0 text-left">
          <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
            {t("auth.assistant.savedLabel")}
          </p>
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {props.entry.label}
          </p>
        </div>
      </div>
      <Button
        type="button"
        disabled={props.isBusy}
        onClick={props.onUnlock}
        className="h-11 w-full rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold"
      >
        {props.isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          t("auth.assistant.tapUnlock")
        )}
      </Button>
    </div>
  );
}
