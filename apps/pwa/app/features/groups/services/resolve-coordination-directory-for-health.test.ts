import { describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const loadDirectory = vi.fn();

vi.mock("./community-coordination-membership-directory-store", () => ({
  loadCoordinationMembershipDirectory: (...args: unknown[]) => loadDirectory(...args),
}));

import { resolveCoordinationDirectoryForMemberHealth } from "./resolve-coordination-directory-for-health";

const member = "aa".repeat(32) as PublicKeyHex;
const peer = "cc".repeat(32) as PublicKeyHex;

describe("resolveCoordinationDirectoryForMemberHealth", () => {
  it("prefers a candidate directory that lists the local member", () => {
    loadDirectory.mockImplementation((communityId: string) => {
      if (communityId === "legacy:g1") {
        return {
          activeMemberPubkeys: [peer],
          leftMemberPubkeys: [],
          expelledMemberPubkeys: [],
          headSeq: 1,
        };
      }
      if (communityId === "v2_abc") {
        return {
          activeMemberPubkeys: [member, peer],
          leftMemberPubkeys: [],
          expelledMemberPubkeys: [],
          headSeq: 4,
        };
      }
      return null;
    });

    const resolved = resolveCoordinationDirectoryForMemberHealth({
      communityId: "legacy:g1",
      communityIdCandidates: ["legacy:g1", "v2_abc"],
      localMemberPubkey: member,
      primaryDirectory: {
        activeMemberPubkeys: [peer],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        headSeq: 1,
      },
    });

    expect(resolved?.activeMemberPubkeys).toEqual([member, peer]);
  });
});
