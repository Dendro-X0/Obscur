import { describe, expect, it } from "vitest";

import { buildInvitationRequestMessage, DEFAULT_INVITATION_INTRO } from "./invitation-composer";

describe("invitation composer", () => {
  it("builds one canonical invitation payload from the shared composer fields", () => {
    expect(buildInvitationRequestMessage({
      intro: "Hello there",
      note: "Designer from the Oslo meetup",
      secretCode: "OBSCUR-123",
    })).toBe("Hello there\n\nNote: Designer from the Oslo meetup\n\nCode: OBSCUR-123");
  });

  it("falls back to the default intro when the intro is blank", () => {
    expect(buildInvitationRequestMessage({
      intro: "   ",
      note: "",
      secretCode: "",
    })).toBe(DEFAULT_INVITATION_INTRO);
  });
});
