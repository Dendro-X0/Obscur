"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Button, Label, toast } from "@dweb/ui-kit";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import {
  exportEncryptedWorkspaceBundle,
  importEncryptedWorkspaceBundle,
  parseEncryptedWorkspaceBundleEnvelope,
} from "@/app/features/profiles/services/encrypted-workspace-bundle-service";
import { revealExportPathInFileManager } from "@/app/features/profiles/services/data-root-export-service";
import { pickPortabilityImportFile } from "@/app/features/profiles/services/portability-file-picker";
import {
  buildWorkspaceBundleExportManifest,
  type PortabilityExportManifest,
} from "@/app/features/profiles/services/portability-export-manifest";
import { recordPortabilityExport } from "@/app/features/profiles/services/portability-export-history";
import {
  buildWorkspaceBundleExportFileName,
  loadPortabilityExportNamingPreset,
  type PortabilityExportNamingPreset,
} from "@/app/features/profiles/services/portability-export-naming";
import {
  preflightWorkspaceBundleImport,
  type PortabilityImportPreflight,
} from "@/app/features/profiles/services/portability-import-preflight";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { SettingsToggle } from "@/app/settings/settings-tab-panel-shared";
import {
  PortabilityExportResultBanner,
  type PortabilityExportResult,
} from "@/app/features/profiles/components/portability-export-result-banner";
import { PortabilityExportManifestPreview } from "@/app/features/profiles/components/portability-export-manifest-preview";
import { PortabilityExportNamingSelect } from "@/app/features/profiles/components/portability-export-naming-select";
import { PortabilityImportPreflightDialog } from "@/app/features/profiles/components/portability-import-preflight-dialog";
import { PortabilityLastExportCard } from "@/app/features/profiles/components/portability-last-export-card";
import { SettingsPortabilityTabLink } from "@/app/features/profiles/components/settings-portability-tab-link";

type Props = Readonly<{
  publicKeyHex: PublicKeyHex | null;
  profileLabel?: string;
  resolveActivePrivateKeyHex: () => Promise<PrivateKeyHex | null>;
  t: (key: string, fallback?: string) => string;
}>;

