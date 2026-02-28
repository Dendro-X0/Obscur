"use client";

import { useState, useRef } from "react";
import { inviteManager } from "@/app/features/invites/utils/invite-manager";
import type { ImportResult } from "@/app/features/invites/utils/types";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Label } from "../ui/label";
import { useTranslation } from "react-i18next";

type ImportState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "importing"; progress: number; total: number }
  | { status: "completed"; result: ImportResult }
  | { status: "error"; error: string };

export const ConnectionImportExport = () => {
  const { t } = useTranslation();
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportState({ status: "validating" });

    try {
      const fileContent = await file.text();
      const validation = await inviteManager.validateConnectionListFormat(JSON.parse(fileContent));

      if (!validation.isValid) {
        setImportState({
          status: "error",
          error: `${t("common.invalid")} ${t("network.fileFormat")}: ${validation.errors.join(", ")}`
        });
        return;
      }

      setImportState({ status: "importing", progress: 0, total: 0 });
      const result = await inviteManager.importConnectionsFromFile(fileContent);
      setImportState({ status: "completed", result });
    } catch (error) {
      setImportState({
        status: "error",
        error: error instanceof Error ? error.message : t("network.importFailed")
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const exportData = await inviteManager.exportConnectionsToFile();
      const blob = new Blob([exportData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `obscur-connections-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleReset = () => {
    setImportState({ status: "idle" });
  };

  return (
    <div className="space-y-4">
      {/* Import Section */}
      <Card title={t("network.importConnections")} description={t("network.importConnectionsDesc")}>
        <div className="space-y-4">
          {importState.status === "idle" && (
            <>
              <div className="text-sm text-muted-foreground">
                {t("network.importSourceDesc")}
              </div>

              <div>
                <Label htmlFor="fileInput">{t("network.selectFile")}</Label>
                <input
                  ref={fileInputRef}
                  id="fileInput"
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelect}
                  className="mt-1 w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
                />
              </div>

              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-3 text-xs text-blue-900 dark:text-blue-100">
                <div className="font-medium mb-1">{t("network.supportedFormats")}</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>Nostr contact lists (NIP-02)</li>
                  <li>Obscur contact exports</li>
                  <li>JSON files with contact data</li>
                </ul>
              </div>
            </>
          )}

          {importState.status === "validating" && (
            <div className="text-center py-8">
              <div className="text-sm text-muted-foreground">
                {t("network.validating")}
              </div>
            </div>
          )}

          {importState.status === "importing" && (
            <div className="text-center py-8">
              <div className="text-sm text-muted-foreground mb-2">
                {t("network.importing")}
              </div>
              <div className="text-xs text-muted-foreground/60">
                {t("network.importLargeListNote")}
              </div>
            </div>
          )}

          {importState.status === "completed" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-4">
                <div className="text-sm font-medium text-emerald-900 dark:text-emerald-100 mb-2">
                  {t("network.importCompleted")}
                </div>
                <div className="space-y-1 text-xs text-emerald-800 dark:text-emerald-200">
                  <div>{t("network.totalConnections")}: {importState.result.totalConnections}</div>
                  <div>{t("network.successfulImports")}: {importState.result.successfulImports}</div>
                  <div>{t("network.duplicatesSkipped")}: {importState.result.duplicates}</div>
                  <div>{t("network.failed")}: {importState.result.failedImports}</div>
                </div>
              </div>

              {importState.result.errors.length > 0 && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-4">
                  <div className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
                    {t("network.importErrors")} ({importState.result.errors.length})
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {importState.result.errors.slice(0, 10).map((error, index) => (
                      <div key={index} className="text-xs text-red-800 dark:text-red-200">
                        <div className="font-mono truncate">{error.publicKey}</div>
                        <div>{error.error}</div>
                      </div>
                    ))}
                    {importState.result.errors.length > 10 && (
                      <div className="text-xs text-red-700 dark:text-red-300">
                        ... and {importState.result.errors.length - 10} more errors
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Button onClick={handleReset} variant="secondary" className="w-full">
                {t("network.importAnother")}
              </Button>
            </div>
          )}

          {importState.status === "error" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-4">
                <div className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
                  {t("network.importFailed")}
                </div>
                <div className="text-xs text-red-800 dark:text-red-200">
                  {importState.error}
                </div>
              </div>

              <Button onClick={handleReset} variant="secondary" className="w-full">
                {t("common.tryAgain")}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Export Section */}
      <Card title={t("network.exportConnections")} description={t("network.exportConnectionsDesc")}>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {t("network.exportSourceDesc")}
          </div>

          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-3 text-xs text-blue-900 dark:text-blue-100">
            <div className="font-medium mb-1">{t("network.exportFormat")}</div>
            <div>
              {t("network.exportFormatDesc")}
            </div>
          </div>

          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full"
          >
            {isExporting ? t("network.exporting") : t("network.exportConnections")}
          </Button>
        </div>
      </Card>

      {/* Import Instructions */}
      <Card title={t("network.importInstructions")} description={t("network.howToPrepare")}>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div>
            <div className="font-medium text-foreground mb-1">
              {t("network.fileFormat")}
            </div>
            <div className="text-xs">
              {t("network.fileFormatDesc")}
            </div>
          </div>

          <div>
            <div className="font-medium text-foreground mb-1">
              {t("network.exampleStructure")}
            </div>
            <pre className="mt-1 rounded-lg bg-muted p-3 text-xs overflow-x-auto scrollbar-immersive text-foreground">
              {`{
  "connections": [
    {
      "publicKey": "npub1...",
      "petname": "Alice",
      "relayHint": "wss://relay.example.com"
    }
  ],
  "version": 1,
  "createdAt": 1234567890
}`}
            </pre>
          </div>

          <div>
            <div className="font-medium text-foreground mb-1">
              {t("network.validation")}
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>{t("network.validationKeys")}</li>
              <li>{t("network.validationDuplicates")}</li>
              <li>{t("network.validationErrors")}</li>
              <li>{t("network.validationLarge")}</li>
            </ul>
          </div>

          <div>
            <div className="font-medium text-foreground mb-1">
              {t("network.rateLimiting")}
            </div>
            <div className="text-xs">
              {t("network.rateLimitingDesc")}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
