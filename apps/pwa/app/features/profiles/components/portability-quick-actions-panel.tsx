"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button, toast } from "@dweb/ui-kit";
import { Download, FolderOpen, Upload } from "lucide-react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import {
  openExportsFolderInFileManager,
  revealExportPathInFileManager,
} from "@/app/features/profiles/services/data-root-export-service";
import { openProfileArchivesFolderInFileManager } from "@/app/features/profiles/services/profile-archives-service";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  buildUnifiedAccountExportFileName,
  buildUnifiedAccountExportFileNamePreview,
  loadPortabilityExportNamingPreset,
} from "@/app/features/profiles/services/portability-export-naming";
import { recordPortabilityExport } from "@/app/features/profiles/services/portability-export-history";
import { exportUnifiedAccountBundle, writeUnifiedAccountExportToDataRoot } from "@/app/features/profiles/services/unified-account-export-service";
import { useUnifiedImportFlow } from "@/app/features/profiles/hooks/use-unified-import-flow";
import { PortabilityLastExportCard } from "./portability-last-export-card";
import { PortabilityExportResultBanner, type PortabilityExportResult } from "./portability-export-result-banner";
import { cn } from "@/app/lib/utils";

type Props = Readonly<{
  publicKeyHex: PublicKeyHex | null;
  profileLabel?: string;
  resolveActivePrivateKeyHex: () => Promise<PrivateKeyHex | null>;
  includeVaultMedia?: boolean;
  compact?: boolean;
  className?: string;
}>;

export function PortabilityQuickActionsPanel(props: Props): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const isDesktop = hasNativeRuntime();
  const [isExporting, setIsExporting] = useState(false);
  const [lastExport, setLastExport] = useState<PortabilityExportResult | null>(null);
  const [exportRefreshToken, setExportRefreshToken] = useState(0);
  const importFlow = useUnifiedImportFlow({
    publicKeyHex: props.publicKeyHex,
    resolveActivePrivateKeyHex: props.resolveActivePrivateKeyHex,
  });

  const handleExport = async (): Promise<void> => {
    if (!props.publicKeyHex || isExporting) {
      toast.error(t("profiles.portability.quickActions.signInToExport"));
      return;
    }
    setIsExporting(true);
    try {
      const privateKeyHex = await props.resolveActivePrivateKeyHex();
      if (!privateKeyHex) {
        throw new Error(t("profiles.portability.quickActions.unlockFirst"));
      }
      const { envelope, serialized } = await exportUnifiedAccountBundle({
        publicKeyHex: props.publicKeyHex,
        privateKeyHex,
        profileId: getResolvedProfileId(),
        profileLabel: props.profileLabel,
        includeVaultMedia: props.includeVaultMedia ?? false,
      });
      const fileName = buildUnifiedAccountExportFileName({
        publicKeyHex: props.publicKeyHex,
        profileLabel: props.profileLabel,
        exportedAtUnixMs: envelope.exportedAtUnixMs,
        preset: loadPortabilityExportNamingPreset(),
      });
      const writeResult = await writeUnifiedAccountExportToDataRoot({
        fileName,
        envelope,
      });
      recordPortabilityExport({
        kind: "unified_account",
        fileName: writeResult.fileName,
        absolutePath: writeResult.absolutePath,
        exportedAtUnixMs: envelope.exportedAtUnixMs,
        estimatedSizeBytes: serialized.length,
        label: t("profiles.portability.quickActions.unifiedExportLabel"),
      });
      setLastExport({
        fileName: writeResult.fileName,
        absolutePath: writeResult.absolutePath,
        downloadTriggered: writeResult.downloadTriggered,
        label: t("profiles.portability.quickActions.unifiedExportSaved"),
      });
      setExportRefreshToken((value) => value + 1);
      toast.success(isDesktop
        ? t("profiles.portability.quickActions.backupSavedDesktop")
        : t("profiles.portability.quickActions.backupDownloaded"));
      if (writeResult.absolutePath) {
        await revealExportPathInFileManager(writeResult.absolutePath);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("profiles.portability.quickActions.exportFailed"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (): Promise<void> => {
    await importFlow.pickAndBeginImport();
  };

  return (
    <div className={cn(props.compact ? "space-y-3" : "rounded-[28px] border border-black/10 bg-white/70 p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/40 space-y-4", props.className)}>
      {!props.compact ? (
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {t("profiles.portability.quickActions.title")}
          </div>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            {t("profiles.portability.quickActions.desc")}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          size="sm"
          className="h-9 text-xs font-bold"
          disabled={!props.publicKeyHex || isExporting || importFlow.isImporting}
          onClick={() => void handleExport()}
        >
          <Download className="h-3.5 w-3.5" />
          {isExporting ? t("profiles.portability.quickActions.exporting") : t("profiles.portability.quickActions.exportBackup")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 text-xs font-bold"
          disabled={importFlow.isImporting || isExporting}
          onClick={() => void handleImport()}
        >
          <Upload className="h-3.5 w-3.5" />
          {importFlow.isImporting ? t("profiles.portability.quickActions.importing") : t("profiles.portability.quickActions.importBackup")}
        </Button>
        {isDesktop ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 text-xs font-bold"
              onClick={() => void openExportsFolderInFileManager()}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {t("profiles.portability.quickActions.exportsFolder")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 text-xs font-bold"
              onClick={() => void openProfileArchivesFolderInFileManager()}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {t("profiles.portability.quickActions.archivesFolder")}
            </Button>
          </>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 text-xs"
          onClick={() => router.push("/settings?tab=profile#manual-portability")}
        >
          {t("profiles.portability.quickActions.advancedOptions")}
        </Button>
      </div>

      <PortabilityLastExportCard kind="unified_account" refreshToken={exportRefreshToken} />
      {props.publicKeyHex ? (
        <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {t("profiles.portability.quickActions.exportFilenameHint", {
            defaultValue: "Export saves as {{fileName}} in your Obscur export folder.",
            fileName: buildUnifiedAccountExportFileNamePreview({
              publicKeyHex: props.publicKeyHex,
              profileLabel: props.profileLabel,
              preset: loadPortabilityExportNamingPreset(),
            }),
          })}
        </p>
      ) : null}
      <PortabilityExportResultBanner result={lastExport} onDismiss={() => setLastExport(null)} />
      {importFlow.preflightDialog}

      {!props.publicKeyHex ? (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {t("profiles.portability.quickActions.signInHint")}
        </p>
      ) : null}
    </div>
  );
}
