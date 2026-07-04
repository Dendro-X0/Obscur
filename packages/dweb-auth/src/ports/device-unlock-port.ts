import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { AuthUnlockOptions } from "../contracts/auth-unlock-options";
import type { AuthResult } from "../contracts/auth-result";

export type UnlockWithPassphraseParams = AuthUnlockOptions & Readonly<{
  passphrase: Passphrase;
  expectedPublicKeyHex: PublicKeyHex;
}>;

export type UnlockWithPrivateKeyParams = AuthUnlockOptions & Readonly<{
  privateKeyHex: PrivateKeyHex;
  expectedPublicKeyHex: PublicKeyHex;
}>;

export type UnlockOutcome = Readonly<{
  profileId: string;
  publicKeyHex: PublicKeyHex;
  staySignedInApplied: boolean;
}>;

/** Plane C — explicit device unlock (passphrase, import, assistant gesture). */
export type DeviceUnlockPort = Readonly<{
  unlockWithPassphrase: (params: UnlockWithPassphraseParams) => Promise<AuthResult<UnlockOutcome>>;
  unlockWithPrivateKey: (params: UnlockWithPrivateKeyParams) => Promise<AuthResult<UnlockOutcome>>;
  revokeDeviceUnlockMaterial: (profileId: string) => Promise<AuthResult<void>>;
}>;

export const DEVICE_UNLOCK_PORT_ID = "obscur.auth.device-unlock" as const;
