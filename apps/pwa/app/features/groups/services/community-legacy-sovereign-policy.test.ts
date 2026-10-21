import { describe, expect, it } from "vitest";
import {
  assessLegacySovereignRoomCommunity,
  isNewSovereignRoomCreationAllowed,
} from "./community-legacy-sovereign-policy";

describe("community-legacy-sovereign-policy", () => {
  it("shows honesty for sovereign room on public relay without read-only lock", () => {
    const assessment = assessLegacySovereignRoomCommunity({
      communityMode: "sovereign_room",
      relayUrl: "wss://nos.lol",
    });
    expect(assessment.isLegacyReadOnly).toBe(false);
    expect(assessment.title).toMatch(/Quick group/i);
  });

  it("does not flag managed workspace on private relay", () => {
    const assessment = assessLegacySovereignRoomCommunity({
      communityMode: "managed_workspace",
      relayUrl: "wss://relay.team.internal",
    });
    expect(assessment.isLegacyReadOnly).toBe(false);
  });

  it("allows new sovereign (quick group) create", () => {
    expect(isNewSovereignRoomCreationAllowed()).toBe(true);
  });
});
