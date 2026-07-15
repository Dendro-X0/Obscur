"use client";

import type React from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { Button } from "@dweb/ui-kit";
import { IdentityBindingPanel } from "@/app/features/security/components/identity-binding-panel";
import type { IdentityBindingViewModel } from "@/app/features/security/services/identity-binding-presenter";
import type { DmTrustAssessment } from "@/app/features/dm-kernel/dm-kernel-trust-assessment-port";
import { shouldJunkIncomingRequestAssessment } from "@/app/features/dm-kernel/dm-kernel-trust-action-gate";

type IdentityBindingAcceptDialogProps = Readonly<{
  isOpen: boolean;
  binding: IdentityBindingViewModel | null;
  title?: string;
  confirmLabel?: string;
  trustAssessment?: DmTrustAssessment | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}>;

export function IdentityBindingAcceptDialog({
  isOpen,
  binding,
  title,
  confirmLabel,
  trustAssessment = null,
  isSubmitting = false,
  onClose,
  onConfirm,
}: IdentityBindingAcceptDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (!isOpen || !binding) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-border/70 bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        data-testid="identity-binding-accept-dialog"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              {t("security.identityBinding.accept.eyebrow")}
            </p>
            <h2 className="mt-1 text-lg font-black text-foreground">
              {title ?? t("security.identityBinding.accept.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("security.identityBinding.accept.description")}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} disabled={isSubmitting}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {trustAssessment && shouldJunkIncomingRequestAssessment(trustAssessment) ? (
            <div
              className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
              data-testid="identity-binding-trust-warning"
              role="status"
            >
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                {t("messaging.trust.bannerTitle")}
              </p>
              <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
                {t(trustAssessment.copyKey)}
              </p>
            </div>
          ) : null}
          <IdentityBindingPanel binding={binding} compact showLiteracyNote />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t("security.identityBinding.accept.cancel")}
            </Button>
            <Button onClick={() => void onConfirm()} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              {confirmLabel ?? t("security.identityBinding.accept.confirm")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
