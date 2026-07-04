import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { resolveWorkspaceKernelParticipantPubkeys } from "./resolve-workspace-kernel-participant-pubkeys";

const PK_A = "aa".repeat(32) as PublicKeyHex;
const PK_B = "bb".repeat(32) as PublicKeyHex;

describe("resolveWorkspaceKernelParticipantPubkeys", () => {
  it("returns coordination active members minus terminal state", () => {
    const pubkeys = resolveWorkspaceKernelParticipantPubkeys({
      communityId: "room:ws://localhost:7000",
      communityMode: "managed_workspace",
      relayUrl: "ws://localhost:7000",
      localMemberPubkey: PK_A,
      coordinationDirectory: {
        activeMemberPubkeys: [PK_A, PK_B],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        headSeq: 3,
      },
    });
    expect(pubkeys).toEqual([PK_A, PK_B]);
  });

  it("excludes left and expelled members from coordination directory", () => {
    const pubkeys = resolveWorkspaceKernelParticipantPubkeys({
      communityId: "room:ws://localhost:7000",
      communityMode: "managed_workspace",
      relayUrl: "ws://localhost:7000",
      coordinationDirectory: {
        activeMemberPubkeys: [PK_A, PK_B],
        leftMemberPubkeys: [PK_B],
        expelledMemberPubkeys: [],
        headSeq: 4,
      },
    });
    expect(pubkeys).toEqual([PK_A]);
  });
});
