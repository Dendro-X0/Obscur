import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

/**
 * Workspace kernel — managed_workspace communities on native bypass legacy `features/groups/` authority.
 * Opt out only for emergency: NEXT_PUBLIC_OBSCUR_WORKSPACE_KERNEL=0
 *
 * @see docs/program/workspace-kernel-manifest.md
 */
export const isWorkspaceKernelAuthority = (): boolean => {
  if (!requiresSqlitePersistence()) {
    return false;
  }
  if (process.env.NEXT_PUBLIC_OBSCUR_WORKSPACE_KERNEL === "0") {
    return false;
  }
  return true;
};
