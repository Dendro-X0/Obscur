import { describe, expect, it } from "vitest";
import type { RequestsInboxItem } from "../types";
import {
  getIncomingInboxRequests,
  getIncomingPendingRequestCount,
  getIncomingUnreadRequestTotal,
  getOpenPendingRequestCount,
  getOpenPendingRequests,
  getRequestsTabItems,
  isIncomingPendingRequest,
  isOutgoingPendingRequest,
  partitionOpenRequestsByLane,
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

  it("includes outgoing pending requests in the open Requests tab view", () => {
    const items: RequestsInboxItem[] = [
      makeItem({ peerPublicKeyHex: "1".repeat(64) as any, isOutgoing: false }),
      makeItem({ peerPublicKeyHex: "2".repeat(64) as any, isOutgoing: true }),
      makeItem({ peerPublicKeyHex: "3".repeat(64) as any, isOutgoing: false, status: "accepted" }),
    ];

    expect(getOpenPendingRequests(items).map((item) => item.peerPublicKeyHex)).toEqual([
      "1".repeat(64),
      "2".repeat(64),
    ]);
    expect(getIncomingInboxRequests(items).map((item) => item.peerPublicKeyHex)).toEqual([
      "1".repeat(64),
    ]);
  });

  it("treats missing status as pending for outgoing request rows", () => {
    const items: RequestsInboxItem[] = [
      makeItem({ peerPublicKeyHex: "2".repeat(64) as any, isOutgoing: true, status: undefined }),
    ];

    expect(getRequestsTabItems(items)).toHaveLength(1);
    expect(partitionOpenRequestsByLane(items).inbox).toHaveLength(1);
  });

  it("routes outgoing pending rows to the main Requests lane", () => {
    const items: RequestsInboxItem[] = [
      makeItem({ peerPublicKeyHex: "2".repeat(64) as any, isOutgoing: true }),
    ];
    const partitioned = partitionOpenRequestsByLane(items);
    expect(partitioned.inbox).toHaveLength(1);
    expect(partitioned.inbox[0]?.isOutgoing).toBe(true);
  });

  it("keeps outgoing declined rows visible for resend", () => {
    const items: RequestsInboxItem[] = [
      makeItem({ peerPublicKeyHex: "2".repeat(64) as any, isOutgoing: true, status: "declined" }),
      makeItem({ peerPublicKeyHex: "3".repeat(64) as any, isOutgoing: false, status: "accepted" }),
    ];
    const partitioned = partitionOpenRequestsByLane(items);
    expect(partitioned.inbox).toHaveLength(1);
    expect(partitioned.inbox[0]?.status).toBe("declined");
    expect(getRequestsTabItems(items)).toHaveLength(1);
    expect(getOpenPendingRequestCount(items)).toBe(0);
  });

  it("counts open pending requests for tab badges", () => {
    const items: RequestsInboxItem[] = [
      makeItem({ isOutgoing: false, status: "pending", unreadCount: 2 }),
      makeItem({ isOutgoing: true, status: "pending", unreadCount: 0 }),
      makeItem({ isOutgoing: false, status: "accepted", unreadCount: 3 }),
    ];

    expect(getIncomingPendingRequestCount(items)).toBe(1);
    expect(getOpenPendingRequestCount(items)).toBe(2);
    expect(getIncomingUnreadRequestTotal(items)).toBe(5);
  });
});
