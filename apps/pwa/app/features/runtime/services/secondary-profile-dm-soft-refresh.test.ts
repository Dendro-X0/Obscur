import { beforeEach, describe, expect, it, vi } from "vitest";

const repairMocks = vi.hoisted(() => ({
  inviteRepair: vi.fn(() => [{ id: "invite-1" }]),
  outgoingRepair: vi.fn(() => [{ id: "msg-1" }]),
  dispatch: vi.fn(),
  chatLoad: vi.fn(() => ({
    messagesByConversationId: {
      "a:b": [{ id: "x" }],
    },
  })),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => true,
}));

vi.mock("@/app/features/messaging/services/dm-conversation-native-invite-repair", () => ({
  loadNativeOutgoingCommunityInviteRepairMessages: repairMocks.inviteRepair,
}));

vi.mock("@/app/features/messaging/services/dm-conversation-native-outgoing-repair", () => ({
  loadNativeOutgoingChatStateRepairMessages: repairMocks.outgoingRepair,
}));

vi.mock("@/app/features/messaging/services/message-persistence-service", () => ({
  dispatchMessagesIndexRebuiltEvent: repairMocks.dispatch,
}));

vi.mock("@/app/features/messaging/services/chat-state-store", () => ({
  chatStateStoreService: {
    load: repairMocks.chatLoad,
  },
}));

vi.mock("@/app/features/profiles/services/account-shared-sqlite-profile-ids", () => ({
  listAccountSharedSqliteProfileIds: ({ primaryProfileId }: { primaryProfileId: string }) => [primaryProfileId],
}));

import { runSecondaryProfileDmSoftRefresh } from "./secondary-profile-dm-soft-refresh";

describe("runSecondaryProfileDmSoftRefresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("repairs outgoing messages and dispatches refresh events for secondary profiles", () => {
    const listener = vi.fn();
    window.addEventListener("obscur:secondary-profile-dm-soft-refresh", listener);

    const result = runSecondaryProfileDmSoftRefresh({
      profileId: "profile-2",
      myPublicKeyHex: "a".repeat(64) as any,
      reason: "post_login",
    });

    expect(result.repairedMessageCount).toBe(2);
    expect(repairMocks.dispatch).toHaveBeenCalled();
    expect(listener).toHaveBeenCalled();

    window.removeEventListener("obscur:secondary-profile-dm-soft-refresh", listener);
  });

  it("skips default profile windows", () => {
    const result = runSecondaryProfileDmSoftRefresh({
      profileId: "default",
      myPublicKeyHex: "a".repeat(64) as any,
      reason: "post_login",
    });
    expect(result.repairedMessageCount).toBe(0);
    expect(repairMocks.inviteRepair).not.toHaveBeenCalled();
  });
});
