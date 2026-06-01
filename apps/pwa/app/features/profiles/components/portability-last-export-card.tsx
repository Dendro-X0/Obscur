"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@dweb/ui-kit";
import { FileSearch, FolderOpen } from "lucide-react";
import {
  getLatestPortabilityExport,
  type PortabilityExportHistoryEntry,
  type PortabilityExportKind,
} from "@/app/features/profiles/services/portability-export-history";
import {
  openExportsFolderInFileManager,
  revealExportPathInFileManager,
} from "@/app/features/profiles/services/data-root-export-service";

type Props = Readonly<{
  kind?: PortabilityExportKind;
  refreshToken?: number;
}>;

const formatBytes = (bytes: number): string => {
  if (bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
};

export function PortabilityLastExportCard(props: Props): React.JSX.Element | null {
  const [entry, setEntry] = useState<PortabilityExportHistoryEntry | null>(null);

  useEffect(() => {
    setEntry(getLatestPortabilityExport(props.kind));
  }, [props.kind, props.refreshToken]);

  if (!entry) {
    return null;
  }

  return (
    <div className="rounded-xl border border-black/10 bg-zinc-50 px-3 py-3 dark:border-white/10 dark:bg-zinc-950/60">
      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Last export</div>
      <div className="mt-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">{entry.label}</div>
      <div className="mt-1 truncate font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
        {entry.absolutePath ?? entry.fileName}
      </div>
      <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
        {new Date(entry.exportedAtUnixMs).toLocaleString()} · {formatBytes(entry.estimatedSizeBytes)}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {entry.absolutePath ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => void revealExportPathInFileManager(entry.absolutePath!)}
          >
            <FileSearch className="h-3.5 w-3.5" />
            Show File
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => void openExportsFolderInFileManager()}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Open Exports Folder
        </Button>
      </div>
    </div>
  );
}
