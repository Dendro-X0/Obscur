import { describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "../lib/message-queue";
import { prepareOutgoingDm } from "./outgoing-dm-send-preparer";

const SENDER_PUBKEY = "a".repeat(64) as PublicKeyHex;
const RECIPIENT_PUBKEY = "b".repeat(64) as PublicKeyHex;

const buildStateHarness = () => {
  let state = { messages: [] as ReadonlyArray<Message> };
  const setState = vi.fn((updater: ((prev: typeof state) => typeof state) | typeof state) => {
    state = typeof updater === "function" ? updater(state) : updater;
  });
  return {
    getState: () => state,
    setState,
  };
};

describe("outgoing-dm-send-preparer", () => {
  it("persists canonical event id for nip17 rows while keeping wrapper id as local row id", async () => {
    const harness = buildStateHarness();
    const pendingMessages = new Map<string, Message>();
    const relayRequestTimes = new Map<string, number>();

    const result = await prepareOutgoingDm({
      build: {
        format: "nip17",
        signedEvent: {
          id: "gift-wrap-id-1",
          kind: 1059,
          created_at: 1_700_000_123,
          pubkey: SENDER_PUBKEY,
          sig: "c".repeat(128),
          content: "ciphertext",
          tags: [["p", RECIPIENT_PUBKEY]],
        },
        encryptedContent: "ciphertext",
        canonicalEventId: "rumor-id-1",
      },
      plaintext: "hello",
      createdAtUnixSeconds: 1_700_000_123,
      myPublicKeyHex: SENDER_PUBKEY,
      recipientPubkey: RECIPIENT_PUBKEY,
      maxMessagesInMemory: 200,
      extractAttachmentsFromContent: () => [],
      messageQueue: null,
      setState: harness.setState,
      createReadyState: (messages) => ({ messages }),
      messageMemoryManager: { addMessages: () => undefined },
      getExistingMessagesForOptimisticInsert: (prev) => prev.messages,
      pendingMessages,
      relayRequestTimes,
    });

    expect(result.initialMessage.id).toBe("gift-wrap-id-1");
    expect(result.initialMessage.eventId).toBe("rumor-id-1");
    expect(harness.getState().messages[0]?.eventId).toBe("rumor-id-1");
    expect(pendingMessages.has("gift-wrap-id-1")).toBe(true);
  });
});
