/**
 * @deprecated Use {@link loadWorkspaceKernelGroupThreadPage} from workspace-kernel-thread-port (W2).
 * Retained for non-workspace-kernel legacy callers until deletion.
 */
export {
  loadWorkspaceKernelGroupThreadEarlier as loadDmKernelGroupThreadEarlier,
  loadWorkspaceKernelGroupThreadPage as loadDmKernelGroupThreadPage,
  type LoadWorkspaceKernelGroupThreadEarlierParams as LoadDmKernelGroupThreadEarlierParams,
  type LoadWorkspaceKernelGroupThreadParams as LoadDmKernelGroupThreadParams,
} from "@/app/features/workspace-kernel/workspace-kernel-thread-port";
