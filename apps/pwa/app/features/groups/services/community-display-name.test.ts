import { describe, expect, it } from "vitest";
import {
  hasMeaningfulCommunityDisplayName,
  pickPreferredCommunityDisplayName,
  PLACEHOLDER_GROUP_DISPLAY_NAME,
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

  it("treats community:v2 conversation ids as opaque display names", () => {
    const communityId = "community:v2_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(hasMeaningfulCommunityDisplayName(communityId, { communityId })).toBe(false);
    expect(
      resolveCommunityDisplayName({
        persistedDisplayName: communityId,
        groupId: GROUP_ID,
        communityId,
        fallback: "GroupTset 4",
      }),
    ).toBe("GroupTset 4");
  });

  it("never surfaces community id as fallback when name is missing", () => {
    const communityId = "community:v2_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    expect(
      resolveCommunityDisplayName({
        persistedDisplayName: undefined,
        metadataName: GROUP_ID,
        groupId: GROUP_ID,
        communityId,
        fallback: communityId,
      }),
    ).toBe(PLACEHOLDER_GROUP_DISPLAY_NAME);
  });
});
