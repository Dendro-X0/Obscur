import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { createNostrEvent } from "./create-nostr-event";
import type { NostrEvent } from "./nostr-event";
import { nip04Encrypt } from "./nip04-encrypt";

type CreateNostrDmEventParams = Readonly<{
  senderPrivateKeyHex: PrivateKeyHex;
  recipientPublicKeyHex: PublicKeyHex;
  plaintext: string;
  createdAtUnixSeconds?: number;
}>;

export const createNostrDmEvent = async (params: CreateNostrDmEventParams): Promise<NostrEvent> => {
  const encryptedContent: string = await nip04Encrypt({
    senderPrivateKeyHex: params.senderPrivateKeyHex,
    recipientPublicKeyHex: params.recipientPublicKeyHex,
    plaintext: params.plaintext
  });
  const createdAtParam: Readonly<{ createdAtUnixSeconds?: number }> =
    params.createdAtUnixSeconds === undefined ? {} : { createdAtUnixSeconds: params.createdAtUnixSeconds };
  return createNostrEvent({
    privateKeyHex: params.senderPrivateKeyHex,
    ...createdAtParam,
    kind: 4,
    content: encryptedContent,
    tags: [["p", params.recipientPublicKeyHex]]
  });
};
