import type { IdentityRecord } from "@dweb/core/identity-record";

export const IDENTITY_RECOVERY_FILE_SCHEMA = "obscur.identity-recovery@1" as const;

export type IdentityRecoveryFilePayload = Readonly<{
  schema: typeof IDENTITY_RECOVERY_FILE_SCHEMA;
  exportedAt: string;
  username?: string;
  publicKeyHex: string;
  encryptedPrivateKey: string;
}>;

/** Builds a recovery JSON payload — ciphertext only, never plaintext private key. */
export const buildIdentityRecoveryFilePayload = (
  record: IdentityRecord,
  exportedAt: string = new Date().toISOString(),
): IdentityRecoveryFilePayload => ({
  schema: IDENTITY_RECOVERY_FILE_SCHEMA,
  exportedAt,
  username: record.username,
  publicKeyHex: record.publicKeyHex,
  encryptedPrivateKey: record.encryptedPrivateKey,
});

export const buildIdentityRecoveryFileName = (params: Readonly<{
  username?: string;
  publicKeyHex: string;
}>): string => {
  const safeName = (params.username?.trim() || "identity")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "identity";
  const suffix = params.publicKeyHex.trim().toLowerCase().slice(0, 8) || "unknown";
  return `obscur-identity-recovery-${safeName}-${suffix}.json`;
};

/**
 * Downloads the encrypted identity record as a recovery file (wallet-style offline backup).
 * Returns metadata for tests; does not include plaintext key material.
 */
export const downloadIdentityRecoveryFile = (params: Readonly<{
  record: IdentityRecord;
  fileName?: string;
}>): Readonly<{ fileName: string; byteLength: number }> => {
  const payload = buildIdentityRecoveryFilePayload(params.record);
  const fileName = params.fileName ?? buildIdentityRecoveryFileName({
    username: params.record.username,
    publicKeyHex: params.record.publicKeyHex,
  });
  const body = JSON.stringify(payload, null, 2);
  if (typeof document === "undefined") {
    return { fileName, byteLength: body.length };
  }
  const blob = new Blob([body], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return { fileName, byteLength: body.length };
};
