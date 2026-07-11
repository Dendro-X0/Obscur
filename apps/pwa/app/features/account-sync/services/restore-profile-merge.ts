import type { UserProfile } from "@/app/features/profile/hooks/use-profile";
import type { IdentityUnlockSnapshot } from "../account-sync-contracts";

const mergeProfileTextField = (current: string, incoming: string): string => {
  const trimmedIncoming = incoming.trim();
  const trimmedCurrent = current.trim();
  return trimmedIncoming || trimmedCurrent;
};

/** Prefer non-empty incoming fields; never let empty backup strings erase local profile data. */
export const mergeProfileSnapshotsForRestore = (
  current: UserProfile,
  incoming: UserProfile,
): UserProfile => ({
  username: mergeProfileTextField(current.username, incoming.username),
  about: mergeProfileTextField(current.about ?? "", incoming.about ?? ""),
  avatarUrl: mergeProfileTextField(current.avatarUrl, incoming.avatarUrl),
  nip05: mergeProfileTextField(current.nip05, incoming.nip05),
  inviteCode: mergeProfileTextField(current.inviteCode, incoming.inviteCode),
});

export const enrichProfileSnapshotForRestore = (
  profile: UserProfile,
  identityUnlock: IdentityUnlockSnapshot | undefined,
  profileLabelHint?: string,
): UserProfile => {
  const identityUsername = identityUnlock?.username?.trim() ?? "";
  const labelUsername = profileLabelHint?.trim() ?? "";
  return {
    ...profile,
    username: profile.username.trim() || identityUsername || labelUsername,
  };
};

export const resolveRestoredProfileSnapshot = (
  current: UserProfile,
  incoming: UserProfile,
  identityUnlock: IdentityUnlockSnapshot | undefined,
  profileLabelHint?: string,
): UserProfile => enrichProfileSnapshotForRestore(
  mergeProfileSnapshotsForRestore(current, incoming),
  identityUnlock,
  profileLabelHint,
);
