import { describe, expect, it } from "vitest";
import {
  assessLegacySovereignRoomCommunity,
  isNewSovereignRoomCreationAllowed,
} from "./community-legacy-sovereign-policy";

describe("community-legacy-sovereign-policy", () => {
  it("flags sovereign room on public relay as legacy read-only", () => {
    const assessment = assessLegacySovereignRoomCommunity({
      communityMode: "sovereign_room",
      relayUrl: "wss://nos.lol",
    });
    expect(assessment.isLegacyReadOnly).toBe(true);
    expect(assessment.title).toContain("Legacy");
  });

  it("does not flag managed workspace on private relay", () => {
    const assessment = assessLegacySovereignRoomCommunity({
      communityMode: "managed_workspace",
      relayUrl: "wss://relay.team.internal",
    });
    expect(assessment.isLegacyReadOnly).toBe(false);
  });

  it("disallows new sovereign room creation", () => {
    expect(isNewSovereignRoomCreationAllowed()).toBe(false);
  });
});
