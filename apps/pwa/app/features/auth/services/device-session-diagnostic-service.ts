import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getDeviceTrustSnapshot } from "@/app/features/auth/services/device-trust-service";
import { readLastNativeSessionPersistError } from "@/app/features/auth/services/native-session-persist-feedback";
import { SessionApi } from "@/app/features/auth/services/session-api";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

export type DeviceSessionOverallStatus =
  | "unavailable"
  | "off"
  | "active"
  | "ready"
  | "keychain_missing"
  | "mismatch"
  | "persist_error";

export type DeviceSessionDiagnosticSnapshot = Readonly<{
  profileId: string;
  status: DeviceSessionOverallStatus;
  staySignedInEnabled: boolean;
  usesNativeSecureStore: boolean;
  inMemorySessionActive: boolean;
  keychainPublicKeyHex: PublicKeyHex | null;
  storedPublicKeyHex: PublicKeyHex | null;
  identityMatch: "ok" | "mismatch" | "unknown";
  lastPersistError: string | null;
  checkedAtUnixMs: number;
}>;

const resolveIdentityMatch = (params: Readonly<{
  storedPublicKeyHex: PublicKeyHex | null;
  keychainPublicKeyHex: PublicKeyHex | null;
}>): "ok" | "mismatch" | "unknown" => {
  if (!params.storedPublicKeyHex || !params.keychainPublicKeyHex) {
    return "unknown";
  }
  return params.storedPublicKeyHex === params.keychainPublicKeyHex ? "ok" : "mismatch";
};

const resolveOverallStatus = (params: Readonly<{
  staySignedInEnabled: boolean;
  keychainPublicKeyHex: PublicKeyHex | null;
  inMemorySessionActive: boolean;
  identityMatch: "ok" | "mismatch" | "unknown";
  lastPersistError: string | null;
}>): DeviceSessionOverallStatus => {
  if (!params.staySignedInEnabled) {
    return "off";
  }
  if (params.identityMatch === "mismatch") {
    return "mismatch";
  }
  if (params.keychainPublicKeyHex) {
    return params.inMemorySessionActive ? "active" : "ready";
  }
  if (params.lastPersistError) {
    return "persist_error";
  }
  return "keychain_missing";
};

export const resolveDeviceSessionDiagnostic = async (params: Readonly<{
  profileId: string;
  storedPublicKeyHex?: PublicKeyHex | null;
}>): Promise<DeviceSessionDiagnosticSnapshot> => {
  const profileId = params.profileId.trim();
  const storedPublicKeyHex = params.storedPublicKeyHex ?? null;
  const trust = getDeviceTrustSnapshot(profileId);
  const lastPersistErrorSnapshot = readLastNativeSessionPersistError(profileId);
  const lastPersistError = lastPersistErrorSnapshot?.message ?? null;

  if (!hasNativeRuntime()) {
    return {
      profileId,
      status: "unavailable",
      staySignedInEnabled: trust.trusted,
      usesNativeSecureStore: false,
      inMemorySessionActive: false,
      keychainPublicKeyHex: null,
      storedPublicKeyHex,
      identityMatch: "unknown",
      lastPersistError,
      checkedAtUnixMs: Date.now(),
    };
  }

  const sessionStatus = await SessionApi.getSessionStatus();
  const keychainPublicKeyHex = normalizePublicKeyHex(sessionStatus.npub);
  const identityMatch = resolveIdentityMatch({
    storedPublicKeyHex,
    keychainPublicKeyHex,
  });
  const status = resolveOverallStatus({
    staySignedInEnabled: trust.trusted,
    keychainPublicKeyHex,
    inMemorySessionActive: sessionStatus.isActive,
    identityMatch,
    lastPersistError,
  });

  return {
    profileId,
    status,
    staySignedInEnabled: trust.trusted,
    usesNativeSecureStore: trust.usesNativeSecureStore,
    inMemorySessionActive: sessionStatus.isActive,
    keychainPublicKeyHex,
    storedPublicKeyHex,
    identityMatch,
    lastPersistError,
    checkedAtUnixMs: Date.now(),
  };
};
