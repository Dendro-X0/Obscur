/** Product default: proposals expire after 72h without quorum (implementation plan). */
export const COMMUNITY_GOVERNANCE_PROPOSAL_TTL_MS = 72 * 60 * 60 * 1000;

export const computeGovernanceProposalExpiresAtUnixMs = (
  nowUnixMs: number = Date.now(),
): number => nowUnixMs + COMMUNITY_GOVERNANCE_PROPOSAL_TTL_MS;
