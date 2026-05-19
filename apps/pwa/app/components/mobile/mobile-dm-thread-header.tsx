"use client";

import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Conversation } from "@/app/features/messaging/types";

type MobileDmThreadHeaderProps = Readonly<{
  conversation: Conversation;
  onBack: () => void;
}>;

const resolveConversationTitle = (conversation: Conversation): string => {
  if (conversation.kind === "group") {
    return conversation.displayName?.trim() || conversation.groupId || "Community";
  }
  return conversation.displayName?.trim() || "Direct message";
};

export function MobileDmThreadHeader({ conversation, onBack }: MobileDmThreadHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-black/10 bg-gradient-sidebar/90 px-2 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur dark:border-white/10">
      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-gradient-card text-zinc-700 dark:border-white/10 dark:text-zinc-200"
        onClick={onBack}
        aria-label={t("common.back", "Back")}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {resolveConversationTitle(conversation)}
        </div>
      </div>
    </header>
  );
}
