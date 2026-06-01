"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Button, toast } from "@dweb/ui-kit";
import { Loader2 } from "lucide-react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  revealExportPathInFileManager,
} from "@/app/features/profiles/services/data-root-export-service";
import { pickPortabilityImportFile } from "@/app/features/profiles/services/portability-file-picker";
import {
  buildPortableAccountExportManifest,
  type PortabilityExportManifest,
} from "@/app/features/profiles/services/portability-export-manifest";
import { recordPortabilityExport } from "@/app/features/profiles/services/portability-export-history";
import {
  buildUnifiedAccountExportFileName,
  loadPortabilityExportNamingPreset,
  type PortabilityExportNamingPreset,
} from "@/app/features/profiles/services/portability-export-naming";
import {
  preflightUnifiedAccountImport,
  type PortabilityImportPreflight,
} from "@/app/features/profiles/services/portability-import-preflight";
import {
  exportUnifiedAccountBundle,
  importUnifiedAccountBundle,
} from "@/app/features/profiles/services/unified-account-export-service";
import {
  PortabilityExportResultBanner,
  type PortabilityExportResult,
} from "./portability-export-result-banner";
import { PortabilityExportManifestPreview } from "./portability-export-manifest-preview";
import { PortabilityExportNamingSelect } from "./portability-export-naming-select";
import { PortabilityImportPreflightDialog } from "./portability-import-preflight-dialog";
import { SettingsPortabilityTabLink } from "./settings-portability-tab-link";

const UNIFIED_EXPORT_INCLUDES = [
  "Profile metadata and invite code",
  "Complete relay / network list",
  "Direct and group chat history",
  "Privacy and UI settings",
  "Contacts, trust, and community memberships",
  "Encrypted account key material (not plaintext nsec)",
  "Optional: vault media and profile-window workspace snapshot",
] as const;

type Props = Readonly<{
  publicKeyHex: PublicKeyHex | null;
  profileLabel?: string;
  resolveActivePrivateKeyHex: () => Promise<PrivateKeyHex | null>;
}>;

