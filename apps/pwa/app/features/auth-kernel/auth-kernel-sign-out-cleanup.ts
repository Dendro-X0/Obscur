import { deleteAuthAssistantVaultPayload } from "./services/auth-assistant-vault-service";
import { clearAuthKernelManualLock } from "./auth-kernel-manual-lock-state";

/**
 * AUTH-KERN-3 — canonical sign-out cleanup for auth-kernel plane C/D material.
 * OS keychain deletion remains owned by `endNativeDeviceSignInBestEffort`.
 */
export const runAuthKernelSignOutCleanup = async (profileId: string): Promise<void> => {
  const trimmed = profileId.trim();
  if (!trimmed) {
    return;
  }
  clearAuthKernelManualLock(trimmed);
  await deleteAuthAssistantVaultPayload(trimmed);
};
