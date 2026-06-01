import { parsePortableOrUnifiedImportEnvelope } from "./unified-account-export-service";

export type PendingProfileImport = Readonly<{
  profileId: string;
  fileName: string;
  rawJson: string;
  bundlePublicKeyHex: string;
  savedAtUnixMs: number;
}>;

const STORAGE_PREFIX = "obscur.pending_profile_import.v1::";
const MAX_PENDING_IMPORT_BYTES = 4 * 1024 * 1024;

const pendingImportStorageKey = (profileId: string): string => `${STORAGE_PREFIX}${profileId}`;

export const extractBundlePublicKeyHexFromRawJson = (rawJson: string): string | null => {
  try {
    const parsed = parsePortableOrUnifiedImportEnvelope(JSON.parse(rawJson));
    if (!parsed) {
      return null;
    }
    return parsed.kind === "unified"
      ? parsed.envelope.publicKeyHex
      : parsed.bundle.publicKeyHex;
  } catch {
    return null;
  }
};

export const loadPendingProfileImport = (profileId: string): PendingProfileImport | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.sessionStorage.getItem(pendingImportStorageKey(profileId));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PendingProfileImport>;
    if (
      parsed.profileId !== profileId
      || typeof parsed.fileName !== "string"
      || typeof parsed.rawJson !== "string"
      || typeof parsed.bundlePublicKeyHex !== "string"
      || typeof parsed.savedAtUnixMs !== "number"
    ) {
      return null;
    }
    return parsed as PendingProfileImport;
  } catch {
    return null;
  }
};

export const savePendingProfileImport = (params: Readonly<{
  profileId: string;
  fileName: string;
  rawJson: string;
}>): PendingProfileImport => {
  if (typeof window === "undefined") {
    throw new Error("Pending imports are only available in the browser.");
  }
  const bundlePublicKeyHex = extractBundlePublicKeyHexFromRawJson(params.rawJson);
  if (!bundlePublicKeyHex) {
    throw new Error("File is not a valid unified account export or portable bundle.");
  }
  if (params.rawJson.length > MAX_PENDING_IMPORT_BYTES) {
    throw new Error("Backup file is too large to stage before sign-in. Sign in first, then import.");
  }
  const pending: PendingProfileImport = {
    profileId: params.profileId,
    fileName: params.fileName,
    rawJson: params.rawJson,
    bundlePublicKeyHex,
    savedAtUnixMs: Date.now(),
  };
  window.sessionStorage.setItem(pendingImportStorageKey(params.profileId), JSON.stringify(pending));
  return pending;
};

export const clearPendingProfileImport = (profileId: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(pendingImportStorageKey(profileId));
};

export const pendingImportAccountPrefix = (publicKeyHex: string): string => `${publicKeyHex.slice(0, 8)}…`;
