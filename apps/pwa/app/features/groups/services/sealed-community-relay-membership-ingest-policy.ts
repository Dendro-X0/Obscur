/**
 * Path B B1-2 — sealed-community relay ingest policy.
 *
 * For `managed_workspace`, coordination directory owns membership roster.
 * Relay membership signals (join/leave/roster/gossip) must not widen or shrink
 * sealed-community member state. Chat rows use {@link resolveSealedCommunityRelaySubscribeKinds}.
 */

import type { CommunityMode } from "../types";
import {
  SEALED_COMMUNITY_CHAT_SUBSCRIBE_KINDS,
  SEALED_COMMUNITY_TIMELINE_SUBSCRIBE_KINDS,
} from "./sealed-community-relay-kinds";
import { shouldUseCoordinationMembershipAuthority } from "./community-workspace-r1-policy";

export const shouldIgnoreRelayMembershipSignalForSealedCommunity = (params: Readonly<{
  communityMode?: CommunityMode | null;
}>): boolean => shouldUseCoordinationMembershipAuthority(params.communityMode);

export const resolveSealedCommunityRelaySubscribeKinds = (
  communityMode?: CommunityMode | null,
): ReadonlyArray<number> => (
  shouldUseCoordinationMembershipAuthority(communityMode)
    ? [...SEALED_COMMUNITY_CHAT_SUBSCRIBE_KINDS]
    : [...SEALED_COMMUNITY_TIMELINE_SUBSCRIBE_KINDS]
);
