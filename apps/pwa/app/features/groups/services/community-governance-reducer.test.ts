import { describe, expect, it } from "vitest";
import {
  computeGovernanceQuorumThreshold,
  createEmptyCommunityGovernanceState,
  getActiveGovernanceProposals,
  hasGovernanceQuorum,
  hasGovernanceRejectionQuorum,
  hasGovernanceVoteTie,
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

  it("detects tied approve/reject counts at quorum as a tie", () => {
    let state = createEmptyCommunityGovernanceState();
    state = reduceCommunityGovernance(state, {
      type: "PROPOSED",
      proposalId: "p-tie",
      actionType: "update_descriptor",
      proposerPublicKeyHex: PROPOSER,
      createdAtUnixMs: 1000,
      quorumThreshold: 2,
      payload: { name: "Tie" },
      logicalEventId: "e1",
    });
    state = reduceCommunityGovernance(state, {
      type: "VOTE_CAST",
      proposalId: "p-tie",
      voterPublicKeyHex: PROPOSER,
      vote: "approve",
      createdAtUnixMs: 1001,
      logicalEventId: "e2",
    });
    state = reduceCommunityGovernance(state, {
      type: "VOTE_CAST",
      proposalId: "p-tie",
      voterPublicKeyHex: VOTER_B,
      vote: "reject",
      createdAtUnixMs: 1002,
      logicalEventId: "e3",
    });
    const extraVoter = "c".repeat(64);
    state = reduceCommunityGovernance(state, {
      type: "VOTE_CAST",
      proposalId: "p-tie",
      voterPublicKeyHex: extraVoter,
      vote: "approve",
      createdAtUnixMs: 1003,
      logicalEventId: "e4",
    });
    state = reduceCommunityGovernance(state, {
      type: "VOTE_CAST",
      proposalId: "p-tie",
      voterPublicKeyHex: "d".repeat(64),
      vote: "reject",
      createdAtUnixMs: 1004,
      logicalEventId: "e5",
    });
    const proposal = state.proposalsById["p-tie"]!;
    expect(hasGovernanceVoteTie(proposal)).toBe(true);
    expect(hasGovernanceQuorum(proposal)).toBe(false);
    expect(hasGovernanceRejectionQuorum(proposal)).toBe(false);
  });

  it("ignores duplicate RESOLVED events with the same resolution", () => {
    let state = createEmptyCommunityGovernanceState();
    state = reduceCommunityGovernance(state, {
      type: "PROPOSED",
      proposalId: "p1",
      actionType: "update_descriptor",
      proposerPublicKeyHex: PROPOSER,
      createdAtUnixMs: 1000,
      quorumThreshold: 1,
      payload: { name: "Once" },
      logicalEventId: "e1",
    });
    state = reduceCommunityGovernance(state, {
      type: "RESOLVED",
      proposalId: "p1",
      resolution: "rejected",
      resolverPublicKeyHex: PROPOSER,
      createdAtUnixMs: 2000,
      logicalEventId: "e2",
    });
    const afterDuplicate = reduceCommunityGovernance(state, {
      type: "RESOLVED",
      proposalId: "p1",
      resolution: "rejected",
      resolverPublicKeyHex: VOTER_B,
      createdAtUnixMs: 3000,
      logicalEventId: "e3",
    });
    expect(afterDuplicate.proposalsById.p1?.resolution).toBe("rejected");
    expect(afterDuplicate.proposalsById.p1?.resolvedAtUnixMs).toBe(2000);
    expect(afterDuplicate.lastGovernanceEventId).toBe("e3");
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
