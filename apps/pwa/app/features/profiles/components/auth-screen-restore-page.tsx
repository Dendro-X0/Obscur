"use client";

import type React from "react";
import { useCallback, useRef } from "react";
import { Button } from "@dweb/ui-kit";
import { Loader2, Upload } from "lucide-react";
import { useUnifiedImportFlow } from "@/app/features/profiles/hooks/use-unified-import-flow";
import { pickPortabilityImportFile } from "@/app/features/profiles/services/portability-file-picker";
import { getWorkspaceExportsFolderPath } from "@/app/features/profiles/services/data-root-export-service";
import { readLocalSavePayloadText } from "@/app/features/profiles/services/local-save-library-service";
import type { LocalSaveLibraryEntry } from "@/app/features/profiles/services/local-save-contracts";
import { AuthScreenLocalSaveLibrary } from "./auth-screen-local-save-library";

type Props = Readonly<{
  onNavigateToLogin: () => void;
}>;

export function AuthScreenRestorePage(props: Props): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importFlow = useUnifiedImportFlow({
    publicKeyHex: null,
    resolveActivePrivateKeyHex: async () => null,
    onStagedForSignIn: props.onNavigateToLogin,
    preflightPresentation: "inline",
  });

  const handlePickFile = useCallback(async (): Promise<void> => {
    const defaultPath = await getWorkspaceExportsFolderPath();
    const picked = await pickPortabilityImportFile("unified_account", { defaultPath });
    if (picked) {
      await importFlow.beginImportFromFile(picked);
      return;
    }
    fileInputRef.current?.click();
  }, [importFlow]);

  const handleLibrarySelect = useCallback(async (entry: LocalSaveLibraryEntry): Promise<void> => {
    const rawJson = await readLocalSavePayloadText(entry.payloadAbsolutePath);
    const file = new File([rawJson], entry.fileName, { type: "application/json" });
    await importFlow.beginImportFromFile(file);
  }, [importFlow]);

  return (
    <>
      <div className="w-full space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
            Restore account
          </h2>
          <p className="text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
            Import a unified backup or pick a tagged local save. Obscur validates the file, then sends you to sign in with the matching account.
          </p>
        </div>

        <div className="space-y-4 text-left">
          <AuthScreenLocalSaveLibrary onSelectSave={handleLibrarySelect} />

          {importFlow.preflightDialog}

          <div className="rounded-[24px] border border-violet-500/20 bg-violet-500/5 px-4 py-4">
            <div className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
              Import from file
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              Opens your Obscur export folder first. You can also browse Downloads or any folder from there.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 h-9 text-xs font-bold"
              disabled={importFlow.isImporting}
              onClick={() => { void handlePickFile(); }}
            >
              {importFlow.isImporting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Checking backup…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Upload className="h-3.5 w-3.5" />
                  Choose backup file
                </span>
              )}
            </Button>
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
        </div>
      </div>
    </>
  );
}
