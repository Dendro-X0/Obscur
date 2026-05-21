"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { CommunityGovernanceProjection } from "@dweb/core/community-projection-contracts";
import {
  getActiveCommunityGovernanceProposals,
  getCommunityGovernanceProjection,
  getCommunityGovernanceReducerState,
  resolveCommunityGovernanceScopeId,
  subscribeCommunityGovernance,
} from "../services/community-governance-projection";
import {
  createEmptyCommunityGovernanceState,
  type CommunityGovernanceReducerState,
  type GovernanceProposalRecord,
} from "../services/community-governance-reducer";

const disabledReducerState = createEmptyCommunityGovernanceState();

export type UseCommunityGovernanceProjectionParams = Readonly<{
  groupId: string;
  communityId?: string | null;
  /** When false, subscription is inactive (dialog closed). */
  enabled?: boolean;
}>;

export type UseCommunityGovernanceProjectionResult = Readonly<{
  scopeId: string;
  reducerState: CommunityGovernanceReducerState;
  projection: CommunityGovernanceProjection;
  activeProposals: ReadonlyArray<GovernanceProposalRecord>;
  activeProposalCount: number;
}>;

/**
 * Canonical governance read path for community UI (G2.1).
 * Writes remain in `use-sealed-community` via `ingestCommunityGovernanceEvent`.
 */
export const useCommunityGovernanceProjection = (
  params: UseCommunityGovernanceProjectionParams,
): UseCommunityGovernanceProjectionResult => {
  const scopeId = useMemo(
    () => resolveCommunityGovernanceScopeId({
      communityId: params.communityId,
      groupId: params.groupId,
    }),
    [params.communityId, params.groupId],
  );
  const enabled = params.enabled !== false && scopeId.length > 0;

  const subscribe = useCallback(
    (onStoreChange: () => void) => (
      enabled
        ? subscribeCommunityGovernance(scopeId, onStoreChange)
        : () => { }
    ),
    [enabled, scopeId],
  );

  const getSnapshot = useCallback(
    () => (enabled ? getCommunityGovernanceReducerState(scopeId) : disabledReducerState),
    [enabled, scopeId],
  );

  const reducerState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const activeProposals = useMemo(
    () => (enabled ? getActiveCommunityGovernanceProposals(scopeId) : []),
    [enabled, reducerState, scopeId],
  );

  const projection = useMemo(
    () => (enabled ? getCommunityGovernanceProjection(scopeId) : {
      communityId: "",
      activeVotes: [],
      resolvedVotes: [],
      policyState: {},
      moderationState: {},
    }),
    [enabled, reducerState, scopeId],
  );

  return {
    scopeId,
    reducerState,
    projection,
    activeProposals,
    activeProposalCount: activeProposals.length,
  };
};
