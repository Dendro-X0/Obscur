import { authFailed, authOk } from "@dweb/auth/contracts/auth-result";
import type { DeviceUnlockPort } from "@dweb/auth/ports/device-unlock-port";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

/**
 * Cut 3.2 lab DeviceUnlockPort — injectable stand-in for auth-kernel face.
 * Does not open SQLite / PDK. Native kernel adapter remains the production door.
 */
export const createLabDeviceUnlockPort = (params: Readonly<{
  acceptedPassphrase: string;
  publicKeyHex: PublicKeyHex;
}>): DeviceUnlockPort => ({
  unlockWithPassphrase: async (request) => {
    if (request.passphrase !== params.acceptedPassphrase) {
      return authFailed({
        reasonCode: "invalid_passphrase",
        message: "Incorrect passphrase",
      });
    }
    if (request.expectedPublicKeyHex !== params.publicKeyHex) {
      return authFailed({
        reasonCode: "identity_mismatch",
        message: "Identity mismatch",
      });
    }
    return authOk({
      profileId: request.profileId,
      publicKeyHex: params.publicKeyHex,
      staySignedInApplied: request.staySignedIn !== false,
    });
  },
  unlockWithPrivateKey: async () => authFailed({
    reasonCode: "unsupported_runtime",
    message: "Lab door: passphrase unlock only",
  }),
  revokeDeviceUnlockMaterial: async () => authOk(undefined),
});

/** Lab defaults — not product secrets; for local Vite door soaks only. */
export const LAB_AUTH_DOOR_DEFAULTS = {
  profileId: "lab",
  expectedPublicKeyHex: "b".repeat(64) as PublicKeyHex,
  acceptedPassphrase: "lab-unlock",
} as const;
