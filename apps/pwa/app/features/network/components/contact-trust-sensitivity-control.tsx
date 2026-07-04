"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@dweb/ui-kit";
import {
  CONTACT_TRUST_SENSITIVITY_LEVELS,
  sensitivityLabelKey,
  type ContactTrustSensitivity,
} from "@/app/features/dm-kernel/contact-trust-sensitivity";

export function ContactTrustSensitivityControl(props: Readonly<{
  sensitivity: ContactTrustSensitivity;
  onSensitivityChange: (value: ContactTrustSensitivity) => void;
  compact?: boolean;
  inline?: boolean;
  testIdPrefix?: string;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const testIdPrefix = props.testIdPrefix ?? "contact-trust-sensitivity";

  return (
    <div
      className={cn("space-y-2", props.inline ? "px-4 py-2" : "")}
      data-testid={`${testIdPrefix}-control`}
    >
      {!props.inline ? (
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
          {t("network.trust.sensitivityControlLabel")}
        </p>
      ) : null}
      <div
        className={cn(
          props.inline
            ? "flex flex-wrap gap-1.5"
            : cn(
              "grid grid-cols-2 gap-2 sm:grid-cols-4",
              props.compact ? "" : "sm:gap-3",
            ),
        )}
        role="radiogroup"
        aria-label={t("network.trust.sensitivityControlLabel")}
      >
        {CONTACT_TRUST_SENSITIVITY_LEVELS.map((level: ContactTrustSensitivity) => {
          const selected = props.sensitivity === level;
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`${testIdPrefix}-${level}`}
              data-selected={selected ? "true" : "false"}
              onClick={() => props.onSensitivityChange(level)}
              className={cn(
                "rounded-xl border text-left transition-colors",
                props.inline
                  ? "px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide"
                  : cn(
                    "px-3 py-2.5",
                    props.compact ? "text-[11px]" : "text-xs",
                  ),
                selected
                  ? "border-amber-500/40 bg-amber-500/15 font-bold text-amber-950 dark:text-amber-50"
                  : "border-zinc-200/70 bg-zinc-50/80 font-semibold text-zinc-700 hover:border-zinc-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:border-white/20",
              )}
            >
              {t(sensitivityLabelKey(level))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
