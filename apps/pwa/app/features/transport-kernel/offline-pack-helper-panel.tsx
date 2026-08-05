"use client";

/**
 * R-RELAY-RUST-6d — USB / QR chunk helper for offline packs (Settings → Relays).
 * Evidence copy: imported offline ≠ live relay delivery.
 */

import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, HardDrive, QrCode, Upload } from "lucide-react";

import { Button } from "@dweb/ui-kit/button";
import { Input } from "@dweb/ui-kit/input";
import { Label } from "@dweb/ui-kit/label";
import { Textarea } from "@dweb/ui-kit/textarea";
import { toast } from "@dweb/ui-kit/toast";
import { cn } from "@/app/lib/utils";
import { isTauriEngineHostAvailable } from "@obscur/engine-host/tauri";

import {
  assembleOfflinePackJson,
  chunkOfflinePackJson,
  parseOfflineQrChunkJson,
  type OfflineQrChunkV1,
} from "./offline-pack-qr-chunks";
import {
  buildLabOfflineEnvelopeWire,
  exportOfflinePackViaHost,
  importOfflinePackViaHost,
  OFFLINE_PACK_FILE_SUFFIX,
} from "./offline-pack-usb-helper";

export type OfflinePackHelperPanelProps = Readonly<{
  profileId: string;
}>;

const bytesToBase64 = (bytes: Uint8Array): string => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

