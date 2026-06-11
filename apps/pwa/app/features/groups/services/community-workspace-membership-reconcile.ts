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
  communityIdCandidates?: ReadonlyArray<string>;
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
    !shouldUseCoordinationMembershipAuthority(params.communityMode, params.relayUrl)
    || !params.onSemanticMemberEvent
  ) {
    return { coordination: null };
  }

  const communityIdCandidates = (params.communityIdCandidates?.length
    ? params.communityIdCandidates
    : [(params.communityId ?? params.groupId).trim()]
  ).filter((communityId) => communityId.length > 0);

  let coordination: CoordinationMembershipReconcileResult | null = null;
  for (const communityId of communityIdCandidates) {
    const attempt = await runCoordinationMembershipReconcile({
      communityId,
      profileId: params.profileId,
      forceFull: true,
      onSemanticMemberEvent: params.onSemanticMemberEvent,
    });
    if (!attempt.ok) {
      continue;
    }
    if (
      !coordination
      || attempt.toSeq > coordination.toSeq
      || attempt.appliedDeltaCount > coordination.appliedDeltaCount
    ) {
      coordination = attempt;
    }
  }

  params.refreshRelaySubscription();
  return { coordination };
};
