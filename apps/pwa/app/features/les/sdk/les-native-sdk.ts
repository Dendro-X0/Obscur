/**
 * LES — Local Encrypted Store thin TypeScript SDK.
 * All persistence/crypto logic lives in Rust (`libobscur::les` + Tauri commands).
 */
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

export type LesKind = "image" | "video" | "audio" | "file";
export type LesSource = "secure_upload" | "chat_save";

export type LesCommitReceipt = Readonly<{
  lesObjectId: string;
  profileId: string;
  relativePath: string;
  catalogRevision: number;
}>;

export type LesObjectMeta = Readonly<{
  lesObjectId: string;
  profileId: string;
  kind: string;
  displayName: string;
  contentType: string;
  byteLength: number;
  createdAtUnixMs: number;
  source: string;
  sourceAttachmentUrl?: string | null;
  relativePath: string;
}>;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
};

export const isLesNativeAvailable = (): boolean => hasNativeRuntime();

export const commitLesObject = async (input: Readonly<{
  profileId?: string;
  bytes: Uint8Array;
  kind: LesKind;
  displayName: string;
  contentType: string;
  source: LesSource;
  sourceAttachmentUrl?: string;
}>): Promise<LesCommitReceipt> => {
  if (!hasNativeRuntime()) {
    throw new Error("LES requires the native desktop runtime");
  }
  if (input.bytes.byteLength === 0) {
    throw new Error("Cannot commit empty LES object");
  }
  const result = await invokeNativeCommand<LesCommitReceipt>("desktop_les_commit", {
    profileId: input.profileId ?? null,
    bytesB64: bytesToBase64(input.bytes),
    kind: input.kind,
    displayName: input.displayName,
    contentType: input.contentType,
    source: input.source,
    sourceAttachmentUrl: input.sourceAttachmentUrl ?? null,
  });
  if (!result.ok || !result.value) {
    throw new Error(!result.ok ? (result.message ?? "LES commit failed") : "LES commit failed");
  }
  return result.value;
};

/** Success only when commit returns and get proves the catalog row. */
export const commitLesObjectWithProof = async (
  input: Parameters<typeof commitLesObject>[0],
): Promise<LesCommitReceipt> => {
  const receipt = await commitLesObject(input);
  const row = await getLesObject(receipt.lesObjectId, receipt.profileId);
  if (!row || row.relativePath !== receipt.relativePath) {
    throw new Error("LES commit proof failed: catalog row missing");
  }
  return receipt;
};

export const listLesObjects = async (profileId?: string): Promise<ReadonlyArray<LesObjectMeta>> => {
  if (!hasNativeRuntime()) {
    return [];
  }
  const result = await invokeNativeCommand<LesObjectMeta[]>("desktop_les_list", {
    profileId: profileId ?? null,
  });
  if (!result.ok || !result.value) {
    throw new Error(!result.ok ? (result.message ?? "LES list failed") : "LES list failed");
  }
  return result.value;
};

export const getLesObject = async (
  lesObjectId: string,
  profileId?: string,
): Promise<LesObjectMeta | null> => {
  if (!hasNativeRuntime()) {
    return null;
  }
  const result = await invokeNativeCommand<LesObjectMeta | null>("desktop_les_get", {
    profileId: profileId ?? null,
    lesObjectId,
  });
  if (!result.ok) {
    throw new Error(result.message ?? "LES get failed");
  }
  return result.value ?? null;
};

export const readLesObjectDecrypted = async (
  lesObjectId: string,
  profileId?: string,
): Promise<Uint8Array> => {
  if (!hasNativeRuntime()) {
    throw new Error("LES requires the native desktop runtime");
  }
  const result = await invokeNativeCommand<string>("desktop_les_read_decrypted", {
    profileId: profileId ?? null,
    lesObjectId,
  });
  if (!result.ok || typeof result.value !== "string") {
    throw new Error(!result.ok ? (result.message ?? "LES read failed") : "LES read failed");
  }
  return base64ToBytes(result.value);
};

export type LesDeleteReceipt = Readonly<{
  deleted: boolean;
  lesObjectId: string;
  profileId: string;
}>;

/** Hard-remove catalog row + ciphertext for the active profile. */
export const deleteLesObject = async (
  lesObjectId: string,
  profileId?: string,
): Promise<LesDeleteReceipt> => {
  if (!hasNativeRuntime()) {
    throw new Error("LES requires the native desktop runtime");
  }
  const result = await invokeNativeCommand<LesDeleteReceipt>("desktop_les_delete", {
    profileId: profileId ?? null,
    lesObjectId,
  });
  if (!result.ok || !result.value) {
    throw new Error(!result.ok ? (result.message ?? "LES delete failed") : "LES delete failed");
  }
  return result.value;
};
