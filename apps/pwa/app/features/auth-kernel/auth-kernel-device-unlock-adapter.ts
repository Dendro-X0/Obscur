import type { DeviceUnlockPort } from "@dweb/auth";
import { authFailed, authOk } from "@dweb/auth";
import {
  AuthKernelProfileScopeError,
  revokeAuthKernelDeviceUnlockMaterial,
  runAuthKernelUnlockWithPassphrase,
  runAuthKernelUnlockWithPrivateKey,
} from "@/app/features/auth/services/auth-kernel-legacy-delegates";
import { deleteAuthAssistantVaultPayload } from "./services/auth-assistant-vault-service";

const mapDeviceUnlockError = (error: unknown): ReturnType<typeof authFailed> => {
  if (error instanceof AuthKernelProfileScopeError) {
    return authFailed({
      reasonCode: "invalid_input",
      message: error.message,
    });
  }
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (
    normalized.includes("incorrect password")
    || normalized.includes("invalid passphrase")
    || normalized.includes("unable to authenticate")
    || normalized.includes("does not match stored identity")
  ) {
    return authFailed({ reasonCode: "invalid_passphrase", message });
  }
  if (normalized.includes("no device password unlock")) {
    return authFailed({ reasonCode: "invalid_input", message });
  }
  return authFailed({ reasonCode: "session_inactive", message });
};

export const createAuthKernelDeviceUnlockPort = (): DeviceUnlockPort => ({
  unlockWithPassphrase: async (params) => {
    try {
      const outcome = await runAuthKernelUnlockWithPassphrase(params);
      return authOk({
        profileId: params.profileId,
        publicKeyHex: outcome.publicKeyHex,
        staySignedInApplied: outcome.staySignedInApplied,
      });
    } catch (error) {
      return mapDeviceUnlockError(error);
    }
  },
  unlockWithPrivateKey: async (params) => {
    try {
      const outcome = await runAuthKernelUnlockWithPrivateKey(params);
      return authOk({
        profileId: params.profileId,
        publicKeyHex: outcome.publicKeyHex,
        staySignedInApplied: outcome.staySignedInApplied,
      });
    } catch (error) {
      return mapDeviceUnlockError(error);
    }
  },
  revokeDeviceUnlockMaterial: async (profileId) => {
    try {
      await revokeAuthKernelDeviceUnlockMaterial(profileId);
      await deleteAuthAssistantVaultPayload(profileId);
      return authOk(undefined);
    } catch (error) {
      return mapDeviceUnlockError(error);
    }
  },
});
