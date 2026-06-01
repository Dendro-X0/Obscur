import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { writeExportToDataRoot } from "./data-root-export-service";
import { UNIFIED_ACCOUNT_EXPORT_FORMAT } from "./unified-account-export-contracts";
import {
  OBSCUR_LOCAL_SAVE_FORMAT,
  type ObscurLocalSavePayloadKind,
  type ObscurLocalSaveSidecar,
} from "./local-save-contracts";

const sidecarFileNameForPayload = (payloadFileName: string): string => {
  const base = payloadFileName.replace(/\.[^./\\]+$/, "");
  return `${base}.obscur-save.json`;
};

export const buildObscurLocalSaveSidecar = (params: Readonly<{
  saveId?: string;
  publicKeyHex: PublicKeyHex;
  profileLabel?: string;
  exportedAtUnixMs: number;
  payloadFileName: string;
  payloadKind: ObscurLocalSavePayloadKind;
  payloadFormat: string;
  payloadBytes: number;
}>): ObscurLocalSaveSidecar => ({
  version: 1,
  format: OBSCUR_LOCAL_SAVE_FORMAT,
  saveId: params.saveId ?? crypto.randomUUID(),
  publicKeyHex: params.publicKeyHex.trim().toLowerCase() as PublicKeyHex,
  profileLabel: params.profileLabel?.trim() || undefined,
  exportedAtUnixMs: params.exportedAtUnixMs,
  payloadFileName: params.payloadFileName,
  payloadKind: params.payloadKind,
  payloadFormat: params.payloadFormat,
  payloadBytes: params.payloadBytes,
});

export const parseObscurLocalSaveSidecar = (raw: unknown): ObscurLocalSaveSidecar | null => {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const candidate = raw as Partial<ObscurLocalSaveSidecar>;
  const publicKeyHex = typeof candidate.publicKeyHex === "string"
    ? candidate.publicKeyHex.trim().toLowerCase()
    : "";
  if (
    candidate.version !== 1
    || candidate.format !== OBSCUR_LOCAL_SAVE_FORMAT
    || publicKeyHex.length !== 64
    || typeof candidate.saveId !== "string"
    || typeof candidate.payloadFileName !== "string"
    || typeof candidate.exportedAtUnixMs !== "number"
  ) {
    return null;
  }
  return {
    version: 1,
    format: OBSCUR_LOCAL_SAVE_FORMAT,
    saveId: candidate.saveId,
    publicKeyHex: publicKeyHex as PublicKeyHex,
    profileLabel: typeof candidate.profileLabel === "string" ? candidate.profileLabel : undefined,
    exportedAtUnixMs: candidate.exportedAtUnixMs,
    payloadFileName: candidate.payloadFileName,
    payloadKind: candidate.payloadKind ?? "unified_account_export",
    payloadFormat: typeof candidate.payloadFormat === "string" ? candidate.payloadFormat : UNIFIED_ACCOUNT_EXPORT_FORMAT,
    payloadBytes: typeof candidate.payloadBytes === "number" ? candidate.payloadBytes : 0,
  };
};

/** Writes tagged sidecar next to a unified export in workspace-exports (desktop data root). */
export const writeObscurLocalSaveSidecarForExport = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileLabel?: string;
  exportedAtUnixMs: number;
  payloadFileName: string;
  payloadFormat?: string;
  payloadBytes: number;
}>): Promise<void> => {
  const sidecar = buildObscurLocalSaveSidecar({
    publicKeyHex: params.publicKeyHex,
    profileLabel: params.profileLabel,
    exportedAtUnixMs: params.exportedAtUnixMs,
    payloadFileName: params.payloadFileName,
    payloadKind: "unified_account_export",
    payloadFormat: params.payloadFormat ?? UNIFIED_ACCOUNT_EXPORT_FORMAT,
    payloadBytes: params.payloadBytes,
  });
  await writeExportToDataRoot(
    sidecarFileNameForPayload(params.payloadFileName),
    JSON.stringify(sidecar, null, 2),
  );
};
