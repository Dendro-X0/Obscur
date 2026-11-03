import { describe, expect, it } from "vitest";
import {
  formatNostrCanonicalSendRequiresCredentialsError,
  OBSCUR_NOSTR_CAPABILITIES,
} from "./capabilities";

describe("obscur-nostr capabilities (P7b)", () => {
  it("advertises full DM/group/reaction/media surface", () => {
    expect(OBSCUR_NOSTR_CAPABILITIES).toEqual({
      dms: true,
      groups: true,
      reactions: true,
      media: true,
    });
  });

  it("formats canonical send refuse with truncated conversation id", () => {
    const id = "abcdefghijklmnopqrstuvwxyz";
    expect(formatNostrCanonicalSendRequiresCredentialsError(id)).toContain(
      "conversation=abcdefghijklmnop",
    );
  });
});
