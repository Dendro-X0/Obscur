"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, X } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { DM_LOCAL_VISIBILITY_COPY } from "../config/dm-local-visibility-product";
import type { Message } from "../types";
import { formatTime } from "../utils/formatting";

export type DmHiddenMessagesPanelProps = Readonly<{
  hiddenMessages: ReadonlyArray<Message>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onShowAgain: (message: Message) => void | Promise<void>;
  onShowAllAgain: () => void | Promise<void>;
  isRestoring?: boolean;
}>;

export function DmHiddenMessagesPanel({
  hiddenMessages,
  isOpen,
  onOpenChange,
  onShowAgain,
  onShowAllAgain,
  isRestoring = false,
}: DmHiddenMessagesPanelProps) {
  const { t } = useTranslation();
  const [nowMs] = useState(() => Date.now());
  const count = hiddenMessages.length;

  if (count === 0) {
    return null;
  }

  return (
    <div className="mx-4 mt-2">
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/90 px-3 py-2 text-left text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:bg-zinc-800"
        aria-expanded={isOpen}
      >
        <span className="inline-flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 opacity-70" />
          {t(
            "messaging.hiddenOnThisDeviceCount",
            DM_LOCAL_VISIBILITY_COPY.hiddenOnThisDeviceCount,
            { count },
          )}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {isOpen ? t("common.hide", "Hide") : t("common.show", "Show")}
        </span>
      </button>

      {isOpen ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-2 border-b border-black/5 px-3 py-2 dark:border-white/10">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {t(
                "messaging.hiddenOnThisDeviceHelp",
                "These messages are hidden on this device only.",
              )}
            </p>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label={t("common.close", "Close")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto p-2">
            <button
              type="button"
              disabled={isRestoring}
              onClick={() => void onShowAllAgain()}
              className="mb-2 w-full rounded-lg border border-black/10 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {t("messaging.showAllAgainOnThisDevice", "Show all again on this device")}
            </button>
            <ul className="space-y-1">
              {hiddenMessages.map((message) => {
                const preview = message.content.trim() || t("messaging.attachmentOnly", "Attachment");
                return (
                  <li
                    key={message.id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/80"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-zinc-800 dark:text-zinc-100">{preview}</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {formatTime(message.timestamp, nowMs)}
                        {message.isOutgoing
                          ? ` · ${t("messaging.outgoingShort", "You")}`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isRestoring}
                      onClick={() => void onShowAgain(message)}
                      className={cn(
                        "shrink-0 rounded-lg border border-black/10 px-2 py-1 text-[10px] font-semibold",
                        "text-zinc-700 hover:bg-zinc-100 disabled:opacity-50",
                        "dark:border-white/10 dark:text-zinc-200 dark:hover:bg-zinc-800",
                      )}
                    >
                      {t(
                        "messaging.showAgainOnThisDevice",
                        DM_LOCAL_VISIBILITY_COPY.showAgainOnThisDevice,
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
