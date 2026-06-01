"use client";

import type React from "react";
import { Button } from "@dweb/ui-kit";
import { FolderOpen, FileSearch } from "lucide-react";
import {
  openExportsFolderInFileManager,
  revealExportPathInFileManager,
} from "@/app/features/profiles/services/data-root-export-service";

export type PortabilityExportResult = Readonly<{
  fileName: string;
  absolutePath: string | null;
  downloadTriggered: boolean;
  label: string;
}>;

type Props = Readonly<{
  result: PortabilityExportResult | null;
  onDismiss?: () => void;
}>;

export function PortabilityExportResultBanner(props: Props): React.JSX.Element | null {
  const { result } = props;
  if (!result) {
    return null;
  }

  return (
    <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-3 dark:border-emerald-400/25 dark:bg-emerald-400/10">
      <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
        {result.label}
      </div>
      <div className="mt-1 truncate font-mono text-[11px] text-emerald-900/80 dark:text-emerald-100/80">
        {result.absolutePath ?? result.fileName}
      </div>
      {result.downloadTriggered ? (
        <p className="mt-1 text-[11px] text-emerald-800/80 dark:text-emerald-100/80">
          Saved to your browser downloads folder.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {result.absolutePath ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => void revealExportPathInFileManager(result.absolutePath!)}
            >
              <FileSearch className="h-3.5 w-3.5" />
              Show File
            </Button>
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
          </>
        ) : null}
        {props.onDismiss ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={props.onDismiss}
          >
            Dismiss
          </Button>
        ) : null}
      </div>
    </div>
  );
}
