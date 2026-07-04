import type { Passphrase } from "@dweb/crypto/passphrase";
import type { AuthAssistantEntry, AuthAssistantUnlockParams } from "../contracts/auth-assistant-entry";
import type { AuthResult } from "../contracts/auth-result";
import type { UnlockOutcome } from "./device-unlock-port";

export type SaveAssistantUnlockParams = Readonly<{
  profileId: string;
  username: string;
  passphrase: Passphrase;
}>;

/**
 * Plane C UI — tap-to-unlock assistant on top of {@link DeviceUnlockPort}.
 * Passphrase material never leaves the assistant adapter boundary into React state.
 */
export type AuthAssistantPort = Readonly<{
  readEntry: (profileId: string) => Promise<AuthResult<AuthAssistantEntry | null>>;
  saveUnlockMaterial: (params: SaveAssistantUnlockParams) => Promise<AuthResult<void>>;
  removeUnlockMaterial: (profileId: string) => Promise<AuthResult<void>>;
  requestBiometricGate: () => Promise<AuthResult<boolean>>;
  unlockWithAssistantGesture: (params: AuthAssistantUnlockParams) => Promise<AuthResult<UnlockOutcome>>;
}>;

export const AUTH_ASSISTANT_PORT_ID = "obscur.auth.assistant" as const;
