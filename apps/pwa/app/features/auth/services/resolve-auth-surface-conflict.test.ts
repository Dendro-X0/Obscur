import { describe, expect, it } from "vitest";
import { createMismatchStartupAuthState, createStoredLockedStartupAuthState } from "./startup-auth-state-contracts";
import { resolveAuthSurfaceConflicts } from "./resolve-auth-surface-conflict";

describe("resolveAuthSurfaceConflicts", () => {
  it("surfaces manual lock before other conflicts", () => {
    const conflicts = resolveAuthSurfaceConflicts({
      manualLockActive: true,
      startupState: createMismatchStartupAuthState({
        mismatchReason: "native_mismatch",
        message: "Native mismatch",
      }),
      hasPrivateKeyMismatch: true,
      activeSessionConflict: true,
      profileSlotConflict: true,
    });

    expect(conflicts[0]?.kind).toBe("manual_lock");
    expect(conflicts.map((entry) => entry.kind)).toEqual([
      "manual_lock",
      "active_session_lease",
      "profile_slot_conflict",
      "native_mismatch",
      "private_key_mismatch",
    ]);
  });

  it("returns empty when no conflict signals are present", () => {
    expect(resolveAuthSurfaceConflicts({
      manualLockActive: false,
      startupState: createStoredLockedStartupAuthState({ storedPublicKeyHex: "a".repeat(64) }),
      hasPrivateKeyMismatch: false,
      activeSessionConflict: false,
      profileSlotConflict: false,
    })).toEqual([]);
  });

  it("includes native mismatch detail message from startup state", () => {
    const conflicts = resolveAuthSurfaceConflicts({
      manualLockActive: false,
      startupState: createMismatchStartupAuthState({
        mismatchReason: "native_mismatch",
        message: "Secure storage belonged to another account.",
      }),
      hasPrivateKeyMismatch: false,
      activeSessionConflict: false,
      profileSlotConflict: false,
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.kind).toBe("native_mismatch");
    expect(conflicts[0]?.detailMessage).toBe("Secure storage belonged to another account.");
  });
});
