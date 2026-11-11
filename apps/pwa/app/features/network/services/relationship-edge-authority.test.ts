import { describe, expect, it } from "vitest";
import {
  isEmptyStickyPeerTrust,
  mapRelationshipEdgesToStickyTrust,
  planRelationshipEdgesFromStickyTrust,
  RELATIONSHIP_EDGE_STATES,
} from "./relationship-edge-authority";

describe("relationship-edge-authority (Cut 1.1)", () => {
  it("plans trusted / removed / muted-only rows without inventing peers", () => {
    const plan = planRelationshipEdgesFromStickyTrust({
      acceptedPeers: ["aa", "bb"],
      mutedPeers: ["bb", "cc"],
      removedPeers: ["dd"],
    });
    const byPeer = Object.fromEntries(plan.map((row) => [row.peerPubkey, row]));
    expect(byPeer.aa).toEqual({
      peerPubkey: "aa",
      state: RELATIONSHIP_EDGE_STATES.trusted,
      trustTier: null,
    });
    expect(byPeer.bb).toEqual({
      peerPubkey: "bb",
      state: RELATIONSHIP_EDGE_STATES.trusted,
      trustTier: "muted",
    });
    expect(byPeer.cc).toEqual({
      peerPubkey: "cc",
      state: RELATIONSHIP_EDGE_STATES.muted,
      trustTier: null,
    });
    expect(byPeer.dd).toEqual({
      peerPubkey: "dd",
      state: RELATIONSHIP_EDGE_STATES.removed,
      trustTier: null,
    });
  });

  it("maps kernel edges back to sticky snapshot (trusted+trust_tier muted)", () => {
    const aa = "a".repeat(64);
    const bb = "b".repeat(64);
    const cc = "c".repeat(64);
    const dd = "d".repeat(64);
    const self = "e".repeat(64);
    const stored = mapRelationshipEdgesToStickyTrust(
      [
        {
          profile_id: "p1",
          peer_pubkey: aa,
          state: "trusted",
          trust_tier: null,
          updated_at: 1,
        },
        {
          profile_id: "p1",
          peer_pubkey: bb,
          state: "trusted",
          trust_tier: "muted",
          updated_at: 2,
        },
        {
          profile_id: "p1",
          peer_pubkey: cc,
          state: "muted",
          trust_tier: null,
          updated_at: 3,
        },
        {
          profile_id: "p1",
          peer_pubkey: dd,
          state: "removed",
          trust_tier: null,
          updated_at: 4,
        },
        {
          profile_id: "p1",
          peer_pubkey: self,
          state: "trusted",
          trust_tier: null,
          updated_at: 5,
        },
      ],
      self as never,
    );
    expect(stored.acceptedPeers).toEqual([aa, bb]);
    expect(stored.mutedPeers).toEqual([bb, cc]);
    expect(stored.removedPeers).toEqual([dd]);
  });

  it("treats empty sticky snapshot as empty", () => {
    expect(isEmptyStickyPeerTrust({
      acceptedPeers: [],
      mutedPeers: [],
      removedPeers: [],
    })).toBe(true);
    expect(isEmptyStickyPeerTrust({
      acceptedPeers: ["aa"],
      mutedPeers: [],
      removedPeers: [],
    })).toBe(false);
  });
});
