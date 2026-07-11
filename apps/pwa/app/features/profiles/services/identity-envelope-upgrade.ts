import type { IdentityRecord } from "@dweb/core/identity-record";
import type { Passphrase } from "@dweb/crypto/passphrase";
import { upgradeEncryptedPrivateKeyHexIfLegacy } from "@dweb/crypto/upgrade-encrypted-private-key-hex";

/**
 * After a successful passphrase unlock, migrate legacy PBKDF2 identity blobs to Argon2id v2.
 */
export const maybeUpgradeUnlockedIdentityRecord = async (params: Readonly<{
  record: IdentityRecord;
  passphrase: Passphrase;
}>): Promise<IdentityRecord | null> => {
  const upgradedPayload = await upgradeEncryptedPrivateKeyHexIfLegacy({
    payload: params.record.encryptedPrivateKey,
    passphrase: params.passphrase,
  });
  if (!upgradedPayload) {
    return null;
  }
  return {
    ...params.record,
    encryptedPrivateKey: upgradedPayload,
  };
};
