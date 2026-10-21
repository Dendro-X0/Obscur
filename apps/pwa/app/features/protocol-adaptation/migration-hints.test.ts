import { describe, expect, it } from "vitest";
import { getProtocolMigrationHints, getProtocolSwitchSummary } from "./migration-hints";

describe("protocol migration hints (C3)", () => {
  it("returns Matrix gap hints without dual-write language as a bridge", () => {
    const hints = getProtocolMigrationHints("matrix");
    expect(hints.length).toBeGreaterThanOrEqual(2);
    expect(hints.some((h) => h.id === "matrix-no-history-bridge")).toBe(true);
    expect(hints.some((h) => h.id === "matrix-cleartext-mvp")).toBe(true);
    const joined = hints.map((h) => `${h.title} ${h.body}`).join(" ");
    expect(joined.toLowerCase()).toContain("no dual-write");
  });

  it("returns Nostr native hint", () => {
    const hints = getProtocolMigrationHints("nostr");
    expect(hints[0]?.id).toBe("nostr-native-path");
  });

  it("summarizes protocol switches", () => {
    expect(getProtocolSwitchSummary("matrix")).toMatch(/Matrix/i);
    expect(getProtocolSwitchSummary("nostr")).toMatch(/Nostr/i);
  });
});
