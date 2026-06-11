"use client";

import React from "react";
import { Bot, PauseCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CommunityBotTriggerSummary } from "../../services/community-bot-triggers-policy";

export function CommunityBotPausedBanner(props: Readonly<{
  summary: CommunityBotTriggerSummary;
}>): React.JSX.Element | null {
  const { t } = useTranslation();
  if (!props.summary.shouldShowPausedNotice) {
    return null;
  }

  const { registeredBotCount, pausedBotCount, unconfiguredBotCount } = props.summary;

  return (
    <div
      className="z-10 border-b border-sky-500/25 bg-gradient-to-r from-sky-500/10 via-sky-600/10 to-sky-500/10 px-4 py-3 backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-4xl items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300">
          <PauseCircle className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold leading-tight text-sky-950 dark:text-sky-100">
            {t("groups.bot.pausedBannerTitle")}
          </p>
          <p className="text-xs text-sky-900/80 dark:text-sky-200/80">
            {t("groups.bot.pausedBannerBody", {
              count: registeredBotCount,
              paused: pausedBotCount,
              unconfigured: unconfiguredBotCount,
            })}
          </p>
          <p className="text-[11px] text-sky-900/65 dark:text-sky-200/65">
            {t("groups.bot.pausedBannerHint")}
          </p>
        </div>
        <Bot className="mt-0.5 h-4 w-4 shrink-0 text-sky-700/50 dark:text-sky-300/50" aria-hidden />
      </div>
    </div>
  );
}
