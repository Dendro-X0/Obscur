"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneIncoming, PhoneOff, PhoneCall, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { UserAvatar } from "@/app/components/user-avatar";
import {
  incomingNotificationActionToneClassNames,
  incomingNotificationCardBodyClassName,
  incomingNotificationCardGlowClassName,
  incomingNotificationCardMotion,
  incomingNotificationCardShellClassName,
} from "./incoming-notification-card-theme";

type IncomingVoiceCallToastProps = Readonly<{
  isOpen: boolean;
  inviterDisplayName: string;
  inviterAvatarUrl?: string;
  roomIdHint: string;
  anchorMode?: "chat" | "page";
  onOpenChat?: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss: () => void;
}>;

const CALL_OVERLAY_RIGHT_OFFSET = "max(1rem, calc(env(safe-area-inset-right) + 0.75rem))";
const CALL_OVERLAY_BOTTOM_OFFSET_CHAT = "max(9rem, calc(env(safe-area-inset-bottom) + 8.5rem))";
const CALL_OVERLAY_BOTTOM_OFFSET_PAGE = "max(1.5rem, calc(env(safe-area-inset-bottom) + 1rem))";

export function IncomingVoiceCallToast({
  isOpen,
  inviterDisplayName,
  inviterAvatarUrl = "",
  roomIdHint: _roomIdHint,
  anchorMode = "page",
  onOpenChat,
  onAccept,
  onDecline,
  onDismiss,
}: IncomingVoiceCallToastProps): React.JSX.Element {
  const { t } = useTranslation();
  const bottomOffset = anchorMode === "chat"
    ? CALL_OVERLAY_BOTTOM_OFFSET_CHAT
    : CALL_OVERLAY_BOTTOM_OFFSET_PAGE;
  const toastNode = (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={incomingNotificationCardMotion.initial}
          animate={incomingNotificationCardMotion.animate}
          exit={incomingNotificationCardMotion.exit}
          transition={incomingNotificationCardMotion.transition}
          className={`pointer-events-auto w-[min(27rem,calc(100vw-1.5rem))] ${incomingNotificationCardShellClassName}`}
          style={{
            position: "fixed",
            bottom: bottomOffset,
            right: CALL_OVERLAY_RIGHT_OFFSET,
            left: "auto",
            zIndex: 2147483000,
          }}
        >
          <div className="relative">
            <div className={incomingNotificationCardGlowClassName} />
            <div className={incomingNotificationCardBodyClassName}>
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
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 text-xs font-black uppercase tracking-widest text-rose-700 transition-colors hover:bg-rose-500/15 dark:border-rose-400/45 dark:text-rose-300"
                >
                  <PhoneOff className="h-4 w-4" />
                  {t("common.decline", "Decline")}
                </button>
                <button
                  type="button"
                  onClick={onAccept}
                  className={[
                    "inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-xs font-black uppercase tracking-widest transition-colors",
                    incomingNotificationActionToneClassNames.positive,
                  ].join(" ")}
                >
                  <PhoneCall className="h-4 w-4" />
                  {t("common.accept", "Accept")}
                </button>
              </div>
              {onOpenChat ? (
                <button
                  type="button"
                  onClick={onOpenChat}
                  className={[
                    "mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border text-[10px] font-black uppercase tracking-[0.14em] transition-colors",
                    incomingNotificationActionToneClassNames.subtle,
                  ].join(" ")}
                >
                  <PhoneCall className="h-4 w-4" />
                  {t("messaging.openCallChat", "Open Chat")}
                </button>
              ) : null}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (typeof document === "undefined") {
    return toastNode;
  }

  return createPortal(toastNode, document.body);
}
