"use client";

import { cn } from "@/app/lib/utils";
import { evaluatePasswordStrength } from "@/app/shared/password-strength";

type PasswordStrengthIndicatorProps = Readonly<{
  password: string;
  className?: string;
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

export const PasswordStrengthIndicator = ({ password, className }: PasswordStrengthIndicatorProps) => {
  if (password.length === 0) {
    return null;
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
