import { describe, expect, it, vi, beforeEach } from "vitest";
import type { GroupConversation } from "@/app/features/messaging/types";
import { persistCommunityDescriptorUpdate } from "./community-descriptor-mutation-owner";

const GROUP_ID = "d56bc22fd0164c54840c5ce3cbc7df1a";
const PUBLIC_KEY = "a".repeat(64);

const baseGroup = (): GroupConversation => ({
  kind: "group",
  id: `group:${GROUP_ID}:wss://nos.lol`,
  groupId: GROUP_ID,
  relayUrl: "wss://nos.lol",
  displayName: GROUP_ID,
  memberPubkeys: [PUBLIC_KEY],
  adminPubkeys: [PUBLIC_KEY],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(),
  access: "invite-only",
  memberCount: 1,
});

vi.mock("./community-membership-mutation-owner", () => ({
  persistCommunityMembershipLedgerMutation: vi.fn(),
}));

describe("persistCommunityDescriptorUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists human display name over hex group id", async () => {
    const { persistCommunityMembershipLedgerMutation } = await import("./community-membership-mutation-owner");

    persistCommunityDescriptorUpdate({
      publicKeyHex: PUBLIC_KEY,
      group: baseGroup(),
      displayName: "NewTest 1",
    });

    expect(persistCommunityMembershipLedgerMutation).toHaveBeenCalled();
    const mutation = vi.mocked(persistCommunityMembershipLedgerMutation).mock.calls[0]?.[1];
    expect(mutation?.reason).toBe("descriptor_updated");
    expect(mutation?.entry.displayName).toBe("NewTest 1");
  });
});
