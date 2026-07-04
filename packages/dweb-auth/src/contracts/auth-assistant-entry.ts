import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

/** Metadata surfaced to UI — never includes passphrase material. */
export type AuthAssistantEntry = Readonly<{
  profileId: string;
  username: string;
  label: string;
  hasSavedUnlock: boolean;
  biometricGateAvailable: boolean;
}>;

export type AuthAssistantUnlockParams = Readonly<{
  profileId: string;
  expectedPublicKeyHex: PublicKeyHex;
  requireBiometric?: boolean;
}>;

export const AUTH_ASSISTANT_PAYLOAD_VERSION = 1 as const;

export type AuthAssistantVaultPayload = Readonly<{
  version: typeof AUTH_ASSISTANT_PAYLOAD_VERSION;
  username: string;
  passphrase: string;
}>;
