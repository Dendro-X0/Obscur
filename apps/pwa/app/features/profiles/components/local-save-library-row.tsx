"use client";

import type React from "react";
import { useTranslation } from "react-i18next";
import { Clock3, HardDrive, KeyRound, Loader2 } from "lucide-react";
import { cn } from "@/app/lib/utils";
import type { LocalSaveLibraryEntry } from "@/app/features/profiles/services/local-save-contracts";
import { formatLocalSaveAgeLabel } from "@/app/features/profiles/services/local-save-library-service";
import {
  formatLocalSaveModifiedLabel,
  formatLocalSaveSizeLabel,
  formatPublicKeyAbbreviation,
  resolveLocalSaveDisplayName,
  resolveLocalSaveTypeLabelKey,
} from "@/app/features/profiles/services/local-save-library-presenters";
import {
  localSaveOccupancyDetailKey,
  localSaveOccupancyIsBlocked,
  localSaveOccupancyLabelKey,
  type LocalSaveAccountOccupancy,
} from "@/app/features/profiles/services/local-save-account-occupancy";

type Props = Readonly<{
  entry: LocalSaveLibraryEntry;
  slotIndex: number;
  occupancy?: LocalSaveAccountOccupancy;
  isActive?: boolean;
  isSelecting?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}>;

const occupancyBadgeClass = (occupancy: LocalSaveAccountOccupancy | undefined): string => {
  if (!occupancy) {
    return "bg-zinc-900/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-300";
  }
  switch (occupancy.kind) {
    case "this_slot_match":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "this_slot_conflict":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "other_slot":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-300";
    case "active_in_other_window":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    default:
      return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }
};

export function LocalSaveLibraryRow(props: Props): React.JSX.Element {
  const { t } = useTranslation();
  const displayName = resolveLocalSaveDisplayName(props.entry);
  const typeLabel = t(resolveLocalSaveTypeLabelKey(props.entry));
  const modifiedLabel = formatLocalSaveModifiedLabel(props.entry.modifiedAtUnixMs);
  const modifiedDisplay = modifiedLabel === "Unknown date"
    ? t("profiles.portability.localSave.unknownDate")
    : t("profiles.portability.localSave.modified", { date: modifiedLabel });
  const ageLabel = formatLocalSaveAgeLabel(props.entry.modifiedAtUnixMs || props.entry.exportedAtUnixMs);
  const sizeLabel = formatLocalSaveSizeLabel(props.entry.payloadBytes);
  const sizeDisplay = sizeLabel === "Unknown size"
    ? t("profiles.portability.localSave.unknownSize")
    : sizeLabel;
  const pubkeyLabel = formatPublicKeyAbbreviation(props.entry.publicKeyHex);
  const occupancyLabel = props.occupancy
    ? (props.occupancy.kind === "other_slot" || props.occupancy.kind === "active_in_other_window"
      ? t(localSaveOccupancyLabelKey(props.occupancy), { profileLabel: props.occupancy.profileLabel })
      : t(localSaveOccupancyLabelKey(props.occupancy)))
    : null;
  const occupancyDetail = props.occupancy
    ? localSaveOccupancyDetailKey(props.occupancy)
    : null;
  const isBlocked = props.occupancy ? localSaveOccupancyIsBlocked(props.occupancy) : false;

  return (
    <button
      type="button"
      disabled={props.disabled || isBlocked}
      onClick={props.onSelect}
      className={cn(
        "group relative w-full rounded-2xl border px-4 py-3 text-left transition-[border-color,box-shadow,background-color] duration-200",
        isBlocked
          ? "border-rose-500/40 bg-rose-500/5"
          : props.isActive
            ? "border-emerald-500/50 bg-gradient-to-r from-emerald-500/15 to-sky-500/10 shadow-lg shadow-emerald-500/10"
            : "border-black/10 bg-gradient-to-r from-white/70 to-white/40 hover:border-sky-500/35 hover:shadow-md dark:border-white/10 dark:from-zinc-900/80 dark:to-zinc-900/40 dark:hover:border-sky-500/35 dark:hover:shadow-lg dark:hover:shadow-sky-500/5",
        props.disabled ? "cursor-not-allowed opacity-70" : isBlocked ? "cursor-not-allowed" : "",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-black tracking-tight",
            isBlocked
              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
              : props.isActive
                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                : "bg-sky-500/10 text-sky-700 dark:text-sky-300",
          )}
        >
          {String(props.slotIndex).padStart(2, "0")}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-zinc-900 dark:text-zinc-50">
                {displayName}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-zinc-900/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                  {typeLabel}
                </span>
                {occupancyLabel ? (
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    occupancyBadgeClass(props.occupancy),
                  )}
                  >
                    {occupancyLabel}
                  </span>
                ) : null}
              </div>
              {isBlocked && occupancyDetail ? (
                <p className="mt-2 text-[11px] leading-relaxed text-rose-700 dark:text-rose-300">
                  {t(occupancyDetail, props.occupancy?.kind === "other_slot" || props.occupancy?.kind === "active_in_other_window"
                    ? { profileLabel: props.occupancy.profileLabel }
                    : undefined)}
                </p>
              ) : null}
            </div>
            {props.isSelecting ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sky-500" />
            ) : (
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                {ageLabel}
              </span>
            )}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-300">
              <KeyRound className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
              <span className="font-mono">{pubkeyLabel}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-300">
              <Clock3 className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
              <span>{modifiedDisplay}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-300 sm:col-span-2">
              <HardDrive className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
              <span className="truncate" title={props.entry.fileName}>
                {props.entry.fileName}
                {" · "}
                {sizeDisplay}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
