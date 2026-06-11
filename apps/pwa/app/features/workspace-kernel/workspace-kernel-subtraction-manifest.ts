/**
 * W0 subtraction manifest — legacy symbols that must not be authority when
 * {@link isWorkspaceKernelAuthority} is true.
 *
 * @see docs/program/workspace-kernel-manifest.md §Subtraction manifest
 */

/** Legacy modules workspace-kernel must never import. */
export const WORKSPACE_KERNEL_FORBIDDEN_KERNEL_IMPORTS = [
  "use-sealed-community",
  "group-provider",
  "mergeHybridMembershipTruthFallback",
  "persistExplicitCommunityMembershipLeave",
  "community-membership-coordinator",
  "dm-kernel-group-thread-port",
] as const;

/** Kernel implementation files checked for forbidden imports (excludes this manifest). */
export const WORKSPACE_KERNEL_IMPLEMENTATION_FILES = [
  "workspace-kernel-policy.ts",
  "workspace-kernel-sovereign-create-policy.ts",
  "workspace-kernel-diagnostics.ts",
  "workspace-kernel-membership-port.ts",
  "workspace-kernel-thread-port.ts",
  "workspace-kernel-write-port.ts",
  "workspace-kernel-leave-port.ts",
  "workspace-kernel-list-port.ts",
  "workspace-kernel-com-mem-gate.ts",
  "workspace-kernel-com-msg-gate.ts",
  "workspace-kernel-roster-port.ts",
  "workspace-kernel-com-roster-gate.ts",
  "workspace-kernel-backup-restore-scope.ts",
  "workspace-kernel-backup-restore-port.ts",
  "workspace-kernel-com-bkp-gate.ts",
  "workspace-kernel-transport-port.ts",
] as const;

/** All kernel module files (implementation + manifest + barrel). */
export const WORKSPACE_KERNEL_SOURCE_FILES = [
  ...WORKSPACE_KERNEL_IMPLEMENTATION_FILES,
  "workspace-kernel-subtraction-manifest.ts",
  "index.ts",
] as const;

/** Legacy routing surfaces that must gate on workspace-kernel authority (W0). */
export const WORKSPACE_KERNEL_LEGACY_ROUTING_FILES = [
  "app/features/groups/services/sealed-community-instance-policy.ts",
  "app/features/main-shell/main-shell.tsx",
  "app/groups/[...id]/group-home-page-client.tsx",
  "app/features/main-shell/hooks/use-chat-actions.ts",
  "app/features/messaging/components/global-dialog-manager.tsx",
  "app/features/groups/components/create-group-dialog.tsx",
  "app/features/groups/components/group-join-dialog.tsx",
  "app/groups/leave/page.tsx",
] as const;
