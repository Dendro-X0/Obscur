import { describe, expect, it } from "vitest";
import {
  computeGovernanceQuorumThreshold,
  createEmptyCommunityGovernanceState,
  getActiveGovernanceProposals,
  hasGovernanceQuorum,
  hasGovernanceRejectionQuorum,
  listExpiredOpenGovernanceProposalIds,
  reduceCommunityGovernance,
} from "./community-governance-reducer";

const PROPOSER = "a".repeat(64);
const VOTER_B = "b".repeat(64);

describe("community-governance-reducer", () => {
  it("computes quorum for solo and multi-member rooms", () => {
    expect(computeGovernanceQuorumThreshold(1)).toBe(1);
    expect(computeGovernanceQuorumThreshold(2)).toBe(2);
    expect(computeGovernanceQuorumThreshold(3)).toBe(2);
    expect(computeGovernanceQuorumThreshold(5)).toBe(3);
  });

  it("reaches quorum when enough approve votes exist", () => {
    let state = createEmptyCommunityGovernanceState();
    state = reduceCommunityGovernance(state, {
      type: "PROPOSED",
      proposalId: "p1",
      actionType: "update_descriptor",
      proposerPublicKeyHex: PROPOSER,
      createdAtUnixMs: 1000,
      quorumThreshold: 2,
      payload: { name: "Renamed" },
      logicalEventId: "e1",
    });
    state = reduceCommunityGovernance(state, {
      type: "VOTE_CAST",
      proposalId: "p1",
      voterPublicKeyHex: PROPOSER,
      vote: "approve",
      createdAtUnixMs: 1001,
      logicalEventId: "e2",
    });
    const proposal = state.proposalsById.p1;
    expect(proposal).toBeDefined();
    expect(hasGovernanceQuorum(proposal!)).toBe(false);

    state = reduceCommunityGovernance(state, {
      type: "VOTE_CAST",
      proposalId: "p1",
      voterPublicKeyHex: VOTER_B,
      vote: "approve",
      createdAtUnixMs: 1002,
      logicalEventId: "e3",
    });
    expect(hasGovernanceQuorum(state.proposalsById.p1!)).toBe(true);
  });

  it("detects rejection quorum when rejects exceed approves", () => {
    let state = createEmptyCommunityGovernanceState();
    state = reduceCommunityGovernance(state, {
      type: "PROPOSED",
      proposalId: "p2",
      actionType: "update_descriptor",
      proposerPublicKeyHex: PROPOSER,
      createdAtUnixMs: 1000,
      quorumThreshold: 2,
      payload: { name: "X" },
      logicalEventId: "e1",
    });
    state = reduceCommunityGovernance(state, {
      type: "VOTE_CAST",
      proposalId: "p2",
      voterPublicKeyHex: PROPOSER,
      vote: "reject",
      createdAtUnixMs: 1001,
      logicalEventId: "e2",
    });
    expect(hasGovernanceRejectionQuorum(state.proposalsById.p2!)).toBe(false);
    state = reduceCommunityGovernance(state, {
      type: "VOTE_CAST",
      proposalId: "p2",
      voterPublicKeyHex: VOTER_B,
      vote: "reject",
      createdAtUnixMs: 1002,
      logicalEventId: "e3",
    });
    expect(hasGovernanceRejectionQuorum(state.proposalsById.p2!)).toBe(true);
  });

  it("moves resolved proposals out of active list", () => {
    let state = createEmptyCommunityGovernanceState();
    state = reduceCommunityGovernance(state, {
      type: "PROPOSED",
      proposalId: "p1",
      actionType: "expel_member",
      proposerPublicKeyHex: PROPOSER,
      createdAtUnixMs: 1000,
      quorumThreshold: 2,
      payload: { targetPublicKeyHex: VOTER_B },
      logicalEventId: "e1",
    });
    state = reduceCommunityGovernance(state, {
      type: "RESOLVED",
      proposalId: "p1",
      resolution: "accepted",
      resolverPublicKeyHex: PROPOSER,
      createdAtUnixMs: 2000,
      logicalEventId: "e4",
    });
    expect(state.activeProposalIds).not.toContain("p1");
    expect(state.resolvedProposalIds).toContain("p1");
    expect(getActiveGovernanceProposals(state)).toHaveLength(0);
  });

  it("lists expired proposal ids past TTL", () => {
    const past = Date.now() - 1000;
    let state = createEmptyCommunityGovernanceState();
    state = reduceCommunityGovernance(state, {
      type: "PROPOSED",
      proposalId: "exp1",
      actionType: "update_descriptor",
      proposerPublicKeyHex: PROPOSER,
      createdAtUnixMs: past - 10_000,
      quorumThreshold: 2,
      proposalExpiresAtUnixMs: past,
      payload: { name: "Late" },
      logicalEventId: "e0",
    });
    expect(listExpiredOpenGovernanceProposalIds(state, Date.now())).toContain("exp1");
    expect(getActiveGovernanceProposals(state, Date.now())).toHaveLength(0);
  });
});
