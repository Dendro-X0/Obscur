import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { resolvePeerTrustReadAuthority } from "./peer-trust-read-authority";

const PK_A = "aa".repeat(32) as PublicKeyHex;
const PK_B = "bb".repeat(32) as PublicKeyHex;

describe("resolvePeerTrustReadAuthority", () => {
  it("uses legacy storage before projection is promoted", () => {
    const decision = resolvePeerTrustReadAuthority({
      shouldUseProjectionReads: false,
      projectionReadAuthorityReason: "projection_not_ready",
      projectionAcceptedPeers: [],
      storedAcceptedPeers: [PK_B],
    });
    expect(decision.source).toBe("legacy");
    expect(decision.acceptedPeers).toEqual([PK_B]);
  });

  it("holds legacy contacts when projection cutover would empty the list", () => {
    const decision = resolvePeerTrustReadAuthority({
      shouldUseProjectionReads: true,
      projectionReadAuthorityReason: "read_cutover_enabled",
      projectionAcceptedPeers: [],
      storedAcceptedPeers: [PK_B],
    });
    expect(decision.source).toBe("legacy_hold");
    expect(decision.holdReason).toBe("projection_empty_legacy_nonempty");
    expect(decision.acceptedPeers).toEqual([PK_B]);
  });

  it("uses projection when it has accepted peers", () => {
    const decision = resolvePeerTrustReadAuthority({
      shouldUseProjectionReads: true,
      projectionReadAuthorityReason: "read_cutover_enabled",
      projectionAcceptedPeers: [PK_A],
      storedAcceptedPeers: [PK_B],
    });
    expect(decision.source).toBe("projection");
    expect(decision.acceptedPeers).toEqual([PK_A]);
  });
});
