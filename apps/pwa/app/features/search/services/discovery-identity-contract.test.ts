import { describe, expect, it } from "vitest";
import { resolvePrimaryDiscoverySource, toDiscoveryIdentity } from "./discovery-identity-contract";
import type { DiscoveryResult } from "@/app/features/search/types/discovery";

const baseResult: DiscoveryResult = {
  canonicalId: "pk-test",
  kind: "person",
  display: {
    title: "Alice",
    subtitle: "alice@example.com",
    description: "hello",
    picture: "https://example.com/avatar.jpg",
    pubkey: "f".repeat(64),
    inviteCode: "OBSCUR-ABCD12",
  },
  confidence: "relay_confirmed",
  sources: ["relay"],
  score: 77,
  freshnessUnixMs: 1,
};

describe("discovery-identity-contract", () => {
  it("maps discovery result to canonical discovery identity", () => {
    const identity = toDiscoveryIdentity(baseResult);
    expect(identity).toEqual(expect.objectContaining({
      canonicalId: "pk-test",
      pubkey: "f".repeat(64),
      inviteCode: "OBSCUR-ABCD12",
      displayName: "Alice",
      verification: {
        confidence: "relay_confirmed",
        status: "verified",
      },
      provenance: {
        primarySource: "relay",
        sources: ["relay"],
      },
    }));
  });

  it("returns mixed when multiple sources are present", () => {
    expect(resolvePrimaryDiscoverySource(["local", "relay"])).toBe("mixed");
  });

  it("returns null when result has no pubkey", () => {
    const identity = toDiscoveryIdentity({
      ...baseResult,
      display: {
        ...baseResult.display,
        pubkey: undefined,
      },
      kind: "community",
    });
    expect(identity).toBeNull();
  });
});
