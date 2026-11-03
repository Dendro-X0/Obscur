import { describe, expect, it } from "vitest";
import { OBSCUR_NOSTR_DISPLAY_NAME } from "./display-name";
import {
  getObscurNostrMigrationHints,
  getObscurNostrSwitchSummary,
} from "./migration-hints";

describe("obscur-nostr display + migration hints (P7c)", () => {
  it("names the module Obscur-Nostr", () => {
    expect(OBSCUR_NOSTR_DISPLAY_NAME).toBe("Obscur-Nostr");
  });

  it("returns a single native-path hint without dual-write language as a bridge", () => {
    const hints = getObscurNostrMigrationHints();
    expect(hints).toHaveLength(1);
    expect(hints[0]?.id).toBe("nostr-native-path");
    expect(hints[0]?.body.toLowerCase()).not.toContain("dual-write bridge");
  });

  it("summarizes switch to Obscur-Nostr", () => {
    expect(getObscurNostrSwitchSummary()).toContain("Obscur-Nostr");
  });
});
