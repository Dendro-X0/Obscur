import type { DeviceUnlockPort } from "@dweb/auth/ports/device-unlock-port";
import { createDelegatingDeviceUnlockPort } from "@obscur/auth-engine";
import {
  revokeAuthKernelDeviceUnlockMaterial,
  runAuthKernelUnlockWithPassphrase,
  runAuthKernelUnlockWithPrivateKey,
} from "@/app/features/auth/services/auth-kernel-legacy-delegates";
import { deleteAuthAssistantVaultPayload } from "./services/auth-assistant-vault-service";

/**
 * Cut 4.1 — Next/auth-kernel face uses package delegating DeviceUnlockPort.
 * Vite must not import this file; it uses @obscur/auth-engine + its own handlers.
 */
export const createAuthKernelDeviceUnlockPort = (): DeviceUnlockPort => (
  createDelegatingDeviceUnlockPort({
    unlockWithPassphrase: async (params) => {
      const outcome = await runAuthKernelUnlockWithPassphrase(params);
      return {
        profileId: params.profileId,
        publicKeyHex: outcome.publicKeyHex,
        staySignedInApplied: outcome.staySignedInApplied,
      };
    },
    unlockWithPrivateKey: async (params) => {
      const outcome = await runAuthKernelUnlockWithPrivateKey(params);
      return {
        profileId: params.profileId,
        publicKeyHex: outcome.publicKeyHex,
        staySignedInApplied: outcome.staySignedInApplied,
      };
    },
    revokeDeviceUnlockMaterial: async (profileId) => {
      await revokeAuthKernelDeviceUnlockMaterial(profileId);
      await deleteAuthAssistantVaultPayload(profileId);
    },
  })
);
