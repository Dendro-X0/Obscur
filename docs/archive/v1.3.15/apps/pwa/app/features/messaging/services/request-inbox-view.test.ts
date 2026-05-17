import { describe, expect, it } from "vitest";
import type { RequestsInboxItem } from "../types";
import {
  getIncomingInboxRequests,
  getIncomingPendingRequestCount,
  getIncomingUnreadRequestTotal,
  isIncomingPendingRequest,
  isOutgoingPendingRequest,
} from "./request-inbox-view";

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

describe("request inbox view helpers", () => {
  it("classifies incoming vs outgoing pending requests correctly", () => {
    expect(isIncomingPendingRequest(makeItem({ isOutgoing: false, status: "pending" }))).toBe(true);
    expect(isIncomingPendingRequest(makeItem({ isOutgoing: true, status: "pending" }))).toBe(false);
    expect(isOutgoingPendingRequest(makeItem({ isOutgoing: true, status: "pending" }))).toBe(true);
    expect(isOutgoingPendingRequest(makeItem({ isOutgoing: false, status: "pending" }))).toBe(false);
  });

  it("keeps only incoming pending requests in the receiver inbox view", () => {
    const items: RequestsInboxItem[] = [
      makeItem({ peerPublicKeyHex: "1".repeat(64) as any, isOutgoing: false }),
      makeItem({ peerPublicKeyHex: "2".repeat(64) as any, isOutgoing: true }),
      makeItem({ peerPublicKeyHex: "3".repeat(64) as any, isOutgoing: false, status: "accepted" }),
    ];

    expect(getIncomingInboxRequests(items).map((item) => item.peerPublicKeyHex)).toEqual([
      "1".repeat(64),
    ]);
  });

  it("counts only incoming pending and unread requests", () => {
    const items: RequestsInboxItem[] = [
      makeItem({ isOutgoing: false, status: "pending", unreadCount: 2 }),
      makeItem({ isOutgoing: true, status: "pending", unreadCount: 5 }),
      makeItem({ isOutgoing: false, status: "accepted", unreadCount: 3 }),
    ];

    expect(getIncomingPendingRequestCount(items)).toBe(1);
    expect(getIncomingUnreadRequestTotal(items)).toBe(5);
  });
});
