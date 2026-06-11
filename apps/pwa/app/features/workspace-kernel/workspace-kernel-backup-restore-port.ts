import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PersistedChatState } from "@/app/features/messaging/types";
import type { NativeSqliteBackupEvidenceSnapshot } from "@/app/features/account-sync/account-sync-contracts";
import {
  applyNativeRestoreSqliteMaterialization,
  applyNativeSqliteBackupEvidence,
  collectNativeSqliteBackupEvidence,
  mergeNativeSqliteBackupEvidence,
} from "@/app/features/account-sync/services/native-sqlite-backup-evidence";
import { logWorkspaceKernelDiagnostic } from "./workspace-kernel-diagnostics";
import { isWorkspaceKernelAuthority } from "./workspace-kernel-policy";

export type WorkspaceKernelBackupRestorePortStatus = "w4_landed";

export const workspaceKernelBackupRestorePortStatus = (): WorkspaceKernelBackupRestorePortStatus => "w4_landed";

export const isWorkspaceKernelBackupRestorePortReady = (): boolean => isWorkspaceKernelAuthority();

/** W4 — delegate group thread + room list evidence to Path B B4 collectors. */
export const collectWorkspaceKernelBackupEvidence = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId?: string;
}>): Promise<NativeSqliteBackupEvidenceSnapshot | undefined> => {
  if (!isWorkspaceKernelBackupRestorePortReady()) {
    return undefined;
  }
  const evidence = await collectNativeSqliteBackupEvidence(params);
  logWorkspaceKernelDiagnostic("workspace.backup.collect", {
    hasEvidence: Boolean(evidence),
    groupMessageCount: evidence?.groupMessages.length ?? 0,
    groupRecordCount: evidence?.groupRecords.length ?? 0,
  });
  return evidence;
};

export const mergeWorkspaceKernelBackupEvidence = mergeNativeSqliteBackupEvidence;

export const applyWorkspaceKernelBackupEvidence = applyNativeSqliteBackupEvidence;

/** W4 — restore room list + sqlite group bodies on native (B4-2). */
export const applyWorkspaceKernelRestoreMaterialization = async (params: Readonly<{
  profileId: string;
  chatState: PersistedChatState | null | undefined;
  nativeSqliteEvidence?: NativeSqliteBackupEvidenceSnapshot | null | undefined;
}>): Promise<void> => {
  if (!isWorkspaceKernelBackupRestorePortReady()) {
    return;
  }
  await applyNativeRestoreSqliteMaterialization(params);
  logWorkspaceKernelDiagnostic("workspace.backup.restore", {
    groupCount: params.chatState?.createdGroups?.length ?? 0,
    hasSqliteEvidence: Boolean(params.nativeSqliteEvidence),
  });
};
