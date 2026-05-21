import { describe, expect, it, beforeEach, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  hasGovernanceQuorum,
  hasGovernanceRejectionQuorum,
  hasGovernanceVoteTie,
  listExpiredOpenGovernanceProposalIds,
} from "./community-governance-reducer";
import {
  getActiveCommunityGovernanceProposals,
  getCommunityGovernanceProjection,
  getCommunityGovernanceReducerState,
  hydrateCommunityGovernanceState,
  ingestCommunityGovernanceEvent,
  replayCommunityGovernanceEvents,
  resetCommunityGovernanceProjectionForTests,
  resolveCommunityGovernanceScopeId,
  subscribeCommunityGovernance,
} from "./community-governance-projection";
import { createEmptyCommunityGovernanceState } from "./community-governance-reducer";

const ACTOR = "a".repeat(64) as PublicKeyHex;
const VOTER_B = "b".repeat(64) as PublicKeyHex;
const SCOPE = "community-alpha";

describe("community-governance-projection", () => {
  beforeEach(() => {
    resetCommunityGovernanceProjectionForTests();
  });

  it("resolves scope id from communityId when present", () => {
    expect(resolveCommunityGovernanceScopeId({
      communityId: "comm-1",
      groupId: "group-1",
    })).toBe("comm-1");
    expect(resolveCommunityGovernanceScopeId({
      groupId: "group-1",
    })).toBe("group-1");
  });

  it("ingests events and exposes projection read model", () => {
    ingestCommunityGovernanceEvent(SCOPE, {
      type: "PROPOSED",
      proposalId: "p1",
      actionType: "update_descriptor",
      proposerPublicKeyHex: ACTOR,
      createdAtUnixMs: 1000,
      quorumThreshold: 2,
      payload: { name: "New name" },
      logicalEventId: "e1",
    });

    const reducer = getCommunityGovernanceReducerState(SCOPE);
    expect(reducer.proposalsById.p1).toBeDefined();
    expect(getActiveCommunityGovernanceProposals(SCOPE, 2000)).toHaveLength(1);

    const projection = getCommunityGovernanceProjection(SCOPE);
    expect(projection.communityId).toBe(SCOPE);
    expect(projection.activeVotes).toContain("p1");
  });

  it("hydrates session state without ingest", () => {
    const seeded = {
      ...createEmptyCommunityGovernanceState(),
      proposalsById: {
        p2: {
          proposalId: "p2",
          actionType: "expel_member" as const,
          proposerPublicKeyHex: ACTOR,
          createdAtUnixMs: 500,
          quorumThreshold: 2,
          payload: { targetPublicKeyHex: VOTER_B },
          votes: {},
        },
      },
      activeProposalIds: ["p2"],
      resolvedProposalIds: [],
    };
    hydrateCommunityGovernanceState(SCOPE, seeded);
    expect(getActiveCommunityGovernanceProposals(SCOPE, 10_000)).toHaveLength(1);
  });

  it("notifies subscribers when ingest updates the store", () => {
    const listener = vi.fn();
    subscribeCommunityGovernance(SCOPE, listener);
    ingestCommunityGovernanceEvent(SCOPE, {
      type: "PROPOSED",
      proposalId: "sub-p1",
      actionType: "update_descriptor",
      proposerPublicKeyHex: ACTOR,
      createdAtUnixMs: 1,
      quorumThreshold: 1,
      payload: { name: "X" },
      logicalEventId: "sub-e1",
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("community-governance-projection replay (G2.2)", () => {
  beforeEach(() => {
    resetCommunityGovernanceProjectionForTests();
  });

  it("converges tie votes to rejected resolution via replay", () => {
    const proposalId = "p-tie";
    const events = [
      {
        type: "PROPOSED" as const,
        proposalId,
        actionType: "update_descriptor" as const,
        proposerPublicKeyHex: ACTOR,
        createdAtUnixMs: 1000,
        quorumThreshold: 2,
        payload: { name: "Tie" },
        logicalEventId: "e1",
      },
      {
        type: "VOTE_CAST" as const,
        proposalId,
        voterPublicKeyHex: ACTOR,
        vote: "approve" as const,
        createdAtUnixMs: 1001,
        logicalEventId: "e2",
      },
      {
        type: "VOTE_CAST" as const,
        proposalId,
        voterPublicKeyHex: VOTER_B,
        vote: "reject" as const,
        createdAtUnixMs: 1002,
        logicalEventId: "e3",
      },
      {
        type: "VOTE_CAST" as const,
        proposalId,
        voterPublicKeyHex: "c".repeat(64) as PublicKeyHex,
        vote: "approve" as const,
        createdAtUnixMs: 1003,
        logicalEventId: "e4",
      },
      {
        type: "VOTE_CAST" as const,
        proposalId,
        voterPublicKeyHex: "d".repeat(64) as PublicKeyHex,
        vote: "reject" as const,
        createdAtUnixMs: 1004,
        logicalEventId: "e5",
      },
      {
        type: "RESOLVED" as const,
        proposalId,
        resolution: "rejected" as const,
        resolverPublicKeyHex: ACTOR,
        createdAtUnixMs: 2000,
        logicalEventId: "e6",
      },
    ];

    const voteEvents = events.slice(0, 5);
    replayCommunityGovernanceEvents(SCOPE, voteEvents);
    expect(hasGovernanceVoteTie(getCommunityGovernanceReducerState(SCOPE).proposalsById[proposalId]!)).toBe(true);

    ingestCommunityGovernanceEvent(SCOPE, events[5]!);
    const proposal = getCommunityGovernanceReducerState(SCOPE).proposalsById[proposalId]!;
    expect(proposal.resolution).toBe("rejected");
    expect(getActiveCommunityGovernanceProposals(SCOPE, 3000)).toHaveLength(0);
    expect(getCommunityGovernanceProjection(SCOPE).resolvedVotes).toContain(proposalId);
  });

  it("is idempotent for duplicate RESOLVED with the same resolution", () => {
    replayCommunityGovernanceEvents(SCOPE, [
      {
        type: "PROPOSED",
        proposalId: "p1",
        actionType: "update_descriptor",
        proposerPublicKeyHex: ACTOR,
        createdAtUnixMs: 1000,
        quorumThreshold: 1,
        payload: { name: "Once" },
        logicalEventId: "e1",
      },
      {
        type: "RESOLVED",
        proposalId: "p1",
        resolution: "rejected",
        resolverPublicKeyHex: ACTOR,
        createdAtUnixMs: 2000,
        logicalEventId: "e2",
      },
      {
        type: "RESOLVED",
        proposalId: "p1",
        resolution: "rejected",
        resolverPublicKeyHex: VOTER_B,
        createdAtUnixMs: 3000,
        logicalEventId: "e3",
      },
    ]);

    const proposal = getCommunityGovernanceReducerState(SCOPE).proposalsById.p1!;
    expect(proposal.resolution).toBe("rejected");
    expect(proposal.resolvedAtUnixMs).toBe(2000);
    expect(getCommunityGovernanceReducerState(SCOPE).lastGovernanceEventId).toBe("e3");
  });

  it("excludes TTL-expired proposals from active read model", () => {
    const now = 50_000;
    const past = now - 1000;
    replayCommunityGovernanceEvents(SCOPE, [
      {
        type: "PROPOSED",
        proposalId: "exp1",
        actionType: "update_descriptor",
        proposerPublicKeyHex: ACTOR,
        createdAtUnixMs: past - 10_000,
        quorumThreshold: 2,
        proposalExpiresAtUnixMs: past,
        payload: { name: "Late" },
        logicalEventId: "e0",
      },
    ]);

    expect(listExpiredOpenGovernanceProposalIds(getCommunityGovernanceReducerState(SCOPE), now)).toContain("exp1");
    expect(getActiveCommunityGovernanceProposals(SCOPE, now)).toHaveLength(0);
  });

  it("converges to the same state when replay order differs across devices", () => {
    const proposalId = "p-reorder";
    const proposed = {
      type: "PROPOSED" as const,
      proposalId,
      actionType: "update_descriptor" as const,
      proposerPublicKeyHex: ACTOR,
      createdAtUnixMs: 1000,
      quorumThreshold: 2,
      payload: { name: "Reorder" },
      logicalEventId: "e-proposed",
    };
    const voteA = {
      type: "VOTE_CAST" as const,
      proposalId,
      voterPublicKeyHex: ACTOR,
      vote: "approve" as const,
      createdAtUnixMs: 1001,
      logicalEventId: "e-vote-a",
    };
    const voteB = {
      type: "VOTE_CAST" as const,
      proposalId,
      voterPublicKeyHex: VOTER_B,
      vote: "approve" as const,
      createdAtUnixMs: 1002,
      logicalEventId: "e-vote-b",
    };
    const resolved = {
      type: "RESOLVED" as const,
      proposalId,
      resolution: "accepted" as const,
      resolverPublicKeyHex: ACTOR,
      createdAtUnixMs: 2000,
      logicalEventId: "e-resolved",
    };

    const scopeA = "device-a";
    const scopeB = "device-b";
    replayCommunityGovernanceEvents(scopeA, [proposed, voteA, voteB, resolved]);
    replayCommunityGovernanceEvents(scopeB, [proposed, voteB, voteA, resolved]);

    const stateA = getCommunityGovernanceReducerState(scopeA);
    const stateB = getCommunityGovernanceReducerState(scopeB);
    expect(stateA.proposalsById[proposalId]?.resolution).toBe("accepted");
    expect(stateB.proposalsById[proposalId]?.resolution).toBe("accepted");
    expect(hasGovernanceQuorum(stateA.proposalsById[proposalId]!)).toBe(true);
    expect(getActiveCommunityGovernanceProposals(scopeA, 3000)).toHaveLength(0);
    expect(getActiveCommunityGovernanceProposals(scopeB, 3000)).toHaveLength(0);
    expect(stateA.resolvedProposalIds).toEqual(stateB.resolvedProposalIds);
  });

  it("surfaces rejection quorum before resolution in active proposals", () => {
    replayCommunityGovernanceEvents(SCOPE, [
      {
        type: "PROPOSED",
        proposalId: "p-reject",
        actionType: "update_descriptor",
        proposerPublicKeyHex: ACTOR,
        createdAtUnixMs: 1000,
        quorumThreshold: 2,
        payload: { name: "No" },
        logicalEventId: "e1",
      },
      {
        type: "VOTE_CAST",
        proposalId: "p-reject",
        voterPublicKeyHex: ACTOR,
        vote: "reject",
        createdAtUnixMs: 1001,
        logicalEventId: "e2",
      },
      {
        type: "VOTE_CAST",
        proposalId: "p-reject",
        voterPublicKeyHex: VOTER_B,
        vote: "reject",
        createdAtUnixMs: 1002,
        logicalEventId: "e3",
      },
    ]);

    const proposal = getCommunityGovernanceReducerState(SCOPE).proposalsById["p-reject"]!;
    expect(hasGovernanceRejectionQuorum(proposal)).toBe(true);
    expect(getActiveCommunityGovernanceProposals(SCOPE, 1500)).toHaveLength(1);
  });
});
