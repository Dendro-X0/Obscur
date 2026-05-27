import type { CommunityMode } from "../types";
import type { TransportKind } from "@dweb/transport-contracts";
import { hasWritableCommunityRelayTransport } from "./community-relay-transport";
import { isPublicDefaultRelayHost, normalizeRelayHost } from "./community-mode-contract";
import { shouldUseCoordinationMembershipAuthority } from "./community-workspace-r1-policy";

/**
 * Resolves which transport kind carries sealed community control for this community.
 * Membership roster authority is always coordination when {@link shouldUseCoordinationMembershipAuthority}.
 */
export const resolveCommunityControlTransportKind = (params: Readonly<{
  communityMode?: CommunityMode | null;
  communityRelayUrl: string;
}>): TransportKind => {
  if (params.communityMode === "managed_workspace") {
    const host = normalizeRelayHost(params.communityRelayUrl);
    if (host && hasWritableCommunityRelayTransport(params.communityRelayUrl) && !isPublicDefaultRelayHost(host)) {
      return "team_relay";
    }
  }
  return "nostr";
};

export const usesCoordinationMembershipDirectory = (
  communityMode?: CommunityMode | null,
): boolean => shouldUseCoordinationMembershipAuthority(communityMode);
