import type { AuthAssistantPort } from "@dweb/auth";
import { authFailed, authOk } from "@dweb/auth";
import { AuthKernelProfileScopeError } from "@/app/features/auth/services/auth-kernel-legacy-delegates";
import { readDeviceSessionConsent } from "@/app/features/auth/services/device-session-consent";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { runAuthKernelBoundProfileUnlockWithPassphrase } from "./auth-kernel-bound-profile-auth";
import { createAuthKernelDeviceUnlockPort } from "./auth-kernel-device-unlock-adapter";
import { createAuthKernelIdentityRootPort } from "./auth-kernel-identity-root-adapter";
import { createAuthKernelRegistrationPolicyPort } from "./auth-kernel-registration-policy-adapter";
import type { AuthKernelPorts } from "./auth-kernel-ports";
import { createAuthKernelRuntimeSessionPort } from "./auth-kernel-runtime-session-adapter";
import {
  deleteAuthAssistantVaultPayload,
  readAuthAssistantVaultPayload,
  requestAuthAssistantBiometricGate,
  writeAuthAssistantVaultPayload,
} from "./services/auth-assistant-vault-service";

const mapAssistantError = (error: unknown): ReturnType<typeof authFailed> => {
  if (error instanceof AuthKernelProfileScopeError) {
    return authFailed({
      reasonCode: "invalid_input",
      message: error.message,
    });
  }
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
  if (normalized.includes("no saved unlock") || normalized.includes("not available")) {
    return authFailed({ reasonCode: "keychain_missing", message });
  }
  if (normalized.includes("biometric")) {
    return authFailed({ reasonCode: "session_inactive", message });
  }
  return authFailed({ reasonCode: "session_inactive", message });
};

const buildAssistantUnlockPorts = (): AuthKernelPorts => ({
  identityRoot: createAuthKernelIdentityRootPort(),
  registrationPolicy: createAuthKernelRegistrationPolicyPort(),
  deviceUnlock: createAuthKernelDeviceUnlockPort(),
  runtimeSession: createAuthKernelRuntimeSessionPort(),
  authAssistant: {
    readEntry: async () => authFailed({ reasonCode: "unsupported_runtime" }),
    saveUnlockMaterial: async () => authFailed({ reasonCode: "unsupported_runtime" }),
    removeUnlockMaterial: async () => authFailed({ reasonCode: "unsupported_runtime" }),
    requestBiometricGate: async () => authFailed({ reasonCode: "unsupported_runtime" }),
    unlockWithAssistantGesture: async () => authFailed({ reasonCode: "unsupported_runtime" }),
  },
});

const buildAssistantLabel = (username: string): string => (
  username.trim() || "Saved unlock"
);

export const createAuthKernelAssistantPort = (): AuthAssistantPort => ({
  readEntry: async (profileId) => {
    try {
      if (!hasNativeRuntime()) {
        return authOk(null);
      }
      const payload = await readAuthAssistantVaultPayload(profileId);
      if (!payload) {
        return authOk(null);
      }
      return authOk({
        profileId: profileId.trim(),
        username: payload.username,
        label: buildAssistantLabel(payload.username),
        hasSavedUnlock: true,
        biometricGateAvailable: hasNativeRuntime(),
      });
    } catch (error) {
      return mapAssistantError(error);
    }
  },

  saveUnlockMaterial: async (params) => {
    try {
      await writeAuthAssistantVaultPayload(params.profileId, {
        version: 1,
        username: params.username.trim(),
        passphrase: params.passphrase,
      });
      return authOk(undefined);
    } catch (error) {
      return mapAssistantError(error);
    }
  },

  removeUnlockMaterial: async (profileId) => {
    try {
      await deleteAuthAssistantVaultPayload(profileId);
      return authOk(undefined);
    } catch (error) {
      return mapAssistantError(error);
    }
  },

  requestBiometricGate: async () => {
    try {
      const passed = await requestAuthAssistantBiometricGate();
      return authOk(passed);
    } catch (error) {
      return mapAssistantError(error);
    }
  },

  unlockWithAssistantGesture: async (params) => {
    try {
      if (!hasNativeRuntime()) {
        return authFailed({
          reasonCode: "keychain_missing",
          message: "Auth assistant requires native runtime",
        });
      }

      if (params.requireBiometric !== false) {
        const gate = await requestAuthAssistantBiometricGate();
        if (!gate) {
          // Desktop and unsupported platforms: best-effort tap unlock without OS biometric.
        }
      }

      const payload = await readAuthAssistantVaultPayload(params.profileId);
      if (!payload) {
        return authFailed({
          reasonCode: "keychain_missing",
          message: "No saved unlock material for this profile",
        });
      }

      const staySignedIn = readDeviceSessionConsent(params.profileId);
      await runAuthKernelBoundProfileUnlockWithPassphrase(buildAssistantUnlockPorts(), {
        profileId: params.profileId,
        passphrase: payload.passphrase,
        expectedPublicKeyHex: params.expectedPublicKeyHex,
        staySignedIn,
      });

      return authOk({
        profileId: params.profileId,
        publicKeyHex: params.expectedPublicKeyHex,
        staySignedInApplied: staySignedIn,
      });
    } catch (error) {
      return mapAssistantError(error);
    }
  },
});
