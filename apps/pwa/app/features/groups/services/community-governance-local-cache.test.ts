import { describe, expect, it } from "vitest";
import type { CommunityGovernanceReducerState } from "./community-governance-reducer";
import {
  parseStoredCommunityGovernanceState,
  serializeCommunityGovernanceState,
} from "./community-governance-local-cache";

const PK = "b".repeat(64);

describe("community-governance-local-cache", () => {
  it("round-trips governance state", () => {
    const state: CommunityGovernanceReducerState = {
      proposalsById: {
        p1: {
          proposalId: "p1",
          actionType: "update_descriptor",
          proposerPublicKeyHex: PK,
          createdAtUnixMs: 1000,
          quorumThreshold: 2,
          payload: { name: "X" },
          votes: { [PK]: "approve" },
        },
      },
      activeProposalIds: ["p1"],
      resolvedProposalIds: [],
      lastGovernanceEventId: "e1",
      lastGovernanceAtUnixMs: 1000,
    };
    const json = serializeCommunityGovernanceState(state);
    const back = parseStoredCommunityGovernanceState(json);
    expect(back).toEqual(state);
  });

  it("returns null for invalid JSON", () => {
    expect(parseStoredCommunityGovernanceState(null)).toBeNull();
    expect(parseStoredCommunityGovernanceState("{}")).toBeNull();
    expect(parseStoredCommunityGovernanceState("not json")).toBeNull();
  });
});
