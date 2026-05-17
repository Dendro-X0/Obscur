"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, MessageSquareReply, CheckCheck, X } from "lucide-react";
import { UserAvatar } from "@/app/components/user-avatar";
import {
  incomingNotificationActionToneClassNames,
  incomingNotificationBadgeToneClassNames,
  incomingNotificationCardBodyClassName,
  incomingNotificationCardGlowClassName,
  incomingNotificationCardMotion,
  incomingNotificationCardShellClassName,
  incomingNotificationSubtleMetaClassName,
} from "./incoming-notification-card-theme";

type IncomingMessageBadgeTone = "neutral" | "positive" | "info" | "warning" | "muted";

type IncomingMessageBadge = Readonly<{
  label: string;
  tone: IncomingMessageBadgeTone;
}>;

export type IncomingMessageToastItem = Readonly<{
  id: string;
  senderDisplayName: string;
  senderAvatarUrl?: string;
  preview: string;
  contextLabel?: string;
  timestampLabel?: string;
  badges?: ReadonlyArray<IncomingMessageBadge>;
}>;

type IncomingMessageToastStackProps = Readonly<{
  items: ReadonlyArray<IncomingMessageToastItem>;
  onOpen: (id: string) => void;
  onReply: (id: string) => void;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}>;

const DEFAULT_MESSAGE_BADGES: ReadonlyArray<IncomingMessageBadge> = [
  { label: "New", tone: "info" },
  { label: "Encrypted", tone: "positive" },
];

export function IncomingMessageToastStack({
  items,
  onOpen,
  onReply,
  onMarkRead,
  onDismiss,
}: IncomingMessageToastStackProps): React.JSX.Element {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[85] flex w-[min(29rem,calc(100vw-1.5rem))] flex-col gap-2.5 sm:bottom-5 sm:right-5 sm:gap-3">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={incomingNotificationCardMotion.initial}
            animate={incomingNotificationCardMotion.animate}
            exit={incomingNotificationCardMotion.exit}
            transition={incomingNotificationCardMotion.transition}
            className={incomingNotificationCardShellClassName}
          >
            <div className={incomingNotificationCardGlowClassName} />
            <div className={incomingNotificationCardBodyClassName}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative shrink-0">
                    <UserAvatar
                      username={item.senderDisplayName}
                      avatarUrl={item.senderAvatarUrl || ""}
                      sizePx={38}
                      className="rounded-xl border border-cyan-500/35 bg-cyan-500/12"
                    />
                    <span className="absolute -bottom-1 -right-1 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-cyan-500/45 bg-cyan-500/85 text-white">
                      <MessageCircle className="h-2.5 w-2.5" />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
                      New Message
                    </p>
                    <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {item.senderDisplayName}
                    </p>
                    <p className={incomingNotificationSubtleMetaClassName}>
                      {[item.contextLabel || "Direct message", item.timestampLabel || "Just now"].join(" • ")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDismiss(item.id)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-black/10 bg-white/70 text-zinc-500 transition-colors hover:text-zinc-800 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:text-zinc-100"
                  aria-label="Dismiss message notification"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="w-full rounded-2xl border border-black/10 bg-white/55 px-3 py-3 text-left transition-colors hover:bg-white/80 dark:border-white/10 dark:bg-zinc-900/55 dark:hover:bg-zinc-900/80"
              >
                <p className="line-clamp-3 text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {item.preview}
                </p>
              </button>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {(item.badges && item.badges.length > 0 ? item.badges : DEFAULT_MESSAGE_BADGES).map((badge) => (
                  <span
                    key={`${item.id}-${badge.label}`}
                    className={[
                      "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
                      incomingNotificationBadgeToneClassNames[badge.tone],
                    ].join(" ")}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onReply(item.id)}
                  className={[
                    "inline-flex h-9 items-center justify-center gap-1 rounded-lg border px-2 text-[10px] font-black uppercase tracking-[0.12em] transition-colors",
                    incomingNotificationActionToneClassNames.subtle,
                  ].join(" ")}
                >
                  <MessageSquareReply className="h-3.5 w-3.5" />
                  Reply
                </button>
                <button
                  type="button"
                  onClick={() => onMarkRead(item.id)}
                  className={[
                    "inline-flex h-9 items-center justify-center gap-1 rounded-lg border px-2 text-[10px] font-black uppercase tracking-[0.12em] transition-colors",
                    incomingNotificationActionToneClassNames.info,
                  ].join(" ")}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark read
                </button>
              </div>
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={() => onOpen(item.id)}
                  className={[
                    "inline-flex h-10 w-full items-center justify-center rounded-xl border px-3 text-[10px] font-black uppercase tracking-[0.14em] transition-colors",
                    incomingNotificationActionToneClassNames.positive,
                  ].join(" ")}
                >
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                  Open Chat
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