export function OfflinePackHelperPanel({
  profileId,
}: OfflinePackHelperPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const desktop = isTauriEngineHostAvailable();
  const resolvedProfileId = profileId.trim();

  const [packKeyHex, setPackKeyHex] = useState(() => "07".repeat(32));
  const [ciphertextBase64, setCiphertextBase64] = useState(() => bytesToBase64(new Uint8Array([9, 8, 7, 6])));
  const [exportFileName, setExportFileName] = useState(
    `offline-pack${OFFLINE_PACK_FILE_SUFFIX}`,
  );
  const [importFilePath, setImportFilePath] = useState("");
  const [persistToDm, setPersistToDm] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [qrChunks, setQrChunks] = useState<ReadonlyArray<OfflineQrChunkV1>>([]);
  const [qrPaste, setQrPaste] = useState("");
  const [assembledPreview, setAssembledPreview] = useState("");

  const evidenceNote = t("settings.relays.offlinePackEvidenceNote", {
    defaultValue:
      "Imported offline means the pack was accepted into this vault — not delivered on a live relay.",
  });

  const onExport = useCallback(async () => {
    setBusy(true);
    setStatus("");
    try {
      const envelope = buildLabOfflineEnvelopeWire({
        envelopeId: `env-offline-${Date.now()}`,
        profileId: resolvedProfileId,
        ciphertextBase64: ciphertextBase64.trim(),
      });
      const result = await exportOfflinePackViaHost({
        profileId: resolvedProfileId,
        packKeyHex,
        envelopes: [envelope],
        fileName: exportFileName.trim() || `offline-pack${OFFLINE_PACK_FILE_SUFFIX}`,
      });
      if (!result.ok) {
        setStatus(result.errorMessage ?? "export_failed");
        return;
      }
      const data = result.data as { filePath?: string } | undefined;
      const path = data?.filePath ?? exportFileName;
      setStatus(`export_ready:${path}`);
      toast.success(
        t("settings.relays.offlinePackExportOk", {
          defaultValue: "Offline pack exported (USB / file).",
        }),
      );
    } finally {
      setBusy(false);
    }
  }, [ciphertextBase64, exportFileName, packKeyHex, resolvedProfileId, t]);

  const onImport = useCallback(async () => {
    setBusy(true);
    setStatus("");
    try {
      const result = await importOfflinePackViaHost({
        profileId: resolvedProfileId,
        packKeyHex,
        filePath: importFilePath,
        persistToDm,
      });
      if (!result.ok) {
        setStatus(result.errorMessage ?? "import_failed");
        toast.error(
          t("settings.relays.offlinePackImportFail", {
            defaultValue: "Offline pack import rejected.",
          }),
        );
        return;
      }
      setStatus("imported_offline");
      toast.success(
        t("settings.relays.offlinePackImportOk", {
          defaultValue: "Pack imported offline (not live relay OK).",
        }),
      );
    } finally {
      setBusy(false);
    }
  }, [importFilePath, packKeyHex, persistToDm, resolvedProfileId, t]);

  const onBuildQrFromLabPack = useCallback(() => {
    const envelope = buildLabOfflineEnvelopeWire({
      envelopeId: "env-qr-preview",
      profileId: resolvedProfileId,
      ciphertextBase64: ciphertextBase64.trim() || "CQgHBg==",
      createdAtUnixMs: 1_700_000_000_000,
    });
    const preview = JSON.stringify({
      schema: "obscur-offline-pack/v1",
      profileIdHint: resolvedProfileId,
      createdAtUnixMs: 1_700_000_000_000,
      envelopes: [envelope],
      packMac: "2728ce2f00000000000000000000000000000000000000000000000000000000",
    });
    const chunks = chunkOfflinePackJson(preview, 120);
    setQrChunks(chunks);
    setStatus(`qr_chunks:${chunks.length}`);
  }, [ciphertextBase64, resolvedProfileId]);

  const onAssembleQrPaste = useCallback(() => {
    const lines = qrPaste
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const chunks: OfflineQrChunkV1[] = [];
    for (const line of lines) {
      const parsed = parseOfflineQrChunkJson(line);
      if (!parsed.ok) {
        setStatus(`qr_${parsed.reason}`);
        setAssembledPreview("");
        return;
      }
      chunks.push(parsed.chunk);
    }
    const assembled = assembleOfflinePackJson(chunks);
    if (!assembled.ok) {
      setStatus(`qr_${assembled.reason}`);
      setAssembledPreview("");
      return;
    }
    setAssembledPreview(assembled.packJson);
    setStatus("qr_assembled");
  }, [qrPaste]);

  const copyChunk = useCallback(async (chunk: OfflineQrChunkV1) => {
    const text = JSON.stringify(chunk);
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`QR chunk ${chunk.index + 1}/${chunk.total} copied`);
    } catch {
      toast.error("Clipboard unavailable");
    }
  }, []);

  const hostHint = useMemo(() => {
    if (desktop) {
      return null;
    }
    return t("settings.relays.offlinePackDesktopRequired", {
      defaultValue: "Export/import IPC requires the desktop (Tauri) host.",
    });
  }, [desktop, t]);

  return (
    <section
      id="offline-pack-helper"
      data-testid="offline-pack-helper-panel"
      className="space-y-4 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-white to-zinc-50/40 p-5 shadow-sm dark:border-amber-500/25 dark:from-amber-500/10 dark:via-zinc-950 dark:to-zinc-900/40"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-amber-700 dark:text-amber-300" />
          <h3 className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {t("settings.relays.offlinePackTitle", {
              defaultValue: "Offline pack (USB / QR chunks)",
            })}
          </h3>
        </div>
        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
          {t("settings.relays.offlinePackDesc", {
            defaultValue:
              "Sneakernet helper for ciphertext packs. Profile-scoped. No BLE.",
          })}
        </p>
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-900 dark:text-amber-100">
          {evidenceNote}
        </p>
        <p className="text-[11px] font-mono text-zinc-500">
          profileId={resolvedProfileId || "(missing)"}
        </p>
        {hostHint ? (
          <p className="text-xs text-rose-600 dark:text-rose-300">{hostHint}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Pack key (hex)</Label>
        <Input
          value={packKeyHex}
          onChange={(e) => setPackKeyHex(e.target.value)}
          className="font-mono text-xs"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-black/5 bg-white/70 p-3 dark:border-white/10 dark:bg-black/25">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Upload className="h-3.5 w-3.5" />
            Export (USB / file)
          </div>
          <Label className="text-xs">Ciphertext (base64)</Label>
          <Input
            value={ciphertextBase64}
            onChange={(e) => setCiphertextBase64(e.target.value)}
            className="font-mono text-xs"
          />
          <Label className="text-xs">File name</Label>
          <Input
            value={exportFileName}
            onChange={(e) => setExportFileName(e.target.value)}
            className="font-mono text-xs"
          />
          <Button
            type="button"
            size="sm"
            disabled={busy || !desktop || !resolvedProfileId}
            onClick={() => void onExport()}
          >
            Export pack
          </Button>
        </div>

        <div className="space-y-3 rounded-xl border border-black/5 bg-white/70 p-3 dark:border-white/10 dark:bg-black/25">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <HardDrive className="h-3.5 w-3.5" />
            Import (USB / file)
          </div>
          <Label className="text-xs">Absolute pack path</Label>
          <Input
            value={importFilePath}
            onChange={(e) => setImportFilePath(e.target.value)}
            placeholder={`C:/…/pack${OFFLINE_PACK_FILE_SUFFIX}`}
            className="font-mono text-xs"
          />
          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={persistToDm}
              onChange={(e) => setPersistToDm(e.target.checked)}
            />
            Persist import receipts to dm (offline thread)
          </label>
          <Button
            type="button"
            size="sm"
            disabled={busy || !desktop || !resolvedProfileId || !importFilePath.trim()}
            onClick={() => void onImport()}
          >
            Import pack
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-black/5 bg-white/70 p-3 dark:border-white/10 dark:bg-black/25">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <QrCode className="h-3.5 w-3.5" />
          QR chunks (copy / paste — no camera)
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onBuildQrFromLabPack}>
            Build preview chunks
          </Button>
        </div>
        {qrChunks.length > 0 ? (
          <ul className="space-y-2">
            {qrChunks.map((chunk) => (
              <li
                key={`${chunk.packMacPrefix}-${chunk.index}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-black/5 px-2 py-1.5 text-xs dark:border-white/10"
              >
                <span className="font-mono">
                  {chunk.index + 1}/{chunk.total} · {chunk.packMacPrefix}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1"
                  onClick={() => void copyChunk(chunk)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <Label className="text-xs">Paste chunk JSON lines</Label>
        <Textarea
          value={qrPaste}
          onChange={(e) => setQrPaste(e.target.value)}
          className="min-h-[88px] font-mono text-[11px]"
          placeholder='{"schema":"obscur-offline-qr/v1",...}'
        />
        <Button type="button" size="sm" variant="secondary" onClick={onAssembleQrPaste}>
          Assemble chunks
        </Button>
        {assembledPreview ? (
          <pre className="max-h-32 overflow-auto rounded-lg bg-black/5 p-2 text-[10px] dark:bg-white/5">
            {assembledPreview}
          </pre>
        ) : null}
      </div>

      {status ? (
        <p
          className={cn(
            "font-mono text-[11px]",
            status.startsWith("imported") || status.startsWith("export_ready") || status === "qr_assembled"
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-zinc-600 dark:text-zinc-300",
          )}
          data-testid="offline-pack-helper-status"
        >
          {status}
        </p>
      ) : null}
    </section>
  );
}