export function ManualPortabilityPanel(props: Props): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImportFileRef = useRef<File | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastExport, setLastExport] = useState<PortabilityExportResult | null>(null);
  const [exportManifest, setExportManifest] = useState<PortabilityExportManifest | null>(null);
  const [isManifestLoading, setIsManifestLoading] = useState(false);
  const [namingPreset, setNamingPreset] = useState<PortabilityExportNamingPreset>(() => loadPortabilityExportNamingPreset());
  const [importPreflight, setImportPreflight] = useState<PortabilityImportPreflight | null>(null);
  const [isImportPreflightOpen, setIsImportPreflightOpen] = useState(false);
  const [includeVaultMedia, setIncludeVaultMedia] = useState(false);

  useEffect(() => {
    if (!props.publicKeyHex) {
      setExportManifest(null);
      return;
    }
    let cancelled = false;
    setIsManifestLoading(true);
    void buildPortableAccountExportManifest(props.publicKeyHex)
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
  }, [props.publicKeyHex]);

  const applyUnifiedImport = async (file: File): Promise<void> => {
    if (!props.publicKeyHex) {
      toast.error("Sign in to the target account in this profile window first.");
      return;
    }
    setIsImporting(true);
    try {
      const privateKeyHex = await props.resolveActivePrivateKeyHex();
      if (!privateKeyHex) {
        throw new Error("Unlock this account first so the export can be decrypted and restored.");
      }
      const raw = JSON.parse(await file.text());
      const result = await importUnifiedAccountBundle({
        raw,
        publicKeyHex: props.publicKeyHex,
        privateKeyHex,
        profileId: getResolvedProfileId(),
      });
      toast.success(
        result.importedWorkspace
          ? "Unified account export imported (account + workspace)."
          : "Account export imported.",
      );
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Account export import failed.");
    } finally {
      setIsImporting(false);
      pendingImportFileRef.current = null;
      setIsImportPreflightOpen(false);
      setImportPreflight(null);
    }
  };

  const beginImport = async (file: File): Promise<void> => {
    const privateKeyHex = await props.resolveActivePrivateKeyHex();
    const preflight = await preflightUnifiedAccountImport({
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
        throw new Error("Unlock this account first so private state can be exported.");
      }
      const { envelope, serialized } = await exportUnifiedAccountBundle({
        publicKeyHex: props.publicKeyHex,
        privateKeyHex,
        profileId: getResolvedProfileId(),
        profileLabel: props.profileLabel,
        includeVaultMedia,
      });
      const fileName = buildUnifiedAccountExportFileName({
        publicKeyHex: props.publicKeyHex,
        profileLabel: props.profileLabel,
        exportedAtUnixMs: envelope.exportedAtUnixMs,
        preset: namingPreset,
      });
      const { writeExportToDataRoot } = await import("@/app/features/profiles/services/data-root-export-service");
      const writeResult = await writeExportToDataRoot(fileName, serialized);
      recordPortabilityExport({
        kind: "unified_account",
        fileName: writeResult.fileName,
        absolutePath: writeResult.absolutePath,
        exportedAtUnixMs: envelope.exportedAtUnixMs,
        estimatedSizeBytes: serialized.length,
        label: includeVaultMedia
          ? "Unified account export (with workspace + vault)"
          : "Unified account export",
      });
      setLastExport({
        fileName: writeResult.fileName,
        absolutePath: writeResult.absolutePath,
        downloadTriggered: writeResult.downloadTriggered,
        label: includeVaultMedia
          ? "Unified account export (with workspace + vault)"
          : "Unified account export",
      });
      toast.success("Unified account export saved.");
      if (writeResult.absolutePath) {
        await revealExportPathInFileManager(writeResult.absolutePath);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unified export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = async (): Promise<void> => {
    const picked = await pickPortabilityImportFile("unified_account");
    if (picked) {
      await beginImport(picked);
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <div id="manual-portability" className="mt-3 rounded-xl border border-black/10 bg-zinc-50 px-3 py-3 dark:border-white/10 dark:bg-zinc-950/60">
      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Account portability</div>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        One file for cross-device migration: account backup plus optional workspace and vault media.
        JSON shows <span className="font-semibold">ciphertext</span> in editors — import only through Obscur with the matching account unlocked.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-zinc-600 dark:text-zinc-400">
        {UNIFIED_EXPORT_INCLUDES.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="mt-3 space-y-3">
        <PortabilityExportManifestPreview
          manifest={exportManifest}
          isLoading={isManifestLoading}
          title="Export preview"
        />
        <PortabilityExportNamingSelect value={namingPreset} onChange={setNamingPreset} />
        <label className="flex items-center justify-between gap-3 rounded-xl border border-black/5 p-3 dark:border-white/10">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Include workspace snapshot and vault media
          </span>
          <input
            type="checkbox"
            checked={includeVaultMedia}
            onChange={(event) => setIncludeVaultMedia(event.target.checked)}
            className="h-4 w-4"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          disabled={!props.publicKeyHex || isExporting || isImporting}
          className="h-9 text-xs font-bold"
          onClick={() => void handleExport()}
        >
          {isExporting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Exporting...
            </span>
          ) : "Export Unified Backup"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isImporting || isExporting}
          className="h-9 text-xs font-bold"
          onClick={() => void handleImportClick()}
        >
          {isImporting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Importing...
            </span>
          ) : "Import Unified Backup"}
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.obscur-account-export,application/json"
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
      <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        Legacy portable JSON and encrypted <code>.obscur-bundle</code> files still import. For profile-window-only settings without account data, see{" "}
        <SettingsPortabilityTabLink tab="storage" hash="encrypted-workspace-export">
          Settings → Storage
        </SettingsPortabilityTabLink>.
      </p>
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
            void applyUnifiedImport(file);
          }
        }}
      />
    </div>
  );
}
