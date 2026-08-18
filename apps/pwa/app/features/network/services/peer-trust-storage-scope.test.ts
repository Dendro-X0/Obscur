import { beforeEach, describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { setProfileRuntimeScope } from "@/app/features/profiles/services/profile-runtime-scope";
import { peerTrustInternals } from "../hooks/use-peer-trust";
import {
  getLegacyPeerTrustStorageKey,
  getPeerTrustStorageKey,
} from "./peer-trust-storage-key";

const PUBKEY = "f".repeat(64) as PublicKeyHex;
const PEER = "e".repeat(64) as PublicKeyHex;

const stored = {
  acceptedPeers: [PEER],
  mutedPeers: [] as PublicKeyHex[],
  removedPeers: [] as PublicKeyHex[],
};

describe("peer-trust storage profile isolation (Containment D)", () => {
  beforeEach(() => {
    localStorage.clear();
    setProfileRuntimeScope(null);
  });

  it("writes and reads only the scoped profile key", () => {
    peerTrustInternals.saveToStorage(PUBKEY, stored, "profile-a");

    expect(localStorage.getItem(getPeerTrustStorageKey(PUBKEY, "profile-a"))).toBeTruthy();
    expect(localStorage.getItem(getPeerTrustStorageKey(PUBKEY, "profile-b"))).toBeNull();
    expect(localStorage.getItem(getLegacyPeerTrustStorageKey(PUBKEY))).toBeNull();
    expect(peerTrustInternals.loadFromStorage(PUBKEY, "profile-a").acceptedPeers).toEqual([PEER]);
    expect(peerTrustInternals.loadFromStorage(PUBKEY, "profile-b").acceptedPeers).toEqual([]);
  });

  it("lets the default profile inherit unscoped rows once, without leaking to other profiles", () => {
    localStorage.setItem(getLegacyPeerTrustStorageKey(PUBKEY), JSON.stringify(stored));

    expect(peerTrustInternals.loadFromStorage(PUBKEY, "second-profile").acceptedPeers).toEqual([]);
    expect(peerTrustInternals.loadFromStorage(PUBKEY, "default").acceptedPeers).toEqual([PEER]);
    expect(localStorage.getItem(getPeerTrustStorageKey(PUBKEY, "default"))).toBeTruthy();
    expect(peerTrustInternals.loadFromStorage(PUBKEY, "second-profile").acceptedPeers).toEqual([]);
  });
});
