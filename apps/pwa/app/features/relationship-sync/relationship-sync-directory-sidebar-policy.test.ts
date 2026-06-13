import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  isSelfListedAsTerminalInDirectory,
  qualifiesForDirectoryIncompleteRejoinRepair,
} from "./relationship-sync-directory-sidebar-policy";

const PK_A = "aa".repeat(32) as PublicKeyHex;
const PK_B = "bb".repeat(32) as PublicKeyHex;
const PROFILE_ID = "default";
const RELAY = "ws://localhost:7000";

vi.mock("@/app/features/groups/services/community-leave-outbox", () => ({
  readCommunityLeaveOutbox: vi.fn(() => []),
}));

import { readCommunityLeaveOutbox } from "@/app/features/groups/services/community-leave-outbox";

describe("relationship-sync-directory-sidebar-policy", () => {
  beforeEach(() => {
    vi.mocked(readCommunityLeaveOutbox).mockReturnValue([]);
  });

  it("blocks repair when self is listed as left in directory", () => {
    expect(isSelfListedAsTerminalInDirectory({
      activeMemberPubkeys: [PK_A],
      leftMemberPubkeys: [PK_B],
      expelledMemberPubkeys: [],
      headSeq: 2,
    }, PK_B)).toBe(true);
  });

  it("allows incomplete rejoin when directory active, terminal ledger, no leave outbox", () => {
    expect(qualifiesForDirectoryIncompleteRejoinRepair({
      publicKeyHex: PK_B,
      profileId: PROFILE_ID,
      groupId: "newtest-2",
      relayUrl: RELAY,
      materialization: {
        activeMemberPubkeys: [PK_A, PK_B],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        headSeq: 3,
      },
      ledger: [{
        communityId: "v2_newtest_2",
        groupId: "newtest-2",
        relayUrl: RELAY,
        status: "left",
      }],
    })).toBe(true);
  });

  it("blocks repair when leave outbox still records intentional leave", () => {
    vi.mocked(readCommunityLeaveOutbox).mockReturnValue([{
      id: "leave-1",
      publicKeyHex: PK_B,
      groupId: "newtest-1",
      relayUrl: RELAY,
      communityId: "v2_newtest_1",
      intentUnixMs: Date.now(),
      status: "published",
      attemptCount: 1,
    }]);

    expect(qualifiesForDirectoryIncompleteRejoinRepair({
      publicKeyHex: PK_B,
      profileId: PROFILE_ID,
      groupId: "newtest-1",
      relayUrl: RELAY,
      materialization: {
        activeMemberPubkeys: [PK_A, PK_B],
        leftMemberPubkeys: [],
        expelledMemberPubkeys: [],
        headSeq: 3,
      },
      ledger: [{
        communityId: "v2_newtest_1",
        groupId: "newtest-1",
        relayUrl: RELAY,
        status: "left",
      }],
    })).toBe(false);
  });
});
