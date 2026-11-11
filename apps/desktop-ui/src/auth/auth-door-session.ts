import {
  resolveAuthShellReady,
  type AuthShellIdentityStatus,
} from "@dweb/auth/policy/auth-shell-ready-gate";
import type { DeviceUnlockPort } from "@dweb/auth/ports/device-unlock-port";
import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export type AuthDoorPhase =
  | "locked"
  | "unlocking"
  | "bind_pending"
  | "shell_ready"
  | "error";

export type AuthDoorSession = Readonly<{
  phase: AuthDoorPhase;
  profileId: string;
  expectedPublicKeyHex: PublicKeyHex;
  identityStatus: AuthShellIdentityStatus;
  publicKeyHex: PublicKeyHex | null;
  devicePasswordBindPending: boolean;
  runtimePhase: string;
  errorMessage: string | null;
}>;

export const createLockedAuthDoorSession = (params: Readonly<{
  profileId: string;
  expectedPublicKeyHex: PublicKeyHex;
}>): AuthDoorSession => ({
  phase: "locked",
  profileId: params.profileId,
  expectedPublicKeyHex: params.expectedPublicKeyHex,
  identityStatus: "locked",
  publicKeyHex: null,
  devicePasswordBindPending: false,
  runtimePhase: "auth_required",
  errorMessage: null,
});

export const isAuthDoorShellReady = (session: AuthDoorSession): boolean => (
  resolveAuthShellReady({
    identityStatus: session.identityStatus,
    publicKeyHex: session.publicKeyHex,
    runtimePhase: session.runtimePhase,
    devicePasswordBindPending: session.devicePasswordBindPending,
  })
);

const derivePhase = (session: Omit<AuthDoorSession, "phase" | "errorMessage"> & {
  errorMessage: string | null;
}): AuthDoorPhase => {
  if (session.errorMessage) {
    return "error";
  }
  if (isAuthDoorShellReady({
    ...session,
    phase: "locked",
    errorMessage: null,
  })) {
    return "shell_ready";
  }
  if (session.identityStatus === "unlocked" && session.devicePasswordBindPending) {
    return "bind_pending";
  }
  return "locked";
};

export const beginAuthDoorUnlock = (session: AuthDoorSession): AuthDoorSession => ({
  ...session,
  phase: "unlocking",
  errorMessage: null,
});

export const applyAuthDoorUnlockSuccess = (
  session: AuthDoorSession,
  params: Readonly<{
    publicKeyHex: PublicKeyHex;
    devicePasswordBindPending?: boolean;
  }>,
): AuthDoorSession => {
  const nextBase = {
    profileId: session.profileId,
    expectedPublicKeyHex: session.expectedPublicKeyHex,
    identityStatus: "unlocked" as const,
    publicKeyHex: params.publicKeyHex,
    devicePasswordBindPending: params.devicePasswordBindPending ?? false,
    runtimePhase: session.runtimePhase,
    errorMessage: null as string | null,
  };
  return {
    ...nextBase,
    phase: derivePhase(nextBase),
  };
};

export const applyAuthDoorUnlockFailure = (
  session: AuthDoorSession,
  message: string,
): AuthDoorSession => ({
  ...session,
  phase: "error",
  identityStatus: "locked",
  publicKeyHex: null,
  devicePasswordBindPending: false,
  errorMessage: message,
});

export const clearAuthDoorBindPending = (session: AuthDoorSession): AuthDoorSession => {
  const nextBase = {
    profileId: session.profileId,
    expectedPublicKeyHex: session.expectedPublicKeyHex,
    identityStatus: session.identityStatus,
    publicKeyHex: session.publicKeyHex,
    devicePasswordBindPending: false,
    runtimePhase: session.runtimePhase,
    errorMessage: null as string | null,
  };
  return {
    ...nextBase,
    phase: derivePhase(nextBase),
  };
};

export const lockAuthDoorSession = (session: AuthDoorSession): AuthDoorSession => (
  createLockedAuthDoorSession({
    profileId: session.profileId,
    expectedPublicKeyHex: session.expectedPublicKeyHex,
  })
);

/** Unlock via injected DeviceUnlockPort — never invents a parallel PDK opener. */
export const unlockAuthDoorWithPassphrase = async (params: Readonly<{
  session: AuthDoorSession;
  deviceUnlock: DeviceUnlockPort;
  passphrase: Passphrase;
  devicePasswordBindPendingAfterUnlock?: boolean;
}>): Promise<AuthDoorSession> => {
  const result = await params.deviceUnlock.unlockWithPassphrase({
    profileId: params.session.profileId,
    passphrase: params.passphrase,
    expectedPublicKeyHex: params.session.expectedPublicKeyHex,
    staySignedIn: true,
    context: "unlock",
  });
  if (result.status !== "ok" || !result.value) {
    return applyAuthDoorUnlockFailure(
      params.session,
      result.message ?? result.reasonCode ?? "Unlock failed",
    );
  }
  return applyAuthDoorUnlockSuccess(params.session, {
    publicKeyHex: result.value.publicKeyHex,
    devicePasswordBindPending: params.devicePasswordBindPendingAfterUnlock ?? false,
  });
};
