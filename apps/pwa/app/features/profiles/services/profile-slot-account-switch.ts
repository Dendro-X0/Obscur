import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { desktopProfileRuntime } from "./desktop-profile-runtime";
import { ProfileRegistryService } from "./profile-registry-service";
import {
  archiveProfileWorkspaceBeforeWipe,
} from "./profile-workspace-archive-service";
import type { ProfileWorkspaceArchiveWriteResult } from "./profile-workspace-archive-contracts";
import { clearLastBoundAccountPublicKeyHex } from "./profile-window-account-binding";
import { wipeProfileWorkspaceCompletely } from "./wipe-profile-workspace";

/**
 * Clears all local data for a profile window slot so a different account can sign in.
 * Optionally writes a workspace archive to the data-root / downloads first.
 */
export const clearProfileSlotForDifferentAccount = async (params: Readonly<{
  profileId: string;
  previousPublicKeyHex: PublicKeyHex | null;
  exportArchiveFirst: boolean;
  profileLabel?: string;
}>): Promise<ProfileWorkspaceArchiveWriteResult | null> => {
  let archiveResult: ProfileWorkspaceArchiveWriteResult | null = null;
  if (params.exportArchiveFirst) {
    archiveResult = await archiveProfileWorkspaceBeforeWipe({
      profileId: params.profileId,
      profileLabel: params.profileLabel,
      reason: "account_switch",
      lastBoundPublicKeyHex: params.previousPublicKeyHex,
    });
  }
  await wipeProfileWorkspaceCompletely({
    profileId: params.profileId,
    publicKeyHex: params.previousPublicKeyHex,
  });
  clearLastBoundAccountPublicKeyHex(params.profileId);
  return archiveResult;
};

/** Preferred path: open a fresh desktop profile window for the next sign-in. */
export const openFreshProfileWindowForSignIn = async (label = "New profile window"): Promise<string> => {
  if (hasNativeRuntime()) {
    const beforeIds = new Set(desktopProfileRuntime.getSnapshot().profiles.map((profile) => profile.profileId));
    const nextSnapshot = await desktopProfileRuntime.createProfile(label);
    const created = nextSnapshot.profiles.find(
      (profile) => !beforeIds.has(profile.profileId),
    );
    const profileId = created?.profileId;
    if (!profileId) {
      throw new Error("Could not resolve new profile window id.");
    }
    await desktopProfileRuntime.openProfileWindow(profileId);
    return profileId;
  }

  const before = ProfileRegistryService.getState();
  const created = ProfileRegistryService.createProfile(label);
  if (!created.ok) {
    throw new Error(created.message ?? "Could not create a new profile window.");
  }
  const newProfile = created.value.profiles.find(
    (profile) => !before.profiles.some((existing) => existing.profileId === profile.profileId),
  );
  const profileId = newProfile?.profileId;
  if (!profileId) {
    throw new Error("Could not resolve new profile window id.");
  }
  return profileId;
};
