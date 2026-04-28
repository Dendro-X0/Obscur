import { describe, expect, it } from "vitest";
import {
  createMismatchStartupAuthState,
  createPendingStartupAuthState,
  deriveStartupAuthStateFromIdentityState,
  shouldShowStoredIdentityLockScreen,
  shouldEnterLoginModeOnStartup,
  startupAuthStateHasPrivateKeyMismatch,
  startupAuthStateHasStoredIdentity,
} from "./startup-auth-state-contracts";

describe("startup-auth-state-contracts", () => {
  it("derives no_identity when startup reaches a locked state without stored identity", () => {
    expect(deriveStartupAuthStateFromIdentityState({
      identityStatus: "locked",
    })).toEqual(expect.objectContaining({
      kind: "no_identity",
      runtimePhaseHint: "auth_required",
      recoveryActions: [],
    }));
  });

  it("derives restored when startup identity is unlocked", () => {
    expect(deriveStartupAuthStateFromIdentityState({
      identityStatus: "unlocked",
      storedPublicKeyHex: "a".repeat(64),
      unlockedPublicKeyHex: "a".repeat(64),
      nativeSessionPublicKeyHex: "a".repeat(64),
    })).toEqual(expect.objectContaining({
      kind: "restored",
      runtimePhaseHint: "activating_runtime",
      unlockedPublicKeyHex: "a".repeat(64),
    }));
  });

  it("classifies native mismatch as auth_required with reset recovery", () => {
    expect(createMismatchStartupAuthState({
      storedPublicKeyHex: "a".repeat(64),
      nativeSessionPublicKeyHex: "b".repeat(64),
      mismatchReason: "native_mismatch",
      message: "Native mismatch",
    })).toEqual(expect.objectContaining({
      kind: "mismatch",
      runtimePhaseHint: "auth_required",
      degradedReasonHint: "native_session_mismatch",
      recoveryActions: ["login", "unlock_with_private_key", "reset_secure_storage"],
    }));
  });

  it("keeps pending startup distinct from settled auth decisions", () => {
    expect(createPendingStartupAuthState({
      storedPublicKeyHex: "a".repeat(64),
    })).toEqual(expect.objectContaining({
      kind: "pending",
      identityStatus: "loading",
      runtimePhaseHint: "binding_profile",
      storedPublicKeyHex: "a".repeat(64),
    }));
  });

  it("derives login entry and stored-identity capability from stored_locked state", () => {
    const startupState = deriveStartupAuthStateFromIdentityState({
      identityStatus: "locked",
      storedPublicKeyHex: "a".repeat(64),
    });

    expect(shouldEnterLoginModeOnStartup(startupState)).toBe(true);
    expect(startupAuthStateHasStoredIdentity(startupState)).toBe(true);
  });

  it("flags private-key mismatch and allows stored-identity lock screen gating", () => {
    const startupState = createMismatchStartupAuthState({
      storedPublicKeyHex: "a".repeat(64),
      mismatchReason: "private_key_mismatch",
      message: "Private key does not match stored identity.",
    });

    expect(startupAuthStateHasPrivateKeyMismatch(startupState)).toBe(true);
    expect(shouldShowStoredIdentityLockScreen({
      startupState,
      isAutoLockLocked: false,
    })).toBe(true);
  });
});
