"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import type React from "react";
import { cn } from "@/app/lib/utils";
import type { MobileShellStatusItem, MobileShellStatusTone } from "./mobile-shell-status-items";
import { summarizeMobileShellStatusItems } from "./mobile-shell-status-items";

type MobileShellStatusStripProps = Readonly<{
  items: readonly MobileShellStatusItem[];
  onOpenProfiles?: () => void;
  className?: string;
}>;

const TONE_CLASS: Record<MobileShellStatusTone, string> = {
  error: "border-orange-500/30 bg-orange-500/10 text-orange-950 dark:text-orange-50",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-50",
  sync: "border-indigo-500/25 bg-indigo-500/10 text-indigo-950 dark:text-indigo-50",
  info: "border-sky-500/25 bg-sky-500/10 text-sky-950 dark:text-sky-50",
  relay: "border-amber-500/25 bg-amber-500/10 text-amber-950 dark:text-amber-50",
};

function StatusRow({
  item,
  compact,
  onOpenProfiles,
}: Readonly<{
  item: MobileShellStatusItem;
  compact?: boolean;
  onOpenProfiles?: () => void;
}>): React.JSX.Element {
  const action = item.actionId === "open_profiles" && onOpenProfiles
    ? (
      <button
        type="button"
        className="shrink-0 rounded-md border border-current/20 px-2 py-1 text-[11px] font-semibold opacity-90"
        onClick={onOpenProfiles}
      >
        Open Profiles
      </button>
    )
    : null;

  return (
    <div
      className={cn(
        "border-b px-3 py-2 text-xs leading-snug",
        TONE_CLASS[item.tone],
        compact ? "py-1.5" : "py-2",
      )}
      data-status-id={item.id}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{item.title}</p>
          {!compact ? <p className="mt-0.5 opacity-90">{item.body}</p> : null}
        </div>
        {action}
      </div>
    </div>
  );
}

/**
 * Collapses multiple account/relay status banners into one mobile strip (P13-a).
 */
export function MobileShellStatusStrip({
  items,
  onOpenProfiles,
  className,
}: MobileShellStatusStripProps): React.JSX.Element | null {
  const summary = useMemo(() => summarizeMobileShellStatusItems(items), [items]);
  const [expanded, setExpanded] = useState(false);

  if (!summary.primary) {
    return null;
  }

  const canExpand = items.length > 1;
  const showExpanded = expanded || !canExpand;

  if (!canExpand) {
    return (
      <div
        className={cn("shrink-0", className)}
        data-testid="mobile-shell-status-strip"
        role="status"
      >
        <StatusRow item={summary.primary} onOpenProfiles={onOpenProfiles} />
      </div>
    );
  }

  return (
    <div
      className={cn("shrink-0", className)}
      data-testid="mobile-shell-status-strip"
      role="status"
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 border-b px-3 py-2 text-left text-xs",
          TONE_CLASS[summary.primary.tone],
        )}
        aria-expanded={showExpanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="min-w-0 flex-1">
          <span className="font-semibold">{summary.primary.title}</span>
          {!showExpanded ? (
            <span className="ml-1 opacity-80">
              ·
              {" "}
              {summary.extraCount}
              {" "}
              more
            </span>
          ) : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-current/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          Status
          {showExpanded ? <ChevronUp className="h-3 w-3" aria-hidden /> : <ChevronDown className="h-3 w-3" aria-hidden />}
        </span>
      </button>
      {showExpanded ? (
        <div className="mobile-scroll-region max-h-[28dvh] overflow-y-auto overscroll-contain">
          {items.map((item) => (
            <StatusRow
              key={item.id}
              item={item}
              compact={item.id !== summary.primary?.id}
              onOpenProfiles={onOpenProfiles}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
