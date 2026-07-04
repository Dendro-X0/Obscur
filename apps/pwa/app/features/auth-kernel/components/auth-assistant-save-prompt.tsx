"use client";

import React from "react";
import { Button } from "@dweb/ui-kit";
import { useTranslation } from "react-i18next";

type AuthAssistantSavePromptProps = Readonly<{
  isBusy: boolean;
  onSave: () => void;
  onDismiss: () => void;
}>;

export function AuthAssistantSavePrompt(props: AuthAssistantSavePromptProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
      <div className="space-y-1 text-left">
        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          {t("auth.assistant.savePromptTitle")}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {t("auth.assistant.savePromptDescription")}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={props.isBusy}
          onClick={props.onSave}
          className="h-10 flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
        >
          {t("auth.assistant.save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={props.isBusy}
          onClick={props.onDismiss}
          className="h-10 flex-1 rounded-xl"
        >
          {t("auth.assistant.dismiss")}
        </Button>
      </div>
    </div>
  );
}
