import { cryptoService, type UnsignedNostrEvent } from "@/app/features/crypto/crypto-service";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export type DmFormat = "nip17" | "nip04";

export type DmEventBuildResult = Readonly<{
  format: DmFormat;
  signedEvent: NostrEvent;
  encryptedContent: string;
  canonicalEventId: string;
}>;

const toHex = (bytes: Uint8Array): string => (
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
);

const fallbackDigestHex = (payload: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").repeat(8);
};

const deriveUnsignedEventId = async (event: Readonly<{
  pubkey: string;
  created_at: number;
  kind: number;
  tags: ReadonlyArray<ReadonlyArray<string>>;
  content: string;
}>): Promise<string> => {
  const payload = JSON.stringify([0, event.pubkey, event.created_at, event.kind, event.tags, event.content]);
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    return toHex(new Uint8Array(digest));
  } catch {
    return fallbackDigestHex(payload);
  }
};

export const buildDmEvent = async (params: Readonly<{
  format: DmFormat;
  plaintext: string;
  recipientPubkey: PublicKeyHex;
  senderPubkey: PublicKeyHex;
  senderPrivateKeyHex: PrivateKeyHex;
  createdAtUnixSeconds: number;
  tags: ReadonlyArray<ReadonlyArray<string>>;
}>): Promise<DmEventBuildResult> => {
  if (params.format === "nip17") {
    const rumor: UnsignedNostrEvent = {
      kind: 14,
      created_at: params.createdAtUnixSeconds,
      tags: params.tags.map((t: ReadonlyArray<string>) => [...t]),
      content: params.plaintext,
      pubkey: params.senderPubkey
    };
    const canonicalEventId: string = await deriveUnsignedEventId(rumor);
    const signedEvent: NostrEvent = await cryptoService.encryptGiftWrap(rumor, params.senderPrivateKeyHex, params.recipientPubkey);
    return {
      format: "nip17",
      signedEvent,
      encryptedContent: signedEvent.content,
      canonicalEventId,
    };
  }
  const encryptedContent: string = await cryptoService.encryptDM(params.plaintext, params.recipientPubkey, params.senderPrivateKeyHex);
  const unsignedEvent: UnsignedNostrEvent = {
    kind: 4,
    created_at: params.createdAtUnixSeconds,
    tags: params.tags.map((t: ReadonlyArray<string>) => [...t]),
    content: encryptedContent,
    pubkey: params.senderPubkey
  };
  const signedEvent: NostrEvent = await cryptoService.signEvent(unsignedEvent, params.senderPrivateKeyHex);
  return {
    format: "nip04",
    signedEvent,
    encryptedContent,
    canonicalEventId: signedEvent.id,
  };
};

export const dmEventBuilderInternals = {
  deriveUnsignedEventId,
  fallbackDigestHex,
};
