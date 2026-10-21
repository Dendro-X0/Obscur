import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getDefaultProfileId } from "@/app/features/profiles/services/profile-scope";
import {
  canInheritUnscopedPeerTrust,
  getLegacyPeerTrustStorageKey,
  getPeerTrustStorageKey,
} from "./peer-trust-storage-key";

const PUBKEY = "a".repeat(64) as PublicKeyHex;

describe("peer-trust-storage-key (Containment D)", () => {
  it("scopes the storage key by profileId", () => {
    const legacy = getLegacyPeerTrustStorageKey(PUBKEY);
    const profileA = getPeerTrustStorageKey(PUBKEY, "profile-a");
    const profileB = getPeerTrustStorageKey(PUBKEY, "profile-b");

    expect(legacy).toBe(`obscur.peer_trust.v1.${PUBKEY}`);
    expect(profileA).toBe(`${legacy}::profile-a`);
    expect(profileB).toBe(`${legacy}::profile-b`);
    expect(profileA).not.toBe(profileB);
  });

  it("allows unscoped inheritance only for the default profile", () => {
    expect(canInheritUnscopedPeerTrust(getDefaultProfileId())).toBe(true);
    expect(canInheritUnscopedPeerTrust("second-profile")).toBe(false);
  });
});
