import { isWorkspaceR1MembershipEnforced } from "./community-dev-flags";
import { resolveCoordinationBaseUrl } from "./operator-trust-config";

export type MembershipSyncMode = "nostr_only" | "coordination_preferred";

const MODE_STORAGE_KEY = "obscur.membership_sync_mode.v1";

export const getCoordinationBaseUrl = (): string | null => resolveCoordinationBaseUrl();

export const isCoordinationConfigured = (): boolean => getCoordinationBaseUrl() !== null;

export const readMembershipSyncMode = (): MembershipSyncMode => {
  if (!isCoordinationConfigured()) {
    return "nostr_only";
  }
  /** Phase 2: managed workspaces always use coordination when the service is configured. */
  if (isWorkspaceR1MembershipEnforced()) {
    return "coordination_preferred";
  }
  if (typeof window === "undefined") {
    return "coordination_preferred";
  }
  try {
    const raw = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (raw === "nostr_only" || raw === "coordination_preferred") {
      return raw;
    }
  } catch {
    // ignore
  }
  return "coordination_preferred";
};

export const writeMembershipSyncMode = (mode: MembershipSyncMode): void => {
  if (
    isWorkspaceR1MembershipEnforced()
    && isCoordinationConfigured()
    && mode === "nostr_only"
  ) {
    return;
  }
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
};
