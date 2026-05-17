"use client";

import type { AccountSyncSnapshot } from "@/app/features/account-sync/account-sync-contracts";
import type { AccountProjectionRuntimeSnapshot } from "@/app/features/account-sync/account-event-contracts";

/** Avoid useSyncExternalStore churn when only `updatedAtUnixMs` or object identity drifts. */
export const areAccountProjectionRuntimeSnapshotsEqual = (
  previous: AccountProjectionRuntimeSnapshot,
  next: AccountProjectionRuntimeSnapshot,
): boolean => (
  previous.profileId === next.profileId
  && previous.accountPublicKeyHex === next.accountPublicKeyHex
  && previous.phase === next.phase
  && previous.status === next.status
  && previous.accountProjectionReady === next.accountProjectionReady
  && previous.driftStatus === next.driftStatus
  && previous.lastError === next.lastError
  && previous.projection === next.projection
  && previous.driftReport === next.driftReport
  && previous.bootstrapReport === next.bootstrapReport
);

const areConvergenceDiagnosticsEqual = (
  previous: AccountSyncSnapshot["convergenceDiagnostics"],
  next: AccountSyncSnapshot["convergenceDiagnostics"],
): boolean => {
  if (previous === next) {
    return true;
  }
  if (!previous || !next) {
    return !previous && !next;
  }
  return JSON.stringify(previous) === JSON.stringify(next);
};

export const areAccountSyncSnapshotsEqual = (
  previous: AccountSyncSnapshot,
  next: AccountSyncSnapshot,
): boolean => (
  previous.publicKeyHex === next.publicKeyHex
  && previous.status === next.status
  && previous.portabilityStatus === next.portabilityStatus
  && previous.phase === next.phase
  && previous.message === next.message
  && previous.hasEncryptedBackup === next.hasEncryptedBackup
  && previous.lastRestoreSource === next.lastRestoreSource
  && previous.lastRelayFailureReason === next.lastRelayFailureReason
  && previous.latestProfileEventId === next.latestProfileEventId
  && previous.latestBackupEventId === next.latestBackupEventId
  && previous.lastPublicProfileFetchAtUnixMs === next.lastPublicProfileFetchAtUnixMs
  && previous.lastEncryptedBackupPublishAtUnixMs === next.lastEncryptedBackupPublishAtUnixMs
  && previous.profileProof === next.profileProof
  && previous.backupProof === next.backupProof
  && areConvergenceDiagnosticsEqual(previous.convergenceDiagnostics, next.convergenceDiagnostics)
);
