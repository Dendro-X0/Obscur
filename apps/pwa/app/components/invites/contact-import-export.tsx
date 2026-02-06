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

export const ContactImportExport = () => {
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
      const validation = await inviteManager.validateContactListFormat(JSON.parse(fileContent));

      if (!validation.isValid) {
        setImportState({
          status: "error",
          error: `${t("common.invalid")} ${t("invites.fileFormat")}: ${validation.errors.join(", ")}`
        });
        return;
      }

      setImportState({ status: "importing", progress: 0, total: 0 });
      const result = await inviteManager.importContactsFromFile(fileContent);
      setImportState({ status: "completed", result });
    } catch (error) {
      setImportState({
        status: "error",
        error: error instanceof Error ? error.message : t("invites.importFailed")
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const exportData = await inviteManager.exportContactsToFile();
      const blob = new Blob([exportData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `obscur-contacts-${Date.now()}.json`;
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
      <Card title={t("invites.importContacts")} description={t("invites.importContactsDesc")}>
        <div className="space-y-4">
          {importState.status === "idle" && (
            <>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {t("invites.importSourceDesc")}
              </div>

              <div>
                <Label htmlFor="fileInput">{t("invites.selectFile")}</Label>
                <input
                  ref={fileInputRef}
                  id="fileInput"
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelect}
                  className="mt-1 w-full text-sm text-zinc-900 dark:text-zinc-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-zinc-900 file:text-white hover:file:bg-zinc-800 dark:file:bg-zinc-100 dark:file:text-zinc-900 dark:hover:file:bg-white file:cursor-pointer"
                />
              </div>

              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-3 text-xs text-blue-900 dark:text-blue-100">
                <div className="font-medium mb-1">{t("invites.supportedFormats")}</div>
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
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {t("invites.validating")}
              </div>
            </div>
          )}

          {importState.status === "importing" && (
            <div className="text-center py-8">
              <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                {t("invites.importing")}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-500">
                {t("invites.importLargeListNote")}
              </div>
            </div>
          )}

          {importState.status === "completed" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-4">
                <div className="text-sm font-medium text-emerald-900 dark:text-emerald-100 mb-2">
                  {t("invites.importCompleted")}
                </div>
                <div className="space-y-1 text-xs text-emerald-800 dark:text-emerald-200">
                  <div>{t("invites.totalContacts")}: {importState.result.totalContacts}</div>
                  <div>{t("invites.successfulImports")}: {importState.result.successfulImports}</div>
                  <div>{t("invites.duplicatesSkipped")}: {importState.result.duplicates}</div>
                  <div>{t("invites.failed")}: {importState.result.failedImports}</div>
                </div>
              </div>

              {importState.result.errors.length > 0 && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-4">
                  <div className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
                    {t("invites.importErrors")} ({importState.result.errors.length})
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
                {t("invites.importAnother")}
              </Button>
            </div>
          )}

          {importState.status === "error" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-4">
                <div className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
                  {t("invites.importFailed")}
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
      <Card title={t("invites.exportContacts")} description={t("invites.exportContactsDesc")}>
        <div className="space-y-4">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("invites.exportSourceDesc")}
          </div>

          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-3 text-xs text-blue-900 dark:text-blue-100">
            <div className="font-medium mb-1">{t("invites.exportFormat")}</div>
            <div>
              {t("invites.exportFormatDesc")}
            </div>
          </div>

          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full"
          >
            {isExporting ? t("invites.exporting") : t("invites.exportContacts")}
          </Button>
        </div>
      </Card>

      {/* Import Instructions */}
      <Card title={t("invites.importInstructions")} description={t("invites.howToPrepare")}>
        <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
          <div>
            <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
              {t("invites.fileFormat")}
            </div>
            <div className="text-xs">
              {t("invites.fileFormatDesc")}
            </div>
          </div>

          <div>
            <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
              {t("invites.exampleStructure")}
            </div>
            <pre className="mt-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 p-3 text-xs overflow-x-auto scrollbar-immersive">
              {`{
  "contacts": [
    {
      "publicKey": "npub1...",
      "petname": "Alice",
      "relayUrl": "wss://relay.example.com"
    }
  ],
  "version": 1,
  "createdAt": 1234567890
}`}
            </pre>
          </div>

          <div>
            <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
              {t("invites.validation")}
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>{t("invites.validationKeys")}</li>
              <li>{t("invites.validationDuplicates")}</li>
              <li>{t("invites.validationErrors")}</li>
              <li>{t("invites.validationLarge")}</li>
            </ul>
          </div>

          <div>
            <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
              {t("invites.rateLimiting")}
            </div>
            <div className="text-xs">
              {t("invites.rateLimitingDesc")}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
