import { authFailed, authOk, type AuthResult } from "@dweb/auth/contracts/auth-result";
import type {
  DeviceUnlockPort,
  UnlockOutcome,
  UnlockWithPassphraseParams,
  UnlockWithPrivateKeyParams,
} from "@dweb/auth/ports/device-unlock-port";

/**
 * Cut 4.1 — package-facing DeviceUnlockPort factory.
 * Vite and Next supply handlers; neither imports the other's UI tree.
 */

export type DeviceUnlockHandlers = Readonly<{
  unlockWithPassphrase: (params: UnlockWithPassphraseParams) => Promise<UnlockOutcome>;
  unlockWithPrivateKey: (params: UnlockWithPrivateKeyParams) => Promise<UnlockOutcome>;
  revokeDeviceUnlockMaterial: (profileId: string) => Promise<void>;
}>;

export const mapDeviceUnlockFailure = (error: unknown): AuthResult<never> => {
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
  if (
    normalized.includes("profile scope")
    || normalized.includes("no device password unlock")
    || normalized.includes("invalid_input")
  ) {
    return authFailed({ reasonCode: "invalid_input", message });
  }
  if (
    normalized.includes("unsupported")
    || normalized.includes("not available")
    || normalized.includes("unknown command")
    || normalized.includes("command not found")
  ) {
    return authFailed({ reasonCode: "unsupported_runtime", message });
  }
  return authFailed({ reasonCode: "session_inactive", message });
};

export const createDelegatingDeviceUnlockPort = (
  handlers: DeviceUnlockHandlers,
): DeviceUnlockPort => ({
  unlockWithPassphrase: async (params) => {
    try {
      const outcome = await handlers.unlockWithPassphrase(params);
      return authOk(outcome);
    } catch (error) {
      return mapDeviceUnlockFailure(error);
    }
  },
  unlockWithPrivateKey: async (params) => {
    try {
      const outcome = await handlers.unlockWithPrivateKey(params);
      return authOk(outcome);
    } catch (error) {
      return mapDeviceUnlockFailure(error);
    }
  },
  revokeDeviceUnlockMaterial: async (profileId) => {
    try {
      await handlers.revokeDeviceUnlockMaterial(profileId);
      return authOk(undefined);
    } catch (error) {
      return mapDeviceUnlockFailure(error);
    }
  },
});

/** Fail-closed port when native unlock bridge is absent. */
export const createUnavailableDeviceUnlockPort = (
  message = "Native DeviceUnlockPort unavailable in this runtime",
): DeviceUnlockPort => ({
  unlockWithPassphrase: async () => authFailed({
    reasonCode: "unsupported_runtime",
    message,
  }),
  unlockWithPrivateKey: async () => authFailed({
    reasonCode: "unsupported_runtime",
    message,
  }),
  revokeDeviceUnlockMaterial: async () => authFailed({
    reasonCode: "unsupported_runtime",
    message,
  }),
});
