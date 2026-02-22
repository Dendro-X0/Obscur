import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type IdentityRecord = Readonly<{
  encryptedPrivateKey: string;
  publicKeyHex: PublicKeyHex;
  username?: string;
}>;

export type { IdentityRecord };
