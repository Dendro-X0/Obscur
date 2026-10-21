/**
 * Soft-lock slice 3 — choose identity unlock vs storage-only PDK reopen.
 */

export type SoftLockUnlockMode = "identity" | "storage_only";

export type SoftLockUnlockModeInput = Readonly<{
  identityStatus: "loading" | "locked" | "unlocked" | "missing" | string;
  nativeSqliteWriteBlocked: boolean;
}>;

/**
 * When identity is already unlocked but SQLite writes are blocked, only reopen PDK.
 * Avoids re-locking identity on a wrong-password attempt during storage recovery.
 */
export const resolveSoftLockUnlockMode = (
  input: SoftLockUnlockModeInput,
): SoftLockUnlockMode => {
  if (input.identityStatus === "unlocked" && input.nativeSqliteWriteBlocked) {
    return "storage_only";
  }
  return "identity";
};
