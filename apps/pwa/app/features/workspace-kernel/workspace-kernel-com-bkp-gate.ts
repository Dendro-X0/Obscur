import {
  listWorkspaceKernelBackupRestoreDeferredScope,
  listWorkspaceKernelBackupRestoreIncludedScope,
  WORKSPACE_KERNEL_BACKUP_RESTORE_SCOPE_REGISTER,
  type WorkspaceKernelBackupRestoreScopeItemId,
} from "./workspace-kernel-backup-restore-scope";

export type ComBkpGateEvaluation = Readonly<{
  passed: boolean;
  reason: string;
  includedIds: ReadonlyArray<string>;
  deferredIds: ReadonlyArray<string>;
}>;

/** COM-BKP: workspace backup scope includes thread + list; coordination roster deferred with copy. */
export const evaluateComBkpWorkspaceScopeGate = (): ComBkpGateEvaluation => {
  const included = listWorkspaceKernelBackupRestoreIncludedScope();
  const deferred = listWorkspaceKernelBackupRestoreDeferredScope();
  const includedIds = included.map((item) => item.id);
  const deferredIds = deferred.map((item) => item.id);

  const requiresIncluded: ReadonlyArray<WorkspaceKernelBackupRestoreScopeItemId> = [
    "room_list",
    "thread_messages",
    "group_sqlite_metadata",
  ];
  const missingIncluded = requiresIncluded.filter((id) => !includedIds.includes(id));
  if (missingIncluded.length > 0) {
    return {
      passed: false,
      reason: `missing_included_scope:${missingIncluded.join(",")}`,
      includedIds,
      deferredIds,
    };
  }

  if (!deferredIds.includes("coordination_membership_directory")) {
    return {
      passed: false,
      reason: "coordination_directory_not_deferred",
      includedIds,
      deferredIds,
    };
  }

  const deferredWithoutCopy = deferred.filter((item) => !item.userCopyKey.trim());
  if (deferredWithoutCopy.length > 0) {
    return {
      passed: false,
      reason: "deferred_scope_missing_user_copy",
      includedIds,
      deferredIds,
    };
  }

  if (WORKSPACE_KERNEL_BACKUP_RESTORE_SCOPE_REGISTER.length < 5) {
    return {
      passed: false,
      reason: "scope_register_incomplete",
      includedIds,
      deferredIds,
    };
  }

  return {
    passed: true,
    reason: "com_bkp_ok",
    includedIds,
    deferredIds,
  };
};
