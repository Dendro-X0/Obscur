export type StartupAuthMismatchReason =
  | "stored_public_key_invalid"
  | "native_mismatch"
  | "private_key_mismatch";

export type StartupAuthRecoveryAction =
  | "login"
  | "unlock_with_private_key"
  | "reset_secure_storage";

export type StartupAuthRuntimePhaseHint =
  | "binding_profile"
  | "auth_required"
  | "activating_runtime"
  | "fatal";

export type StartupAuthDegradedReasonHint =
  | "none"
  | "identity_error"
  | "native_session_mismatch";

export type StartupAuthStateKind =
  | "pending"
  | "no_identity"
  | "stored_locked"
  | "native_restorable"
  | "restored"
  | "mismatch"
  | "fatal_storage_error";

export type StartupAuthState = Readonly<{
  kind: StartupAuthStateKind;
  identityStatus: "loading" | "locked" | "unlocked" | "error";
  runtimePhaseHint: StartupAuthRuntimePhaseHint;
  degradedReasonHint: StartupAuthDegradedReasonHint;
  storedPublicKeyHex?: string;
  unlockedPublicKeyHex?: string;
  nativeSessionPublicKeyHex?: string | null;
  mismatchReason?: StartupAuthMismatchReason;
  message?: string;
  recoveryActions: ReadonlyArray<StartupAuthRecoveryAction>;
}>;

export const startupAuthStateHasStoredIdentity = (state: StartupAuthState): boolean => (
  typeof state.storedPublicKeyHex === "string" && state.storedPublicKeyHex.length > 0
);

export const shouldEnterLoginModeOnStartup = (state: StartupAuthState): boolean => (
  state.kind === "stored_locked"
  || state.kind === "native_restorable"
  || state.kind === "mismatch"
  || state.kind === "fatal_storage_error"
);

export const startupAuthStateHasPrivateKeyMismatch = (state: StartupAuthState): boolean => (
  state.mismatchReason === "private_key_mismatch"
  || state.message?.toLowerCase().includes("does not match stored identity") === true
);

export const shouldShowStoredIdentityLockScreen = (params: Readonly<{
  startupState: StartupAuthState;
  isAutoLockLocked: boolean;
}>): boolean => (
  startupAuthStateHasStoredIdentity(params.startupState)
  && (
    params.isAutoLockLocked
    || params.startupState.kind === "stored_locked"
    || params.startupState.kind === "mismatch"
  )
);

export const createPendingStartupAuthState = (params?: Readonly<{
  storedPublicKeyHex?: string;
}>): StartupAuthState => ({
  kind: "pending",
  identityStatus: "loading",
  runtimePhaseHint: "binding_profile",
  degradedReasonHint: "none",
  storedPublicKeyHex: params?.storedPublicKeyHex,
  recoveryActions: [],
});

export const createNoIdentityStartupAuthState = (): StartupAuthState => ({
  kind: "no_identity",
  identityStatus: "locked",
  runtimePhaseHint: "auth_required",
  degradedReasonHint: "none",
  recoveryActions: [],
});

export const createStoredLockedStartupAuthState = (params: Readonly<{
  storedPublicKeyHex?: string;
  message?: string;
}>): StartupAuthState => ({
  kind: "stored_locked",
  identityStatus: "locked",
  runtimePhaseHint: "auth_required",
  degradedReasonHint: "none",
  storedPublicKeyHex: params.storedPublicKeyHex,
  message: params.message,
  recoveryActions: ["login", "unlock_with_private_key"],
});

export const createNativeRestorableStartupAuthState = (params: Readonly<{
  storedPublicKeyHex: string;
  nativeSessionPublicKeyHex?: string | null;
}>): StartupAuthState => ({
  kind: "native_restorable",
  identityStatus: "locked",
  runtimePhaseHint: "auth_required",
  degradedReasonHint: "none",
  storedPublicKeyHex: params.storedPublicKeyHex,
  nativeSessionPublicKeyHex: params.nativeSessionPublicKeyHex,
  recoveryActions: [],
});

export const createRestoredStartupAuthState = (params: Readonly<{
  storedPublicKeyHex?: string;
  unlockedPublicKeyHex?: string;
  nativeSessionPublicKeyHex?: string | null;
}>): StartupAuthState => ({
  kind: "restored",
  identityStatus: "unlocked",
  runtimePhaseHint: "activating_runtime",
  degradedReasonHint: "none",
  storedPublicKeyHex: params.storedPublicKeyHex,
  unlockedPublicKeyHex: params.unlockedPublicKeyHex,
  nativeSessionPublicKeyHex: params.nativeSessionPublicKeyHex,
  recoveryActions: [],
});

export const createMismatchStartupAuthState = (params: Readonly<{
  storedPublicKeyHex?: string;
  nativeSessionPublicKeyHex?: string | null;
  mismatchReason: StartupAuthMismatchReason;
  message: string;
}>): StartupAuthState => ({
  kind: "mismatch",
  identityStatus: "locked",
  runtimePhaseHint: "auth_required",
  degradedReasonHint: params.mismatchReason === "native_mismatch"
    ? "native_session_mismatch"
    : "none",
  storedPublicKeyHex: params.storedPublicKeyHex,
  nativeSessionPublicKeyHex: params.nativeSessionPublicKeyHex,
  mismatchReason: params.mismatchReason,
  message: params.message,
  recoveryActions: params.mismatchReason === "native_mismatch"
    ? ["login", "unlock_with_private_key", "reset_secure_storage"]
    : ["login", "unlock_with_private_key"],
});

export const createFatalStorageErrorStartupAuthState = (params: Readonly<{
  storedPublicKeyHex?: string;
  message: string;
}>): StartupAuthState => ({
  kind: "fatal_storage_error",
  identityStatus: "error",
  runtimePhaseHint: "fatal",
  degradedReasonHint: "identity_error",
  storedPublicKeyHex: params.storedPublicKeyHex,
  message: params.message,
  recoveryActions: ["login"],
});

export const deriveStartupAuthStateFromIdentityState = (params: Readonly<{
  identityStatus: "loading" | "locked" | "unlocked" | "error";
  storedPublicKeyHex?: string;
  unlockedPublicKeyHex?: string;
  nativeSessionPublicKeyHex?: string | null;
  mismatchReason?: StartupAuthMismatchReason;
  message?: string;
}>): StartupAuthState => {
  if (params.identityStatus === "loading") {
    return createPendingStartupAuthState({
      storedPublicKeyHex: params.storedPublicKeyHex,
    });
  }
  if (params.identityStatus === "error") {
    return createFatalStorageErrorStartupAuthState({
      storedPublicKeyHex: params.storedPublicKeyHex,
      message: params.message ?? "Identity startup failed.",
    });
  }
  if (params.identityStatus === "unlocked") {
    return createRestoredStartupAuthState({
      storedPublicKeyHex: params.storedPublicKeyHex,
      unlockedPublicKeyHex: params.unlockedPublicKeyHex,
      nativeSessionPublicKeyHex: params.nativeSessionPublicKeyHex,
    });
  }
  if (params.mismatchReason) {
    return createMismatchStartupAuthState({
      storedPublicKeyHex: params.storedPublicKeyHex,
      nativeSessionPublicKeyHex: params.nativeSessionPublicKeyHex,
      mismatchReason: params.mismatchReason,
      message: params.message ?? "Identity startup mismatch detected.",
    });
  }
  if (params.storedPublicKeyHex) {
    return createStoredLockedStartupAuthState({
      storedPublicKeyHex: params.storedPublicKeyHex,
      message: params.message,
    });
  }
  return createNoIdentityStartupAuthState();
};
