import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { DmConversation, GroupConversation } from "../../messaging/types";
import { usePinnedDmForMessageHook } from "./use-pinned-dm-for-message-hook";

const dm: DmConversation = {
  kind: "dm",
  id: "dm:a:b",
  pubkey: "b".repeat(64) as DmConversation["pubkey"],
  displayName: "Tester2",
  lastMessage: "test",
  unreadCount: 0,
  lastMessageTime: new Date(),
};

const group: GroupConversation = {
  kind: "group",
  id: "community:g1",
  communityId: "g1",
  groupId: "g1",
  relayUrl: "wss://localhost:7000",
  displayName: "Group 1",
  memberPubkeys: [],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(),
  access: "open",
  memberCount: 1,
  adminPubkeys: [],
};

describe("usePinnedDmForMessageHook", () => {
  it("keeps the last DM bound while a group is selected", () => {
    const { result, rerender } = renderHook(
      ({ selected }) => usePinnedDmForMessageHook(selected),
      { initialProps: { selected: dm as DmConversation | GroupConversation } },
    );
    expect(result.current?.id).toBe("dm:a:b");

    rerender({ selected: group });
    expect(result.current?.id).toBe("dm:a:b");
    expect(result.current?.kind).toBe("dm");
  });
});
