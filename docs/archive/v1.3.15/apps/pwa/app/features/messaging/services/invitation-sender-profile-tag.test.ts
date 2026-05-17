import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import {
  buildInvitationSenderProfileTag,
  invitationSenderProfileTagInternals,
  readInvitationSenderProfileFromTags,
} from "./invitation-sender-profile-tag";

describe("invitation-sender-profile-tag", () => {
  beforeEach(() => {
    setProfileScopeOverride("profile-a");
    window.localStorage.clear();
  });

  afterEach(() => {
    setProfileScopeOverride(null);
    window.localStorage.clear();
  });

  it("builds a sender profile tag from scoped local profile storage", () => {
    window.localStorage.setItem(invitationSenderProfileTagInternals.getLocalProfileStorageKey(), JSON.stringify({
      version: 1,
      profile: {
        username: "Alice",
        avatarUrl: "https://cdn.example.com/a.png",
        about: "Private-first user",
        nip05: "alice@example.com",
      },
    }));

    const tag = buildInvitationSenderProfileTag();
    expect(tag?.[0]).toBe(invitationSenderProfileTagInternals.SENDER_PROFILE_TAG);
    expect(readInvitationSenderProfileFromTags(tag ? [tag] : [])).toEqual({
      displayName: "Alice",
      avatarUrl: "https://cdn.example.com/a.png",
      about: "Private-first user",
      nip05: "alice@example.com",
    });
  });

  it("rejects malformed sender profile tags", () => {
    expect(readInvitationSenderProfileFromTags([[invitationSenderProfileTagInternals.SENDER_PROFILE_TAG, "{bad-json"]])).toBeNull();
    expect(readInvitationSenderProfileFromTags([["x", "{}"]])).toBeNull();
  });
});
