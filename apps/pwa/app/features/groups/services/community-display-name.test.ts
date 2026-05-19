import { describe, expect, it } from "vitest";
import {
  hasMeaningfulCommunityDisplayName,
  pickPreferredCommunityDisplayName,
  resolveCommunityDisplayName,
} from "./community-display-name";

const GROUP_ID = "d56bc22fd0164c54840c5ce3cbc7df1a";

describe("community-display-name", () => {
  it("treats hex group id as non-meaningful display name", () => {
    expect(hasMeaningfulCommunityDisplayName(GROUP_ID, { groupId: GROUP_ID })).toBe(false);
    expect(hasMeaningfulCommunityDisplayName(GROUP_ID)).toBe(false);
  });

  it("prefers persisted human name over relay metadata hex id", () => {
    expect(
      resolveCommunityDisplayName({
        metadataName: GROUP_ID,
        persistedDisplayName: "NewTest 1",
        groupId: GROUP_ID,
      }),
    ).toBe("NewTest 1");
  });

  it("falls back to metadata when it is human-readable", () => {
    expect(
      resolveCommunityDisplayName({
        metadataName: "Relay Community",
        persistedDisplayName: GROUP_ID,
        groupId: GROUP_ID,
      }),
    ).toBe("Relay Community");
  });

  it("pickPreferredCommunityDisplayName rejects opaque identifiers in either slot", () => {
    expect(
      pickPreferredCommunityDisplayName(GROUP_ID, "NewTest 1", { groupId: GROUP_ID }),
    ).toBe("NewTest 1");
    expect(
      pickPreferredCommunityDisplayName("NewTest 1", GROUP_ID, { groupId: GROUP_ID }),
    ).toBe("NewTest 1");
  });
});
