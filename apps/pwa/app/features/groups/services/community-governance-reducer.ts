import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type {
  CommunityGovernanceActionType,
  CommunityGovernanceResolution,
  CommunityGovernanceVote,
} from "@dweb/core/community-control-event-contracts";
import type { CommunityGovernanceProjection } from "@dweb/core/community-projection-contracts";

export type GovernanceDescriptorPayload = Readonly<{
  name?: string;
  about?: string;
  picture?: string;
  access?: "open" | "invite-only" | "discoverable";
}>;

export type GovernanceExpelPayload = Readonly<{
  targetPublicKeyHex: PublicKeyHex;
  reason?: string;
}>;

export type GovernanceProposalPayload = GovernanceDescriptorPayload | GovernanceExpelPayload;

export type GovernanceProposalRecord = Readonly<{
  proposalId: string;
  actionType: CommunityGovernanceActionType;
  proposerPublicKeyHex: PublicKeyHex;
  createdAtUnixMs: number;
  quorumThreshold: number;
  proposalExpiresAtUnixMs?: number;
  payload: GovernanceProposalPayload;
  votes: Readonly<Record<PublicKeyHex, CommunityGovernanceVote>>;
  resolution?: CommunityGovernanceResolution;
  resolvedAtUnixMs?: number;
  lastEventId?: string;
}>;

export type CommunityGovernanceReducerState = Readonly<{
  proposalsById: Readonly<Record<string, GovernanceProposalRecord>>;
  activeProposalIds: ReadonlyArray<string>;
  resolvedProposalIds: ReadonlyArray<string>;
  lastGovernanceEventId?: string;
  lastGovernanceAtUnixMs?: number;
}>;

export type GovernanceReducerEvent =
  | Readonly<{
    type: "PROPOSED";
    proposalId: string;
    actionType: CommunityGovernanceActionType;
    proposerPublicKeyHex: PublicKeyHex;
    createdAtUnixMs: number;
    quorumThreshold: number;
    proposalExpiresAtUnixMs?: number;
    payload: GovernanceProposalPayload;
    logicalEventId: string;
  }>
  | Readonly<{
    type: "VOTE_CAST";
    proposalId: string;
    voterPublicKeyHex: PublicKeyHex;
    vote: CommunityGovernanceVote;
    createdAtUnixMs: number;
    logicalEventId: string;
  }>
  | Readonly<{
    type: "RESOLVED";
    proposalId: string;
    resolution: CommunityGovernanceResolution;
    resolverPublicKeyHex: PublicKeyHex;
    createdAtUnixMs: number;
    logicalEventId: string;
  }>;

export const createEmptyCommunityGovernanceState = (): CommunityGovernanceReducerState => ({
  proposalsById: {},
  activeProposalIds: [],
  resolvedProposalIds: [],
});

/** Member-vote quorum: solo = 1; multi-member uses majority with floor of 2 approvers. */
export const computeGovernanceQuorumThreshold = (activeMemberCount: number): number => {
  if (activeMemberCount <= 1) {
    return 1;
  }
  return Math.max(2, Math.ceil(activeMemberCount / 2));
};

export const countGovernanceVotes = (
  proposal: GovernanceProposalRecord,
): Readonly<{ approve: number; reject: number; abstain: number }> => {
  let approve = 0;
  let reject = 0;
  let abstain = 0;
  for (const vote of Object.values(proposal.votes)) {
    if (vote === "approve") {
      approve += 1;
    } else if (vote === "reject") {
      reject += 1;
    } else if (vote === "abstain") {
      abstain += 1;
    }
  }
  return { approve, reject, abstain };
};

export const isGovernanceProposalOpen = (
  proposal: GovernanceProposalRecord,
  nowUnixMs: number = Date.now(),
): boolean => {
  if (proposal.resolution) {
    return false;
  }
  if (
    typeof proposal.proposalExpiresAtUnixMs === "number"
    && proposal.proposalExpiresAtUnixMs > 0
    && nowUnixMs >= proposal.proposalExpiresAtUnixMs
  ) {
    return false;
  }
  return true;
};

export const hasGovernanceQuorum = (proposal: GovernanceProposalRecord): boolean => {
  const { approve, reject } = countGovernanceVotes(proposal);
  return approve >= proposal.quorumThreshold && approve > reject;
};

/** Enough reject votes to close the proposal without applying effects (symmetric to approve quorum). */
export const hasGovernanceRejectionQuorum = (proposal: GovernanceProposalRecord): boolean => {
  const { approve, reject } = countGovernanceVotes(proposal);
  return reject >= proposal.quorumThreshold && reject > approve;
};

export const getActiveGovernanceProposals = (
  state: CommunityGovernanceReducerState,
  nowUnixMs: number = Date.now(),
): ReadonlyArray<GovernanceProposalRecord> => (
  state.activeProposalIds
    .map((id) => state.proposalsById[id])
    .filter((proposal): proposal is GovernanceProposalRecord => (
      !!proposal && isGovernanceProposalOpen(proposal, nowUnixMs)
    ))
);

