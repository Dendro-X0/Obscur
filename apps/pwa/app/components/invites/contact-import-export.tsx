"use client";

import { useState, useRef } from "react";
import { inviteManager } from "@/app/features/invites/utils/invite-manager";
import type { ImportResult } from "@/app/features/invites/utils/types";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Label } from "../ui/label";

type ImportState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "importing"; progress: number; total: number }
  | { status: "completed"; result: ImportResult }
  | { status: "error"; error: string };

export const ContactImportExport = () => {
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset state
    setImportState({ status: "validating" });

    try {
      // Read file content
      const fileContent = await file.text();

      // Validate format
      const validation = await inviteManager.validateContactListFormat(JSON.parse(fileContent));

      if (!validation.isValid) {
        setImportState({
          status: "error",
          error: `Invalid file format: ${validation.errors.join(", ")}`
        });
        return;
      }

      // Start import
      setImportState({ status: "importing", progress: 0, total: 0 });

      const result = await inviteManager.importContactsFromFile(fileContent);

      setImportState({ status: "completed", result });
    } catch (error) {
      setImportState({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to import contacts"
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const exportData = await inviteManager.exportContactsToFile();

      // Create blob and download
      const blob = new Blob([exportData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `obscur-contacts-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // TODO: Show success toast
    } catch (error) {
      console.error("Export failed:", error);
      // TODO: Show error toast
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
      <Card title="Import Contacts" description="Import contacts from a JSON file">
        <div className="space-y-4">
          {importState.status === "idle" && (
            <>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                Import contacts from a Nostr contact list (NIP-02 format) or an Obscur export file.
              </div>

              <div>
                <Label htmlFor="fileInput">Select File</Label>
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
                <div className="font-medium mb-1">Supported Formats</div>
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
                Validating file format...
              </div>
            </div>
          )}

          {importState.status === "importing" && (
            <div className="text-center py-8">
              <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                Importing contacts...
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-500">
                This may take a moment for large contact lists
              </div>
            </div>
          )}

          {importState.status === "completed" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-4">
                <div className="text-sm font-medium text-emerald-900 dark:text-emerald-100 mb-2">
                  Import Completed
                </div>
                <div className="space-y-1 text-xs text-emerald-800 dark:text-emerald-200">
                  <div>Total contacts: {importState.result.totalContacts}</div>
                  <div>Successfully imported: {importState.result.successfulImports}</div>
                  <div>Duplicates skipped: {importState.result.duplicates}</div>
                  <div>Failed: {importState.result.failedImports}</div>
                </div>
              </div>

              {importState.result.errors.length > 0 && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-4">
                  <div className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
                    Import Errors ({importState.result.errors.length})
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
                Import Another File
              </Button>
            </div>
          )}

          {importState.status === "error" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-4">
                <div className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
                  Import Failed
                </div>
                <div className="text-xs text-red-800 dark:text-red-200">
                  {importState.error}
                </div>
              </div>

              <Button onClick={handleReset} variant="secondary" className="w-full">
                Try Again
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Export Section */}
      <Card title="Export Contacts" description="Export your contacts to a JSON file">
        <div className="space-y-4">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Export all your contacts (except blocked ones) to a JSON file that can be imported later or shared with other Nostr clients.
          </div>

          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-3 text-xs text-blue-900 dark:text-blue-100">
            <div className="font-medium mb-1">Export Format</div>
            <div>
              Contacts are exported in NIP-02 compatible format, which can be imported by most Nostr clients.
            </div>
          </div>

          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full"
          >
            {isExporting ? "Exporting..." : "Export Contacts"}
          </Button>
        </div>
      </Card>

      {/* Import Instructions */}
      <Card title="Import Instructions" description="How to prepare your contact list">
        <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
          <div>
            <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
              File Format
            </div>
            <div className="text-xs">
              Your JSON file should contain a contacts array with public keys and optional metadata.
            </div>
          </div>

          <div>
            <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
              Example Structure
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
              Validation
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Public keys must be valid Nostr public keys</li>
              <li>Duplicate contacts will be skipped</li>
              <li>Invalid entries will be reported in the import results</li>
              <li>Large imports may take several minutes</li>
            </ul>
          </div>

          <div>
            <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
              Rate Limiting
            </div>
            <div className="text-xs">
              Imports are rate-limited to prevent system overload. Large contact lists will be processed in batches.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
