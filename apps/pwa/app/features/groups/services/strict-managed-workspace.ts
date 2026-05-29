import { readOperatorWorkspaceRelayUrl } from "./operator-trust-config";
import { isLocalWorkspaceRelayHost, workspaceRelayUrlsMatch } from "./workspace-relay-url";
import { MANAGED_WORKSPACE_DELETE_COPY } from "./managed-workspace-delete-copy";

export { MANAGED_WORKSPACE_DELETE_COPY };

/**
 * Strict managed-workspace mode (D3): operator-trusted relay URL is configured
 * and matches the community relay (or localhost dev relay).
 */
export const isStrictManagedWorkspaceRelay = (
  relayUrl: string | null | undefined,
): boolean => {
  const normalized = relayUrl?.trim();
  if (!normalized) {
    return false;
  }
  const operatorRelay = readOperatorWorkspaceRelayUrl();
  if (operatorRelay && workspaceRelayUrlsMatch(normalized, operatorRelay)) {
    return true;
  }
  return isLocalWorkspaceRelayHost(normalized);
};

/** D1 filter applies on the same relay plane as strict managed workspace. */
export const shouldApplyCommunityRelayHideFilter = (
  relayUrl: string,
): boolean => isStrictManagedWorkspaceRelay(relayUrl);
