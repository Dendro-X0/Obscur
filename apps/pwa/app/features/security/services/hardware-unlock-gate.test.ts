/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import {
  isHardwareUnlockGateRequired,
  mapBiometricCapabilityToUiState,
  probeBiometricCapability,
  requireHardwareUnlockGateIfEnabled,
} from "./hardware-unlock-gate";

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: vi.fn(() => true),
}));

vi.mock("@/app/features/runtime/native-adapters", () => ({
  invokeNativeCommand: vi.fn(async (command: string) => {
    if (command === "get_biometric_capability") {
      return { ok: true, value: "available" };
    }
    if (command === "request_biometric_auth") {
      return { ok: true, value: true };
    }
    return { ok: false, message: "unknown command" };
  }),
}));

describe("hardware unlock gate (KEY-MOAT Phase 6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    PrivacySettingsService.saveSettings({
      ...PrivacySettingsService.getSettings(),
      biometricLockEnabled: false,
    });
  });

  it("does not require gate when biometric lock is disabled", async () => {
    expect(isHardwareUnlockGateRequired()).toBe(false);
    await expect(requireHardwareUnlockGateIfEnabled()).resolves.toEqual({
      required: false,
      passed: true,
    });
  });

  it("requires successful OS verification when biometric lock is enabled", async () => {
    PrivacySettingsService.saveSettings({
      ...PrivacySettingsService.getSettings(),
      biometricLockEnabled: true,
    });
    await expect(requireHardwareUnlockGateIfEnabled()).resolves.toEqual({
      required: true,
      passed: true,
    });
  });

  it("maps native capability to UI states", () => {
    expect(mapBiometricCapabilityToUiState("available")).toBe("supported");
    expect(mapBiometricCapabilityToUiState("not_enrolled")).toBe("unavailable");
    expect(probeBiometricCapability()).resolves.toBe("available");
  });
});
