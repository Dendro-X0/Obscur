"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { enrichProfileSnapshotForRestore } from "@/app/features/account-sync/services/restore-profile-merge";
import { getStoredIdentity } from "@/app/features/auth/utils/get-stored-identity";
import { readIdentityRecordFromLocalStorage } from "@/app/features/auth/utils/identity-persistence";
import { useProfileInternals } from "@/app/features/profile/hooks/use-profile";
import { PROFILE_CHANGED_EVENT } from "@/app/features/profiles/services/profile-registry-service";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

/**
 * Copies a stored identity display name into profile settings when the profile draft is still empty.
 * Covers greenfield create (username saved on identity first) and restore flows that unlocked before import applied.
 */
export const syncProfileDraftFromStoredIdentity = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
}>): Promise<boolean> => {
  const current = useProfileInternals.loadFromStorage().profile;
  if (current.username.trim()) {
    return false;
  }

  let record = (await getStoredIdentity()).record;
  if (!record || record.publicKeyHex !== params.publicKeyHex) {
    record = readIdentityRecordFromLocalStorage(getResolvedProfileId());
  }
  if (!record || record.publicKeyHex !== params.publicKeyHex) {
    return false;
  }

  const identityUsername = record.username?.trim() ?? "";
  if (!identityUsername) {
    return false;
  }

  const restoredProfile = enrichProfileSnapshotForRestore(current, {
    encryptedPrivateKey: record.encryptedPrivateKey,
    username: identityUsername,
  });
  useProfileInternals.saveToStorage({ profile: restoredProfile });
  useProfileInternals.setState({ profile: restoredProfile });
  useProfileInternals.notify();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PROFILE_CHANGED_EVENT));
  }
  return true;
};
