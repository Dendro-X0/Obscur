import { isWorkspaceKernelAuthority } from "./workspace-kernel-policy";
import { isWorkspaceKernelMembershipPortReady } from "./workspace-kernel-membership-port";

/** Sovereign rooms on public relays are never a supported create path. */
export const isNewSovereignRoomCreationAllowed = (): boolean => false;

/**
 * Managed workspace create: legacy path when kernel is off; membership-port when kernel is on (W1).
 */
export const isWorkspaceCommunityCreateAllowed = (): boolean => {
  if (!isWorkspaceKernelAuthority()) {
    return true;
  }
  return isWorkspaceKernelMembershipPortReady();
};

export const WORKSPACE_KERNEL_CREATE_DEFERRED_MESSAGE =
  "Workspace communities require coordination. Start coordination and confirm membership sync settings.";
