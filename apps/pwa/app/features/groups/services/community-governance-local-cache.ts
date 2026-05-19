import type { CommunityGovernanceReducerState } from "./community-governance-reducer";

export const COMMUNITY_GOVERNANCE_LOCAL_CACHE_VERSION = 1 as const;

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

/**
 * Best-effort session persistence for governance UI (reload / tab restore).
 * Not a security or consensus source — relay replay remains canonical.
 */
export const parseStoredCommunityGovernanceState = (raw: string | null): CommunityGovernanceReducerState | null => {
  if (raw == null || raw.trim() === "") {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainObject(parsed) || parsed.version !== COMMUNITY_GOVERNANCE_LOCAL_CACHE_VERSION) {
      return null;
    }
    const inner = parsed.state;
    if (!isPlainObject(inner)) {
      return null;
    }
    if (!isPlainObject(inner.proposalsById) || !Array.isArray(inner.activeProposalIds) || !Array.isArray(inner.resolvedProposalIds)) {
      return null;
    }
    return {
      proposalsById: inner.proposalsById as CommunityGovernanceReducerState["proposalsById"],
      activeProposalIds: inner.activeProposalIds as string[],
      resolvedProposalIds: inner.resolvedProposalIds as string[],
      ...(typeof inner.lastGovernanceEventId === "string" ? { lastGovernanceEventId: inner.lastGovernanceEventId } : {}),
      ...(typeof inner.lastGovernanceAtUnixMs === "number" ? { lastGovernanceAtUnixMs: inner.lastGovernanceAtUnixMs } : {}),
    };
  } catch {
    return null;
  }
};

export const serializeCommunityGovernanceState = (state: CommunityGovernanceReducerState): string => (
  JSON.stringify({
    version: COMMUNITY_GOVERNANCE_LOCAL_CACHE_VERSION,
    state,
  })
);
