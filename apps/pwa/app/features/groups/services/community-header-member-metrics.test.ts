import { describe, expect, it } from "vitest";
import { resolveCommunityHeaderMemberMetrics } from "./community-header-member-metrics";

const online = new Set(["aa", "cc"]);

describe("resolveCommunityHeaderMemberMetrics (U5 Wave B)", () => {
  it("prefers directory active count when a snapshot is present", () => {
    const metrics = resolveCommunityHeaderMemberMetrics({
      directoryActivePubkeys: ["aa", "bb", "cc"],
      directoryFetchedAtUnixMs: 1_700_000_000_000,
      knownHerePubkeys: ["aa", "zz"],
      isPeerOnline: (pk) => online.has(pk),
    });
    expect(metrics.memberCount).toBe(3);
    expect(metrics.memberCountSource).toBe("directory");
    expect(metrics.directoryFetchedAtUnixMs).toBe(1_700_000_000_000);
    expect(metrics.onlineAmongVisible).toBe(2);
    expect(metrics.visibleForPresenceCount).toBe(3);
  });

  it("allows empty directory after leave without falling back to known-here inflate", () => {
    const metrics = resolveCommunityHeaderMemberMetrics({
      directoryActivePubkeys: [],
      directoryFetchedAtUnixMs: 1_700_000_000_000,
      knownHerePubkeys: ["aa", "bb", "cc"],
      isPeerOnline: () => true,
    });
    expect(metrics.memberCount).toBe(0);
    expect(metrics.memberCountSource).toBe("directory");
    expect(metrics.onlineAmongVisible).toBe(3);
    expect(metrics.visibleForPresenceCount).toBe(3);
  });

  it("uses known-here when no directory snapshot", () => {
    const metrics = resolveCommunityHeaderMemberMetrics({
      directoryActivePubkeys: null,
      knownHerePubkeys: ["aa", "bb"],
      isPeerOnline: (pk) => pk === "aa",
    });
    expect(metrics.memberCount).toBe(2);
    expect(metrics.memberCountSource).toBe("known_here");
    expect(metrics.directoryFetchedAtUnixMs).toBeNull();
    expect(metrics.onlineAmongVisible).toBe(1);
  });

  it("floors known-here count at 1 when the set is empty", () => {
    const metrics = resolveCommunityHeaderMemberMetrics({
      knownHerePubkeys: [],
      isPeerOnline: () => false,
    });
    expect(metrics.memberCount).toBe(1);
    expect(metrics.memberCountSource).toBe("known_here");
    expect(metrics.onlineAmongVisible).toBe(0);
  });
});
