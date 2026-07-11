import { fromBase64 } from "@dweb/crypto/from-base64";
import { toBase64 } from "@dweb/crypto/to-base64";
import { toArrayBuffer } from "@dweb/crypto/to-array-buffer";
import { importProfileDataKey } from "./profile-data-key";

export const STORAGE_ENVELOPE_SUITE = "obscur-storage-envelope-v1" as const;

export type StorageEnvelopePurpose =
  | "vault-media"
  | "profile-archive"
  | "sqlite-at-rest";

export type StorageEnvelopeV1 = Readonly<{
  v: 1;
  suite: typeof STORAGE_ENVELOPE_SUITE;
  purpose: StorageEnvelopePurpose;
  profileId: string;
  ivB64: string;
  ciphertextB64: string;
}>;

const textEncoder = new TextEncoder();

const createRandomIv = (): Uint8Array => {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  return iv;
};

export const encryptStorageEnvelopeV1 = async (params: Readonly<{
  plaintext: Uint8Array;
  keyMaterial: Uint8Array;
  purpose: StorageEnvelopePurpose;
  profileId: string;
}>): Promise<StorageEnvelopeV1> => {
  const iv = createRandomIv();
  const key = await importProfileDataKey(params.keyMaterial);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(params.plaintext),
  );
  return {
    v: 1,
    suite: STORAGE_ENVELOPE_SUITE,
    purpose: params.purpose,
    profileId: params.profileId.trim(),
    ivB64: toBase64(iv),
    ciphertextB64: toBase64(new Uint8Array(ciphertextBuffer)),
  };
};

export const decryptStorageEnvelopeV1 = async (params: Readonly<{
  envelope: StorageEnvelopeV1;
  keyMaterial: Uint8Array;
}>): Promise<Uint8Array> => {
  if (params.envelope.suite !== STORAGE_ENVELOPE_SUITE || params.envelope.v !== 1) {
    throw new Error("Unsupported storage envelope.");
  }
  const key = await importProfileDataKey(params.keyMaterial);
  const iv = fromBase64(params.envelope.ivB64);
  const ciphertext = fromBase64(params.envelope.ciphertextB64);
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext),
  );
  return new Uint8Array(plaintextBuffer);
};

export const decryptStorageEnvelopeV1WithKeyCandidates = async (params: Readonly<{
  envelope: StorageEnvelopeV1;
  keyMaterials: ReadonlyArray<Uint8Array>;
}>): Promise<Uint8Array> => {
  let lastError: unknown;
  for (const keyMaterial of params.keyMaterials) {
    try {
      return await decryptStorageEnvelopeV1({ envelope: params.envelope, keyMaterial });
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Unable to decrypt storage envelope.");
};

export const serializeStorageEnvelopeV1 = (envelope: StorageEnvelopeV1): string => (
  JSON.stringify(envelope)
);

export const parseStorageEnvelopeV1 = (raw: string): StorageEnvelopeV1 | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<StorageEnvelopeV1>;
    if (
      parsed?.v !== 1
      || parsed.suite !== STORAGE_ENVELOPE_SUITE
      || typeof parsed.purpose !== "string"
      || typeof parsed.profileId !== "string"
      || typeof parsed.ivB64 !== "string"
      || typeof parsed.ciphertextB64 !== "string"
    ) {
      return null;
    }
    return parsed as StorageEnvelopeV1;
  } catch {
    return null;
  }
};

export const isStorageEnvelopeV1Payload = (raw: string): boolean => {
  const trimmed = raw.trim();
  return trimmed.startsWith("{") && trimmed.includes(STORAGE_ENVELOPE_SUITE);
};

export const sha256Hex = async (input: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};