/** Proposal IDs that are still "active" in the index but past `proposalExpiresAtUnixMs` (caller should emit `RESOLVED` expired). */
export const listExpiredOpenGovernanceProposalIds = (
  state: CommunityGovernanceReducerState,
  nowUnixMs: number = Date.now(),
): ReadonlyArray<string> => (
  state.activeProposalIds.filter((id) => {
    const p = state.proposalsById[id];
    if (!p || p.resolution) {
      return false;
    }
    return (
      typeof p.proposalExpiresAtUnixMs === "number"
      && p.proposalExpiresAtUnixMs > 0
      && nowUnixMs >= p.proposalExpiresAtUnixMs
    );
  })
);

export const toCommunityGovernanceProjection = (
  communityId: string,
  state: CommunityGovernanceReducerState,
): CommunityGovernanceProjection => ({
  communityId,
  activeVotes: [...state.activeProposalIds],
  resolvedVotes: [...state.resolvedProposalIds],
  policyState: {},
  moderationState: {},
  ...(state.lastGovernanceEventId ? { lastGovernanceEventId: state.lastGovernanceEventId } : {}),
  ...(typeof state.lastGovernanceAtUnixMs === "number"
    ? { lastGovernanceAtUnixMs: state.lastGovernanceAtUnixMs }
    : {}),
});

const moveProposalToResolved = (
  state: CommunityGovernanceReducerState,
  proposalId: string,
): CommunityGovernanceReducerState => ({
  ...state,
  activeProposalIds: state.activeProposalIds.filter((id) => id !== proposalId),
  resolvedProposalIds: state.resolvedProposalIds.includes(proposalId)
    ? state.resolvedProposalIds
    : [...state.resolvedProposalIds, proposalId],
});

export const reduceCommunityGovernance = (
  current: CommunityGovernanceReducerState,
  event: GovernanceReducerEvent,
): CommunityGovernanceReducerState => {
  const touchMeta = (logicalEventId: string, createdAtUnixMs: number): CommunityGovernanceReducerState => ({
    ...current,
    lastGovernanceEventId: logicalEventId,
    lastGovernanceAtUnixMs: createdAtUnixMs,
  });

  switch (event.type) {
    case "PROPOSED": {
      const existing = current.proposalsById[event.proposalId];
      if (existing && existing.createdAtUnixMs >= event.createdAtUnixMs) {
        return touchMeta(event.logicalEventId, event.createdAtUnixMs);
      }
      const nextProposal: GovernanceProposalRecord = {
        proposalId: event.proposalId,
        actionType: event.actionType,
        proposerPublicKeyHex: event.proposerPublicKeyHex,
        createdAtUnixMs: event.createdAtUnixMs,
        quorumThreshold: event.quorumThreshold,
        ...(event.proposalExpiresAtUnixMs
          ? { proposalExpiresAtUnixMs: event.proposalExpiresAtUnixMs }
          : {}),
        payload: event.payload,
        votes: existing?.votes ?? {},
        ...(existing?.resolution ? { resolution: existing.resolution } : {}),
        ...(existing?.resolvedAtUnixMs ? { resolvedAtUnixMs: existing.resolvedAtUnixMs } : {}),
        lastEventId: event.logicalEventId,
      };
      const activeProposalIds = current.activeProposalIds.includes(event.proposalId)
        ? current.activeProposalIds
        : [...current.activeProposalIds, event.proposalId];
      return {
        ...touchMeta(event.logicalEventId, event.createdAtUnixMs),
        proposalsById: {
          ...current.proposalsById,
          [event.proposalId]: nextProposal,
        },
        activeProposalIds,
      };
    }

    case "VOTE_CAST": {
      const existing = current.proposalsById[event.proposalId];
      if (!existing || existing.resolution) {
        return touchMeta(event.logicalEventId, event.createdAtUnixMs);
      }
      const priorVote = existing.votes[event.voterPublicKeyHex];
      if (priorVote === event.vote) {
        return touchMeta(event.logicalEventId, event.createdAtUnixMs);
      }
      const nextProposal: GovernanceProposalRecord = {
        ...existing,
        votes: {
          ...existing.votes,
          [event.voterPublicKeyHex]: event.vote,
        },
        lastEventId: event.logicalEventId,
      };
      return {
        ...touchMeta(event.logicalEventId, event.createdAtUnixMs),
        proposalsById: {
          ...current.proposalsById,
          [event.proposalId]: nextProposal,
        },
      };
    }

    case "RESOLVED": {
      const existing = current.proposalsById[event.proposalId];
      if (!existing) {
        return touchMeta(event.logicalEventId, event.createdAtUnixMs);
      }
      if (
        existing.resolution
        && existing.resolvedAtUnixMs
        && existing.resolvedAtUnixMs >= event.createdAtUnixMs
      ) {
        return touchMeta(event.logicalEventId, event.createdAtUnixMs);
      }
      const nextProposal: GovernanceProposalRecord = {
        ...existing,
        resolution: event.resolution,
        resolvedAtUnixMs: event.createdAtUnixMs,
        lastEventId: event.logicalEventId,
      };
      return {
        ...moveProposalToResolved(touchMeta(event.logicalEventId, event.createdAtUnixMs), event.proposalId),
        proposalsById: {
          ...current.proposalsById,
          [event.proposalId]: nextProposal,
        },
      };
    }

    default:
      return current;
  }
};
