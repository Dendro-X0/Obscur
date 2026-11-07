import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { resolveInviteConnectionCandidates } from "./resolve-invite-connection-candidates";

const PEER = "b".repeat(64) as PublicKeyHex;
const PEER2 = "c".repeat(64) as PublicKeyHex;

const resolveDisplayName = (params: Readonly<{
  pubkey: string;
  connectionDisplayName?: string;
  metadataDisplayName?: string;
}>): string => (
  params.connectionDisplayName?.trim()
  || params.metadataDisplayName?.trim()
  || params.pubkey.slice(0, 8)
);

const toSearchText = (params: Readonly<{
  pubkey: string;
  resolvedDisplayName: string;
  connectionDisplayName?: string;
  metadataDisplayName?: string;
}>): string => (
  [
    params.pubkey,
    params.resolvedDisplayName,
    params.connectionDisplayName,
    params.metadataDisplayName,
  ].filter(Boolean).join(" ").toLowerCase()
);

describe("resolveInviteConnectionCandidates (Slice 3)", () => {
  it("lists accepted peers even when no DM connection row exists", () => {
    const candidates = resolveInviteConnectionCandidates({
      acceptedPeers: [PEER],
      connectionsByPubkey: new Map(),
      resolveDisplayName,
      toSearchText,
    });

    expect(candidates).toEqual([{
      pubkey: PEER,
      connectionDisplayName: undefined,
      cachedMetadataDisplayName: undefined,
    }]);
  });

  it("returns empty when acceptedPeers is empty (social-core Fail shape)", () => {
    expect(resolveInviteConnectionCandidates({
      acceptedPeers: [],
      connectionsByPubkey: new Map([[PEER.toLowerCase(), {
        pubkey: PEER,
        connectionDisplayName: "Ghost DM",
      }]]),
      resolveDisplayName,
      toSearchText,
    })).toEqual([]);
  });

  it("attaches DM display name when present and filters by search", () => {
    const candidates = resolveInviteConnectionCandidates({
      acceptedPeers: [PEER, PEER2],
      connectionsByPubkey: new Map([
        [PEER.toLowerCase(), { pubkey: PEER, connectionDisplayName: "Tester2" }],
      ]),
      searchQuery: "tester",
      resolveDisplayName,
      toSearchText,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.pubkey).toBe(PEER);
    expect(candidates[0]?.connectionDisplayName).toBe("Tester2");
  });
});
