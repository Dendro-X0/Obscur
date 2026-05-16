import { describe, expect, it } from "vitest";
import type { Message } from "../types";
import { encodeDmDeleteCommandV1 } from "../deletion/delete-command-codec";
import { resolveDmRemoteDeleteIdentityIds } from "./resolve-dm-remote-delete-identity-ids";

const makeMessage = (overrides: Partial<Message>): Message => ({
  id: "local-id",
  kind: "user",
  content: "test",
  timestamp: new Date(),
  isOutgoing: false,
  status: "delivered",
  conversationId: "conv",
  ...overrides,
});

describe("resolveDmRemoteDeleteIdentityIds", () => {
  it("expands to all aliases when a local row partially matches", () => {
    const rumorId = "rumor-id-64-chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const wrapId = "wrap-id-64-chars-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const local = makeMessage({
      id: rumorId,
      eventId: rumorId,
      relayPublishedEventId: wrapId,
    });

    const resolved = resolveDmRemoteDeleteIdentityIds({
      targetMessageIds: [wrapId],
      localMessages: [local],
    });

    expect(resolved).toContain(rumorId);
    expect(resolved).toContain(wrapId);
  });

  it("merges ids from decoded delete payload", () => {
    const payload = encodeDmDeleteCommandV1({
      conversationId: "a:b",
      targetMessageIdentityIds: ["target-a"],
      targetAuthorPubkey: "aa".repeat(32),
      deletedByPubkey: "aa".repeat(32),
    });

    const resolved = resolveDmRemoteDeleteIdentityIds({
      targetMessageIds: ["target-b"],
      plaintext: payload,
    });

    expect(resolved).toContain("target-a");
    expect(resolved).toContain("target-b");
  });
});
