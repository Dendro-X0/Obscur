"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, toast } from "@dweb/ui-kit";
import { Copy, FileSearch, FolderOpen } from "lucide-react";
import type { ProfileWorkspaceArchiveWriteResult } from "@/app/features/profiles/services/profile-workspace-archive-contracts";
import {
  getProfileArchivesFolderPath,
  openProfileArchivesFolderInFileManager,
  revealProfileArchivePathInFileManager,
} from "@/app/features/profiles/services/profile-archives-service";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { openExportsFolderInFileManager } from "@/app/features/profiles/services/data-root-export-service";

type Props = Readonly<{
  result: ProfileWorkspaceArchiveWriteResult | null;
  label?: string;
  profileLabel?: string;
  showExportsFolder?: boolean;
}>;

export function ProfileArchiveResultBanner(props: Props): React.JSX.Element {
  const { t } = useTranslation();
  const [archivesFolderPath, setArchivesFolderPath] = useState<string | null>(null);
  const isDesktop = hasNativeRuntime();

  useEffect(() => {
    if (!isDesktop) {
      return;
    }
    void getProfileArchivesFolderPath().then((path) => {
      if (path) {
        setArchivesFolderPath(path);
      }
    });
  }, [isDesktop]);

  const copyPathToClipboard = async (path: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(path);
      toast.success(t("profiles.portability.archive.pathCopied"));
    } catch {
      toast.error(t("profiles.portability.archive.pathCopyFailed"));
    }
  };

  const title = props.label ?? t("profiles.portability.archive.workspaceSaved");
  const filePath = props.result?.absolutePath ?? null;
  const fileName = props.result?.fileName ?? null;

  return (
    <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-4 dark:border-sky-400/25 dark:bg-sky-400/10">
      <div className="text-sm font-semibold text-sky-900 dark:text-sky-100">{title}</div>
      {props.profileLabel ? (
        <p className="mt-1 text-xs text-sky-800/90 dark:text-sky-100/90">
          {t("profiles.portability.archive.profileLabel", { label: props.profileLabel })}
        </p>
      ) : null}

      {filePath || fileName ? (
        <div className="mt-3 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700/80 dark:text-sky-200/80">
            {t("profiles.portability.archive.archiveFile")}
          </div>
          <div className="break-all rounded-lg bg-black/5 px-2 py-2 font-mono text-[11px] text-sky-950 dark:bg-white/5 dark:text-sky-50">
            {filePath ?? fileName}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-sky-800/90 dark:text-sky-100/90">
          {t("profiles.portability.archive.emptyArchiveNote")}
        </p>
      )}

      {archivesFolderPath ? (
        <div className="mt-3 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700/80 dark:text-sky-200/80">
            {t("profiles.portability.archive.archivesFolderDesktop")}
          </div>
          <div className="break-all rounded-lg bg-black/5 px-2 py-2 font-mono text-[11px] text-sky-950 dark:bg-white/5 dark:text-sky-50">
            {archivesFolderPath}
          </div>
        </div>
      ) : props.result?.downloadTriggered ? (
        <p className="mt-2 text-xs text-sky-800/80 dark:text-sky-100/80">
          {t("profiles.portability.archive.browserDownloadNote")}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {filePath ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => void revealProfileArchivePathInFileManager(filePath)}
            >
              <FileSearch className="h-3.5 w-3.5" />
              {t("profiles.portability.archive.showArchiveFile")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => void copyPathToClipboard(filePath)}
            >
              <Copy className="h-3.5 w-3.5" />
              {t("profiles.portability.archive.copyFilePath")}
            </Button>
          </>
        ) : null}
        {isDesktop ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => void openProfileArchivesFolderInFileManager()}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {t("profiles.portability.archive.openArchivesFolder")}
            </Button>
            {archivesFolderPath ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => void copyPathToClipboard(archivesFolderPath)}
              >
                <Copy className="h-3.5 w-3.5" />
                {t("profiles.portability.archive.copyFolderPath")}
              </Button>
            ) : null}
          </>
        ) : null}
        {props.showExportsFolder && isDesktop ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => void openExportsFolderInFileManager()}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {t("profiles.portability.archive.openExportsFolder")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
