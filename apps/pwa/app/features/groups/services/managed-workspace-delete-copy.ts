/** D3 — honest delete/remove copy for operator-managed workspace relays. */
export const MANAGED_WORKSPACE_DELETE_COPY = {
  removeFromWorkspace: "Remove from this workspace",
  removeFromWorkspaceWithCount: "Remove from this workspace ({{count}})",
  removeScopeHelper:
    "Removes the message from this operator-managed workspace relay. Copies on other relays or devices outside this workspace may still exist.",
  removedFromWorkspaceToast: "Message removed from this workspace",
  removedFromWorkspaceBatchToast: "Messages removed from this workspace",
} as const;
