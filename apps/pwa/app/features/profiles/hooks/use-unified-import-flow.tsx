"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { pickPortabilityImportFile } from "@/app/features/profiles/services/portability-file-picker";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  preflightUnifiedAccountImport,
  type PortabilityImportPreflight,
} from "@/app/features/profiles/services/portability-import-preflight";
import {
  clearPendingProfileImport,
  loadPendingProfileImport,
  pendingImportAccountPrefix,
  savePendingProfileImport,
  type PendingProfileImport,
} from "@/app/features/profiles/services/pending-profile-import-service";
import { importUnifiedAccountBundle } from "@/app/features/profiles/services/unified-account-export-service";
import { refreshShellAfterAccountImport } from "@/app/features/profiles/services/post-account-import-shell-refresh";
import { shouldAutoApplyStagedImportOnUnlock } from "@/app/features/profiles/services/staged-import-auto-apply-policy";
import { resolvePortabilityPrivateKeyHex } from "@/app/features/auth/services/resolve-portability-private-key-hex";
import { PortabilityImportPreflightDialog } from "@/app/features/profiles/components/portability-import-preflight-dialog";
import { PortabilityImportPreflightInline } from "@/app/features/profiles/components/portability-import-preflight-inline";

type UseUnifiedImportFlowOptions = Readonly<{
  publicKeyHex: PublicKeyHex | null;
  resolveActivePrivateKeyHex: () => Promise<PrivateKeyHex | null>;
  autoResumeOnUnlock?: boolean;
  /** Called after a backup is staged for sign-in (preflight passed, not yet unlocked). */
  onStagedForSignIn?: () => void;
  /** Auth restore uses inline confirmation; settings keep modal dialog. */
  preflightPresentation?: "dialog" | "inline";
}>;

export function resolveUnifiedImportPreflightPresentation(
  options: Pick<UseUnifiedImportFlowOptions, "preflightPresentation" | "publicKeyHex">,
): "dialog" | "inline" {
  return options.preflightPresentation ?? (options.publicKeyHex ? "dialog" : "inline");
}

type UseUnifiedImportFlowResult = Readonly<{
  pendingImport: PendingProfileImport | null;
  isImporting: boolean;
  pickAndBeginImport: () => Promise<void>;
  beginImportFromFile: (file: File) => Promise<void>;
  clearPendingImport: () => void;
  preflightDialog: React.JSX.Element;
}>;

const pendingImportFileFromRecord = (pending: PendingProfileImport): File => (
  new File([pending.rawJson], pending.fileName, { type: "application/json" })
);

