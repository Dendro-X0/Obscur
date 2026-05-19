import { describe, expect, it } from "vitest";
import { toGovernanceReducerEventFromSealed } from "./community-governance-sealed";

const ACTOR = "a".repeat(64);

describe("toGovernanceReducerEventFromSealed", () => {
  it("parses governance.proposed with nested payload", () => {
    const ev = toGovernanceReducerEventFromSealed(
      {
        type: "governance.proposed",
        pubkey: ACTOR,
        created_at: 1700,
        proposalId: "p1",
        actionType: "update_descriptor",
        quorumThreshold: 2,
        proposalExpiresAtUnixMs: 9999999999999,
        payload: { name: "New Name", access: "invite-only" },
      },
      "evt-1",
      ACTOR,
    );
    expect(ev).toEqual({
      type: "PROPOSED",
      proposalId: "p1",
      actionType: "update_descriptor",
      proposerPublicKeyHex: ACTOR,
      createdAtUnixMs: 1_700_000,
      quorumThreshold: 2,
      proposalExpiresAtUnixMs: 9999999999999,
      payload: { name: "New Name", access: "invite-only" },
      logicalEventId: "evt-1",
    });
  });

  it("parses governance.vote", () => {
    const ev = toGovernanceReducerEventFromSealed(
      {
        type: "governance.vote",
        pubkey: ACTOR,
        created_at: 1800,
        proposalId: "p1",
        vote: "reject",
      },
      "evt-2",
      ACTOR,
    );
    expect(ev).toEqual({
      type: "VOTE_CAST",
      proposalId: "p1",
      voterPublicKeyHex: ACTOR,
      vote: "reject",
      createdAtUnixMs: 1_800_000,
      logicalEventId: "evt-2",
    });
  });

  it("parses governance.resolved", () => {
    const ev = toGovernanceReducerEventFromSealed(
      {
        type: "governance.resolved",
        pubkey: ACTOR,
        created_at: 1900,
        proposalId: "p1",
        resolution: "accepted",
      },
      "evt-3",
      ACTOR,
    );
    expect(ev).toEqual({
      type: "RESOLVED",
      proposalId: "p1",
      resolution: "accepted",
      resolverPublicKeyHex: ACTOR,
      createdAtUnixMs: 1_900_000,
      logicalEventId: "evt-3",
    });
  });

  it("parses governance.resolved for expired", () => {
    const ev = toGovernanceReducerEventFromSealed(
      {
        type: "governance.resolved",
        pubkey: ACTOR,
        created_at: 2000,
        proposalId: "p1",
        resolution: "expired",
      },
      "evt-exp",
      ACTOR,
    );
    expect(ev).toEqual({
      type: "RESOLVED",
      proposalId: "p1",
      resolution: "expired",
      resolverPublicKeyHex: ACTOR,
      createdAtUnixMs: 2_000_000,
      logicalEventId: "evt-exp",
    });
  });

  it("returns null for invalid payloads", () => {
    expect(toGovernanceReducerEventFromSealed({ type: "governance.proposed" }, "e", ACTOR)).toBeNull();
    expect(toGovernanceReducerEventFromSealed({ type: "governance.vote", proposalId: "p" }, "e", ACTOR)).toBeNull();
    expect(toGovernanceReducerEventFromSealed({ type: "other" }, "e", ACTOR)).toBeNull();
  });
});
