import type { SemanticCommunityMemberEvent } from "@dweb/transport-contracts";
import type { CommunityMode } from "../types";
import {
  runCoordinationMembershipReconcile,
  type CoordinationMembershipReconcileResult,
} from "./community-coordination-membership-reconcile";
import {
  reconcileCommunityMembershipEvidence,
  type CommunityMembershipReconcileParams,
} from "./community-membership-evidence-actions";
import { shouldUseCoordinationMembershipAuthority } from "./community-workspace-r1-policy";

export type WorkspaceMembershipReconcileParams = CommunityMembershipReconcileParams & Readonly<{
  communityId?: string;
  communityMode?: CommunityMode | null;
  onSemanticMemberEvent?: (event: SemanticCommunityMemberEvent) => void;
}>;

export type WorkspaceMembershipReconcileOutcome = Readonly<{
  coordination: CoordinationMembershipReconcileResult | null;
}>;

/**
 * Phase 3 reconcile: local provisional clear + relay refresh + coordination directory full resync.
 */
export const reconcileWorkspaceMembershipEvidence = async (
  params: WorkspaceMembershipReconcileParams,
): Promise<WorkspaceMembershipReconcileOutcome> => {
  reconcileCommunityMembershipEvidence({
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    profileId: params.profileId,
    refreshRelaySubscription: params.refreshRelaySubscription,
  });

  if (
    !shouldUseCoordinationMembershipAuthority(params.communityMode)
    || !params.onSemanticMemberEvent
  ) {
    return { coordination: null };
  }

  const communityId = (params.communityId ?? params.groupId).trim();
  const coordination = await runCoordinationMembershipReconcile({
    communityId,
    profileId: params.profileId,
    forceFull: true,
    onSemanticMemberEvent: params.onSemanticMemberEvent,
  });
  params.refreshRelaySubscription();
  return { coordination };
};
