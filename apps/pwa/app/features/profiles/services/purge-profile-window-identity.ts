import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { runAuthKernelSignOutCleanup } from "@/app/features/auth-kernel/auth-kernel-sign-out-cleanup";
import { clearDeviceTrustArtifacts, revokeDeviceTrust } from "@/app/features/auth/services/device-trust-service";
import { endNativeDeviceSignInBestEffort } from "@/app/features/auth/services/native-device-session-lifecycle";
import { clearNativeSessionPersistError } from "@/app/features/auth/services/native-session-persist-feedback";
import { clearStoredIdentity } from "@/app/features/auth/utils/clear-stored-identity";
import { clearIdentityRecordsFromLocalStorage } from "@/app/features/auth/utils/identity-persistence";
import { clearProfileLocalData } from "./profile-data-cleanup";

const appendWarning = (
  warnings: string[],
  label: string,
  error: unknown,
): void => {
  const message = error instanceof Error ? error.message : String(error);
  warnings.push(`${label}: ${message}`);
};

/**
 * Removes every durable identity/session artifact for a profile window.
 * Native keychain is cleared first so a storage failure cannot leave unlockable state.
 */
export const purgeProfileWindowIdentityCompletely = async (params: Readonly<{
  profileId: string;
  publicKeyHex?: PublicKeyHex | null;
}>): Promise<ReadonlyArray<string>> => {
  const profileId = params.profileId.trim();
  const publicKeyHex = params.publicKeyHex ?? null;
  const warnings: string[] = [];

  try {
    await endNativeDeviceSignInBestEffort();
  } catch (error) {
    appendWarning(warnings, "Native keychain purge failed", error);
  }

  try {
    await runAuthKernelSignOutCleanup(profileId);
  } catch (error) {
    appendWarning(warnings, "Auth kernel sign-out cleanup failed", error);
  }

  try {
    revokeDeviceTrust(profileId);
    clearDeviceTrustArtifacts({ profileId, includeLegacy: true });
    clearNativeSessionPersistError(profileId);
  } catch (error) {
    appendWarning(warnings, "Device trust revoke failed", error);
  }

  try {
    clearIdentityRecordsFromLocalStorage({
      profileId,
      ...(publicKeyHex ? { publicKeyHex } : {}),
    });
  } catch (error) {
    appendWarning(warnings, "Identity localStorage purge failed", error);
  }

  try {
    await clearProfileLocalData(profileId);
  } catch (error) {
    appendWarning(warnings, "Profile local data purge failed", error);
  }

  try {
    await clearStoredIdentity();
  } catch (error) {
    appendWarning(warnings, "IndexedDB identity purge failed", error);
  }

  return warnings;
};
