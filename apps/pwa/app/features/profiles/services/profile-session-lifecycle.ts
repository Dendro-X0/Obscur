import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { performAccountSessionHardReset } from "@/app/features/runtime/services/account-session-hard-reset";
import { resetLocalHistoryKeepingIdentity } from "@/app/features/messaging/services/local-history-reset-service";
import { wipeProfileWorkspaceCompletely } from "./wipe-profile-workspace";
import { archiveProfileWorkspaceBeforeWipe } from "./profile-workspace-archive-service";
import type { ProfileWorkspaceArchiveWriteResult } from "./profile-workspace-archive-contracts";
import type { ProfileWorkspaceArchiveReason } from "./profile-workspace-archive-contracts";
import {
  clearLastBoundAccountPublicKeyHex,
  evaluateProfileWindowAccountContinuity,
  setLastBoundAccountPublicKeyHex,
  type ProfileWindowAccountContinuity,
} from "./profile-window-account-binding";

export const recordProfileWindowAccountUnlock = (
  profileId: string,
  publicKeyHex: PublicKeyHex,
): ProfileWindowAccountContinuity => {
  const continuity = evaluateProfileWindowAccountContinuity(profileId, publicKeyHex);
  setLastBoundAccountPublicKeyHex(profileId, publicKeyHex);
  return continuity;
};

/**
 * Records account binding after a successful unlock.
 * Cross-account switches must be resolved before login via {@link assertProfileSlotAllowsLogin}
 * and {@link clearProfileSlotForDifferentAccount} — never by silent post-unlock wipes.
 */
export const handleProfileWindowAccountUnlock = (
  profileId: string,
  publicKeyHex: PublicKeyHex,
): ProfileWindowAccountContinuity => recordProfileWindowAccountUnlock(profileId, publicKeyHex);

/** Signs out of the session only — local profile data and archives are unchanged. */
export const finalizeProfileWindowLogout = async (params: Readonly<{
  profileId: string;
  hardReload?: boolean;
}>): Promise<void> => {
  if (params.hardReload !== false) {
    performAccountSessionHardReset({
      reason: "logout",
      profileId: params.profileId,
      nextPublicKeySuffix: null,
    });
  }
};

/** Archives workspace, wipes local data for the profile slot. Caller shows export path UI. */
export const finalizeProfileWorkspaceDeletion = async (params: Readonly<{
  profileId: string;
  profileLabel?: string;
  publicKeyHex?: PublicKeyHex | null;
  reason: Extract<ProfileWorkspaceArchiveReason, "profile_removed" | "settings_clear_data" | "settings_delete_account">;
}>): Promise<ProfileWorkspaceArchiveWriteResult | null> => {
  const archiveResult = await archiveProfileWorkspaceBeforeWipe({
    profileId: params.profileId,
    profileLabel: params.profileLabel,
    reason: params.reason,
    lastBoundPublicKeyHex: params.publicKeyHex ?? null,
  });
  clearLastBoundAccountPublicKeyHex(params.profileId);
  await wipeProfileWorkspaceCompletely({
    profileId: params.profileId,
    publicKeyHex: params.publicKeyHex ?? null,
  });
  return archiveResult;
};

export const finalizeProfileWindowRemoval = async (params: Readonly<{
  profileId: string;
  profileLabel?: string;
  publicKeyHex?: PublicKeyHex | null;
}>): Promise<ProfileWorkspaceArchiveWriteResult | null> => (
  finalizeProfileWorkspaceDeletion({
    ...params,
    reason: "profile_removed",
  })
);

/** Settings: export archive, clear caches/history, keep identity and sign-in. */
export const archiveAndClearProfileLocalDataKeepingIdentity = async (params: Readonly<{
  profileId: string;
  profileLabel?: string;
  publicKeyHex?: PublicKeyHex | null;
}>): Promise<ProfileWorkspaceArchiveWriteResult | null> => {
  const archiveResult = await archiveProfileWorkspaceBeforeWipe({
    profileId: params.profileId,
    profileLabel: params.profileLabel,
    reason: "settings_clear_data",
    lastBoundPublicKeyHex: params.publicKeyHex ?? null,
  });
  await resetLocalHistoryKeepingIdentity({
    profileId: params.profileId,
    publicKeyHex: params.publicKeyHex ?? null,
  });
  return archiveResult;
};
