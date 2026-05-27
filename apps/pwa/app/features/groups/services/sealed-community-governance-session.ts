import type { CommunityGovernanceReducerState } from "./community-governance-reducer";
import {
  getCommunityGovernanceReducerState,
  hydrateCommunityGovernanceState,
  subscribeCommunityGovernance,
} from "./community-governance-projection";
import {
  parseStoredCommunityGovernanceState,
  serializeCommunityGovernanceState,
} from "./community-governance-local-cache";

export const readGovernanceSessionFromStorage = (
  storageKey: string,
): CommunityGovernanceReducerState | null => {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  try {
    return parseStoredCommunityGovernanceState(sessionStorage.getItem(storageKey));
  } catch {
    return null;
  }
};

export const hydrateGovernanceScopeFromSession = (
  governanceScopeId: string,
  storageKey: string,
): Readonly<{ restored: CommunityGovernanceReducerState | null; serialized: string | null }> => {
  const restored = readGovernanceSessionFromStorage(storageKey);
  if (restored) {
    hydrateCommunityGovernanceState(governanceScopeId, restored);
    return {
      restored,
      serialized: serializeCommunityGovernanceState(restored),
    };
  }
  return { restored: null, serialized: null };
};

export const persistGovernanceScopeToSession = (
  governanceScopeId: string,
  storageKey: string,
  lastWrittenJson: string | null,
): string | null => {
  if (typeof sessionStorage === "undefined") {
    return lastWrittenJson;
  }
  const state = getCommunityGovernanceReducerState(governanceScopeId);
  const hasData =
    state.activeProposalIds.length > 0
    || state.resolvedProposalIds.length > 0
    || Object.keys(state.proposalsById).length > 0;
  if (!hasData) {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    return null;
  }
  const json = serializeCommunityGovernanceState(state);
  if (json === lastWrittenJson) {
    return lastWrittenJson;
  }
  try {
    sessionStorage.setItem(storageKey, json);
  } catch {
    // ignore quota / private mode
  }
  return json;
};

export const subscribeGovernanceSessionPersistence = (
  governanceScopeId: string,
  storageKey: string,
  onGovernanceStateChanged: (state: CommunityGovernanceReducerState) => void,
  getLastWrittenJson: () => string | null,
  setLastWrittenJson: (json: string | null) => void,
): (() => void) => {
  const persist = (): void => {
    const state = getCommunityGovernanceReducerState(governanceScopeId);
    onGovernanceStateChanged(state);
    setLastWrittenJson(persistGovernanceScopeToSession(
      governanceScopeId,
      storageKey,
      getLastWrittenJson(),
    ));
  };
  persist();
  return subscribeCommunityGovernance(governanceScopeId, persist);
};
