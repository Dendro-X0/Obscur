import { describe, expect, it } from "vitest";
import type { DmConversation, RequestsInboxItem } from "../types";
import { buildSidebarRequestsInboxItems } from "./request-sidebar-items";

const makeItem = (overrides: Partial<RequestsInboxItem>): RequestsInboxItem => ({
  peerPublicKeyHex: "a".repeat(64) as any,
  lastMessagePreview: "",
  lastReceivedAtUnixSeconds: 1,
  unreadCount: 0,
  status: "pending",
  isRequest: true,
  isOutgoing: false,
  ...overrides,
});

describe("buildSidebarRequestsInboxItems", () => {
  it("includes outgoing pending and declined rows from the inbox", () => {
    const items = buildSidebarRequestsInboxItems({
      inboxItems: [
        makeItem({ peerPublicKeyHex: "1".repeat(64) as any, isOutgoing: true }),
        makeItem({ peerPublicKeyHex: "2".repeat(64) as any, isOutgoing: true, status: "declined" }),
      ],
      createdConnections: [],
      isPeerAcceptedByTrust: () => false,
      getRequestStatus: () => null,
    });

    expect(items.map((item) => item.peerPublicKeyHex)).toEqual([
      "1".repeat(64),
      "2".repeat(64),
    ]);
  });

  it("backfills legacy orphan DM threads into the requests tab", () => {
    const peer = "b".repeat(64) as any;
    const items = buildSidebarRequestsInboxItems({
      inboxItems: [],
      createdConnections: [{
        kind: "dm",
        id: "dm-1",
        pubkey: peer,
        displayName: "DemoUser",
        lastMessage: "Hello",
        unreadCount: 0,
        lastMessageTime: new Date(),
      } satisfies DmConversation],
      isPeerAcceptedByTrust: () => false,
      getRequestStatus: () => ({ status: undefined, isOutgoing: false }),
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.peerPublicKeyHex).toBe(peer);
    expect(items[0]?.isOutgoing).toBe(false);
  });
});
