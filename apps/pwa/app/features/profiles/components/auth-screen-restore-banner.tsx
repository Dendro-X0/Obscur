"use client";

import type React from "react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@dweb/ui-kit";
import { Loader2, Upload, X } from "lucide-react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { useUnifiedImportFlow } from "@/app/features/profiles/hooks/use-unified-import-flow";
import { pendingImportAccountPrefix } from "@/app/features/profiles/services/pending-profile-import-service";
import { pickPortabilityImportFile } from "@/app/features/profiles/services/portability-file-picker";

type Props = Readonly<{
  publicKeyHex: PublicKeyHex | null;
  resolveActivePrivateKeyHex: () => Promise<PrivateKeyHex | null>;
  variant?: "auth" | "inline";
  /** Returning profile windows: only surface staged backup, not full restore CTAs. */
  showRestoreActions?: boolean;
}>;

export function AuthScreenRestoreBanner(props: Props): React.JSX.Element | null {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importFlow = useUnifiedImportFlow({
    publicKeyHex: props.publicKeyHex,
    resolveActivePrivateKeyHex: props.resolveActivePrivateKeyHex,
    preflightPresentation: "inline",
  });

  const handlePick = async (): Promise<void> => {
    const picked = await pickPortabilityImportFile("unified_account");
    if (picked) {
      await importFlow.beginImportFromFile(picked);
      return;
    }
    fileInputRef.current?.click();
  };

  const pending = importFlow.pendingImport;
  const showRestoreActions = props.showRestoreActions !== false;
  const isAuthVariant = props.variant !== "inline";
  const fileExtension = t("profiles.portability.fileExtension.unifiedAccount");

  if (!showRestoreActions && !pending) {
    return importFlow.preflightDialog;
  }

  return (
    <>
      <div
        className={
          isAuthVariant
            ? "w-full max-w-md rounded-[24px] border border-violet-500/20 bg-violet-500/5 px-4 py-4 text-left"
            : "rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-3"
        }
      >
        <div className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
          {pending ? t("profiles.portability.banner.backupReady") : t("profiles.portability.banner.restoreFromBackup")}
        </div>
        {pending ? (
          <div className="mt-2 space-y-2">
            <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              <span className="font-semibold">{pending.fileName}</span>
              {" · "}
              {t("profiles.portability.banner.accountPrefix", {
                prefix: pendingImportAccountPrefix(pending.bundlePublicKeyHex),
              })}
            </p>
            <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              {t("profiles.portability.banner.signInThenConfirm")}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs font-bold"
                onClick={() => void importFlow.clearPendingImport()}
              >
                <X className="h-3.5 w-3.5" />
                {t("profiles.portability.banner.clearStagedBackup")}
              </Button>
            </div>
          </div>
        ) : showRestoreActions ? (
          <>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              {t("profiles.portability.banner.pickUnifiedDesc", { fileExtension })}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 h-9 text-xs font-bold"
              disabled={importFlow.isImporting}
              onClick={() => void handlePick()}
            >
              {importFlow.isImporting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("profiles.portability.restore.checkingBackup")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Upload className="h-3.5 w-3.5" />
                  {t("profiles.portability.banner.chooseUnifiedBackup")}
                </span>
              )}
            </Button>
          </>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.obscur-account-export,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            if (file) {
              void importFlow.beginImportFromFile(file);
            }
          }}
        />
      </div>
      {importFlow.preflightDialog}
    </>
  );
}
