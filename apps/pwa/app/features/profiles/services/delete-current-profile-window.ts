import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { broadcastProfileIsolationChanged, desktopProfileRuntime } from "./desktop-profile-runtime";
import { releaseActiveSessionLeaseAsync } from "./cross-profile-active-session-lease";
import { clearPendingProfileImport } from "./pending-profile-import-service";
import { purgeProfileWindowIdentityCompletely } from "./purge-profile-window-identity";
import { getDefaultProfileId } from "./profile-scope";
import type { ProfileWorkspaceArchiveWriteResult } from "./profile-workspace-archive-contracts";
import { archiveProfileWorkspaceBeforeWipe } from "./profile-workspace-archive-service";
import { clearLastBoundAccountPublicKeyHex } from "./profile-window-account-binding";
import { wipeProfileWorkspaceCompletely } from "./wipe-profile-workspace";

export const DELETE_PROFILE_WINDOW_CONFIRM_TEXT = "DELETE PROFILE WINDOW";

/**
 * Wipes all local data for this profile window, releases the active-session lease,
 * and removes the window from the device registry when allowed (non-default desktop profiles).
 */
export const deleteCurrentProfileWindowCompletely = async (params: Readonly<{
  profileId: string;
  profileLabel?: string;
  publicKeyHex: PublicKeyHex | null;
  syncInMemoryIdentity?: () => Promise<void>;
}>): Promise<ProfileWorkspaceArchiveWriteResult | null> => {
  const profileId = params.profileId.trim();
  const archiveResult = await archiveProfileWorkspaceBeforeWipe({
    profileId,
    profileLabel: params.profileLabel,
    reason: "profile_removed",
    lastBoundPublicKeyHex: params.publicKeyHex,
  });

  if (params.publicKeyHex) {
    await releaseActiveSessionLeaseAsync({
      publicKeyHex: params.publicKeyHex,
      profileId,
    });
  }

  try {
    const purgeWarnings = await purgeProfileWindowIdentityCompletely({
      profileId,
      publicKeyHex: params.publicKeyHex,
    });
    if (purgeWarnings.length > 0) {
      console.warn("[deleteCurrentProfileWindowCompletely] identity purge warnings:", purgeWarnings);
    }
    if (params.syncInMemoryIdentity) {
      await params.syncInMemoryIdentity();
    }
  } catch (error) {
    console.error("[deleteCurrentProfileWindowCompletely] identity purge failed:", error);
    throw error;
  }

  clearLastBoundAccountPublicKeyHex(profileId);
  clearPendingProfileImport(profileId);

  await wipeProfileWorkspaceCompletely({
    profileId,
    publicKeyHex: params.publicKeyHex,
  });

  const isDefaultProfile = profileId === getDefaultProfileId();
  if (hasNativeRuntime() && !isDefaultProfile) {
    await desktopProfileRuntime.removeProfile(profileId);
  }

  await broadcastProfileIsolationChanged();

  return archiveResult;
};
