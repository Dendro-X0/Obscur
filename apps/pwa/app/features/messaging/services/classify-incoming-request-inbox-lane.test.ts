import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { classifyIncomingRequestInboxLane } from "./classify-incoming-request-inbox-lane";
import type { RequestsInboxItem } from "@/app/features/messaging/types";

const PEER = "a".repeat(64) as PublicKeyHex;
const NOW_MS = 1_700_000_000_000;

const createItem = (preview: string): RequestsInboxItem => ({
  peerPublicKeyHex: PEER,
  lastMessagePreview: preview,
  lastReceivedAtUnixSeconds: Math.floor(NOW_MS / 1000),
  unreadCount: 1,
  status: "pending",
  isRequest: true,
  isOutgoing: false,
});

describe("classifyIncomingRequestInboxLane", () => {
  it("keeps benign stranger invitations in the primary inbox", () => {
    expect(classifyIncomingRequestInboxLane({
      item: createItem("Hi — would love to connect."),
      nowUnixMs: NOW_MS,
    })).toBe("inbox");
  });

  it("routes social-engineering invitation copy to junk", () => {
    expect(classifyIncomingRequestInboxLane({
      item: createItem("Urgent: verify your wallet seed phrase at http://bit.ly/support-login"),
      nowUnixMs: NOW_MS,
    })).toBe("junk");
  });

  it("routes financial-pressure invitations to junk", () => {
    expect(classifyIncomingRequestInboxLane({
      item: createItem("Please wire $500 today via gift cards before this offer expires."),
      nowUnixMs: NOW_MS,
    })).toBe("junk");
  });
});
