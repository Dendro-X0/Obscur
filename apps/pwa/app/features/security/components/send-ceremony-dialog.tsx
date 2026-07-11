"use client";

import type React from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Send, ShieldCheck, X } from "lucide-react";
import { Button } from "@dweb/ui-kit";
import { IdentityBindingPanel } from "@/app/features/security/components/identity-binding-panel";
import { SecurityLiteracyNote } from "@/app/features/security/components/security-literacy-note";
import type { SendCeremonyViewModel } from "@/app/features/security/services/send-ceremony-gate";

type SendCeremonyDialogProps = Readonly<{
  isOpen: boolean;
  ceremony: SendCeremonyViewModel | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}>;

export function SendCeremonyDialog({
  isOpen,
  ceremony,
  isSubmitting = false,
  onClose,
  onConfirm,
}: SendCeremonyDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (!isOpen || !ceremony) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
      data-testid="send-ceremony-dialog"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-border/70 bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              {t("security.sendCeremony.eyebrow")}
            </p>
            <h2 className="mt-1 text-lg font-black text-foreground">
              {t("security.sendCeremony.title")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("security.sendCeremony.description", {
                sender: ceremony.senderNpubFragment,
                recipient: ceremony.recipientBinding.npubFragment,
              })}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} disabled={isSubmitting}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              {t("security.sendCeremony.sendingAs")}
            </p>
            <p className="mt-1 font-mono text-xs text-foreground">{ceremony.senderNpubFragment}</p>
          </div>

          <IdentityBindingPanel binding={ceremony.recipientBinding} compact showLiteracyNote={false} />

          {ceremony.plaintextPreview ? (
            <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                {t("security.sendCeremony.messagePreview")}
              </p>
              <p className="mt-1 text-sm text-foreground">{ceremony.plaintextPreview}</p>
            </div>
          ) : null}

          <SecurityLiteracyNote compact />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t("security.sendCeremony.cancel")}
            </Button>
            <Button onClick={() => void onConfirm()} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {t("security.sendCeremony.confirm")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
