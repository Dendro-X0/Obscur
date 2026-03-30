"use client";

import React, { useEffect, useState } from "react";
import {
  Button,
  Input,
  Textarea,
} from "@dweb/ui-kit";
import { AlertTriangle, Loader2, Send, Shield, WifiOff, X } from "lucide-react";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import {
  getRelayReadinessBannerCopy,
  getRelayReadinessTone,
  getRelaySendBlockCopy,
} from "@/app/features/relays/services/relay-readiness-copy";
import {
  DEFAULT_INVITATION_INTRO,
  type InvitationComposerValues,
} from "@/app/features/messaging/services/invitation-composer";

type InvitationComposerDialogProps = Readonly<{
  isOpen: boolean;
  recipientName: string;
  recipientPubkey: string;
  submitLabel?: string;
  deliveryHint?: string;
  defaults?: Partial<InvitationComposerValues>;
  onClose: () => void;
  onSubmit: (values: InvitationComposerValues) => Promise<boolean> | boolean;
}>;

export function InvitationComposerDialog({
  isOpen,
  recipientName,
  recipientPubkey,
  submitLabel = "Send Invitation",
  deliveryHint = "Obscur only shows success after relay evidence comes back.",
  defaults,
  onClose,
  onSubmit,
}: InvitationComposerDialogProps) {
  const { relayRecovery } = useRelay();
  const [intro, setIntro] = useState(DEFAULT_INVITATION_INTRO);
  const [note, setNote] = useState("");
  const [secretCode, setSecretCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const relayBanner = getRelayReadinessBannerCopy(relayRecovery);
  const relayBlockMessage = getRelaySendBlockCopy(relayRecovery);
  const submitButtonLabel = relayRecovery.writableRelayCount > 0
    ? submitLabel
    : "Queue Invitation";

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setIntro(defaults?.intro?.trim() ? defaults.intro : DEFAULT_INVITATION_INTRO);
    setNote(defaults?.note ?? "");
    setSecretCode(defaults?.secretCode ?? "");
  }, [defaults?.intro, defaults?.note, defaults?.secretCode, isOpen, recipientPubkey]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const shouldClose = await onSubmit({
        intro,
        note,
        secretCode,
      });
      if (shouldClose) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm dark:bg-black/60"
      onClick={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-slate-200/80 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.98))] text-slate-900 shadow-[0_30px_80px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-[#040816] dark:text-white dark:shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200/80 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.18),_transparent_62%),linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.96))] px-6 py-6 dark:border-white/10 dark:bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.28),_transparent_56%),linear-gradient(180deg,rgba(10,18,46,0.95),rgba(4,8,22,0.98))]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex w-fit items-center rounded-full border border-indigo-200/80 bg-indigo-50/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                Invitation Composer
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Invite {recipientName}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Write a message that explains who you are and why you are reaching out. The recipient will see this before deciding whether to connect.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/5 dark:hover:text-white"
              onClick={onClose}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200/90 bg-white/85 px-4 py-3 dark:border-white/10 dark:bg-black/20">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Recipient</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{recipientName}</p>
            <p className="mt-1 break-all font-mono text-[11px] text-slate-600 dark:text-slate-400">{recipientPubkey}</p>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">Why you are reaching out</p>
            <Textarea
              value={intro}
              onChange={(event) => setIntro(event.target.value)}
              rows={4}
              maxLength={280}
              placeholder={DEFAULT_INVITATION_INTRO}
              className="resize-none rounded-2xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500"
            />
            <div className="flex justify-end text-[11px] text-slate-500 dark:text-slate-400">{intro.length}/280</div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">How they know you</p>
              <Input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={120}
                placeholder="Designer from the Oslo meetup, teammate, artist friend..."
                className="rounded-2xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">Shared phrase or code</p>
              <Input
                value={secretCode}
                onChange={(event) => setSecretCode(event.target.value)}
                maxLength={64}
                placeholder="Optional shared phrase"
                className="rounded-2xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{deliveryHint}</p>
            </div>
          </div>

          {relayBanner ? (
            <div className={`rounded-2xl border px-4 py-3 text-sm ${getRelayReadinessTone(relayRecovery.readiness)}`}>
              <div className="flex items-start gap-3">
                {relayRecovery.readiness === "offline" ? (
                  <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <p>{relayBlockMessage ?? relayBanner}</p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-[0_12px_40px_rgba(99,102,241,0.35)] hover:from-indigo-400 hover:to-violet-400"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {submitButtonLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
