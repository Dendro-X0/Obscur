import { schnorr } from "@noble/curves/secp256k1";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import { toArrayBuffer } from "@dweb/crypto/to-array-buffer";
import type { NostrEvent } from "./nostr-event";

type CreateNostrEventParams = Readonly<{
  privateKeyHex: PrivateKeyHex;
  createdAtUnixSeconds?: number;
  kind?: number;
  content: string;
  tags?: ReadonlyArray<ReadonlyArray<string>>;
}>;

type NostrEventTemplate = Readonly<{
  pubkey: string;
  created_at: number;
  kind: number;
  tags: ReadonlyArray<ReadonlyArray<string>>;
  content: string;
}>;

const toHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");
};

const sha256Hex = async (payload: string): Promise<string> => {
  const bytes: Uint8Array = new TextEncoder().encode(payload);
  const digest: ArrayBuffer = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  return toHex(new Uint8Array(digest));
};

const buildIdPayloadJson = (template: NostrEventTemplate): string => {
  return JSON.stringify([0, template.pubkey, template.created_at, template.kind, template.tags, template.content]);
};

const getUnixSeconds = (): number => Math.floor(Date.now() / 1000);

export const createNostrEvent = async (params: CreateNostrEventParams): Promise<NostrEvent> => {
  const pubkey: string = derivePublicKeyHex(params.privateKeyHex);
  const createdAtUnixSeconds: number = params.createdAtUnixSeconds ?? getUnixSeconds();
  const kind: number = params.kind ?? 1;
  const tags: ReadonlyArray<ReadonlyArray<string>> = params.tags ?? [];
  const template: NostrEventTemplate = { pubkey, created_at: createdAtUnixSeconds, kind, tags, content: params.content };
  const id: string = await sha256Hex(buildIdPayloadJson(template));
  const sigBytes: Uint8Array = await schnorr.sign(id, params.privateKeyHex);
  const sig: string = toHex(sigBytes);
  return { ...template, id, sig };
};
