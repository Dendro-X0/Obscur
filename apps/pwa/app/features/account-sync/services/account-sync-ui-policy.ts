import type { AccountSyncSnapshot } from "../account-sync-contracts";
import type { AccountProjectionRuntimeSnapshot } from "../account-event-contracts";

const RESTORE_PROGRESS_PHASES = new Set<AccountSyncSnapshot["phase"]>([
  "found_account",
  "restoring_profile",
  "restoring_account_data",
  "syncing_messages_and_requests",
]);

export const isAccountProjectionStillLoading = (
  projectionSnapshot: AccountProjectionRuntimeSnapshot,
): boolean => (
  !projectionSnapshot.accountProjectionReady
  || projectionSnapshot.phase === "bootstrapping"
  || projectionSnapshot.phase === "replaying_event_log"
);

/** True while restore/replay is in flight — suppress noisy transport/status footers. */
export const isAccountDataLoading = (params: Readonly<{
  isIdentityUnlocked: boolean;
  snapshot: AccountSyncSnapshot;
  projectionSnapshot: AccountProjectionRuntimeSnapshot;
  accountSyncUiPolicy: AccountSyncUiPolicy;
}>): boolean => {
  if (!params.isIdentityUnlocked) {
    return false;
  }
  return (
    params.accountSyncUiPolicy.showRestoreProgress
    || params.accountSyncUiPolicy.showInitialHistorySyncNotice
    || isAccountProjectionStillLoading(params.projectionSnapshot)
    || RESTORE_PROGRESS_PHASES.has(params.snapshot.phase)
  );
};

export type AccountSyncUiPolicy = Readonly<{
  showRestoreProgress: boolean;
  showMissingSharedDataWarning: boolean;
  showInitialHistorySyncNotice: boolean;
}>;

export const resolveAccountSyncUiPolicy = (params: Readonly<{
  isIdentityUnlocked: boolean;
  snapshot: AccountSyncSnapshot;
  projectionSnapshot: AccountProjectionRuntimeSnapshot;
  hasVisibleConversations: boolean;
  hasLocalReturningUserEvidence?: boolean;
}>): AccountSyncUiPolicy => {
  if (!params.isIdentityUnlocked) {
    return {
      showRestoreProgress: false,
      showMissingSharedDataWarning: false,
      showInitialHistorySyncNotice: false,
    };
  }

  const isReturningLocalDevice = params.hasLocalReturningUserEvidence === true;
  const hasMissingLocalBindingEvidence = Boolean(
    params.snapshot.lastImportEvidence
    && !params.snapshot.lastImportEvidence.localBinding
  );
  const showRestoreProgress = !isReturningLocalDevice && RESTORE_PROGRESS_PHASES.has(params.snapshot.phase);
  const projectionStillLoading = isAccountProjectionStillLoading(params.projectionSnapshot);
  const hasRestoreSignals = Boolean(
    params.snapshot.lastRestoreSource
    || params.snapshot.lastEncryptedBackupRestoreAtUnixMs
    || params.snapshot.lastPublicProfileFetchAtUnixMs
    || params.snapshot.phase !== "idle"
  );
  const showInitialHistorySyncNotice = (
    !isReturningLocalDevice
    && !params.hasVisibleConversations
    && (showRestoreProgress || projectionStillLoading)
    && hasRestoreSignals
  );

  return {
    showRestoreProgress,
    showMissingSharedDataWarning:
      params.snapshot.phase === "ready"
      && params.snapshot.status === "identity_only"
      && hasMissingLocalBindingEvidence,
    showInitialHistorySyncNotice,
  };
};
