import type { EncryptedString } from "./encrypted-string";

type EncryptedPrivateKey = Readonly<{
  payload: EncryptedString;
}>;

export type { EncryptedPrivateKey };
