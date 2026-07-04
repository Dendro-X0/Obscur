import type { IdentityRecord } from "@dweb/core/identity-record";
import type { Passphrase } from "@dweb/crypto/passphrase";
import { decryptPrivateKeyHex } from "@dweb/crypto/decrypt-private-key-hex";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { isPasswordlessNativeOnlyIdentity } from "@/app/features/auth/services/passwordless-native-only-identity";
import {
  listIdentityRecordCandidatesFromLocalStorage,
  parseIdentityRecord,
} from "@/app/features/auth/utils/identity-persistence";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { harvestProfileWebStorage } from "./profile-web-storage-harvest-service";

const normalizePubkey = (value: string): string => value.trim().toLowerCase();

const dedupeIdentityRecords = (records: ReadonlyArray<IdentityRecord>): IdentityRecord[] => {
  const seen = new Set<string>();
  const unique: IdentityRecord[] = [];
  records.forEach((record) => {
    const signature = `${record.publicKeyHex}::${record.encryptedPrivateKey}`;
    if (seen.has(signature)) {
      return;
    }
    seen.add(signature);
    unique.push(record);
  });
  return unique;
};

/**
 * Every password-encrypted identity row for this account on this device (local aliases + disk harvest).
 */
export const collectPasswordProtectedIdentityCandidates = async (params: Readonly<{
  profileId: string;
  publicKeyHex: PublicKeyHex;
}>): Promise<ReadonlyArray<IdentityRecord>> => {
  const normalizedPubkey = normalizePubkey(params.publicKeyHex);
  const localMatches = listIdentityRecordCandidatesFromLocalStorage(params.profileId)
    .filter((record) => (
      !isPasswordlessNativeOnlyIdentity(record)
      && normalizePubkey(record.publicKeyHex) === normalizedPubkey
    ));

  if (!hasNativeRuntime()) {
    return dedupeIdentityRecords(localMatches);
  }

  const harvest = await harvestProfileWebStorage({ includeDefaultAppData: true });
  const harvestedMatches = harvest.identities.flatMap((snapshot) => {
    if (snapshot.isPasswordless) {
      return [];
    }
    if (normalizePubkey(snapshot.publicKeyHex) !== normalizedPubkey) {
      return [];
    }
    const record = parseIdentityRecord(snapshot.record);
    if (!record || isPasswordlessNativeOnlyIdentity(record)) {
      return [];
    }
    return [record];
  });

  return dedupeIdentityRecords([...localMatches, ...harvestedMatches]);
};

export type PassphraseUnlockMatch = Readonly<{
  record: IdentityRecord;
  privateKeyHex: PrivateKeyHex;
}>;

const recordUnlocksWithPassphrase = async (
  record: IdentityRecord,
  passphrase: Passphrase,
  expectedPublicKeyHex: PublicKeyHex,
): Promise<PrivateKeyHex | undefined> => {
  try {
    const privateKeyHex = await decryptPrivateKeyHex({
      payload: record.encryptedPrivateKey,
      passphrase,
    });
    const derivedPublicKeyHex = derivePublicKeyHex(privateKeyHex);
    if (normalizePubkey(derivedPublicKeyHex) !== normalizePubkey(expectedPublicKeyHex)) {
      return undefined;
    }
    return privateKeyHex;
  } catch {
    return undefined;
  }
};

/**
 * Tries the active record first, then every harvested/local password-encrypted row for this pubkey.
 */
export const tryUnlockIdentityWithPassphrase = async (params: Readonly<{
  profileId: string;
  publicKeyHex: PublicKeyHex;
  passphrase: Passphrase;
  activeRecord?: IdentityRecord;
}>): Promise<PassphraseUnlockMatch | undefined> => {
  const candidates = await collectPasswordProtectedIdentityCandidates({
    profileId: params.profileId,
    publicKeyHex: params.publicKeyHex,
  });

  const ordered: IdentityRecord[] = [];
  if (
    params.activeRecord
    && !isPasswordlessNativeOnlyIdentity(params.activeRecord)
    && normalizePubkey(params.activeRecord.publicKeyHex) === normalizePubkey(params.publicKeyHex)
  ) {
    ordered.push(params.activeRecord);
  }
  candidates.forEach((candidate) => {
    if (candidate.encryptedPrivateKey === params.activeRecord?.encryptedPrivateKey) {
      return;
    }
    ordered.push(candidate);
  });

  const tried = new Set<string>();
  for (const record of dedupeIdentityRecords(ordered)) {
    if (tried.has(record.encryptedPrivateKey)) {
      continue;
    }
    tried.add(record.encryptedPrivateKey);
    const privateKeyHex = await recordUnlocksWithPassphrase(
      record,
      params.passphrase,
      params.publicKeyHex,
    );
    if (privateKeyHex) {
      return { record, privateKeyHex };
    }
  }

  return undefined;
};

/** Whether any password-encrypted identity row exists for this account on disk. */
export const hasPasswordProtectedUnlockOnDevice = async (params: Readonly<{
  profileId: string;
  publicKeyHex: PublicKeyHex;
}>): Promise<boolean> => {
  const candidates = await collectPasswordProtectedIdentityCandidates(params);
  return candidates.length > 0;
};

export const identityPassphraseUnlockInternals = {
  dedupeIdentityRecords,
  recordUnlocksWithPassphrase,
};
