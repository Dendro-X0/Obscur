/**
 * Canonical read owner for community governance (contract 26 `governanceByCommunityId`).
 * Ingest: `use-sealed-community` and replay paths call `ingestCommunityGovernanceEvent` only.
 * UI: `useCommunityGovernanceProjection` — do not read `state.governance` from the hook.
 */

import type { CommunityGovernanceProjection } from "@dweb/core/community-projection-contracts";
import {
  createEmptyCommunityGovernanceState,
  getActiveGovernanceProposals,
  reduceCommunityGovernance,
  toCommunityGovernanceProjection,
  type CommunityGovernanceReducerState,
  type GovernanceProposalRecord,
  type GovernanceReducerEvent,
} from "./community-governance-reducer";

export type CommunityGovernanceProjectionListener = () => void;

const governanceReducerByScopeId = new Map<string, CommunityGovernanceReducerState>();
const governanceListenersByScopeId = new Map<string, Set<CommunityGovernanceProjectionListener>>();

export const resolveCommunityGovernanceScopeId = (params: Readonly<{
  communityId?: string | null;
  groupId: string;
}>): string => {
  const communityId = typeof params.communityId === "string" ? params.communityId.trim() : "";
  if (communityId.length > 0) {
    return communityId;
  }
  return params.groupId.trim();
};

const notifyGovernanceListeners = (scopeId: string): void => {
  const listeners = governanceListenersByScopeId.get(scopeId);
  if (!listeners) {
    return;
  }
  listeners.forEach((listener) => {
    listener();
  });
};

export const getCommunityGovernanceReducerState = (
  scopeId: string,
): CommunityGovernanceReducerState => (
  governanceReducerByScopeId.get(scopeId) ?? createEmptyCommunityGovernanceState()
);

export const getCommunityGovernanceProjection = (
  scopeId: string,
): CommunityGovernanceProjection => (
  toCommunityGovernanceProjection(scopeId, getCommunityGovernanceReducerState(scopeId))
);

export const getActiveCommunityGovernanceProposals = (
  scopeId: string,
  nowUnixMs: number = Date.now(),
): ReadonlyArray<GovernanceProposalRecord> => (
  getActiveGovernanceProposals(getCommunityGovernanceReducerState(scopeId), nowUnixMs)
);

/** Deterministic replay for tests and multi-device convergence checks (G2.2). */
export const replayCommunityGovernanceEvents = (
  scopeId: string,
  events: ReadonlyArray<GovernanceReducerEvent>,
): CommunityGovernanceReducerState => {
  let last = getCommunityGovernanceReducerState(scopeId);
  events.forEach((event) => {
    last = ingestCommunityGovernanceEvent(scopeId, event);
  });
  return last;
};

export const ingestCommunityGovernanceEvent = (
  scopeId: string,
  event: GovernanceReducerEvent,
): CommunityGovernanceReducerState => {
  const next = reduceCommunityGovernance(getCommunityGovernanceReducerState(scopeId), event);
  governanceReducerByScopeId.set(scopeId, next);
  notifyGovernanceListeners(scopeId);
  return next;
};

export const hydrateCommunityGovernanceState = (
  scopeId: string,
  state: CommunityGovernanceReducerState,
): void => {
  governanceReducerByScopeId.set(scopeId, state);
  notifyGovernanceListeners(scopeId);
};

export const clearCommunityGovernanceState = (scopeId: string): void => {
  governanceReducerByScopeId.delete(scopeId);
  notifyGovernanceListeners(scopeId);
};

export const subscribeCommunityGovernance = (
  scopeId: string,
  listener: CommunityGovernanceProjectionListener,
): (() => void) => {
  let listeners = governanceListenersByScopeId.get(scopeId);
  if (!listeners) {
    listeners = new Set();
    governanceListenersByScopeId.set(scopeId, listeners);
  }
  listeners.add(listener);
  return (): void => {
    const current = governanceListenersByScopeId.get(scopeId);
    if (!current) {
      return;
    }
    current.delete(listener);
    if (current.size === 0) {
      governanceListenersByScopeId.delete(scopeId);
    }
  };
};

/** @internal Vitest only */
export const resetCommunityGovernanceProjectionForTests = (): void => {
  governanceReducerByScopeId.clear();
  governanceListenersByScopeId.clear();
};
