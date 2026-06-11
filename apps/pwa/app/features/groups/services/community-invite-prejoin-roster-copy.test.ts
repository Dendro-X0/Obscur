import { describe, expect, it } from "vitest";
import { resolveCommunityInvitePreJoinRosterCopy } from "./community-invite-prejoin-roster-copy";

describe("resolveCommunityInvitePreJoinRosterCopy", () => {
  it("hides zero member counts for invite-only communities", () => {
    const copy = resolveCommunityInvitePreJoinRosterCopy({
      access: "invite-only",
      memberCount: 0,
    });
    expect(copy.showMemberCountBadge).toBe(false);
    expect(copy.rosterSummary).toBe("Roster private until you join");
    expect(copy.privacyHint).toContain("stay private");
  });

  it("hides member counts for invite-only communities even when a sender supplied a count", () => {
    const copy = resolveCommunityInvitePreJoinRosterCopy({
      access: "invite-only",
      memberCount: 4,
    });
    expect(copy.showMemberCountBadge).toBe(false);
    expect(copy.rosterSummary).toBe("Roster private until you join");
  });

  it("shows member count only for open communities with positive evidence", () => {
    const copy = resolveCommunityInvitePreJoinRosterCopy({
      access: "open",
      memberCount: 3,
    });
    expect(copy.showMemberCountBadge).toBe(true);
    expect(copy.memberCount).toBe(3);
    expect(copy.rosterSummary).toBe("3 members");
  });
});
