import { describe, expect, it, vi, beforeEach } from "vitest";
import type { GroupConversation } from "@/app/features/messaging/types";
import { persistCommunityGovernanceMemberExpelled } from "./community-governance-mutation-owner";

const GROUP_ID = "d56bc22fd0164c54840c5ce3cbc7df1a";
const OPERATOR_PK = "a".repeat(64);
const TARGET_PK = "b".repeat(64);

const baseGroup = (): GroupConversation => ({
  kind: "group",
  id: `group:${GROUP_ID}:wss://nos.lol`,
  groupId: GROUP_ID,
  relayUrl: "wss://nos.lol",
  displayName: "Governed Community",
  memberPubkeys: [OPERATOR_PK, TARGET_PK],
  adminPubkeys: [OPERATOR_PK],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(),
  access: "invite-only",
  memberCount: 2,
});

vi.mock("./community-membership-mutation-owner", () => ({
  persistCommunityMembershipLedgerMutation: vi.fn(),
}));

describe("persistCommunityGovernanceMemberExpelled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tags operator ledger with governance_member_expelled while joined", async () => {
    const { persistCommunityMembershipLedgerMutation } = await import("./community-membership-mutation-owner");

    persistCommunityGovernanceMemberExpelled({
      publicKeyHex: OPERATOR_PK,
      group: baseGroup(),
      targetPublicKeyHex: TARGET_PK,
      lastEvidenceEventId: "evt-gov-expel",
    });

    const mutation = vi.mocked(persistCommunityMembershipLedgerMutation).mock.calls[0]?.[1];
    expect(mutation?.reason).toBe("governance_member_expelled");
    expect(mutation?.entry.status).toBe("joined");
    expect(mutation?.entry.lastEvidenceEventId).toBe("evt-gov-expel");
  });

  it("persists expelled status when local user is governance target", async () => {
    const { persistCommunityMembershipLedgerMutation } = await import("./community-membership-mutation-owner");

    persistCommunityGovernanceMemberExpelled({
      publicKeyHex: TARGET_PK,
      group: baseGroup(),
      targetPublicKeyHex: TARGET_PK,
    });

    const mutation = vi.mocked(persistCommunityMembershipLedgerMutation).mock.calls[0]?.[1];
    expect(mutation?.reason).toBe("governance_member_expelled");
    expect(mutation?.entry.status).toBe("expelled");
  });
});
