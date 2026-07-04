import type { AuthAssistantVaultPayload } from "../contracts/auth-assistant-entry";
import { AUTH_ASSISTANT_PAYLOAD_VERSION } from "../contracts/auth-assistant-entry";

export const encodeAuthAssistantVaultPayload = (payload: AuthAssistantVaultPayload): string => (
  JSON.stringify(payload)
);

export const decodeAuthAssistantVaultPayload = (raw: string): AuthAssistantVaultPayload | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<AuthAssistantVaultPayload>;
    if (parsed.version !== AUTH_ASSISTANT_PAYLOAD_VERSION) {
      return null;
    }
    if (typeof parsed.username !== "string" || typeof parsed.passphrase !== "string") {
      return null;
    }
    if (!parsed.passphrase.trim()) {
      return null;
    }
    return {
      version: AUTH_ASSISTANT_PAYLOAD_VERSION,
      username: parsed.username.trim(),
      passphrase: parsed.passphrase,
    };
  } catch {
    return null;
  }
};
