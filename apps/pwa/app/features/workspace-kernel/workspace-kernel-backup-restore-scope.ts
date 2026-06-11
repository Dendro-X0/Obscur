import { isWorkspaceKernelAuthority } from "./workspace-kernel-policy";

export type WorkspaceKernelBackupRestoreScopeItemId = Readonly<
  | "room_list"
  | "thread_messages"
  | "group_sqlite_metadata"
  | "coordination_membership_directory"
  | "relay_membership_hints"
>;

export type WorkspaceKernelBackupRestoreScopeStatus = "included" | "deferred";

export type WorkspaceKernelBackupRestoreScopeItem = Readonly<{
  id: WorkspaceKernelBackupRestoreScopeItemId;
  status: WorkspaceKernelBackupRestoreScopeStatus;
  /** Implementation owner — not user-facing. */
  authority: string;
  /** i18n key for user-facing copy when deferred or listed in scope summary. */
  userCopyKey: string;
}>;

/**
 * W4 scope register — what encrypted backup/restore covers for managed workspace
 * under workspace-kernel authority. Coordination roster is server-truth and deferred.
 *
 * @see docs/program/workspace-kernel-manifest.md §W4
 * @see Path B B4 — nativeSqliteEvidence + createdGroups materialization
 */
export const WORKSPACE_KERNEL_BACKUP_RESTORE_SCOPE_REGISTER: ReadonlyArray<WorkspaceKernelBackupRestoreScopeItem> = [
  {
    id: "room_list",
    status: "included",
    authority: "encrypted backup chat-state createdGroups + B4-2 syncPersistedGroupsToSqliteFromChatState",
    userCopyKey: "settings.accountSync.workspaceBackupScope.includedRoomList",
  },
  {
    id: "thread_messages",
    status: "included",
    authority: "encrypted backup nativeSqliteEvidence.groupMessages + B4-1 collectNativeSqliteBackupEvidence",
    userCopyKey: "settings.accountSync.workspaceBackupScope.includedThreadMessages",
  },
  {
    id: "group_sqlite_metadata",
    status: "included",
    authority: "encrypted backup nativeSqliteEvidence.groupRecords",
    userCopyKey: "settings.accountSync.workspaceBackupScope.includedGroupMetadata",
  },
  {
    id: "coordination_membership_directory",
    status: "deferred",
    authority: "coordination HTTP directory — refresh via membership-port after restore",
    userCopyKey: "settings.accountSync.workspaceBackupScope.deferredCoordinationDirectory",
  },
  {
    id: "relay_membership_hints",
    status: "deferred",
    authority: "relay roster lines are chat-delivery hints only under Path B",
    userCopyKey: "settings.accountSync.workspaceBackupScope.deferredRelayHints",
  },
];

export const workspaceKernelBackupRestoreScopeStatus = (): "w4_landed" => "w4_landed";

export const isWorkspaceKernelBackupRestoreScopeActive = (): boolean => (
  isWorkspaceKernelAuthority()
);

export const listWorkspaceKernelBackupRestoreScope = (): ReadonlyArray<WorkspaceKernelBackupRestoreScopeItem> => (
  WORKSPACE_KERNEL_BACKUP_RESTORE_SCOPE_REGISTER
);

export const listWorkspaceKernelBackupRestoreIncludedScope = (): ReadonlyArray<WorkspaceKernelBackupRestoreScopeItem> => (
  WORKSPACE_KERNEL_BACKUP_RESTORE_SCOPE_REGISTER.filter((item) => item.status === "included")
);

export const listWorkspaceKernelBackupRestoreDeferredScope = (): ReadonlyArray<WorkspaceKernelBackupRestoreScopeItem> => (
  WORKSPACE_KERNEL_BACKUP_RESTORE_SCOPE_REGISTER.filter((item) => item.status === "deferred")
);

export const resolveWorkspaceKernelBackupRestoreDeferredUserCopyKeys = (): ReadonlyArray<string> => (
  listWorkspaceKernelBackupRestoreDeferredScope().map((item) => item.userCopyKey)
);
