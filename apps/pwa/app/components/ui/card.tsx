import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type CardTone = "default" | "success" | "danger";

type CardProps = Readonly<{
  children: ReactNode;
  className?: string;
  tone?: CardTone;
  title?: string;
  description?: string;
}>;

const getToneClassName = (tone: CardTone): string => {
  if (tone === "success") {
    return "border-emerald-500/30 bg-emerald-50 text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-950/25 dark:text-emerald-50";
  }
  if (tone === "danger") {
    return "border-red-500/30 bg-red-50 text-red-950 dark:border-red-500/35 dark:bg-red-950/25 dark:text-red-50";
  }
  return "border-black/5 bg-gradient-card text-zinc-900 dark:border-white/5 dark:text-zinc-100 dark:bg-zinc-900/40";
};

export const Card = (props: CardProps) => {
  const tone: CardTone = props.tone ?? "default";
  return (
    <section
      className={cn(
        "w-full rounded-3xl border p-6 shadow-sm backdrop-blur-xl",
        "shadow-black/[0.02] dark:shadow-black/20",
        "ring-1 ring-black/[0.02] dark:ring-white/[0.05]",
        getToneClassName(tone),
        props.className
      )}
    >
      {props.title ? (
        <div className="text-sm font-bold tracking-tight text-zinc-950 dark:text-zinc-50">{props.title}</div>
      ) : null}
      {props.description ? (
        <div className="mt-1 text-xs font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">{props.description}</div>
      ) : null}
      <div className={cn(props.title || props.description ? "mt-5" : "", "text-sm leading-relaxed")}>{props.children}</div>
    </section>
  );
};
