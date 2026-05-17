import { describe, expect, it } from "vitest";
import type { DiscoveryProfileRecord } from "./discovery-cache";
import { buildFriendSuggestions, friendSuggestionInternals } from "./friend-suggestions";

describe("friend-suggestions", () => {
  it("filters out self, accepted, blocked, and excluded peers", () => {
    const baseTime = Date.parse("2026-03-15T00:00:00.000Z");
    const profiles: ReadonlyArray<DiscoveryProfileRecord> = [
      { pubkey: "a".repeat(64), displayName: "Self", updatedAtUnixMs: baseTime },
      { pubkey: "b".repeat(64), displayName: "Accepted", updatedAtUnixMs: baseTime },
      { pubkey: "c".repeat(64), displayName: "Blocked", updatedAtUnixMs: baseTime },
      { pubkey: "d".repeat(64), displayName: "Excluded", updatedAtUnixMs: baseTime },
      { pubkey: "e".repeat(64), displayName: "Candidate", updatedAtUnixMs: baseTime },
    ];

    const suggestions = buildFriendSuggestions({
      profiles,
      myPublicKeyHex: "a".repeat(64),
      acceptedPeers: ["b".repeat(64)],
      blockedPeers: ["c".repeat(64)],
      excludedPeers: ["d".repeat(64)],
      nowUnixMs: baseTime,
      limit: 10,
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.pubkey).toBe("e".repeat(64));
  });

  it("prefers richer and fresher records", () => {
    const baseTime = Date.parse("2026-03-15T00:00:00.000Z");
    const suggestions = buildFriendSuggestions({
      profiles: [
        {
          pubkey: "a".repeat(64),
          displayName: "Recent and rich",
          nip05: "alice@example.com",
          inviteCode: "OBSCUR-ALICE1",
          updatedAtUnixMs: baseTime,
        },
        {
          pubkey: "b".repeat(64),
          displayName: "Old profile",
          updatedAtUnixMs: baseTime - 1000 * 60 * 60 * 96,
        },
      ],
      nowUnixMs: baseTime,
      limit: 2,
    });

    expect(suggestions[0]?.pubkey).toBe("a".repeat(64));
    expect(suggestions[1]?.pubkey).toBe("b".repeat(64));
  });

  it("applies result limit", () => {
    const baseTime = Date.parse("2026-03-15T00:00:00.000Z");
    const suggestions = buildFriendSuggestions({
      profiles: [
        { pubkey: "a".repeat(64), displayName: "A", updatedAtUnixMs: baseTime },
        { pubkey: "b".repeat(64), displayName: "B", updatedAtUnixMs: baseTime },
        { pubkey: "c".repeat(64), displayName: "C", updatedAtUnixMs: baseTime },
      ],
      nowUnixMs: baseTime,
      limit: 2,
    });

    expect(suggestions).toHaveLength(2);
  });

  it("normalizes peer lists into deduped normalized sets", () => {
    const values = friendSuggestionInternals.toNormalizedSet([
      "A".repeat(64),
      "a".repeat(64),
      "not-a-pubkey",
    ]);

    expect(values.has("a".repeat(64))).toBe(true);
    expect(values.size).toBe(1);
  });
});
