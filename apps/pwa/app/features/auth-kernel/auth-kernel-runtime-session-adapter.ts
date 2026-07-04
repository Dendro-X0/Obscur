import type { AuthBootPhase, AuthBootSnapshot, AuthSessionDiagnosticSnapshot } from "@dweb/auth";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { authFailed, authOk } from "@dweb/auth";
import type { AuthResult, RuntimeSessionPort, RuntimeSessionStatus } from "@dweb/auth";
import { resolveDeviceSessionDiagnostic } from "@/app/features/auth/services/device-session-diagnostic-service";
import {
  clearInMemoryNativeSessionBestEffort,
  endNativeDeviceSignInBestEffort,
} from "@/app/features/auth/services/native-device-session-lifecycle";
import { runAuthKernelSignOutCleanup } from "./auth-kernel-sign-out-cleanup";
import { SessionApi } from "@/app/features/auth/services/session-api";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";

type AuthBootSnapshotWire = Readonly<{
  profileId?: string;
  profile_id?: string;
  phase?: string;
  storedPublicKeyHex?: string | null;
  stored_public_key_hex?: string | null;
  sessionPublicKeyHex?: string | null;
  session_public_key_hex?: string | null;
  keychainPresent?: boolean;
  keychain_present?: boolean;
  restoreEligible?: boolean;
  restore_eligible?: boolean;
  atUnixMs?: number;
  at_unix_ms?: number;
}>;

const normalizeBootPhase = (phase: string | undefined): AuthBootPhase => {
  switch (phase) {
    case "unlocked":
    case "locked":
    case "mismatch":
    case "error":
      return phase;
    default:
      return "pending";
  }
};

export const mapAuthBootSnapshotWire = (wire: AuthBootSnapshotWire): AuthBootSnapshot => {
  const profileId = wire.profileId ?? wire.profile_id ?? "";
  const storedRaw = wire.storedPublicKeyHex ?? wire.stored_public_key_hex ?? null;
  const sessionRaw = wire.sessionPublicKeyHex ?? wire.session_public_key_hex ?? null;
  return {
    profileId,
    phase: normalizeBootPhase(wire.phase),
    storedPublicKeyHex: normalizePublicKeyHex(storedRaw) as PublicKeyHex | null,
    sessionPublicKeyHex: normalizePublicKeyHex(sessionRaw) as PublicKeyHex | null,
    keychainPresent: Boolean(wire.keychainPresent ?? wire.keychain_present),
    restoreEligible: Boolean(wire.restoreEligible ?? wire.restore_eligible),
    atUnixMs: wire.atUnixMs ?? wire.at_unix_ms ?? Date.now(),
  };
};

const normalizeRuntimeSessionStatus = (
  profileId: string,
  status: Awaited<ReturnType<typeof SessionApi.getSessionStatus>>,
): RuntimeSessionStatus => ({
  profileId,
  isActive: status.isActive,
  publicKeyHex: normalizePublicKeyHex(status.npub) as PublicKeyHex | null,
  isNative: status.isNative,
});

export const createAuthKernelRuntimeSessionPort = (): RuntimeSessionPort => ({
  readBootSnapshot: async (params) => {
    const profileId = params.profileId.trim();
    const expectedPublicKeyHex = params.expectedPublicKeyHex;
    const restoreEligible = params.restoreEligible ?? false;
    if (!hasNativeRuntime()) {
      return authFailed({ reasonCode: "unsupported_runtime", message: "Native runtime required" });
    }
    const result = await invokeNativeCommand<AuthBootSnapshotWire>("auth_boot_snapshot", {
      expectedPubkeyHex: expectedPublicKeyHex ?? null,
      restoreEligible,
    }, { timeoutMs: 5_000 });
    if (!result.ok) {
      return authFailed({
        reasonCode: "session_inactive",
        message: result.message ?? "auth_boot_snapshot failed",
      });
    }
    const snapshot = mapAuthBootSnapshotWire(result.value);
    if (profileId && snapshot.profileId !== profileId) {
      return authFailed({
        reasonCode: "profile_scope_unresolved",
        message: `Boot profile ${snapshot.profileId} != requested ${profileId}`,
      });
    }
    return authOk(snapshot);
  },

  readSessionStatus: async (profileId) => {
    if (!hasNativeRuntime()) {
      return authFailed({ reasonCode: "unsupported_runtime" });
    }
    const status = await SessionApi.getSessionStatus();
    return authOk(normalizeRuntimeSessionStatus(profileId, status));
  },

  forceRestoreSession: async (params) => {
    if (!hasNativeRuntime()) {
      return authFailed({ reasonCode: "unsupported_runtime" });
    }
    const status = await SessionApi.forceSessionRestore(params.expectedPublicKeyHex);
    return authOk(normalizeRuntimeSessionStatus(params.profileId, status));
  },

  lockSession: async (profileId) => {
    if (!hasNativeRuntime()) {
      return authFailed({ reasonCode: "unsupported_runtime" });
    }
    const trimmed = profileId.trim();
    if (!trimmed) {
      return authFailed({ reasonCode: "invalid_input", message: "profileId required" });
    }
    await clearInMemoryNativeSessionBestEffort();
    return authOk(undefined);
  },

  signOutSession: async (profileId) => {
    const trimmed = profileId.trim();
    if (!trimmed) {
      return authFailed({ reasonCode: "invalid_input", message: "profileId required" });
    }
    await runAuthKernelSignOutCleanup(trimmed);
    if (!hasNativeRuntime()) {
      return authOk(undefined);
    }
    await endNativeDeviceSignInBestEffort();
    return authOk(undefined);
  },

  readDiagnostic: async (params) => {
    if (!hasNativeRuntime()) {
      return authFailed({ reasonCode: "unsupported_runtime" });
    }
    const snapshot = await resolveDeviceSessionDiagnostic({
      profileId: params.profileId,
      storedPublicKeyHex: params.storedPublicKeyHex ?? null,
    });
    return authOk(snapshot as AuthSessionDiagnosticSnapshot);
  },
});

export const readAuthKernelBootSnapshot = async (params: Readonly<{
  profileId: string;
  expectedPublicKeyHex?: PublicKeyHex;
  restoreEligible: boolean;
}>): Promise<AuthResult<AuthBootSnapshot>> => (
  createAuthKernelRuntimeSessionPort().readBootSnapshot(params)
);
