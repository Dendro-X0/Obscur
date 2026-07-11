import {
  AUTH_ASSISTANT_PAYLOAD_VERSION,
  decodeAuthAssistantVaultPayload,
  encodeAuthAssistantVaultPayload,
  type AuthAssistantVaultPayload,
} from "@dweb/auth";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import {
  DEFAULT_HARDWARE_UNLOCK_REASON,
  requestHardwareUnlockVerification,
} from "@/app/features/security/services/hardware-unlock-gate";

export const readAuthAssistantVaultRaw = async (profileId: string): Promise<string | null> => {
  if (!hasNativeRuntime()) {
    return null;
  }
  const trimmed = profileId.trim();
  if (!trimmed) {
    return null;
  }
  const result = await invokeNativeCommand<string | null>("auth_login_assist_read", {
    profileId: trimmed,
  });
  if (!result.ok) {
    return null;
  }
  const value = result.value;
  return typeof value === "string" && value.trim() ? value : null;
};

export const readAuthAssistantVaultPayload = async (
  profileId: string,
): Promise<AuthAssistantVaultPayload | null> => {
  const raw = await readAuthAssistantVaultRaw(profileId);
  if (!raw) {
    return null;
  }
  return decodeAuthAssistantVaultPayload(raw);
};

export const writeAuthAssistantVaultPayload = async (
  profileId: string,
  payload: AuthAssistantVaultPayload,
): Promise<void> => {
  if (!hasNativeRuntime()) {
    throw new Error("Auth assistant vault requires native runtime");
  }
  const trimmed = profileId.trim();
  if (!trimmed) {
    throw new Error("profileId is required");
  }
  const result = await invokeNativeCommand<void>("auth_login_assist_write", {
    profileId: trimmed,
    payload: encodeAuthAssistantVaultPayload({
      version: AUTH_ASSISTANT_PAYLOAD_VERSION,
      username: payload.username.trim(),
      passphrase: payload.passphrase,
    }),
  });
  if (!result.ok) {
    throw new Error(result.message ?? "auth_login_assist_write failed");
  }
};

export const deleteAuthAssistantVaultPayload = async (profileId: string): Promise<void> => {
  if (!hasNativeRuntime()) {
    return;
  }
  const trimmed = profileId.trim();
  if (!trimmed) {
    return;
  }
  await invokeNativeCommand<void>("auth_login_assist_delete", { profileId: trimmed });
};

export const requestAuthAssistantBiometricGate = async (): Promise<boolean> => {
  if (!hasNativeRuntime()) {
    return false;
  }
  return requestHardwareUnlockVerification(DEFAULT_HARDWARE_UNLOCK_REASON);
};
