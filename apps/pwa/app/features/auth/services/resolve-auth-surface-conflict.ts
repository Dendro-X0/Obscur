import type { StartupAuthState } from "./startup-auth-state-contracts";

export type AuthSurfaceConflictKind =
  | "manual_lock"
  | "active_session_lease"
  | "profile_slot_conflict"
  | "native_mismatch"
  | "private_key_mismatch"
  | "fatal_storage_error";

export type AuthSurfaceConflictTone = "amber" | "orange" | "rose" | "red";

export type AuthSurfaceConflict = Readonly<{
  kind: AuthSurfaceConflictKind;
  titleKey: string;
  bodyKey: string;
  hintKey?: string;
  detailMessage?: string;
  tone: AuthSurfaceConflictTone;
  ariaLabelKey: string;
}>;

const CONFLICT_PRIORITY: Readonly<Record<AuthSurfaceConflictKind, number>> = {
  manual_lock: 0,
  active_session_lease: 1,
  profile_slot_conflict: 2,
  native_mismatch: 3,
  private_key_mismatch: 4,
  fatal_storage_error: 5,
};

export const resolveAuthSurfaceConflicts = (params: Readonly<{
  manualLockActive: boolean;
  startupState: StartupAuthState;
  hasPrivateKeyMismatch: boolean;
  authErrorMessage?: string | null;
  activeSessionConflict: boolean;
  profileSlotConflict: boolean;
}>): ReadonlyArray<AuthSurfaceConflict> => {
  const conflicts: AuthSurfaceConflict[] = [];

  if (params.manualLockActive) {
    conflicts.push({
      kind: "manual_lock",
      titleKey: "auth.surfaceConflict.manualLock.title",
      bodyKey: "auth.surfaceConflict.manualLock.body",
      hintKey: "auth.surfaceConflict.manualLock.hint",
      tone: "amber",
      ariaLabelKey: "auth.surfaceConflict.manualLock.aria",
    });
  }

  if (params.activeSessionConflict) {
    conflicts.push({
      kind: "active_session_lease",
      titleKey: "auth.surfaceConflict.activeSession.title",
      bodyKey: "auth.surfaceConflict.activeSession.body",
      hintKey: "auth.surfaceConflict.activeSession.hint",
      tone: "rose",
      ariaLabelKey: "auth.surfaceConflict.activeSession.aria",
    });
  }

  if (params.profileSlotConflict) {
    conflicts.push({
      kind: "profile_slot_conflict",
      titleKey: "auth.surfaceConflict.slotConflict.title",
      bodyKey: "auth.surfaceConflict.slotConflict.body",
      hintKey: "auth.surfaceConflict.slotConflict.hint",
      tone: "rose",
      ariaLabelKey: "auth.surfaceConflict.slotConflict.aria",
    });
  }

  if (params.startupState.mismatchReason === "native_mismatch") {
    conflicts.push({
      kind: "native_mismatch",
      titleKey: "auth.secureStorageRecoveryTitle",
      bodyKey: "auth.secureStorageRecoveryDesc",
      hintKey: "auth.secureStorageRecoveryHint",
      detailMessage: params.startupState.message,
      tone: "amber",
      ariaLabelKey: "auth.surfaceConflict.nativeMismatch.aria",
    });
  }

  if (params.hasPrivateKeyMismatch) {
    conflicts.push({
      kind: "private_key_mismatch",
      titleKey: "auth.privateKeyMismatchTitle",
      bodyKey: "auth.privateKeyMismatchDesc",
      hintKey: "auth.privateKeyMismatchHint",
      detailMessage: params.startupState.message ?? params.authErrorMessage ?? undefined,
      tone: "orange",
      ariaLabelKey: "auth.surfaceConflict.privateKeyMismatch.aria",
    });
  }

  if (params.startupState.kind === "fatal_storage_error") {
    conflicts.push({
      kind: "fatal_storage_error",
      titleKey: "auth.surfaceConflict.fatalStorage.title",
      bodyKey: "auth.surfaceConflict.fatalStorage.body",
      detailMessage: params.startupState.message,
      tone: "red",
      ariaLabelKey: "auth.surfaceConflict.fatalStorage.aria",
    });
  }

  return conflicts.sort(
    (left, right) => CONFLICT_PRIORITY[left.kind] - CONFLICT_PRIORITY[right.kind],
  );
};