export function EncryptedWorkspaceExportPanel(props: Props): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImportFileRef = useRef<File | null>(null);
  const [includeVaultMedia, setIncludeVaultMedia] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastExport, setLastExport] = useState<PortabilityExportResult | null>(null);
  const [exportHistoryToken, setExportHistoryToken] = useState(0);
  const [exportManifest, setExportManifest] = useState<PortabilityExportManifest | null>(null);
  const [isManifestLoading, setIsManifestLoading] = useState(false);
  const [namingPreset, setNamingPreset] = useState<PortabilityExportNamingPreset>(() => loadPortabilityExportNamingPreset());
  const [importPreflight, setImportPreflight] = useState<PortabilityImportPreflight | null>(null);
  const [isImportPreflightOpen, setIsImportPreflightOpen] = useState(false);

  useEffect(() => {
    if (!props.publicKeyHex) {
      setExportManifest(null);
      return;
    }
    let cancelled = false;
    setIsManifestLoading(true);
    void buildWorkspaceBundleExportManifest({
      profileId: getResolvedProfileId(),
      profileLabel: props.profileLabel,
      publicKeyHex: props.publicKeyHex,
      includeVaultMedia,
    })
      .then((manifest) => {
        if (!cancelled) {
          setExportManifest(manifest);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExportManifest(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsManifestLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [props.publicKeyHex, props.profileLabel, includeVaultMedia]);

  const applyWorkspaceImport = async (file: File): Promise<void> => {
    if (!props.publicKeyHex) {
      toast.error("Unlock this account before importing.");
      return;
    }
    setIsImporting(true);
    try {
      const privateKeyHex = await props.resolveActivePrivateKeyHex();
      if (!privateKeyHex) {
        throw new Error("Unlock this account before importing.");
      }
      const envelope = parseEncryptedWorkspaceBundleEnvelope(JSON.parse(await file.text()));
      if (!envelope) {
        throw new Error("Invalid encrypted workspace bundle.");
      }
      await importEncryptedWorkspaceBundle({
        envelope,
        publicKeyHex: props.publicKeyHex,
        privateKeyHex,
        profileId: getResolvedProfileId(),
      });
      toast.success("Encrypted workspace imported. Reload recommended.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Workspace import failed.");
    } finally {
      setIsImporting(false);
      pendingImportFileRef.current = null;
      setIsImportPreflightOpen(false);
      setImportPreflight(null);
    }
  };

  const beginImport = async (file: File): Promise<void> => {
    const privateKeyHex = await props.resolveActivePrivateKeyHex();
    const preflight = await preflightWorkspaceBundleImport({
      file,
      activePublicKeyHex: props.publicKeyHex,
      privateKeyHex,
    });
    pendingImportFileRef.current = file;
    setImportPreflight(preflight);
    setIsImportPreflightOpen(true);
  };

  const handleExport = async (): Promise<void> => {
    if (!props.publicKeyHex || isExporting) {
      return;
    }
    setIsExporting(true);
    try {
      const privateKeyHex = await props.resolveActivePrivateKeyHex();
      if (!privateKeyHex) {
        throw new Error("Unlock this account before exporting.");
      }
      const exportedAtUnixMs = Date.now();
      const fileName = buildWorkspaceBundleExportFileName({
        profileId: getResolvedProfileId(),
        profileLabel: props.profileLabel,
        exportedAtUnixMs,
        preset: namingPreset,
      });
      const result = await exportEncryptedWorkspaceBundle({
        profileId: getResolvedProfileId(),
        profileLabel: props.profileLabel,
        publicKeyHex: props.publicKeyHex,
        privateKeyHex,
        includeVaultMedia,
        fileName,
      });
      recordPortabilityExport({
        kind: "workspace_bundle",
        fileName: result.fileName,
        absolutePath: result.absolutePath,
        exportedAtUnixMs,
        estimatedSizeBytes: exportManifest?.estimatedSizeBytes ?? 0,
        label: "Encrypted workspace bundle exported",
      });
      setExportHistoryToken((value) => value + 1);
      setLastExport({
        fileName: result.fileName,
        absolutePath: result.absolutePath,
        downloadTriggered: result.downloadTriggered,
        label: "Encrypted workspace bundle exported",
      });
      toast.success("Encrypted workspace bundle exported.");
      if (result.absolutePath) {
        await revealExportPathInFileManager(result.absolutePath);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Workspace export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div id="encrypted-workspace-export" className="border-t border-black/5 pt-5 space-y-4 dark:border-white/10">
      <PortabilityLastExportCard refreshToken={exportHistoryToken} />
      <div className="space-y-1">
        <Label className="font-semibold text-base">
          {props.t("settings.storage.workspaceBundleTitle")}
        </Label>
        <p className="text-xs text-zinc-500">
          {props.t("settings.storage.workspaceBundleDesc")}
        </p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          For cross-device account migration only, use{" "}
          <SettingsPortabilityTabLink tab="profile" hash="manual-portability">
            Settings → Profile → Manual Portability
          </SettingsPortabilityTabLink>.
        </p>
      </div>
      <PortabilityExportManifestPreview
        manifest={exportManifest}
        isLoading={isManifestLoading}
        title="Workspace export preview"
      />
      <div className="flex items-center justify-between gap-3 rounded-xl border border-black/5 p-4 dark:border-white/5">
        <span className="text-sm font-medium">{props.t("settings.storage.includeVaultMedia")}</span>
        <SettingsToggle checked={includeVaultMedia} onChange={setIncludeVaultMedia} />
      </div>
      <PortabilityExportNamingSelect value={namingPreset} onChange={setNamingPreset} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!props.publicKeyHex || isExporting} onClick={() => void handleExport()}>
          {isExporting ? "Exporting..." : "Export Encrypted Bundle"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!props.publicKeyHex || isImporting}
          onClick={async () => {
            const picked = await pickPortabilityImportFile("workspace_bundle");
            if (picked) {
              await beginImport(picked);
              return;
            }
            fileInputRef.current?.click();
          }}
        >
          {isImporting ? "Importing..." : "Import Encrypted Bundle"}
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".obscur-bundle,.json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          if (file) {
            void beginImport(file);
          }
        }}
      />
      <PortabilityExportResultBanner result={lastExport} onDismiss={() => setLastExport(null)} />
      <PortabilityImportPreflightDialog
        preflight={importPreflight}
        isOpen={isImportPreflightOpen}
        isApplying={isImporting}
        onClose={() => {
          setIsImportPreflightOpen(false);
          setImportPreflight(null);
          pendingImportFileRef.current = null;
        }}
        onConfirm={() => {
          const file = pendingImportFileRef.current;
          if (file) {
            void applyWorkspaceImport(file);
          }
        }}
      />
    </div>
  );
}
