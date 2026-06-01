import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

/** Small sidecar written next to exports — fast to scan without parsing large payloads. */
export const OBSCUR_LOCAL_SAVE_FORMAT = "obscur.local_save.v1" as const;

export type ObscurLocalSavePayloadKind =
  | "unified_account_export"
  | "portable_account_bundle"
  | "workspace_bundle";

export type ObscurLocalSaveSidecar = Readonly<{
  version: 1;
  format: typeof OBSCUR_LOCAL_SAVE_FORMAT;
  saveId: string;
  publicKeyHex: PublicKeyHex;
  profileLabel?: string;
  exportedAtUnixMs: number;
  payloadFileName: string;
  payloadKind: ObscurLocalSavePayloadKind;
  payloadFormat: string;
  payloadBytes: number;
}>;

/** Entry returned from a library scan (native or web fallback). */
export type LocalSaveLibraryEntry = Readonly<{
  saveId: string;
  absolutePath: string;
  payloadAbsolutePath: string;
  fileName: string;
  publicKeyHex: PublicKeyHex;
  profileLabel?: string;
  exportedAtUnixMs: number;
  payloadKind: ObscurLocalSavePayloadKind;
  payloadFormat: string;
  payloadBytes: number;
  modifiedAtUnixMs: number;
  scanRoot: string;
  discovery: "sidecar" | "payload_header";
}>;

export type LocalSaveLibraryScanResult = Readonly<{
  scannedAtUnixMs: number;
  roots: ReadonlyArray<string>;
  entries: ReadonlyArray<LocalSaveLibraryEntry>;
  truncated: boolean;
  durationMs: number;
}>;
