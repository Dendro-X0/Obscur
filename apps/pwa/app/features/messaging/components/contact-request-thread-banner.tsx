"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Clock3, Loader2, ShieldAlert, X } from "lucide-react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/lib/utils";
import {
  buildIdentityBindingViewModel,
  IdentityBindingAcceptDialog,
  IdentityBindingPanel,
} from "@/app/features/security";
import { assessIncomingRequestPreview } from "@/app/features/dm-kernel/dm-kernel-trust-action-gate";
import { getPeerFirstSeenAtUnixMs } from "@/app/features/dm-kernel/dm-kernel-trust-peer-state";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

type ContactRequestThreadBannerProps = Readonly<{
  displayName: string;
  peerPublicKeyHex: PublicKeyHex;
  isInitiator: boolean;
  resendEligible?: boolean;
  requestEventId?: string;
  requestPreviewContent?: string;
  requestPreviewTimestampUnixMs?: number;
  onAcceptConfirm: () => void | Promise<void>;
  onDecline: () => void | Promise<void>;
  onCancelOutgoing?: () => void | Promise<void>;
  onResendRequest?: () => void | Promise<void>;
}>;

export function ContactRequestThreadBanner({
  displayName,
  peerPublicKeyHex,
  isInitiator,
  resendEligible = false,
  requestEventId: _requestEventId,
  requestPreviewContent,
  requestPreviewTimestampUnixMs,
  onAcceptConfirm,
  onDecline,
  onCancelOutgoing,
  onResendRequest,
}: ContactRequestThreadBannerProps): React.JSX.Element {
  const { t } = useTranslation();
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [identityExpanded, setIdentityExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const binding = buildIdentityBindingViewModel({
    publicKeyHex: peerPublicKeyHex,
    resolverSource: "connection_request",
  });

  const requestTrustAssessment = useMemo(() => {
    const preview = requestPreviewContent?.trim();
    if (!preview) {
      return null;
    }
    const messageTimestampUnixMs = requestPreviewTimestampUnixMs ?? Date.now();
    return assessIncomingRequestPreview({
      peerPublicKeyHex,
      messageContent: preview,
      messageTimestampUnixMs,
      peerFirstSeenAtUnixMs: getPeerFirstSeenAtUnixMs(getResolvedProfileId(), peerPublicKeyHex),
      profileId: getResolvedProfileId(),
      nowUnixMs: messageTimestampUnixMs,
    }).assessment;
  }, [peerPublicKeyHex, requestPreviewContent, requestPreviewTimestampUnixMs]);

  const runAction = async (action: () => void | Promise<void>): Promise<void> => {
    setIsProcessing(true);
    try {
      await action();
    } finally {
      setIsProcessing(false);
      setAcceptDialogOpen(false);
    }
  };

  if (resendEligible) {
    return (
      <div
        className="z-10 border-b border-rose-500/20 bg-rose-500/5 px-4 py-3 backdrop-blur-md"
        data-testid="contact-request-thread-banner"
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-rose-900 dark:text-rose-100">
                Request not accepted
              </p>
              <p className="truncate text-xs text-rose-700/80 dark:text-rose-300/80">
                {displayName} declined your invitation. You can send a new request if they have not blocked you.
              </p>
            </div>
          </div>
          {onResendRequest ? (
            <Button
              variant="secondary"
              size="sm"
              className="h-9 shrink-0 rounded-xl text-xs font-bold"
              disabled={isProcessing}
              onClick={() => void runAction(onResendRequest)}
            >
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send new request
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (isInitiator) {
    return (
      <div
        className="z-10 border-b border-purple-500/20 bg-purple-500/5 px-4 py-3 backdrop-blur-md"
        data-testid="contact-request-thread-banner"
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400">
              <Clock3 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-purple-900 dark:text-purple-100">
                {t("messaging.waitingForAcceptanceTitle")}
              </p>
              <p className="truncate text-xs text-purple-700/80 dark:text-purple-300/80">
                {t("messaging.waitingForAcceptanceDesc", { name: displayName })}
              </p>
            </div>
          </div>
          {onCancelOutgoing ? (
            <Button
              variant="secondary"
              size="sm"
              className="h-9 shrink-0 rounded-xl text-xs font-bold"
              disabled={isProcessing}
              onClick={() => void runAction(onCancelOutgoing)}
            >
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Cancel request
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="z-10 border-b border-sky-500/20 bg-sky-50/80 px-4 py-3 backdrop-blur-md dark:border-sky-400/15 dark:bg-sky-950/25"
        data-testid="contact-request-thread-banner"
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Connection request from {displayName}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Verify identity, ask a question below, then accept or decline.
                </p>
                {binding ? (
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200"
                    aria-expanded={identityExpanded}
                    onClick={() => setIdentityExpanded((current) => !current)}
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", identityExpanded && "rotate-180")} />
                    {identityExpanded ? "Hide fingerprint" : "Verify fingerprint"}
                    {!identityExpanded ? (
                      <span className="font-mono text-muted-foreground">{binding.npubFragment}</span>
                    ) : null}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 gap-2 sm:pt-0.5">
              <Button
                className="h-9 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500"
                disabled={isProcessing}
                onClick={() => setAcceptDialogOpen(true)}
              >
                <Check className="mr-1.5 h-3.5 w-3.5" />
                {t("common.accept")}
              </Button>
              <Button
                variant="secondary"
                className="h-9 rounded-xl px-4 text-xs font-bold"
                disabled={isProcessing}
                onClick={() => void runAction(onDecline)}
              >
                {isProcessing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1.5 h-3.5 w-3.5" />}
                {t("common.decline")}
              </Button>
            </div>
          </div>

          {identityExpanded && binding ? (
            <IdentityBindingPanel binding={binding} compact showLiteracyNote={false} />
          ) : null}
        </div>
      </div>

      <IdentityBindingAcceptDialog
        isOpen={acceptDialogOpen}
        binding={binding}
        trustAssessment={requestTrustAssessment}
        isSubmitting={isProcessing}
        onClose={() => {
          if (!isProcessing) {
            setAcceptDialogOpen(false);
          }
        }}
        onConfirm={async () => {
          await runAction(onAcceptConfirm);
        }}
      />
    </>
  );
}
