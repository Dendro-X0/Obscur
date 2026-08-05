"use client";

import { cn } from "@/app/lib/utils";
import { evaluatePasswordStrength } from "@/app/shared/password-strength";
import {
  evaluateIdentityPassphrasePolicy,
  type PassphrasePolicyFailureReason,
} from "@/app/features/security/services/identity-passphrase-policy";
import type { Passphrase } from "@dweb/crypto/passphrase";

type PasswordStrengthIndicatorProps = Readonly<{
  password: string;
  className?: string;
  requireIdentityPolicy?: boolean;
  policyFailureMessage?: (reason: PassphrasePolicyFailureReason) => string;
}>;

const levelStyles: Record<ReturnType<typeof evaluatePasswordStrength>["level"], Readonly<{ bar: string; text: string }>> = {
  weak: { bar: "bg-rose-500", text: "text-rose-500" },
  fair: { bar: "bg-amber-500", text: "text-amber-500" },
  good: { bar: "bg-blue-500", text: "text-blue-500" },
  strong: { bar: "bg-emerald-500", text: "text-emerald-500" },
};

const activeBarCount = (score: number): number => {
  if (score >= 5) return 4;
  if (score >= 4) return 3;
  if (score >= 3) return 2;
  if (score >= 1) return 1;
  return 0;
};

export const PasswordStrengthIndicator = ({
  password,
  className,
  requireIdentityPolicy = false,
  policyFailureMessage,
}: PasswordStrengthIndicatorProps) => {
  if (password.length === 0) {
    return null;
  }
  if (requireIdentityPolicy) {
    const policyEvaluation = evaluateIdentityPassphrasePolicy(password as Passphrase);
    if (!policyEvaluation.ok) {
      const policyHint = policyFailureMessage?.(policyEvaluation.reason)
        ?? "Use at least 12 characters, or a passphrase of four or more words.";
      return (
        <div className={cn("space-y-2 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3", className)}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Password Strength</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Too short</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={cn(
                  "h-1.5 rounded-full",
                  index === 0 ? "bg-rose-500" : "bg-zinc-300/70 dark:bg-zinc-700/70",
                )}
              />
            ))}
          </div>
          <p className="text-xs text-rose-600 dark:text-rose-400">{policyHint}</p>
        </div>
      );
    }
  }
  const snapshot = evaluatePasswordStrength(password);
  const activeCount = activeBarCount(snapshot.score);
  const levelStyle = levelStyles[snapshot.level];
  return (
    <div className={cn("space-y-2 rounded-2xl border border-black/5 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.04]", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Password Strength</span>
        <span className={cn("text-[10px] font-black uppercase tracking-widest", levelStyle.text)}>{snapshot.label}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={cn(
              "h-1.5 rounded-full",
              index < activeCount ? levelStyle.bar : "bg-zinc-300/70 dark:bg-zinc-700/70",
            )}
          />
        ))}
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{snapshot.hint}</p>
    </div>
  );
};
