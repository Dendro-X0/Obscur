"use client";

import React from "react";
import { ChevronDown, ChevronUp, ShieldAlert, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DmTrustAssessment } from "../dm-kernel-trust-assessment-port";
import { cn } from "@/app/lib/utils";

export function DmKernelTrustBanner(props: Readonly<{
  assessment: DmTrustAssessment;
  expanded: boolean;
  onToggleExpanded: () => void;
  onDismiss: () => void;
}>): React.JSX.Element | null {
  const { t } = useTranslation();
  if (props.assessment.tier !== "elevated" && props.assessment.tier !== "critical") {
    return null;
  }

  const isCritical = props.assessment.tier === "critical";

  return (
    <div
      className={cn(
        "z-10 px-4 py-3 border-b backdrop-blur-md transition-all duration-300",
        isCritical
          ? "bg-gradient-to-r from-amber-500/15 via-orange-500/20 to-amber-500/15 border-amber-500/30"
          : "bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-amber-500/10 border-amber-500/20",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn(
              "h-9 w-9 shrink-0 rounded-full flex items-center justify-center",
              isCritical
                ? "bg-amber-500/20 text-amber-700 dark:text-amber-200"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
            )}
            >
              <ShieldAlert className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-100 leading-tight">
                {t("messaging.trust.bannerTitle")}
              </p>
              <p className="text-xs text-amber-900/80 dark:text-amber-200/80 mt-0.5">
                {t(props.assessment.copyKey)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={props.onToggleExpanded}
              className="p-2 rounded-lg text-amber-900/70 hover:text-amber-950 hover:bg-amber-500/10 dark:text-amber-200/70 dark:hover:text-amber-50"
              aria-expanded={props.expanded}
              aria-label={props.expanded ? t("messaging.trust.hideDetails") : t("messaging.trust.showDetails")}
            >
              {props.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={props.onDismiss}
              className="p-2 rounded-lg text-amber-900/70 hover:text-amber-950 hover:bg-amber-500/10 dark:text-amber-200/70 dark:hover:text-amber-50"
              aria-label={t("messaging.trust.dismiss")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {props.expanded ? (
          <div className="pl-12 text-[11px] text-amber-900/75 dark:text-amber-100/75 space-y-1">
            <p>{t("messaging.trust.detailsIntro")}</p>
            <ul className="list-disc pl-4">
              {props.assessment.activeSignals.map((signal) => (
                <li key={signal}>{t(`messaging.trust.signal.${signal}`)}</li>
              ))}
            </ul>
            <p className="text-amber-900/60 dark:text-amber-200/60 border-t border-amber-500/15 pt-2">
              {t("messaging.trust.recipientOnlyNote")}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
