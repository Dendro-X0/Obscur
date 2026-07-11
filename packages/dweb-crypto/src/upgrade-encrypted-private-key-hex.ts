import type { EncryptedString } from "./encrypted-string";
import type { Passphrase } from "./passphrase";
import type { PrivateKeyHex } from "./private-key-hex";
import { decryptPrivateKeyHex } from "./decrypt-private-key-hex";
import { encryptPrivateKeyHex } from "./encrypt-private-key-hex";
import { isLegacyIdentityEnvelopePayload } from "./parse-identity-envelope";

/**
 * Re-wrap legacy PBKDF2 identity blobs to Argon2id after a successful unlock.
 * Returns null when the payload is already v2 or cannot be parsed.
 */
export const upgradeEncryptedPrivateKeyHexIfLegacy = async (params: Readonly<{
  payload: EncryptedString;
  passphrase: Passphrase;
}>): Promise<EncryptedString | null> => {
  if (!isLegacyIdentityEnvelopePayload(params.payload)) {
    return null;
  }
  const privateKeyHex: PrivateKeyHex = await decryptPrivateKeyHex({
    payload: params.payload,
    passphrase: params.passphrase,
  });
  return encryptPrivateKeyHex({
    privateKeyHex,
    passphrase: params.passphrase,
  });
};
