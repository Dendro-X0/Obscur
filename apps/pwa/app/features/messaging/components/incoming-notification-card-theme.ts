export const incomingNotificationCardMotion = {
  initial: { opacity: 0, y: 18, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 12, scale: 0.97 },
  transition: { type: "spring", stiffness: 340, damping: 26, mass: 0.85 },
} as const;

export const incomingNotificationCardShellClassName = [
  "pointer-events-auto",
  "relative overflow-hidden rounded-[20px]",
  "border border-white/70 bg-white/86",
  "shadow-[0_24px_78px_rgba(2,6,23,0.28)] backdrop-blur-2xl",
  "supports-[backdrop-filter]:bg-white/76",
  "dark:border-white/15 dark:bg-zinc-950/82",
].join(" ");

export const incomingNotificationCardGlowClassName = [
  "absolute inset-0",
  "bg-[radial-gradient(circle_at_0%_0%,rgba(16,185,129,0.18),transparent_44%),radial-gradient(circle_at_100%_0%,rgba(99,102,241,0.17),transparent_45%)]",
].join(" ");

export const incomingNotificationCardBodyClassName = "relative px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4";

export const incomingNotificationSubtleMetaClassName = "text-[11px] text-zinc-500 dark:text-zinc-400";

export const incomingNotificationBadgeToneClassNames = {
  neutral: "border-zinc-300/65 bg-zinc-100/80 text-zinc-700 dark:border-zinc-700/75 dark:bg-zinc-900/75 dark:text-zinc-200",
  positive: "border-emerald-400/45 bg-emerald-500/14 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/16 dark:text-emerald-200",
  info: "border-cyan-400/45 bg-cyan-500/13 text-cyan-700 dark:border-cyan-300/45 dark:bg-cyan-500/14 dark:text-cyan-200",
  warning: "border-amber-400/55 bg-amber-500/15 text-amber-800 dark:border-amber-300/50 dark:bg-amber-500/18 dark:text-amber-200",
  muted: "border-zinc-400/45 bg-zinc-500/15 text-zinc-700 dark:border-zinc-500/45 dark:bg-zinc-700/28 dark:text-zinc-200",
} as const;

export const incomingNotificationActionToneClassNames = {
  subtle: "border-zinc-300/65 bg-white/72 text-zinc-700 hover:bg-zinc-100/85 dark:border-zinc-700/80 dark:bg-zinc-900/72 dark:text-zinc-200 dark:hover:bg-zinc-800/82",
  info: "border-cyan-400/45 bg-cyan-500/12 text-cyan-700 hover:bg-cyan-500/19 dark:border-cyan-300/45 dark:bg-cyan-500/15 dark:text-cyan-200 dark:hover:bg-cyan-500/24",
  positive: "border-emerald-400/45 bg-emerald-500/14 text-emerald-700 hover:bg-emerald-500/21 dark:border-emerald-300/45 dark:bg-emerald-500/16 dark:text-emerald-200 dark:hover:bg-emerald-500/25",
} as const;
