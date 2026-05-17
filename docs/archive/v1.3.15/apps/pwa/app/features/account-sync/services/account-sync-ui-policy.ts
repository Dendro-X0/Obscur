import type { AccountSyncSnapshot } from "../account-sync-contracts";
import type { AccountProjectionRuntimeSnapshot } from "../account-event-contracts";

const RESTORE_PROGRESS_PHASES = new Set([
  "found_account",
  "restoring_profile",
  "restoring_account_data",
  "syncing_messages_and_requests",
]);

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
}>): AccountSyncUiPolicy => {
  if (!params.isIdentityUnlocked) {
    return {
      showRestoreProgress: false,
      showMissingSharedDataWarning: false,
      showInitialHistorySyncNotice: false,
    };
  }

  const hasMissingLocalBindingEvidence = Boolean(
    params.snapshot.lastImportEvidence
    && !params.snapshot.lastImportEvidence.localBinding
  );
  const showRestoreProgress = RESTORE_PROGRESS_PHASES.has(params.snapshot.phase);
  const projectionStillLoading = (
    !params.projectionSnapshot.accountProjectionReady
    || params.projectionSnapshot.phase === "bootstrapping"
    || params.projectionSnapshot.phase === "replaying_event_log"
  );
  const hasRestoreSignals = Boolean(
    params.snapshot.lastRestoreSource
    || params.snapshot.lastEncryptedBackupRestoreAtUnixMs
    || params.snapshot.lastPublicProfileFetchAtUnixMs
    || params.snapshot.phase !== "idle"
  );
  const showInitialHistorySyncNotice = (
    !params.hasVisibleConversations
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
