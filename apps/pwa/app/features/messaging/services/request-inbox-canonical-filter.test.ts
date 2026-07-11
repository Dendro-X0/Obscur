import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { RequestsInboxItem } from "@/app/features/messaging/types";
import {
  filterCanonicalContactRequestInboxItems,
  isCanonicalContactRequestInboxItem,
  isLikelyPlainDmOrphanRequest,
} from "./request-inbox-canonical-filter";

const PEER = ("a".repeat(64)) as PublicKeyHex;

const item = (overrides: Partial<RequestsInboxItem>): RequestsInboxItem => ({
  peerPublicKeyHex: PEER,
  lastMessagePreview: "Hello",
  lastReceivedAtUnixSeconds: 1,
  unreadCount: 0,
  ...overrides,
});

describe("request-inbox-canonical-filter", () => {
  it("keeps incoming pending rows with connection-request evidence", () => {
    expect(isCanonicalContactRequestInboxItem(item({
      isRequest: true,
      status: "pending",
      eventId: "evt-1",
    }))).toBe(true);
  });

  it("keeps persisted pending requests without eventId when isRequest is set", () => {
    expect(isCanonicalContactRequestInboxItem(item({
      isRequest: true,
      status: "pending",
      lastMessagePreview: "Hello! I'd like to connect on Obscur.",
    }))).toBe(true);
  });

  it("rejects legacy plain-DM orphan rows like GM-test", () => {
    expect(isLikelyPlainDmOrphanRequest(item({
      lastMessagePreview: "GM-test",
      status: "pending",
      isRequest: true,
    }))).toBe(true);
    expect(isCanonicalContactRequestInboxItem(item({
      lastMessagePreview: "GM-test",
      status: "pending",
      isRequest: true,
    }))).toBe(false);
  });

  it("keeps outgoing pending rows", () => {
    expect(isCanonicalContactRequestInboxItem(item({
      isOutgoing: true,
      status: "pending",
    }))).toBe(true);
  });

  it("filters mixed lists to canonical DM requests only", () => {
    const filtered = filterCanonicalContactRequestInboxItems([
      item({ isRequest: true, status: "pending", eventId: "evt-1" }),
      item({
        isRequest: true,
        status: "pending",
        lastMessagePreview: "Hello! I'd like to connect on Obscur.",
      }),
      item({ lastMessagePreview: "GM-test", status: "pending", isRequest: true }),
    ]);
    expect(filtered).toHaveLength(2);
  });
});
