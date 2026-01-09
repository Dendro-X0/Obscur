import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type IdentityRecord = Readonly<{
  encryptedPrivateKey: string;
  publicKeyHex: PublicKeyHex;
}>;

export type { IdentityRecord };
