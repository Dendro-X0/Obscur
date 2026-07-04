import { isEngineLabStrictMode } from "@/app/engine-lab/engine-lab-policy";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

/**
 * Workspace kernel — managed_workspace communities bypass legacy `features/groups/` authority.
 * ENGINE LAB: authority by default. Legacy only when OBSCUR_ALLOW_LEGACY=1.
 *
 * @see docs/program/workspace-kernel-manifest.md
 */
export const isWorkspaceKernelAuthority = (): boolean => {
  if (isEngineLabStrictMode()) {
    return true;
  }
  if (!requiresSqlitePersistence()) {
    return false;
  }
  if (process.env.NEXT_PUBLIC_OBSCUR_WORKSPACE_KERNEL === "0") {
    return false;
  }
  return true;
};
