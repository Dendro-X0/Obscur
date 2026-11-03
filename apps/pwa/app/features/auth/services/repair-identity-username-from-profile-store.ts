import {
  readIdentityRecordFromLocalStorage,
  writeIdentityRecordToLocalStorage,
} from "@/app/features/auth/utils/identity-persistence";
import { resolveIdentityUsernameRepair } from "./resolve-unlock-account-display-name";

/** Rewrite poisoned IdentityRecord.username to match profile-store when they diverge. */
export const repairIdentityUsernameFromProfileStore = (params: Readonly<{
  profileId: string;
  profileStoreUsername?: string | null;
}>): boolean => {
  const record = readIdentityRecordFromLocalStorage(params.profileId);
  if (!record) {
    return false;
  }
  const nextUsername = resolveIdentityUsernameRepair({
    profileId: params.profileId,
    identityUsername: record.username,
    profileStoreUsername: params.profileStoreUsername,
  });
  if (!nextUsername) {
    return false;
  }
  writeIdentityRecordToLocalStorage({
    profileId: params.profileId,
    record: {
      ...record,
      username: nextUsername,
    },
  });
  return true;
};
