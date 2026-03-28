"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneIncoming, PhoneOff, PhoneCall, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { UserAvatar } from "@/app/components/user-avatar";

type IncomingVoiceCallToastProps = Readonly<{
  isOpen: boolean;
  inviterDisplayName: string;
  inviterAvatarUrl?: string;
  roomIdHint: string;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss: () => void;
}>;

export function IncomingVoiceCallToast({
  isOpen,
  inviterDisplayName,
  inviterAvatarUrl = "",
  roomIdHint,
  onAccept,
  onDecline,
  onDismiss,
}: IncomingVoiceCallToastProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
          className="pointer-events-auto fixed bottom-5 right-5 z-[90] w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-black/10 bg-white/92 shadow-[0_24px_80px_rgba(2,6,23,0.28)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/88"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_45%),radial-gradient(circle_at_left,rgba(99,102,241,0.16),transparent_40%)]" />
            <div className="relative p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative shrink-0">
                    <UserAvatar
                      username={inviterDisplayName}
                      avatarUrl={inviterAvatarUrl}
                      sizePx={44}
                      className="rounded-2xl border border-emerald-500/35 bg-emerald-500/15"
                    />
                    <span className="pointer-events-none absolute inset-0 rounded-2xl border border-emerald-400/40 animate-ping" />
                    <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/85 text-white shadow-sm dark:text-emerald-50">
                      <PhoneIncoming className="h-3 w-3" />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                      {t("messaging.incomingVoiceCall", "Incoming Voice Call")}
                    </p>
                    <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {inviterDisplayName}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                      {t("messaging.voiceCallRoom", "Room")}: {roomIdHint}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white/70 text-zinc-500 transition-colors hover:text-zinc-800 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:text-zinc-100"
                  aria-label={t("common.close", "Close")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onDecline}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs font-black uppercase tracking-widest text-rose-700 transition-colors hover:bg-rose-500/15 dark:text-rose-300"
                >
                  <PhoneOff className="h-4 w-4" />
                  {t("common.decline", "Decline")}
                </button>
                <button
                  type="button"
                  onClick={onAccept}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-xs font-black uppercase tracking-widest text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-200"
                >
                  <PhoneCall className="h-4 w-4" />
                  {t("common.accept", "Accept")}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
