import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

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
  return "border-black/10 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-100";
};

export const Card = (props: CardProps) => {
  const tone: CardTone = props.tone ?? "default";
  return (
    <section
      className={cn(
        "w-full rounded-2xl border p-5 shadow-sm backdrop-blur",
        getToneClassName(tone),
        props.className
      )}
    >
      {props.title ? (
        <div className="text-sm font-semibold tracking-tight">{props.title}</div>
      ) : null}
      {props.description ? (
        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{props.description}</div>
      ) : null}
      <div className={cn(props.title || props.description ? "mt-4" : "", "text-sm")}>{props.children}</div>
    </section>
  );
};
