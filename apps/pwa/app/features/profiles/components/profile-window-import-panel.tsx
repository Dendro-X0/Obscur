"use client";

import type React from "react";
import { useRef } from "react";
import { Button } from "@dweb/ui-kit";
import { Loader2, Upload } from "lucide-react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { useUnifiedImportFlow } from "@/app/features/profiles/hooks/use-unified-import-flow";
import { pickPortabilityImportFile } from "@/app/features/profiles/services/portability-file-picker";

type Props = Readonly<{
  publicKeyHex: PublicKeyHex | null;
  resolveActivePrivateKeyHex: () => Promise<PrivateKeyHex | null>;
}>;

export function ProfileWindowImportPanel(props: Props): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importFlow = useUnifiedImportFlow({
    publicKeyHex: props.publicKeyHex,
    resolveActivePrivateKeyHex: props.resolveActivePrivateKeyHex,
  });

  const handlePick = async (): Promise<void> => {
    const picked = await pickPortabilityImportFile("unified_account");
    if (picked) {
      await importFlow.beginImportFromFile(picked);
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <div className="mt-3 rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-3">
      <div className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
        Restore from backup
      </div>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Fresh profile windows start empty. Sign in with your target account (or create it), then import a unified
        <span className="font-semibold"> .obscur-account-export.json </span>
        file from another device or an earlier export.
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
            Importing...
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Upload className="h-3.5 w-3.5" />
            Import unified backup
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
      {importFlow.preflightDialog}
    </div>
  );
}
