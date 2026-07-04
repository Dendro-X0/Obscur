import type { IdentityRecord } from "@dweb/core/identity-record";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { isPasswordlessNativeOnlyIdentity } from "@/app/features/auth/services/passwordless-native-only-identity";
import {
  listIdentityRecordCandidatesFromLocalStorage,
  parseIdentityRecord,
  readIdentityRecordFromLocalStorage,
  writeIdentityRecordToLocalStorage,
} from "@/app/features/auth/utils/identity-persistence";
import { logAppEvent } from "@/app/shared/log-app-event";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import {
  harvestProfileWebStorage,
  type HarvestedIdentitySnapshot,
} from "./profile-web-storage-harvest-service";

const normalizePubkey = (value: string): string => value.trim().toLowerCase();

const harvestedSnapshotToIdentityRecord = (
  snapshot: HarvestedIdentitySnapshot,
): IdentityRecord | undefined => parseIdentityRecord(snapshot.record);

const encryptedPrivateKeyScore = (record: IdentityRecord): number => (
  record.encryptedPrivateKey.length
);

const selectBestPasswordProtectedIdentity = (params: Readonly<{
  snapshots: ReadonlyArray<HarvestedIdentitySnapshot>;
  profileId: string;
  expectedPublicKeyHex?: PublicKeyHex;
}>): IdentityRecord | undefined => {
  const normalizedProfileId = params.profileId.trim();
  const normalizedExpectedPubkey = params.expectedPublicKeyHex
    ? normalizePubkey(params.expectedPublicKeyHex)
    : null;

  let best: IdentityRecord | undefined;
  let bestScore = -1;

  const considerSnapshot = (
    snapshot: HarvestedIdentitySnapshot,
    requireProfileMatch: boolean,
  ): void => {
    if (snapshot.isPasswordless) {
      return;
    }
    if (requireProfileMatch && snapshot.profileId.trim() !== normalizedProfileId) {
      return;
    }
    const record = harvestedSnapshotToIdentityRecord(snapshot);
    if (!record || isPasswordlessNativeOnlyIdentity(record)) {
      return;
    }
    if (normalizedExpectedPubkey && normalizePubkey(record.publicKeyHex) !== normalizedExpectedPubkey) {
      return;
    }
    const score = encryptedPrivateKeyScore(record)
      + (requireProfileMatch ? 1_000 : 0);
    if (score > bestScore) {
      best = record;
      bestScore = score;
    }
  };

  params.snapshots.forEach((snapshot) => considerSnapshot(snapshot, true));
  if (!best && normalizedExpectedPubkey) {
    params.snapshots.forEach((snapshot) => considerSnapshot(snapshot, false));
  }

  return best;
};

const findPasswordProtectedIdentityInLocalCandidates = (params: Readonly<{
  profileId: string;
  expectedPublicKeyHex?: PublicKeyHex;
}>): IdentityRecord | undefined => {
  const normalizedExpectedPubkey = params.expectedPublicKeyHex
    ? normalizePubkey(params.expectedPublicKeyHex)
    : null;
  const candidates = listIdentityRecordCandidatesFromLocalStorage(params.profileId);
  return candidates.find((record) => {
    if (isPasswordlessNativeOnlyIdentity(record)) {
      return false;
    }
    if (normalizedExpectedPubkey && normalizePubkey(record.publicKeyHex) !== normalizedExpectedPubkey) {
      return false;
    }
    return true;
  });
};

/**
 * Best-effort recovery of the password-encrypted identity row for this profile/account.
 * Checks alias localStorage keys first, then LevelDB harvest across sibling WebView roots.
 */
export const resolvePasswordProtectedIdentityRecord = async (params: Readonly<{
  profileId: string;
  expectedPublicKeyHex?: PublicKeyHex;
}>): Promise<IdentityRecord | undefined> => {
  const fromLocalCandidates = findPasswordProtectedIdentityInLocalCandidates(params);
  if (fromLocalCandidates) {
    writeIdentityRecordToLocalStorage({
      profileId: params.profileId,
      record: fromLocalCandidates,
    });
    return fromLocalCandidates;
  }

  const activeRecord = readIdentityRecordFromLocalStorage(params.profileId);
  if (activeRecord && !isPasswordlessNativeOnlyIdentity(activeRecord)) {
    return activeRecord;
  }

  if (!hasNativeRuntime()) {
    return undefined;
  }

  const repaired = await repairPasswordProtectedIdentityFromWebStorageHarvest(params);
  if (!repaired) {
    return undefined;
  }

  return readIdentityRecordFromLocalStorage(params.profileId)
    ?? findPasswordProtectedIdentityInLocalCandidates(params);
};

/**
 * After a data-root move/import, the active WebView snapshot may contain a passwordless
 * native-only identity even when an older sibling LevelDB file still holds the
 * password-encrypted record for the same profile window.
 */
export const repairPasswordProtectedIdentityFromWebStorageHarvest = async (params: Readonly<{
  profileId: string;
  expectedPublicKeyHex?: PublicKeyHex;
}>): Promise<boolean> => {
  if (!hasNativeRuntime()) {
    return false;
  }

  const harvest = await harvestProfileWebStorage({ includeDefaultAppData: true });
  const best = selectBestPasswordProtectedIdentity({
    snapshots: harvest.identities,
    profileId: params.profileId,
    expectedPublicKeyHex: params.expectedPublicKeyHex,
  });
  if (!best) {
    return false;
  }

  writeIdentityRecordToLocalStorage({
    profileId: params.profileId,
    record: best,
  });
  return true;
};

export const shouldAttemptPasswordProtectedIdentityRepair = (
  record: IdentityRecord | undefined,
): boolean => (
  !record || isPasswordlessNativeOnlyIdentity(record)
);

/**
 * Canonical identity load for auth bootstrap: prefer password-protected rows across
 * alias keys, then harvest sibling WebView storage when only passwordless remains.
 */
export const resolveStoredIdentityRecord = async (params: Readonly<{
  profileId: string;
  current?: IdentityRecord;
}>): Promise<IdentityRecord | undefined> => {
  let record = params.current ?? readIdentityRecordFromLocalStorage(params.profileId);
  if (!shouldAttemptPasswordProtectedIdentityRepair(record)) {
    return record;
  }

  const restored = await resolvePasswordProtectedIdentityRecord({
    profileId: params.profileId,
    expectedPublicKeyHex: record?.publicKeyHex,
  });
  if (restored) {
    record = restored;
    logAppEvent({
      name: "auth.identity_password_repair_restored",
      level: "info",
      scope: { feature: "auth", action: "identity_repair" },
      context: {
        profileId: params.profileId,
        publicKeySuffix: record.publicKeyHex?.slice(-8) ?? null,
      },
    });
  }

  return record;
};
