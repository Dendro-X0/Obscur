/**
 * Shared AuthGateway shell-ready gate (Cut 3.2).
 * Identity unlock alone is not enough — device-password → PDK bind must finish first.
 * @see apps/pwa AuthGateway isShellReady · Single-door Slice A
 */

export type AuthShellIdentityStatus = "loading" | "locked" | "unlocked" | "error";

export type AuthShellUnlockEvidence = Readonly<{
  identityStatus: AuthShellIdentityStatus;
  publicKeyHex?: string | null;
  /** When `"fatal"`, shell never mounts. Other phases do not block identity evidence. */
  runtimePhase?: string;
}>;

export type AuthShellReadyEvidence = AuthShellUnlockEvidence & Readonly<{
  devicePasswordBindPending: boolean;
}>;

/** App shell may mount only when identity unlock evidence is present (and not fatal). */
export const isIdentityUnlockedForAppShell = (params: AuthShellUnlockEvidence): boolean => {
  if (params.runtimePhase === "fatal") {
    return false;
  }
  if (params.identityStatus !== "unlocked" || !params.publicKeyHex) {
    return false;
  }
  return true;
};

/**
 * Same compound gate as AuthGateway:
 * `isShellReady = isUnlocked && !devicePasswordBindPending`
 */
export const resolveAuthShellReady = (params: AuthShellReadyEvidence): boolean => (
  isIdentityUnlockedForAppShell(params) && !params.devicePasswordBindPending
);
