import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";

export type BiometricCapabilityStatus = "available" | "not_enrolled" | "unavailable";

export const DEFAULT_HARDWARE_UNLOCK_REASON = "Verify your identity to unlock Obscur.";

const normalizeCapabilityStatus = (value: unknown): BiometricCapabilityStatus => {
  if (value === "available" || value === "not_enrolled" || value === "unavailable") {
    return value;
  }
  return "unavailable";
};

export const probeBiometricCapability = async (): Promise<BiometricCapabilityStatus> => {
  if (!hasNativeRuntime()) {
    return "unavailable";
  }
  const result = await invokeNativeCommand<BiometricCapabilityStatus>("get_biometric_capability");
  if (!result.ok) {
    return "unavailable";
  }
  return normalizeCapabilityStatus(result.value);
};

export const requestHardwareUnlockVerification = async (
  message = DEFAULT_HARDWARE_UNLOCK_REASON,
): Promise<boolean> => {
  if (!hasNativeRuntime()) {
    return false;
  }
  const result = await invokeNativeCommand<boolean>("request_biometric_auth", { message });
  return result.ok && result.value === true;
};

export const isHardwareUnlockGateRequired = (): boolean => {
  if (!hasNativeRuntime()) {
    return false;
  }
  return PrivacySettingsService.getSettings().biometricLockEnabled;
};

/** Gate keychain / assistant restore when biometric lock is enabled. */
export const requireHardwareUnlockGateIfEnabled = async (): Promise<Readonly<{
  required: boolean;
  passed: boolean;
}>> => {
  if (!isHardwareUnlockGateRequired()) {
    return { required: false, passed: true };
  }
  const capability = await probeBiometricCapability();
  if (capability !== "available") {
    return { required: true, passed: false };
  }
  const passed = await requestHardwareUnlockVerification();
  return { required: true, passed };
};

export const mapBiometricCapabilityToUiState = (
  status: BiometricCapabilityStatus,
): "supported" | "unavailable" | "error" => (
  status === "available" ? "supported" : "unavailable"
);
