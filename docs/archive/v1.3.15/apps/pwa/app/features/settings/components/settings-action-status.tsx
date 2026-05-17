import { cn } from "@/app/lib/utils";
import { useTranslation } from "react-i18next";

export type SettingsActionPhase =
  | "idle"
  | "waiting"
  | "preparing"
  | "working"
  | "publishing"
  | "success"
  | "error";

type SettingsActionStatusProps = Readonly<{
  title: string;
  phase: SettingsActionPhase;
  message?: string;
  summary?: string;
  className?: string;
}>;

export function SettingsActionStatus({
  title,
  phase,
  message,
  summary,
  className
}: SettingsActionStatusProps) {
  const { t } = useTranslation();
  const phaseLabel = (() => {
    if (phase === "waiting") return t("settings.actionStatus.phase.waiting", "waiting");
    if (phase === "preparing") return t("settings.actionStatus.phase.preparing", "preparing");
    if (phase === "working") return t("settings.actionStatus.phase.working", "working");
    if (phase === "publishing") return t("settings.actionStatus.phase.publishing", "publishing");
    if (phase === "success") return t("settings.actionStatus.phase.success", "success");
    if (phase === "error") return t("settings.actionStatus.phase.failed", "failed");
    return t("settings.actionStatus.phase.idle", "idle");
  })();

  return (
    <div className={cn("rounded-xl border border-black/5 bg-zinc-50 p-3 text-xs dark:border-white/10 dark:bg-zinc-900/50", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-zinc-700 dark:text-zinc-200">{title}</span>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
          phase === "success" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
          phase === "error" && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
          (phase === "publishing" || phase === "working" || phase === "waiting" || phase === "preparing")
          && "bg-blue-500/15 text-blue-600 dark:text-blue-400",
          phase === "idle" && "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
        )}>
          {phaseLabel}
        </span>
      </div>
      <div className="mt-2 text-zinc-600 dark:text-zinc-400">
        {message || summary || t("settings.actionStatus.ready", "Ready.")}
      </div>
    </div>
  );
}
