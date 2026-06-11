import { describe, expect, it, vi } from "vitest";
import type { DmConversation } from "../types";
import {
  resolveNativeDmSidebarConnections,
  shouldNativeDmSkipChatStateSidebarConnectionHydrate,
} from "./native-dm-conversation-list-owner";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

const conversation = (id: string, peer: string, timeMs: number): DmConversation => ({
  kind: "dm",
  id,
  pubkey: peer as DmConversation["pubkey"],
  displayName: peer.slice(0, 8),
  lastMessage: "preview",
  unreadCount: 0,
  lastMessageTime: new Date(timeMs),
});

describe("native-dm-conversation-list-owner", () => {
  it("sorts sqlite sidebar rows by last message time", () => {
    const peerA = "a".repeat(64);
    const peerB = "b".repeat(64);
    const merged = resolveNativeDmSidebarConnections([
      conversation(`${peerA}:${peerB}`, peerB, 100),
      conversation(`${peerB}:${peerA}`, peerA, 200),
    ]);
    expect(merged[0]?.lastMessageTime.getTime()).toBe(200);
  });

  it("skips chat-state sidebar hydrate on native sqlite owner", () => {
    expect(shouldNativeDmSkipChatStateSidebarConnectionHydrate()).toBe(true);
  });
});
