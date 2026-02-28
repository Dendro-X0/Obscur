import { cryptoService, type UnsignedNostrEvent } from "@/app/features/crypto/crypto-service";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export type DmFormat = "nip17" | "nip04";

export type DmEventBuildResult = Readonly<{
  format: DmFormat;
  signedEvent: NostrEvent;
  encryptedContent: string;
}>;

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
    const signedEvent: NostrEvent = await cryptoService.encryptGiftWrap(rumor, params.senderPrivateKeyHex, params.recipientPubkey);
    return { format: "nip17", signedEvent, encryptedContent: signedEvent.content };
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
  return { format: "nip04", signedEvent, encryptedContent };
};
