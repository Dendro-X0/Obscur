import type { AccountSyncSnapshot } from "../account-sync-contracts";

const RESTORE_PROGRESS_PHASES = new Set([
  "found_account",
  "restoring_profile",
  "restoring_account_data",
  "syncing_messages_and_requests",
]);

export type AccountSyncUiPolicy = Readonly<{
  showRestoreProgress: boolean;
  showMissingSharedDataWarning: boolean;
}>;

export const resolveAccountSyncUiPolicy = (params: Readonly<{
  isIdentityUnlocked: boolean;
  snapshot: AccountSyncSnapshot;
}>): AccountSyncUiPolicy => {
  if (!params.isIdentityUnlocked) {
    return {
      showRestoreProgress: false,
      showMissingSharedDataWarning: false,
    };
  }

  const hasMissingLocalBindingEvidence = Boolean(
    params.snapshot.lastImportEvidence
    && !params.snapshot.lastImportEvidence.localBinding
  );

  return {
    showRestoreProgress: RESTORE_PROGRESS_PHASES.has(params.snapshot.phase),
    showMissingSharedDataWarning:
      params.snapshot.phase === "ready"
      && params.snapshot.status === "identity_only"
      && hasMissingLocalBindingEvidence,
  };
};
