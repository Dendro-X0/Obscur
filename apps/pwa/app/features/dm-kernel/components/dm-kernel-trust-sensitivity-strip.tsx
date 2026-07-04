"use client";

import React from "react";
import { ChevronDown, ChevronUp, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { cn } from "@/app/lib/utils";
import {
  sensitivityHintKey,
  sensitivityLabelKey,
  type ContactTrustSensitivity,
} from "@/app/features/dm-kernel/contact-trust-sensitivity";
import { ContactTrustSensitivityControl } from "@/app/features/network/components/contact-trust-sensitivity-control";
import { useContactTrustSensitivity } from "@/app/features/network/hooks/use-contact-trust-sensitivity";

const HEADER_ACTION_CHROME = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/10 bg-black/[0.03] px-2.5 text-xs font-semibold text-zinc-800 transition-colors hover:bg-black/[0.06] dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:hover:bg-white/[0.07]";

export function DmKernelTrustSensitivityStrip(props: Readonly<{
  peerPublicKeyHex: PublicKeyHex | string;
  isPeerAccepted: boolean | undefined;
  sensitivity?: ContactTrustSensitivity;
  onSensitivityChange?: (value: ContactTrustSensitivity) => void;
  embedded?: boolean;
  headerInline?: boolean;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const internal = useContactTrustSensitivity(props.peerPublicKeyHex);
  const sensitivity = props.sensitivity ?? internal.sensitivity;
  const setSensitivity = props.onSensitivityChange ?? internal.setSensitivity;
  const [expanded, setExpanded] = React.useState(false);
  const connectionStatusLabel = props.isPeerAccepted
    ? t("network.trust.levelTrusted")
    : t("network.trust.levelStranger");

  const isHeaderInline = props.embedded === true && props.headerInline === true;

  if (isHeaderInline) {
    return (
      <div className="relative shrink-0" data-testid="dm-kernel-trust-sensitivity-strip">
        <button
          type="button"
          className={cn(HEADER_ACTION_CHROME, "max-w-[11rem]")}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-label={t("messaging.trust.sensitivityStripLabel")}
          data-testid="dm-kernel-trust-sensitivity-toggle"
        >
          <Shield className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
          <span className="truncate">{t(sensitivityLabelKey(sensitivity))}</span>
          {expanded ? (
            <ChevronUp className="ml-auto h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
          ) : (
            <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
          )}
        </button>
        {expanded ? (
          <div className="absolute right-0 top-[calc(100%+0.35rem)] z-30 w-[min(20rem,calc(100vw-2rem))] space-y-2.5 rounded-xl border border-black/10 bg-white/95 p-3 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-[#07101f]/95">
            <div className="space-y-0.5">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {t("messaging.trust.sensitivityStripLabel")}
              </p>
              <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                {t("network.trust.connectionStatus", { status: connectionStatusLabel })}
              </p>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              {t(sensitivityHintKey(sensitivity))}
            </p>
            <ContactTrustSensitivityControl
              sensitivity={sensitivity}
              onSensitivityChange={setSensitivity}
              inline
              testIdPrefix="dm-thread-trust-sensitivity"
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        props.embedded
          ? "border-t border-black/10 px-4 py-2 dark:border-white/10"
          : "border-b border-zinc-200/60 bg-zinc-50/70 backdrop-blur-sm dark:border-white/5 dark:bg-[#07101f]/60",
      )}
      data-testid="dm-kernel-trust-sensitivity-strip"
    >
      <div className={props.embedded ? "" : "max-w-4xl mx-auto px-4 py-2"}>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          data-testid="dm-kernel-trust-sensitivity-toggle"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Shield className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t("messaging.trust.sensitivityStripLabel")}
              </p>
              <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                {t(sensitivityLabelKey(sensitivity))}
                <span className="mx-1.5 text-zinc-400">·</span>
                <span className="font-medium text-zinc-500 dark:text-zinc-400">
                  {t("network.trust.connectionStatus", { status: connectionStatusLabel })}
                </span>
              </p>
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
          )}
        </button>
        {expanded ? (
          <div className={cn(
            "mt-3 space-y-2 border-t pt-3",
            props.embedded
              ? "border-black/10 dark:border-white/10"
              : "border-zinc-200/60 dark:border-white/5",
          )}>
            <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              {t(sensitivityHintKey(sensitivity))}
            </p>
            <ContactTrustSensitivityControl
              sensitivity={sensitivity}
              onSensitivityChange={setSensitivity}
              inline
              testIdPrefix="dm-thread-trust-sensitivity"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