export function useUnifiedImportFlow(options: UseUnifiedImportFlowOptions): UseUnifiedImportFlowResult {
  const { t } = useTranslation();
  const profileId = getResolvedProfileId();
  const pendingImportFileRef = useRef<File | null>(null);
  const resumeAttemptedForPublicKeyRef = useRef<string | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingProfileImport | null>(
    () => loadPendingProfileImport(profileId),
  );
  const [isImporting, setIsImporting] = useState(false);
  const [importPreflight, setImportPreflight] = useState<PortabilityImportPreflight | null>(null);
  const [isImportPreflightOpen, setIsImportPreflightOpen] = useState(false);

  const refreshPendingImport = useCallback((): void => {
    setPendingImport(loadPendingProfileImport(profileId));
  }, [profileId]);

  const closePreflightDialog = useCallback((): void => {
    setIsImportPreflightOpen(false);
    setImportPreflight(null);
    pendingImportFileRef.current = null;
  }, []);

  const resolveImportPrivateKeyHex = useCallback(async (): Promise<PrivateKeyHex | null> => (
    resolvePortabilityPrivateKeyHex({
      publicKeyHex: options.publicKeyHex,
      privateKeyHex: await options.resolveActivePrivateKeyHex(),
    })
  ), [options]);

  const applyImport = useCallback(async (file: File): Promise<void> => {
    if (!options.publicKeyHex) {
      toast.error(t("profiles.portability.quickActions.signInThenImport"));
      return;
    }
    setIsImporting(true);
    try {
      const privateKeyHex = await resolveImportPrivateKeyHex();
      if (!privateKeyHex) {
        throw new Error(t("profiles.portability.quickActions.unlockFirst"));
      }
      await importUnifiedAccountBundle({
        raw: JSON.parse(await file.text()),
        publicKeyHex: options.publicKeyHex,
        privateKeyHex,
        profileId,
      });
      clearPendingProfileImport(profileId);
      refreshPendingImport();
      toast.success(t("profiles.portability.quickActions.backupImported"));
      await refreshShellAfterAccountImport({
        publicKeyHex: options.publicKeyHex,
        profileId,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("profiles.portability.quickActions.importFailed"));
    } finally {
      setIsImporting(false);
      closePreflightDialog();
    }
  }, [closePreflightDialog, options, profileId, refreshPendingImport, resolveImportPrivateKeyHex, t]);

  const stageImport = useCallback(async (file: File, preflight: PortabilityImportPreflight): Promise<void> => {
    try {
      const rawJson = await file.text();
      const saved = savePendingProfileImport({
        profileId,
        fileName: file.name,
        rawJson,
      });
      setPendingImport(saved);
      closePreflightDialog();
      const accountPrefix = preflight.bundlePublicKeyHex
        ? pendingImportAccountPrefix(preflight.bundlePublicKeyHex)
        : t("profiles.portability.quickActions.thisBackup");
      toast.success(t("profiles.portability.quickActions.backupSavedSignIn", { prefix: accountPrefix }));
      options.onStagedForSignIn?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("profiles.portability.quickActions.couldNotStage"));
    }
  }, [closePreflightDialog, options, profileId, t]);

  const openPreflightForFile = useCallback(async (file: File): Promise<void> => {
    const preflight = await preflightUnifiedAccountImport({
      file,
      activePublicKeyHex: options.publicKeyHex,
      privateKeyHex: await resolveImportPrivateKeyHex(),
    });
    pendingImportFileRef.current = file;
    setImportPreflight(preflight);
    setIsImportPreflightOpen(true);
  }, [options, resolveImportPrivateKeyHex]);

  const beginImportFromFile = useCallback(async (file: File): Promise<void> => {
    await openPreflightForFile(file);
  }, [openPreflightForFile]);

  const pickAndBeginImport = useCallback(async (): Promise<void> => {
    const picked = await pickPortabilityImportFile("unified_account");
    if (picked) {
      await beginImportFromFile(picked);
    }
  }, [beginImportFromFile]);

  const clearPendingImport = useCallback((): void => {
    clearPendingProfileImport(profileId);
    refreshPendingImport();
    toast.info(t("profiles.portability.quickActions.stagedBackupCleared"));
  }, [profileId, refreshPendingImport]);

  const resumePendingImport = useCallback(async (): Promise<void> => {
    const pending = loadPendingProfileImport(profileId);
    if (!pending || !options.publicKeyHex) {
      return;
    }
    if (pending.bundlePublicKeyHex.trim().toLowerCase() !== options.publicKeyHex.trim().toLowerCase()) {
      toast.error(t("profiles.portability.quickActions.stagedBackupMismatch", {
        prefix: pendingImportAccountPrefix(pending.bundlePublicKeyHex),
      }));
      return;
    }
    const file = pendingImportFileFromRecord(pending);
    if (options.autoResumeOnUnlock) {
      const privateKeyHex = await resolveImportPrivateKeyHex();
      const preflight = await preflightUnifiedAccountImport({
        file,
        activePublicKeyHex: options.publicKeyHex,
        privateKeyHex,
      });
      if (shouldAutoApplyStagedImportOnUnlock({
        pending,
        activePublicKeyHex: options.publicKeyHex,
        preflight,
        autoResumeOnUnlock: options.autoResumeOnUnlock,
      })) {
        await applyImport(file);
        return;
      }
    }
    await openPreflightForFile(file);
  }, [applyImport, options, profileId, openPreflightForFile, resolveImportPrivateKeyHex, t]);

  useEffect(() => {
    if (!options.autoResumeOnUnlock || !options.publicKeyHex) {
      return;
    }
    const pending = loadPendingProfileImport(profileId);
    if (!pending) {
      resumeAttemptedForPublicKeyRef.current = null;
      return;
    }
    if (resumeAttemptedForPublicKeyRef.current === options.publicKeyHex) {
      return;
    }
    resumeAttemptedForPublicKeyRef.current = options.publicKeyHex;
    void resumePendingImport();
  }, [options.autoResumeOnUnlock, options.publicKeyHex, profileId, resumePendingImport]);

  useEffect(() => {
    refreshPendingImport();
  }, [profileId, refreshPendingImport]);

  useEffect(() => () => {
    closePreflightDialog();
  }, [closePreflightDialog]);

  const handleConfirmPreflight = (): void => {
    const file = pendingImportFileRef.current;
    if (!file || !importPreflight) {
      return;
    }
    if (importPreflight.canProceed) {
      void applyImport(file);
      return;
    }
    if (importPreflight.canStageForSignIn) {
      void stageImport(file, importPreflight);
    }
  };

  const preflightPresentation = resolveUnifiedImportPreflightPresentation(options);

  const preflightDialog = preflightPresentation === "inline" ? (
    <PortabilityImportPreflightInline
      preflight={importPreflight}
      isOpen={isImportPreflightOpen}
      isApplying={isImporting}
      onClose={closePreflightDialog}
      onConfirm={handleConfirmPreflight}
    />
  ) : (
    <PortabilityImportPreflightDialog
      preflight={importPreflight}
      isOpen={isImportPreflightOpen}
      isApplying={isImporting}
      onClose={closePreflightDialog}
      onConfirm={handleConfirmPreflight}
    />
  );

  return {
    pendingImport,
    isImporting,
    pickAndBeginImport,
    beginImportFromFile,
    clearPendingImport,
    preflightDialog,
  };
}
